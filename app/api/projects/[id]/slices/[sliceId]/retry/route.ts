import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { clearErrorContext, triggerNextSliceBuild } from "@/lib/pipeline"

type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; sliceId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id: projectId, sliceId } = await params

    // Verify project ownership
    const { data: project } = await (supabase as any)
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .eq("user_id", session.user.id)
      .single() as { data: { id: string; user_id: string } | null }

    if (!project) {
      return new NextResponse("Not Found", { status: 404 })
    }

    // Verify slice exists and is failed
    const { data: slice } = await (supabase as any)
      .from("vertical_slices")
      .select("id, status, name")
      .eq("id", sliceId)
      .eq("project_id", projectId)
      .single() as { data: Pick<Slice, "id" | "status" | "name"> | null }

    if (!slice) {
      return NextResponse.json({ error: "Slice not found" }, { status: 404 })
    }

    if (slice.status !== "failed") {
      return NextResponse.json(
        { error: `Cannot retry slice with status "${slice.status}". Must be "failed".` },
        { status: 400 }
      )
    }

    // Reset slice to pending
    await (supabase as any)
      .from("vertical_slices")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", sliceId)

    // Clear project error context
    await clearErrorContext(projectId)

    // Set project status to building
    await (supabase as any)
      .from("projects")
      .update({ status: "building", updated_at: new Date().toISOString() })
      .eq("id", projectId)

    // Trigger next slice build (will pick up the reset slice)
    await triggerNextSliceBuild(projectId, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Failed to retry slice:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
