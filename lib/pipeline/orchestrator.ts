import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import type { ErrorContext, PipelineCheckpoint, PipelineStep } from "./types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

/**
 * Save a checkpoint to the project row.
 * Also inserts a thought event with pipeline_event metadata for audit.
 */
export async function saveCheckpoint(
  projectId: string,
  checkpoint: PipelineCheckpoint
): Promise<void> {
  const updated: PipelineCheckpoint = {
    ...checkpoint,
    last_updated: new Date().toISOString(),
  }

  await (supabase as any)
    .from("projects")
    .update({
      pipeline_checkpoint: updated,
      pipeline_step: updated.completed_steps[updated.completed_steps.length - 1] ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)

  await (supabase as any).from("agent_events").insert({
    project_id: projectId,
    event_type: "thought",
    content: `Checkpoint saved after step: ${updated.completed_steps[updated.completed_steps.length - 1] ?? "init"}`,
    metadata: { pipeline_event: "checkpoint", completed_steps: updated.completed_steps },
  })
}

/**
 * Load the checkpoint from the project row.
 */
export async function loadCheckpoint(
  projectId: string
): Promise<PipelineCheckpoint | null> {
  const { data } = await (supabase as any)
    .from("projects")
    .select("pipeline_checkpoint")
    .eq("id", projectId)
    .single() as { data: { pipeline_checkpoint: PipelineCheckpoint | null } | null }

  if (!data?.pipeline_checkpoint) return null

  const cp = data.pipeline_checkpoint as unknown as Record<string, unknown>
  if (!cp.completed_steps || !Array.isArray(cp.completed_steps)) return null

  return data.pipeline_checkpoint
}

/**
 * Advance the pipeline_step column on the project.
 */
export async function advancePipelineStep(
  projectId: string,
  step: PipelineStep
): Promise<void> {
  await (supabase as any)
    .from("projects")
    .update({ pipeline_step: step, updated_at: new Date().toISOString() })
    .eq("id", projectId)
}

/**
 * Store structured error context on the project.
 */
export async function setErrorContext(
  projectId: string,
  error: ErrorContext
): Promise<void> {
  await (supabase as any)
    .from("projects")
    .update({ error_context: error, updated_at: new Date().toISOString() })
    .eq("id", projectId)

  await (supabase as any).from("agent_events").insert({
    project_id: projectId,
    event_type: "thought",
    content: `Pipeline error at step "${error.step}": ${error.message}`,
    metadata: { pipeline_event: "error", step: error.step, retryable: error.retryable },
  })
}

/**
 * Clear error context from the project.
 */
export async function clearErrorContext(projectId: string): Promise<void> {
  await (supabase as any)
    .from("projects")
    .update({ error_context: null, updated_at: new Date().toISOString() })
    .eq("id", projectId)
}

/**
 * Store the BullMQ job ID on the project for cancellation.
 */
export async function storeBuildJobId(
  projectId: string,
  jobId: string
): Promise<void> {
  await (supabase as any)
    .from("projects")
    .update({ build_job_id: jobId, updated_at: new Date().toISOString() })
    .eq("id", projectId)
}

/**
 * Check whether a project can be resumed from a checkpoint.
 */
export function canResume(project: Project): boolean {
  const cp = project.pipeline_checkpoint as PipelineCheckpoint | null
  if (!cp || !Array.isArray(cp.completed_steps) || cp.completed_steps.length === 0) {
    return false
  }
  return project.status === "failed" || project.status === "paused"
}

/**
 * Reset all pipeline state columns to default/null.
 */
export async function clearCheckpoint(projectId: string): Promise<void> {
  await (supabase as any)
    .from("projects")
    .update({
      pipeline_step: null,
      pipeline_checkpoint: {},
      error_context: null,
      current_slice_id: null,
      build_job_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
}
