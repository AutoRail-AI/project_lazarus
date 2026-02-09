import { type Job, Worker } from "bullmq"
import { env } from "@/env.mjs"
import { generateSlices } from "@/lib/ai/gemini-planner"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { processDemoProjectJob } from "@/lib/demo"
import { createRightBrainClient } from "@/lib/mcp/right-brain-client"
import {
  advancePipelineStep,
  clearErrorContext,
  loadCheckpoint,
  runBrainsInParallel,
  saveCheckpoint,
  setErrorContext,
  storeBuildJobId,
} from "@/lib/pipeline"
import type { PipelineCheckpoint, PipelineStep } from "@/lib/pipeline/types"
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
 * Project processing job — orchestrates Code Analysis → App Behaviour → Gemini planner.
 * Now with checkpoint support: skips completed steps on resume.
 */
async function processProjectJob(
  job: Job<ProjectProcessingJobData>
): Promise<JobResult> {
  // Demo mode: route to demo pipeline (real MCP + Gemini, no Daytona)
  if (env.DEMO_MODE) {
    console.log(`[Project Processing] DEMO_MODE active — using demo pipeline`)
    return processDemoProjectJob(job)
  }

  const { projectId, userId, githubUrl, targetFramework } = job.data

  console.log(`[Project Processing] Starting for project ${projectId}`)

  // Store job ID for cancellation support
  if (job.id) {
    await storeBuildJobId(projectId, job.id)
  }

  // Load existing checkpoint or initialize empty
  let checkpoint: PipelineCheckpoint = (await loadCheckpoint(projectId)) ?? {
    completed_steps: [],
    last_updated: new Date().toISOString(),
  }

  const isStepDone = (step: string) => checkpoint.completed_steps.includes(step as any)

  // Detect if this is a resumed job from the configure route.
  const brainsAlreadyDone = isStepDone("left_brain") && isStepDone("right_brain")

  // Clear any previous error context
  await clearErrorContext(projectId)

  try {
    await insertThought(projectId, brainsAlreadyDone ? "Resuming — generating implementation plan..." : "Beginning project analysis...")
    await job.updateProgress(5)

    let codeAnalysis: Record<string, unknown> = checkpoint.left_brain_result ?? {}
    let behavioralAnalysis: Record<string, unknown> = checkpoint.right_brain_result ?? {}
    let sandboxId: string | undefined = checkpoint.sandbox_id

    const needsLeftBrain = !isStepDone("left_brain")
    const needsRightBrain = !isStepDone("right_brain")

    // Pre-fetch App Behaviour prerequisites (assets check) before parallel execution
    let projectAssets: Array<{ storage_path: string }> = []
    if (needsRightBrain && env.RIGHT_BRAIN_API_URL) {
      const { data: assets } = await (supabase as any)
        .from("project_assets")
        .select("*")
        .eq("project_id", projectId) as { data: Array<{ storage_path: string }> | null }
      projectAssets = assets ?? []
    }

    // --- RUN BRAINS IN PARALLEL ---
    // Code Analysis (code structure) and App Behaviour (behavioral ingestion) run concurrently.
    // Contract generation happens after both complete (needs Code Analysis's featureMap).
    const brainResults = await runBrainsInParallel({
      projectId,
      runLeftBrain: needsLeftBrain && githubUrl
        ? async () => {
            await insertThought(projectId, "[Code Analysis] Running Code-Synapse analysis on repository...")

            const { client, metadata } = await runCodeSynapse(
              projectId,
              githubUrl,
              async (msg) => { await insertThought(projectId, `[Code Analysis] ${msg}`) },
              sandboxId ? { instanceId: sandboxId } : undefined
            )

            await job.updateProgress(20)
            await insertThought(projectId, "[Code Analysis] Building knowledge graph and extracting feature domains...")
            const featureMap = await client.deriveFeatureMap()
            await job.updateProgress(35)

            await insertThought(projectId, "[Code Analysis] Gathering project statistics...")
            const stats = await client.getStatsOverview()
            await job.updateProgress(45)

            await insertThought(projectId, `[Code Analysis] Found ${featureMap.totalFeatures} feature domains spanning ${featureMap.totalEntities} entities`)
            await insertThought(projectId, "[Code Analysis] Code analysis complete.")
            return {
              featureMap,
              stats,
              mcpUrl: metadata.mcpUrl,
              _sandboxId: metadata.sandboxId,
            }
          }
        : undefined,

      runRightBrain: needsRightBrain && env.RIGHT_BRAIN_API_URL && projectAssets.length > 0
        ? async () => {
            await insertThought(projectId, "[App Behaviour] Starting behavioral analysis...")

            const rbClient = createRightBrainClient()

            const s3Refs = projectAssets.map((a) => a.storage_path)
            const ingestResult = await rbClient.startIngestion({
              website_url: githubUrl,
              knowledge_id: projectId,
              s3_references: s3Refs,
            })

            await job.updateProgress(65)

            const workflow = await rbClient.waitForWorkflow(ingestResult.job_id)
            if (workflow.status === "failed") {
              throw new Error(`App Behaviour workflow failed: ${workflow.error}`)
            }

            await insertThought(projectId, "[App Behaviour] Ingestion workflow complete.")
            return { workflow }
          }
        : undefined,
    })

    // Handle Code Analysis results (non-fatal — slices can still be generated from available data)
    if (needsLeftBrain) {
      if (githubUrl) {
        if (!brainResults.leftBrain.success) {
          await insertThought(
            projectId,
            `Code analysis failed: ${brainResults.leftBrain.error ?? "Unknown error"}. Will proceed with available data.`
          )
          await setErrorContext(projectId, {
            step: "left_brain",
            message: brainResults.leftBrain.error ?? "Code Analysis failed",
            timestamp: new Date().toISOString(),
            retryable: true,
          })
        } else {
          codeAnalysis = brainResults.leftBrain.data
          sandboxId = codeAnalysis._sandboxId as string | undefined
        }
      }
    } else {
      console.log(`[Project Processing] Skipping left_brain (already done via checkpoint)`)
      await insertThought(projectId, "Code Analysis restored from checkpoint.")
    }

    // Handle App Behaviour results (non-critical — failure logged but pipeline continues)
    if (needsRightBrain) {
      if (brainResults.rightBrain.success && brainResults.rightBrain.data.workflow) {
        // Post-parallel step: generate contracts using Code Analysis's featureMap
        const rbClient = createRightBrainClient()
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

        behavioralAnalysis = { contracts, workflow: brainResults.rightBrain.data.workflow }
        await insertThought(projectId, "Behavioral analysis complete.")
      } else if (!brainResults.rightBrain.success && brainResults.rightBrain.error) {
        // App Behaviour failed — log but continue (non-critical)
        await insertThought(
          projectId,
          `Behavioral analysis failed: ${brainResults.rightBrain.error}`
        )
      }
    } else {
      console.log(`[Project Processing] Skipping right_brain (already done via checkpoint)`)
      await insertThought(projectId, "App Behaviour analysis restored from checkpoint.")
    }

    // Save combined checkpoint after both brains
    if (needsLeftBrain || needsRightBrain) {
      const newSteps: PipelineStep[] = [...checkpoint.completed_steps]
      if (needsLeftBrain && (githubUrl ? brainResults.leftBrain.success : true)) newSteps.push("left_brain")
      if (needsRightBrain) newSteps.push("right_brain")

      checkpoint = {
        ...checkpoint,
        completed_steps: newSteps,
        left_brain_result: codeAnalysis,
        right_brain_result: behavioralAnalysis,
        sandbox_id: sandboxId,
        mcp_url: (codeAnalysis.mcpUrl as string) ?? checkpoint.mcp_url,
      }
      await saveCheckpoint(projectId, checkpoint)
    }

    // --- PAUSE CHECK ---
    const { data: projectCheck } = await (supabase as any)
      .from("projects")
      .select("status")
      .eq("id", projectId)
      .single() as { data: { status: string } | null }
    if (projectCheck?.status === "paused") {
      console.log(`[Project Processing] Project ${projectId} paused, exiting gracefully.`)
      return { success: true, message: "Paused" }
    }

    await job.updateProgress(80)

    // --- ANALYSIS CHECKPOINT ---
    // If brains just completed (not a resume from configure), save metadata and stop
    // at 'analyzed' status so the user can review results and configure preferences.
    if (!isStepDone("planning") && !brainsAlreadyDone) {
      await (supabase as any)
        .from("projects")
        .update({
          status: "analyzed",
          metadata: {
            code_analysis: codeAnalysis,
            behavioral_analysis: behavioralAnalysis,
            ...(sandboxId ? { daytona_sandbox_id: sandboxId } : {}),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
      await insertThought(projectId, "Analysis complete. Awaiting configuration...")
      return { success: true, message: "Analysis complete — awaiting user configuration" }
    }

    // --- GEMINI PLANNER ---
    // Reached when resumed from configure route (brains already done via checkpoint)
    if (!isStepDone("planning")) {
      await advancePipelineStep(projectId, "planning")
      await insertThought(projectId, "Generating vertical slices...")

      // Re-read project to pick up boilerplate_url/tech_preferences from configure
      const { data: freshProject } = await (supabase as any)
        .from("projects")
        .select("metadata")
        .eq("id", projectId)
        .single() as { data: { metadata: Record<string, unknown> | null } | null }

      const existingMetadata = (freshProject?.metadata ?? {}) as Record<string, unknown>
      await (supabase as any)
        .from("projects")
        .update({
          metadata: {
            ...existingMetadata,
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
        let slices: Awaited<ReturnType<typeof generateSlices>> = []
        try {
          slices = await generateSlices(updatedProject, async (progress) => {
            if (progress.phase === "architect") {
              await insertThought(
                projectId,
                "Architect planning: generating migration architecture..."
              )
            } else {
              await insertThought(
                projectId,
                `Generating implementation guides batch ${progress.batch}/${progress.totalBatches}: ${progress.currentFeatures.join(", ")}${progress.slicesGenerated > 0 ? ` (${progress.slicesGenerated} generated so far)` : ""}`
              )
            }
          })
        } catch (geminiError: unknown) {
          const errMsg = geminiError instanceof Error ? geminiError.message : "Unknown error"
          console.error("[Project Processing] Gemini planner failed:", geminiError)
          await insertThought(projectId, `Gemini planner error: ${errMsg}`)
        }

        await job.updateProgress(90)

        // Only delete + replace slices if we generated new ones.
        // If Gemini failed (slices=[]), preserve any previously generated slices.
        if (slices.length > 0) {
          await (supabase as any)
            .from("vertical_slices")
            .delete()
            .eq("project_id", projectId)

          // Insert slices with empty dependencies first (column is UUID[])
          const sliceRows = slices.map((slice, index) => ({
            project_id: projectId,
            name: slice.name,
            description: slice.description || null,
            priority: slice.priority ?? index + 1,
            status: "pending" as const,
            behavioral_contract: slice.behavioral_contract || null,
            code_contract: slice.code_contract || null,
            modernization_flags: slice.modernization_flags || null,
            dependencies: [] as string[],
            confidence_score: 0,
            retry_count: 0,
          }))

          const { data: insertedSlices, error: insertError } = (await (supabase as any)
            .from("vertical_slices")
            .insert(sliceRows)
            .select("id, name")) as { data: Array<{ id: string; name: string }> | null; error: unknown }

          if (insertError) {
            console.error("Failed to insert slices:", insertError)
          }

          // Map dependency names → UUIDs and update each slice
          if (insertedSlices && insertedSlices.length > 0) {
            const nameToId = new Map<string, string>()
            for (const s of insertedSlices) {
              nameToId.set(s.name, s.id)
            }

            for (const slice of slices) {
              const sliceId = nameToId.get(slice.name)
              if (!sliceId || !slice.dependencies?.length) continue
              const depIds = slice.dependencies
                .map((depName) => nameToId.get(depName))
                .filter((id): id is string => !!id)
              if (depIds.length > 0) {
                await (supabase as any)
                  .from("vertical_slices")
                  .update({ dependencies: depIds })
                  .eq("id", sliceId)
              }
            }
          }
        }

        await insertThought(
          projectId,
          `Project ready! Generated ${slices.length} vertical slice${slices.length !== 1 ? "s" : ""}.`
        )
      }

      // Save checkpoint after planning
      checkpoint = {
        ...checkpoint,
        completed_steps: [...checkpoint.completed_steps, "planning"],
        slices_generated: true,
      }
      await saveCheckpoint(projectId, checkpoint)
    } else {
      console.log(`[Project Processing] Skipping planning (already done via checkpoint)`)
      await insertThought(projectId, "Planning step restored from checkpoint.")
    }

    // Set project status to ready, clear build_job_id
    await (supabase as any)
      .from("projects")
      .update({
        status: "ready" as const,
        build_job_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)

    await job.updateProgress(100)

    console.log(`[Project Processing] Completed for project ${projectId}`)
    return { success: true, message: `Project ${projectId} processed successfully` }
  } catch (error: unknown) {
    console.error(`[Project Processing] Failed for project ${projectId}:`, error)

    // Set error context with step info if not already set
    const currentStep = checkpoint.completed_steps[checkpoint.completed_steps.length - 1] ?? "init"
    await setErrorContext(projectId, {
      step: currentStep,
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      retryable: true,
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Reset project status on failure
    await (supabase as any)
      .from("projects")
      .update({
        status: "failed" as const,
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

  // Project processing worker: concurrency 1 to avoid OOM when multiple jobs run
  // pnpm install (code-synapse + user repo) in Daytona sandboxes is memory-heavy; exit 137 = killed (OOM)
  const projectProcessingWorker = new Worker(
    QUEUE_NAMES.PROJECT_PROCESSING,
    processProjectJob,
    {
      connection: createRedisConnection() as any,
      concurrency: 1,
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
