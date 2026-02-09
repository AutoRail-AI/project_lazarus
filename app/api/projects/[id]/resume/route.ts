import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { canResume, clearErrorContext } from "@/lib/pipeline"
import { queueProjectProcessing } from "@/lib/queue"

type Project = Database["public"]["Tables"]["projects"]["Row"]

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id } = await params

    const { data: project } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single() as { data: Project | null }

    if (!project) {
      return new NextResponse("Not Found", { status: 404 })
    }

    if (!canResume(project)) {
      return NextResponse.json(
        { error: "No checkpoint available for resume" },
        { status: 400 }
      )
    }

    // Clear error and set status to processing
    await clearErrorContext(id)
    await (supabase as any)
      .from("projects")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", id)

    // Re-queue — worker will load checkpoint and skip completed steps
    await queueProjectProcessing({
      projectId: project.id,
      userId: session.user.id,
      githubUrl: project.github_url ?? undefined,
      targetFramework: project.target_framework ?? undefined,
    })

    return NextResponse.json({ success: true, resumed: true })
  } catch (error: unknown) {
    console.error("Failed to resume processing:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
