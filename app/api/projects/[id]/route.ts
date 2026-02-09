import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { cleanupProjectResources, stopDaytonaSandboxForProject } from "@/lib/pipeline/cleanup"
import { getProjectProcessingQueue } from "@/lib/queue"
import { logger } from "@/lib/utils/logger"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  logger.info("[API] GET /api/projects/[id] - request start", { projectId: id })
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      logger.warn("[API] GET /api/projects/[id] - unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: project, error } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single()

    if (error || !project) {
      logger.warn("[API] GET /api/projects/[id] - not found", {
        projectId: id,
        pgMessage: error?.message,
      })
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    logger.info("[API] GET /api/projects/[id] - success", { projectId: id })
    return NextResponse.json(project)
  } catch (error: unknown) {
    logger.error("[API] GET /api/projects/[id] - unexpected error", error, { projectId: id })
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  logger.info("[API] PATCH /api/projects/[id] - request start", { projectId: id })
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      logger.warn("[API] PATCH /api/projects/[id] - unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const keys = Object.keys(body).filter((k) => k !== "metadata")
    logger.info("[API] PATCH /api/projects/[id] - updating", { projectId: id, fields: keys })

    // If pausing: attempt to cancel the BullMQ job
    if (body.status === "paused") {
      type Project = Database["public"]["Tables"]["projects"]["Row"]
      const { data: existing } = await (supabase as any)
        .from("projects")
        .select("build_job_id")
        .eq("id", id)
        .single() as { data: Pick<Project, "build_job_id"> | null }

      if (existing?.build_job_id) {
        try {
          const queue = getProjectProcessingQueue()
          const job = await queue.getJob(existing.build_job_id)
          if (job) {
            await job.remove()
            logger.info("[API] PATCH /api/projects/[id] - cancelled BullMQ job", {
              projectId: id,
              jobId: existing.build_job_id,
            })
          }
        } catch (cancelErr: unknown) {
          // Best-effort — job may already be running or completed
          logger.warn("[API] PATCH /api/projects/[id] - failed to cancel job (best-effort)", {
            projectId: id,
            error: cancelErr instanceof Error ? cancelErr.message : "unknown",
          })
        }
      }

      // Also stop Daytona sandbox (preserves for resume)
      try {
        await stopDaytonaSandboxForProject(id)
        logger.info("[API] PATCH - stopped Daytona sandbox", { projectId: id })
      } catch (stopErr: unknown) {
        logger.warn("[API] PATCH - failed to stop Daytona sandbox (best-effort)", {
          projectId: id,
          error: stopErr instanceof Error ? stopErr.message : "unknown",
        })
      }
    }

    const { data: project, error } = await (supabase as any)
      .from("projects")
      .update({
        ...(body.name !== undefined && { name: body.name as string }),
        ...(body.description !== undefined && { description: body.description as string }),
        ...(body.github_url !== undefined && { github_url: body.github_url as string }),
        ...(body.target_framework !== undefined && { target_framework: body.target_framework as string }),
        ...(body.status !== undefined && { status: body.status as string }),
        ...(body.metadata !== undefined && { metadata: body.metadata }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", session.user.id)
      .select()
      .single()

    if (error || !project) {
      logger.warn("[API] PATCH /api/projects/[id] - update failed", {
        projectId: id,
        pgMessage: error?.message,
      })
      return NextResponse.json({ error: "Project not found or update failed" }, { status: 404 })
    }

    logger.info("[API] PATCH /api/projects/[id] - success", { projectId: id })
    return NextResponse.json(project)
  } catch (error: unknown) {
    logger.error("[API] PATCH /api/projects/[id] - unexpected error", error, { projectId: id })
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  logger.info("[API] DELETE /api/projects/[id] - request start", { projectId: id })
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      logger.warn("[API] DELETE /api/projects/[id] - unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. Verify project exists and belongs to user
    const { data: project } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single()

    if (!project) {
      logger.warn("[API] DELETE /api/projects/[id] - not found", { projectId: id })
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // 2. Cleanup resources (best-effort: Daytona sandbox, BullMQ jobs, local workspace, MCP process)
    try {
      await cleanupProjectResources(id)
    } catch (cleanupErr: unknown) {
      logger.warn("[API] DELETE /api/projects/[id] - cleanup partial failure (continuing)", {
        projectId: id,
        error: cleanupErr instanceof Error ? cleanupErr.message : "unknown",
      })
    }

    // 3. Delete from DB (CASCADE handles slices, events, assets)
    const { error } = await (supabase as any)
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id)

    if (error) {
      logger.error("[API] DELETE /api/projects/[id] - delete failed", error, {
        projectId: id,
        pgMessage: error.message,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info("[API] DELETE /api/projects/[id] - success", { projectId: id })
    return NextResponse.json({ deleted: true })
  } catch (error: unknown) {
    logger.error("[API] DELETE /api/projects/[id] - unexpected error", error, { projectId: id })
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
