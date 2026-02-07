import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"

const eventSchema = z.object({
  slice_id: z.string().optional(),
  event_type: z.enum([
    "thought",
    "tool_call",
    "observation",
    "code_write",
    "test_run",
    "test_result",
    "self_heal",
    "confidence_update",
  ]),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  confidence_delta: z.number().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    const body = (await req.json()) as Record<string, unknown>
    const parsed = eventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { slice_id, event_type, content, metadata, confidence_delta } = parsed.data

    // Insert event — use `as any` for insert to avoid Supabase generic type resolution issues
    const { error: insertError } = await (supabase.from("agent_events") as any).insert({
      project_id: projectId,
      slice_id: slice_id ?? null,
      event_type,
      content,
      metadata: metadata ?? null,
      confidence_delta: confidence_delta ?? null,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // If confidence_delta provided and slice_id present, update slice confidence
    if (confidence_delta !== undefined && slice_id) {
      const { data: slice } = await (supabase.from("vertical_slices") as any)
        .select("confidence_score")
        .eq("id", slice_id)
        .single() as { data: { confidence_score: number } | null }

      if (slice) {
        const newScore = Math.max(0, Math.min(1, slice.confidence_score + confidence_delta))
        await (supabase.from("vertical_slices") as any)
          .update({ confidence_score: newScore, updated_at: new Date().toISOString() })
          .eq("id", slice_id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project ownership
    const { data: project, error: projectError } = await (supabase as any)
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", session.user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const after = searchParams.get("after")

    let query = (supabase.from("agent_events") as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(100)

    if (after) {
      query = query.gt("created_at", after)
    }

    const { data: events, error } = await query as { data: unknown[] | null; error: { message: string } | null }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(events)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
