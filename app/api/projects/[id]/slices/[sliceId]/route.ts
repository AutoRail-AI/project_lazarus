import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import { logger } from "@/lib/utils/logger"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sliceId: string }> }
) {
  const { id: projectId, sliceId } = await params
  logger.info("[API] GET /api/projects/[id]/slices/[sliceId] - request start", {
    projectId,
    sliceId,
  })
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      logger.warn("[API] GET /api/projects/[id]/slices/[sliceId] - unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify project ownership
    const { data: project, error: projectError } = await (supabase as any)
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", session.user.id)
      .single()

    if (projectError || !project) {
      logger.warn("[API] GET /api/projects/[id]/slices/[sliceId] - project not found", {
        projectId,
        sliceId,
        pgMessage: projectError?.message,
      })
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const { data: slice, error } = await (supabase as any)
      .from("vertical_slices")
      .select("*")
      .eq("id", sliceId)
      .eq("project_id", projectId)
      .single()

    if (error || !slice) {
      logger.warn("[API] GET /api/projects/[id]/slices/[sliceId] - slice not found", {
        projectId,
        sliceId,
        pgMessage: error?.message,
      })
      return NextResponse.json({ error: "Slice not found" }, { status: 404 })
    }

    logger.info("[API] GET /api/projects/[id]/slices/[sliceId] - success", {
      projectId,
      sliceId,
    })
    return NextResponse.json(slice)
  } catch (error: unknown) {
    logger.error("[API] GET /api/projects/[id]/slices/[sliceId] - unexpected error", error, {
      projectId,
      sliceId,
    })
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
