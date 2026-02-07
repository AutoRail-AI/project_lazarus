import { type Job, Worker } from "bullmq"
import { env } from "@/env.mjs"
import { generateSlices } from "@/lib/ai/gemini-planner"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { createRightBrainClient } from "@/lib/mcp/right-brain-client"
import { runCodeSynapse } from "@/lib/workspaces/code-synapse-runner"
import { createRedisConnection } from "./redis"
import {
  type EmailJobData,
  type JobResult,
  type ProcessingJobData,
  type ProjectProcessingJobData,
  QUEUE_NAMES,
  type WebhookJobData,
} from "./types"

// Worker instances
const workers: Worker[] = []

/**
 * Email job processor
 * Customize this function to send emails via your email provider
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<JobResult> {
  const { to, subject: _subject, body: _body, templateId: _templateId, variables: _variables } = job.data

  console.log(`Processing email job ${job.id}: sending to ${to}`)

  try {
    // TODO: Implement your email sending logic here
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({ from: process.env.EMAIL_FROM, to, subject, html: body })

    // Simulate email sending for now
    await new Promise((resolve) => setTimeout(resolve, 100))

    console.log(`Email sent successfully to ${to}`)
    return { success: true, message: `Email sent to ${to}` }
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error)
    throw error // This will trigger retry
  }
}

/**
 * Processing job processor
 * Customize this for your long-running background tasks
 */
async function processProcessingJob(
  job: Job<ProcessingJobData>
): Promise<JobResult> {
  const { userId, taskId, payload } = job.data

  console.log(`Processing job ${job.id}: task ${taskId} for user ${userId}`)

  try {
    // TODO: Implement your processing logic here
    // This is where you'd handle long-running tasks like:
    // - File processing
    // - Data transformation
    // - Report generation
    // - AI/ML tasks

    // Update progress (visible in job status)
    await job.updateProgress(10)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await job.updateProgress(50)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await job.updateProgress(100)

    console.log(`Task ${taskId} completed successfully`)
    return { success: true, message: `Task ${taskId} completed`, data: payload }
  } catch (error) {
    console.error(`Task ${taskId} failed:`, error)
    throw error
  }
}

/**
 * Webhook job processor
 * Sends HTTP requests to external services
 */
