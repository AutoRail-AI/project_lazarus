import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import { advancePipelineStep } from "@/lib/pipeline"
import { queueProjectProcessing } from "@/lib/queue"
import { logger } from "@/lib/utils/logger"

/**
 * POST /api/projects/[id]/configure
 *
 * Accept user configuration (boilerplate URL + tech preferences) after
 * brain analysis completes, then resume the pipeline for the planning phase.
 *
 * Body: { boilerplate_url?: string, tech_preferences?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  logger.info("[API] POST /api/projects/[id]/configure - request start", { projectId })

  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify project ownership
    const { data: project, error: projectError } = (await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", session.user.id)
      .single()) as { data: { status: string; metadata: Record<string, unknown> | null; github_url: string | null; target_framework: string | null } | null; error: { message: string } | null }

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (project.status !== "analyzed") {
      return NextResponse.json(
        { error: `Project must be in 'analyzed' status to configure. Current: ${project.status}` },
        { status: 409 }
      )
    }

    // Parse request body
    const body = (await req.json()) as { boilerplate_url?: string; tech_preferences?: string }
    const { boilerplate_url, tech_preferences } = body

    // Merge user config into existing metadata (preserving code_analysis + behavioral_analysis)
    const existingMetadata = (project.metadata ?? {}) as Record<string, unknown>
    const updatedMetadata = {
      ...existingMetadata,
      ...(boilerplate_url ? { boilerplate_url } : {}),
      ...(tech_preferences ? { tech_preferences } : {}),
    }

    // Set status back to processing and advance pipeline to planning
    await (supabase as any)
      .from("projects")
      .update({
        status: "processing",
        metadata: updatedMetadata,
        pipeline_step: "planning",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)

    await advancePipelineStep(projectId, "planning")

    // Queue a new processing job — the worker will load checkpoint (brains done)
    // and skip directly to the planning phase
    try {
      await queueProjectProcessing({
        projectId,
        userId: session.user.id,
        githubUrl: project.github_url ?? undefined,
        targetFramework: project.target_framework ?? undefined,
      })
    } catch (queueError: unknown) {
      // Revert status if queue fails
      await (supabase as any)
        .from("projects")
        .update({
          status: "analyzed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)

      const err = queueError as { message?: string; code?: string }
      const isConnectionError = err?.code === "ECONNREFUSED" || err?.message?.includes("ECONNREFUSED")
      if (isConnectionError) {
        return NextResponse.json(
          { error: "Background job service (Redis) is unavailable." },
          { status: 503 }
        )
      }
      throw queueError
    }

    logger.info("[API] POST /api/projects/[id]/configure - planning queued", {
      projectId,
      hasBoilerplate: !!boilerplate_url,
      hasTechPrefs: !!tech_preferences,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    logger.error("[API] POST /api/projects/[id]/configure - unexpected error", error, { projectId })
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
