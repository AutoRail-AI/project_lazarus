/**
 * Demo event player — plays back pre-scripted mock events for a slice build.
 * Inserts events directly into Supabase with realistic timing.
 * Handles confidence updates and triggers slice lifecycle callbacks.
 *
 * In demo mode we never leave the slice in a failed or stuck state:
 * - When test_result passed is true, we ensure confidence >= threshold so onSliceComplete runs.
 * - On playback errors we force the slice to complete so the pipeline never shows failure.
 *
 * Runs as a fire-and-forget background task (not awaited by the build route).
 */

import { env } from "@/env.mjs"
import { supabase } from "@/lib/db"
import {
  CONFIDENCE_THRESHOLD,
  onSliceComplete,
  onSliceFailed,
} from "@/lib/pipeline"
import type { MockEvent } from "./mock-events"
import { getMockBuildSequence } from "./mock-events"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Insert a single event into agent_events and handle side effects.
 */
async function emitEvent(
  projectId: string,
  sliceId: string,
  event: MockEvent,
  userId: string
): Promise<void> {
  // Insert event
  const { error } = await (supabase as any).from("agent_events").insert({
    project_id: projectId,
    slice_id: sliceId,
    event_type: event.event_type,
    content: event.content,
    metadata: event.metadata ?? null,
    confidence_delta: event.confidence_delta ?? null,
  })

  if (error) {
    console.error(`[Demo Player] Failed to insert event:`, error)
    return
  }

  // Apply confidence delta
  let currentConfidence = 0
  if (event.confidence_delta !== undefined) {
    const { data: slice } = await (supabase as any)
      .from("vertical_slices")
      .select("confidence_score")
      .eq("id", sliceId)
      .single() as { data: { confidence_score: number } | null }

    if (slice) {
      const newScore = Math.max(
        0,
        Math.min(1, slice.confidence_score + event.confidence_delta)
      )
      currentConfidence = newScore
      await (supabase as any)
        .from("vertical_slices")
        .update({
          confidence_score: newScore,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sliceId)
    }
  } else {
    const { data: slice } = await (supabase as any)
      .from("vertical_slices")
      .select("confidence_score")
      .eq("id", sliceId)
      .single() as { data: { confidence_score: number } | null }
    currentConfidence = slice?.confidence_score ?? 0
  }

  // Handle side effects (same logic as events route)
  switch (event.event_type) {
    case "test_run": {
      await (supabase as any)
        .from("vertical_slices")
        .update({ status: "testing", updated_at: new Date().toISOString() })
        .eq("id", sliceId)
      break
    }

    case "test_result": {
      const passed =
        (event.metadata as Record<string, unknown> | undefined)?.passed === true

      if (passed) {
        // In demo mode always complete the slice when tests pass — never leave stuck in "testing"
        if (env.DEMO_MODE && currentConfidence < CONFIDENCE_THRESHOLD) {
          await (supabase as any)
            .from("vertical_slices")
            .update({
              confidence_score: CONFIDENCE_THRESHOLD,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sliceId)
        }
        const scoreToUse = env.DEMO_MODE && currentConfidence < CONFIDENCE_THRESHOLD
          ? CONFIDENCE_THRESHOLD
          : currentConfidence
        if (scoreToUse >= CONFIDENCE_THRESHOLD) {
          await onSliceComplete(projectId, sliceId, userId)
        }
      } else if (!passed) {
        await onSliceFailed(projectId, sliceId, userId)
      }
      break
    }

    case "self_heal": {
      await (supabase as any)
        .from("vertical_slices")
        .update({
          status: "self_healing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sliceId)
      break
    }
  }
}

/**
 * Play back a full mock build sequence for a slice.
 * This is fire-and-forget — errors are logged but don't propagate.
 */
export async function playDemoBuild(
  projectId: string,
  sliceId: string,
  sliceName: string,
  userId: string
): Promise<void> {
  console.log(
    `[Demo Player] Starting mock build for slice "${sliceName}" (${sliceId})`
  )

  const events = getMockBuildSequence(sliceName)

  try {
    for (const event of events) {
      // Wait before emitting
      if (event.delay > 0) {
        await sleep(event.delay)
      }

      try {
        await emitEvent(projectId, sliceId, event, userId)
      } catch (err: unknown) {
        console.error(
          `[Demo Player] Error emitting event:`,
          err instanceof Error ? err.message : err
        )
        if (env.DEMO_MODE) {
          // In demo mode never leave slice stuck — force complete so pipeline doesn't show failure
          await onSliceComplete(projectId, sliceId, userId)
          console.log(`[Demo Player] Demo mode: forced slice complete after emit error`)
          return
        }
        throw err
      }
    }

    console.log(
      `[Demo Player] Mock build complete for slice "${sliceName}" (${sliceId})`
    )
  } catch (err: unknown) {
    console.error(`[Demo Player] Playback failed:`, err instanceof Error ? err.message : err)
    if (env.DEMO_MODE) {
      await onSliceComplete(projectId, sliceId, userId)
      console.log(`[Demo Player] Demo mode: forced slice complete after playback error`)
    } else {
      throw err
    }
  }
}
