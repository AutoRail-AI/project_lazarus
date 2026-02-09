import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import {
  CONFIDENCE_THRESHOLD,
  onSliceComplete,
  onSliceFailed,
} from "@/lib/pipeline"
import { logger } from "@/lib/utils/logger"

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
    "browser_action",
    "screenshot",
    "app_start",
  ]),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  confidence_delta: z.number().optional(),
})

/**
 * Handle side effects of events — update slice/project status based on event type.
 * Only runs when a slice_id is present.
 */
async function handleEventSideEffects(
  projectId: string,
  sliceId: string,
  eventType: string,
  metadata: Record<string, unknown> | undefined,
  confidenceScore: number
): Promise<void> {
  type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]
  type Project = Database["public"]["Tables"]["projects"]["Row"]

  // Fetch the project's user_id for orchestration calls
  const { data: project } = await (supabase as any)
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single() as { data: Pick<Project, "user_id"> | null }

  if (!project) return

  const userId = project.user_id

  switch (eventType) {
    case "test_run": {
      // Transition slice to "testing" if not already
      const { data: slice } = await (supabase as any)
        .from("vertical_slices")
        .select("status")
        .eq("id", sliceId)
        .single() as { data: Pick<Slice, "status"> | null }

      if (slice && slice.status !== "testing") {
        await (supabase as any)
          .from("vertical_slices")
          .update({ status: "testing", updated_at: new Date().toISOString() })
          .eq("id", sliceId)
      }
      break
    }

    case "test_result": {
      const passed = (metadata as Record<string, unknown> | undefined)?.passed === true

      if (passed && confidenceScore >= CONFIDENCE_THRESHOLD) {
        await onSliceComplete(projectId, sliceId, userId)
      } else if (!passed) {
        await onSliceFailed(projectId, sliceId, userId)
      }
      // If passed but confidence below threshold, stay in current state (more tests needed)
      break
    }

    case "self_heal": {
      await (supabase as any)
        .from("vertical_slices")
        .update({ status: "self_healing", updated_at: new Date().toISOString() })
        .eq("id", sliceId)
      break
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  logger.info("[API] POST /api/projects/[id]/events - request start (callback)", { projectId })
  try {
    const body = (await req.json()) as Record<string, unknown>
    const parsed = eventSchema.safeParse(body)
    if (!parsed.success) {
      logger.warn("[API] POST /api/projects/[id]/events - validation failed", {
        projectId,
        issues: parsed.error.issues.map((i) => ({ path: i.path })),
      })
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
      logger.error("[API] POST /api/projects/[id]/events - insert failed", insertError, {
        projectId,
        eventType: event_type,
        sliceId: slice_id ?? "none",
        table: "agent_events",
        pgMessage: insertError.message,
      })
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    logger.info("[API] POST /api/projects/[id]/events - event recorded", {
      projectId,
      eventType: event_type,
      sliceId: slice_id ?? "none",
    })

    // If confidence_delta provided and slice_id present, update slice confidence
    let currentConfidence = 0
    if (confidence_delta !== undefined && slice_id) {
      const { data: slice } = await (supabase.from("vertical_slices") as any)
        .select("confidence_score")
        .eq("id", slice_id)
        .single() as { data: { confidence_score: number } | null }

      if (slice) {
        const newScore = Math.max(0, Math.min(1, slice.confidence_score + confidence_delta))
        currentConfidence = newScore
        await (supabase.from("vertical_slices") as any)
          .update({ confidence_score: newScore, updated_at: new Date().toISOString() })
          .eq("id", slice_id)
      }
    } else if (slice_id) {
      // Fetch current confidence for side effect evaluation
      const { data: slice } = await (supabase.from("vertical_slices") as any)
        .select("confidence_score")
        .eq("id", slice_id)
        .single() as { data: { confidence_score: number } | null }
      currentConfidence = slice?.confidence_score ?? 0
    }

    // Handle event side effects (status transitions)
    if (slice_id) {
      try {
        await handleEventSideEffects(projectId, slice_id, event_type, metadata, currentConfidence)
      } catch (sideEffectErr: unknown) {
        // Log but don't fail the event insert
        logger.error("[API] POST /api/projects/[id]/events - side effect error", sideEffectErr, {
          projectId,
          sliceId: slice_id,
          eventType: event_type,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    logger.error("[API] POST /api/projects/[id]/events - unexpected error", error, { projectId })
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  logger.info("[API] GET /api/projects/[id]/events - request start", { projectId })
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      logger.warn("[API] GET /api/projects/[id]/events - unauthorized")
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
      logger.warn("[API] GET /api/projects/[id]/events - project not found", {
        projectId,
        pgMessage: projectError?.message,
      })
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
      logger.error("[API] GET /api/projects/[id]/events - supabase error", error, {
        projectId,
        table: "agent_events",
        pgMessage: error.message,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info("[API] GET /api/projects/[id]/events - success", {
      projectId,
      count: events?.length ?? 0,
      hasAfter: !!after,
    })
    return NextResponse.json(events)
  } catch (error: unknown) {
    logger.error("[API] GET /api/projects/[id]/events - unexpected error", error, { projectId })
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
