import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import { logger } from "@/lib/utils/logger"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  logger.info("[API] GET /api/projects/[id]/slices - request start", { projectId })
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      logger.warn("[API] GET /api/projects/[id]/slices - unauthorized")
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
      logger.warn("[API] GET /api/projects/[id]/slices - project not found", {
        projectId,
        pgMessage: projectError?.message,
      })
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const { data: slices, error } = await (supabase as any)
      .from("vertical_slices")
      .select("*")
      .eq("project_id", projectId)
      .order("priority", { ascending: true })

    if (error) {
      logger.error("[API] GET /api/projects/[id]/slices - supabase error", error, {
        projectId,
        table: "vertical_slices",
        pgMessage: error.message,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info("[API] GET /api/projects/[id]/slices - success", {
      projectId,
      count: slices?.length ?? 0,
    })
    return NextResponse.json(slices)
  } catch (error: unknown) {
    logger.error("[API] GET /api/projects/[id]/slices - unexpected error", error, { projectId })
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
