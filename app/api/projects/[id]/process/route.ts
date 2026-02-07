import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import { queueProjectProcessing } from "@/lib/queue"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project ownership and fetch project
    const { data: project, error: projectError } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", session.user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (project.status === "processing") {
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
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Queue the background processing job
    await queueProjectProcessing({
      projectId,
      userId: session.user.id,
      githubUrl: project.github_url ?? undefined,
      targetFramework: project.target_framework ?? undefined,
    })

    return NextResponse.json({
      status: "processing",
      projectId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
