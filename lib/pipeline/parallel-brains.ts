/**
 * Shared orchestrator for running Left Brain + Right Brain analysis in parallel.
 * Used by both the demo pipeline and production pipeline.
 *
 * Each brain function is an async closure that:
 *  - Emits its own logs/thoughts (prefixed with [Code Analysis] or [App Behaviour])
 *  - Returns its analysis result as Record<string, unknown>
 *  - Throws on failure (caught here and converted to BrainResult.error)
 *
 * The orchestrator:
 *  - Sets both brain statuses to "processing"
 *  - Runs both in parallel via Promise.allSettled
 *  - Updates each brain's status independently as it completes
 *  - Returns collected results for the caller to checkpoint
 */

import { supabase } from "@/lib/db"
import { advancePipelineStep } from "./orchestrator"

export interface BrainResult {
  success: boolean
  data: Record<string, unknown>
  error?: string
}

export interface ParallelBrainResults {
  leftBrain: BrainResult
  rightBrain: BrainResult
}

export async function runBrainsInParallel(opts: {
  projectId: string
  /** Async function that performs Left Brain analysis. Undefined = skip (already done). */
  runLeftBrain?: () => Promise<Record<string, unknown>>
  /** Async function that performs Right Brain analysis. Undefined = skip (already done). */
  runRightBrain?: () => Promise<Record<string, unknown>>
}): Promise<ParallelBrainResults> {
  const { projectId, runLeftBrain, runRightBrain } = opts

  const results: ParallelBrainResults = {
    leftBrain: { success: true, data: {} },
    rightBrain: { success: true, data: {} },
  }

  // Nothing to run
  if (!runLeftBrain && !runRightBrain) return results

  // Set statuses to "processing" for brains that will run
  const statusUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (runLeftBrain) statusUpdate.left_brain_status = "processing"
  if (runRightBrain) statusUpdate.right_brain_status = "processing"
  await (supabase as any)
    .from("projects")
    .update(statusUpdate)
    .eq("id", projectId)

  // Advance pipeline step (UI shows which phase is active)
  if (runLeftBrain) {
    await advancePipelineStep(projectId, "left_brain")
  } else if (runRightBrain) {
    await advancePipelineStep(projectId, "right_brain")
  }

  // Build parallel tasks
  const tasks: Promise<void>[] = []

  if (runLeftBrain) {
    tasks.push(
      runLeftBrain()
        .then(async (data) => {
          results.leftBrain = { success: true, data }
          await (supabase as any)
            .from("projects")
            .update({
              left_brain_status: "complete",
              updated_at: new Date().toISOString(),
            })
            .eq("id", projectId)
        })
        .catch(async (err: unknown) => {
          const message = err instanceof Error ? err.message : "Unknown error"
          console.error("[Code Analysis] Failed:", err)
          results.leftBrain = { success: false, data: {}, error: message }
          await (supabase as any)
            .from("projects")
            .update({
              left_brain_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", projectId)
        })
    )
  }

  if (runRightBrain) {
    tasks.push(
      runRightBrain()
        .then(async (data) => {
          results.rightBrain = { success: true, data }
          await (supabase as any)
            .from("projects")
            .update({
              right_brain_status: "complete",
              updated_at: new Date().toISOString(),
            })
            .eq("id", projectId)
        })
        .catch(async (err: unknown) => {
          const message = err instanceof Error ? err.message : "Unknown error"
          console.error("[App Behaviour] Failed:", err)
          results.rightBrain = { success: false, data: {}, error: message }
          await (supabase as any)
            .from("projects")
            .update({
              right_brain_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", projectId)
        })
    )
  }

  // Run in parallel — both always settle (errors caught above)
  await Promise.all(tasks)

  return results
}
