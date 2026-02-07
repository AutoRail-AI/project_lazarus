import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const { data: project, error } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single()

    if (error || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = (await req.json()) as Record<string, unknown>

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
      return NextResponse.json({ error: "Project not found or update failed" }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
