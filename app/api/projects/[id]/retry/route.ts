import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { canResume, clearCheckpoint, clearErrorContext } from "@/lib/pipeline"
import { queueProjectProcessing } from "@/lib/queue"

type Project = Database["public"]["Tables"]["projects"]["Row"]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id } = await params

    // Verify project ownership
    const { data: project } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single() as { data: Project | null }

    if (!project) {
      return new NextResponse("Not Found", { status: 404 })
    }

    // Parse mode from query string
    const { searchParams } = new URL(req.url)
    const modeParam = searchParams.get("mode") || "auto"
    const mode = modeParam === "resume" || modeParam === "restart" ? modeParam : "auto"

    let resolvedMode: "resumed" | "restarted"

    if (mode === "restart") {
      // Full restart: clear checkpoint and reset brain statuses
      await clearCheckpoint(id)
      await (supabase as any)
        .from("projects")
        .update({
          status: "processing",
          left_brain_status: "pending",
          right_brain_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
      resolvedMode = "restarted"
    } else if (mode === "resume" || (mode === "auto" && canResume(project))) {
      // Resume from checkpoint: clear error, set status to processing
      await clearErrorContext(id)
      await (supabase as any)
        .from("projects")
        .update({
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
      resolvedMode = "resumed"
    } else {
      // Auto with no checkpoint → full restart
      await clearCheckpoint(id)
      await (supabase as any)
        .from("projects")
        .update({
          status: "processing",
          left_brain_status: "pending",
          right_brain_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
      resolvedMode = "restarted"
    }

    // Queue the job
    await queueProjectProcessing({
      projectId: project.id,
      userId: session.user.id,
      githubUrl: project.github_url ?? undefined,
      targetFramework: project.target_framework ?? undefined,
    })

    return NextResponse.json({ success: true, mode: resolvedMode })
  } catch (error: unknown) {
    console.error("Failed to retry processing:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