async function processWebhookJob(job: Job<WebhookJobData>): Promise<JobResult> {
  const { url, method, headers, body } = job.data

  console.log(`Processing webhook job ${job.id}: ${method} ${url}`)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`)
    }

    const responseData = await response.json().catch(() => null)
    console.log(`Webhook to ${url} succeeded`)
    return { success: true, data: responseData }
  } catch (error) {
    console.error(`Webhook to ${url} failed:`, error)
    throw error
  }
}

/**
 * Insert a thought event into the agent_events table.
 */
async function insertThought(
  projectId: string,
  content: string,
  sliceId?: string
): Promise<void> {
  await (supabase as any).from("agent_events").insert({
    project_id: projectId,
    slice_id: sliceId ?? null,
    event_type: "thought",
    content,
  })
}

/**
 * Project processing job — orchestrates Left Brain → Right Brain → Gemini planner.
 */
async function processProjectJob(
  job: Job<ProjectProcessingJobData>
): Promise<JobResult> {
  const { projectId, userId, githubUrl, targetFramework } = job.data

  console.log(`[Project Processing] Starting for project ${projectId}`)

  try {
    await insertThought(projectId, "Beginning project analysis...")
    await job.updateProgress(5)

    let codeAnalysis: Record<string, unknown> = {}
    let behavioralAnalysis: Record<string, unknown> = {}
    let sandboxId: string | undefined

    // --- LEFT BRAIN ---
    if (githubUrl) {
      await (supabase as any)
        .from("projects")
        .update({ left_brain_status: "processing", updated_at: new Date().toISOString() })
        .eq("id", projectId)

      await insertThought(projectId, "Running Code-Synapse analysis on repository...")

      try {
        const { client, metadata } = await runCodeSynapse(projectId, githubUrl)
        sandboxId = metadata.sandboxId

        await job.updateProgress(20)
        await insertThought(projectId, "Extracting feature map...")

        const featureMap = await client.getFeatureMap(true)
        await job.updateProgress(30)

        await insertThought(projectId, "Analyzing slice dependencies...")
        const sliceDeps = await client.getSliceDependencies()
        await job.updateProgress(40)

        await insertThought(projectId, "Gathering project statistics...")
        const stats = await client.getProjectStats()
        await job.updateProgress(45)

        // Get migration context for each feature
        const features = (featureMap as { features?: Array<{ name: string }> })?.features || []
        const migrationContexts: Record<string, unknown> = {}

        for (const feature of features) {
          if (feature.name) {
            try {
              await insertThought(projectId, `Analyzing migration context for "${feature.name}"...`)
              migrationContexts[feature.name] = await client.getMigrationContext(feature.name)
            } catch (err: unknown) {
              console.warn(`Failed to get migration context for ${feature.name}:`, err)
            }
          }
        }

        await job.updateProgress(55)

        codeAnalysis = {
          featureMap,
          sliceDeps,
          stats,
          migrationContexts,
          mcpUrl: metadata.mcpUrl,
        }

        await (supabase as any)
          .from("projects")
          .update({ left_brain_status: "complete", updated_at: new Date().toISOString() })
          .eq("id", projectId)

        await insertThought(projectId, "Code analysis complete.")
      } catch (err: unknown) {
        console.error("[Left Brain] Failed:", err)
        await (supabase as any)
          .from("projects")
          .update({ left_brain_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", projectId)
        await insertThought(
          projectId,
          `Code analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      }
    }

    // --- RIGHT BRAIN ---
    if (env.RIGHT_BRAIN_MCP_URL) {
      // Check if project has assets
      const { data: assets } = await (supabase as any)
        .from("project_assets")
        .select("*")
        .eq("project_id", projectId) as { data: Array<{ storage_path: string }> | null }

      if (assets && assets.length > 0) {
        await (supabase as any)
          .from("projects")
          .update({ right_brain_status: "processing", updated_at: new Date().toISOString() })
          .eq("id", projectId)

        await insertThought(projectId, "Starting behavioral analysis with Right Brain...")

        try {
          const rbClient = createRightBrainClient()

          const s3Refs = assets.map((a) => a.storage_path)
          const ingestResult = await rbClient.startIngestion({
            website_url: githubUrl,
            knowledge_id: projectId,
            s3_references: s3Refs,
          })

          await job.updateProgress(65)

          const workflow = await rbClient.waitForWorkflow(ingestResult.job_id)

          if (workflow.status === "failed") {
            throw new Error(`Right Brain workflow failed: ${workflow.error}`)
          }

          await job.updateProgress(75)

          // Generate contracts for each feature
          const features = (codeAnalysis.featureMap as { features?: Array<{ name: string }> })?.features || []
          const contracts: Record<string, unknown> = {}

          for (const feature of features) {
            if (feature.name) {
              try {
                const contract = await rbClient.generateContract(projectId, feature.name)
                const leftBrainFormat = await rbClient.getContractLeftBrain(contract.contract_id)
                contracts[feature.name] = leftBrainFormat
              } catch (err: unknown) {
                console.warn(`Failed to generate contract for ${feature.name}:`, err)
              }
            }
          }

          behavioralAnalysis = { contracts, workflow }

          await (supabase as any)
            .from("projects")
            .update({ right_brain_status: "complete", updated_at: new Date().toISOString() })
            .eq("id", projectId)

          await insertThought(projectId, "Behavioral analysis complete.")
        } catch (err: unknown) {
          console.error("[Right Brain] Failed:", err)
          await (supabase as any)
            .from("projects")
            .update({ right_brain_status: "failed", updated_at: new Date().toISOString() })
            .eq("id", projectId)
          await insertThought(
            projectId,
            `Behavioral analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`
          )
        }
      }
    }

    await job.updateProgress(80)

    // --- GEMINI PLANNER ---
    await insertThought(projectId, "Generating vertical slices...")

    // Update project metadata with analysis results
    await (supabase as any)
      .from("projects")
      .update({
        metadata: {
          code_analysis: codeAnalysis,
          behavioral_analysis: behavioralAnalysis,
          ...(sandboxId ? { daytona_sandbox_id: sandboxId } : {}),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)

    // Fetch updated project for Gemini planner
    type Project = Database["public"]["Tables"]["projects"]["Row"]
    const { data: updatedProject } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single() as { data: Project | null }

    if (updatedProject) {
      const slices = await generateSlices(updatedProject)
      await job.updateProgress(90)

      // Insert slices into vertical_slices table
      if (slices.length > 0) {
        const sliceRows = slices.map((slice, index) => ({
          project_id: projectId,
          name: slice.name,
          description: slice.description || null,
          priority: slice.priority ?? index + 1,
          status: "pending" as const,
          behavioral_contract: slice.behavioral_contract || null,
          code_contract: slice.code_contract || null,
          modernization_flags: slice.modernization_flags || null,
          dependencies: slice.dependencies || [],
          confidence_score: 0,
          retry_count: 0,
        }))

        const { error: insertError } = await (supabase as any)
          .from("vertical_slices")
          .insert(sliceRows)

        if (insertError) {
          console.error("Failed to insert slices:", insertError)
        }
      }

      await insertThought(
        projectId,
        `Project ready! Generated ${slices.length} vertical slice${slices.length !== 1 ? "s" : ""}.`
      )
    }

    // Set project status to ready
    await (supabase as any)
      .from("projects")
      .update({ status: "ready" as const, updated_at: new Date().toISOString() })
      .eq("id", projectId)

    await job.updateProgress(100)

    console.log(`[Project Processing] Completed for project ${projectId}`)
    return { success: true, message: `Project ${projectId} processed successfully` }
  } catch (error: unknown) {
    console.error(`[Project Processing] Failed for project ${projectId}:`, error)

    // Reset project status on failure
    await (supabase as any)
      .from("projects")
      .update({
        status: "pending" as const,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)

    await insertThought(
      projectId,
      `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`
    )

    throw error
  }
}

/**
 * Start all workers
 * Call this when your application starts (e.g., in a separate worker process)
 */
export function startWorkers(): void {
  console.log("Starting job workers...")

  // Email worker
  // Use type assertion for connection to handle ioredis version compatibility
  const emailWorker = new Worker(QUEUE_NAMES.EMAIL, processEmailJob, {
    connection: createRedisConnection() as any,
    concurrency: 5,
  })
  workers.push(emailWorker)

  // Processing worker
  // Use type assertion for connection to handle ioredis version compatibility
  const processingWorker = new Worker(
    QUEUE_NAMES.PROCESSING,
    processProcessingJob,
    {
      connection: createRedisConnection() as any,
      concurrency: 3, // Lower concurrency for heavy tasks
    }
  )
  workers.push(processingWorker)

  // Webhooks worker
  // Use type assertion for connection to handle ioredis version compatibility
  const webhooksWorker = new Worker(QUEUE_NAMES.WEBHOOKS, processWebhookJob, {
    connection: createRedisConnection() as any,
    concurrency: 10,
  })
  workers.push(webhooksWorker)

  // Project processing worker
  const projectProcessingWorker = new Worker(
    QUEUE_NAMES.PROJECT_PROCESSING,
    processProjectJob,
    {
      connection: createRedisConnection() as any,
      concurrency: 1, // One project at a time
    }
  )
  workers.push(projectProcessingWorker)

  // Set up event handlers for all workers
  workers.forEach((worker) => {
    worker.on("completed", (job) => {
      console.log(`Job ${job.id} completed in queue ${worker.name}`)
    })

    worker.on("failed", (job, error) => {
      console.error(`Job ${job?.id} failed in queue ${worker.name}:`, error)
    })

    worker.on("error", (error) => {
      console.error(`Worker error in ${worker.name}:`, error)
    })
  })

  console.log("All workers started")
}

/**
 * Stop all workers gracefully
 */
export async function stopWorkers(): Promise<void> {
  console.log("Stopping workers...")
  await Promise.all(workers.map((w) => w.close()))
  workers.length = 0
  console.log("All workers stopped")
}
