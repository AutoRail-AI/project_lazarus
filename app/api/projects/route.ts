import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import { logger } from "@/lib/utils/logger"

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  githubUrl: z.string().url().optional(),
  targetFramework: z.string().optional(),
})

export async function GET() {
  logger.info("[API] GET /api/projects - request start")
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      logger.warn("[API] GET /api/projects - unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    logger.info("[API] GET /api/projects - auth ok", { userId: session.user.id.slice(0, 8) + "…" })

    const { data: projects, error } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })

    if (error) {
      logger.error("[API] GET /api/projects - supabase error", error, {
        table: "projects",
        operation: "select",
        pgMessage: error.message,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info("[API] GET /api/projects - success", { count: projects?.length ?? 0 })
    return NextResponse.json(projects)
  } catch (error: unknown) {
    logger.error("[API] GET /api/projects - unexpected error", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  logger.info("[API] POST /api/projects - request start")
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      logger.warn("[API] POST /api/projects - unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    logger.info("[API] POST /api/projects - auth ok", { userId: session.user.id.slice(0, 8) + "…" })

    const body = (await req.json()) as Record<string, unknown>
    const parsed = createProjectSchema.safeParse(body)
    if (!parsed.success) {
      logger.warn("[API] POST /api/projects - validation failed", {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      })
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, description, githubUrl, targetFramework } = parsed.data
    logger.info("[API] POST /api/projects - inserting project", {
      name,
      hasDescription: !!description,
      hasGithubUrl: !!githubUrl,
      targetFramework: targetFramework ?? "none",
    })

    const { data: project, error } = await (supabase as any)
      .from("projects")
      .insert({
        user_id: session.user.id,
        name,
        description: description ?? null,
        github_url: githubUrl ?? null,
        target_framework: targetFramework ?? null,
        status: "pending" as const,
        confidence_score: 0,
      })
      .select()
      .single()

    if (error) {
      logger.error("[API] POST /api/projects - supabase insert failed", error, {
        table: "projects",
        operation: "insert",
        pgMessage: error.message,
        pgCode: error.code,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info("[API] POST /api/projects - success", { projectId: project?.id, status: 201 })
    return NextResponse.json(project, { status: 201 })
  } catch (error: unknown) {
    logger.error("[API] POST /api/projects - unexpected error", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
