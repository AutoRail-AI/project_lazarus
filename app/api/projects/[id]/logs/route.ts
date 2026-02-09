import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"

export async function GET(
  req: Request,
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
      .select("id")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single()

    if (!project) {
      return new NextResponse("Not Found", { status: 404 })
    }

    const { data: logs, error } = await (supabase as any)
      .from("agent_events")
      .select("*")
      .eq("project_id", id)
      .eq("event_type", "thought")
      .order("created_at", { ascending: true })

    if (error) throw error

    return NextResponse.json(logs)
  } catch (error) {
    console.error("Failed to fetch logs:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
