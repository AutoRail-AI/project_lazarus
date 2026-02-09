import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import { queueProjectProcessing } from "@/lib/queue"
import { logger } from "@/lib/utils/logger"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  logger.info("[API] POST /api/projects/[id]/process - request start", { projectId })
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      logger.warn("[API] POST /api/projects/[id]/process - unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify project ownership and fetch project
    const { data: project, error: projectError } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", session.user.id)
      .single()

    if (projectError || !project) {
      logger.warn("[API] POST /api/projects/[id]/process - project not found", {
        projectId,
        pgMessage: projectError?.message,
      })
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (project.status === "processing") {
      logger.info("[API] POST /api/projects/[id]/process - already processing", { projectId })
      return NextResponse.json(
        { error: "Project is already being processed" },
        { status: 409 }
      )
    }

    // Update project status to processing
    const { error: updateError } = await (supabase as any)
      .from("projects")
      .update({
        status: "processing" as const,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)

    if (updateError) {
      logger.error("[API] POST /api/projects/[id]/process - status update failed", updateError, {
        projectId,
        pgMessage: updateError.message,
      })
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Queue the background processing job
    try {
      await queueProjectProcessing({
        projectId,
        userId: session.user.id,
        githubUrl: project.github_url ?? undefined,
        targetFramework: project.target_framework ?? undefined,
      })
    } catch (queueError: unknown) {
      // Revert status when queue fails (e.g. Redis unavailable)
      await (supabase as any)
        .from("projects")
        .update({
          status: "pending" as const,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)

      const err = queueError as { name?: string; message?: string; code?: string; cause?: unknown }
      const isConnectionError =
        err?.name === "AggregateError" ||
        err?.code === "ECONNREFUSED" ||
        err?.message?.includes("ECONNREFUSED") ||
        err?.message?.includes("Connection is closed")
      if (isConnectionError) {
        logger.warn("[API] POST /api/projects/[id]/process - Redis unavailable", {
          projectId,
          hint: "Start Redis: docker run -d -p 6379:6379 redis:7-alpine",
        })
        return NextResponse.json(
          {
            error:
              "Background job service (Redis) is unavailable. Start Redis with: docker run -d -p 6379:6379 redis:7-alpine",
          },
          { status: 503 }
        )
      }
      throw queueError
    }

    logger.info("[API] POST /api/projects/[id]/process - queued", {
      projectId,
      hasGithubUrl: !!project.github_url,
    })
    return NextResponse.json({
      status: "processing",
      projectId,
    })
  } catch (error: unknown) {
    logger.error("[API] POST /api/projects/[id]/process - unexpected error", error, { projectId })
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
