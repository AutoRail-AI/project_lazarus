import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { buildSliceInSandbox } from "@/lib/demo"
import { advancePipelineStep, setErrorContext } from "./orchestrator"
import { MAX_SLICE_RETRIES } from "./types"

type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

/**
 * Start the automated build pipeline for all slices.
 * Sets project status to "building" and triggers the first slice.
 */
export async function startBuildPipeline(
  projectId: string,
  userId: string
): Promise<void> {
  await (supabase as any)
    .from("projects")
    .update({ status: "building", updated_at: new Date().toISOString() })
    .eq("id", projectId)

  await (supabase as any).from("agent_events").insert({
    project_id: projectId,
    event_type: "thought",
    content: "Starting automated build pipeline for all slices.",
    metadata: { pipeline_event: "build_start" },
  })

  await triggerNextSliceBuild(projectId, userId)
}

/**
 * Find and trigger the next buildable slice.
 * Event-driven — called when a slice completes or the pipeline starts.
 */
export async function triggerNextSliceBuild(
  projectId: string,
  userId: string
): Promise<void> {
  const { data: slices } = await (supabase as any)
    .from("vertical_slices")
    .select("*")
    .eq("project_id", projectId)
    .order("priority", { ascending: true }) as { data: Slice[] | null }

  if (!slices || slices.length === 0) return

  // Check if all slices are complete
  const allComplete = slices.every((s) => s.status === "complete")
  if (allComplete) {
    await (supabase as any)
      .from("projects")
      .update({
        status: "complete",
        current_slice_id: null,
        pipeline_step: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)

    await (supabase as any).from("agent_events").insert({
      project_id: projectId,
      event_type: "thought",
      content: "All slices complete! Project build finished.",
      metadata: { pipeline_event: "build_complete" },
    })
    return
  }

  // Check if any slice is actively building/testing/self_healing
  const activeSlice = slices.find(
    (s) => s.status === "building" || s.status === "testing" || s.status === "self_healing"
  )
  if (activeSlice) return // Wait for active slice to finish

  // Check if any slice has failed — stop pipeline (user must retry)
  const failedSlice = slices.find((s) => s.status === "failed")
  if (failedSlice) {
    await (supabase as any)
      .from("projects")
      .update({
        status: "failed",
        current_slice_id: failedSlice.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)

    await setErrorContext(projectId, {
      step: `slice:${failedSlice.id}`,
      message: `Slice "${failedSlice.name}" failed after ${failedSlice.retry_count} retries`,
      timestamp: new Date().toISOString(),
      retryable: true,
    })
    return
  }

  // Find next buildable slice: pending/selected, all deps complete
  const completedIds = new Set(slices.filter((s) => s.status === "complete").map((s) => s.id))
  const nextSlice = slices.find((s) => {
    if (s.status !== "pending" && s.status !== "selected") return false
    const deps = s.dependencies ?? []
    return deps.every((depId) => completedIds.has(depId))
  })

  if (nextSlice) {
    await buildSlice(projectId, nextSlice.id, userId)
  }
  // If no buildable slice found but not all complete, we're blocked by deps — wait
}

/**
 * Trigger a build for a single slice.
 */
async function buildSlice(
  projectId: string,
  sliceId: string,
  _userId: string
): Promise<void> {
  await advancePipelineStep(projectId, `slice:${sliceId}`)

  await (supabase as any)
    .from("projects")
    .update({ current_slice_id: sliceId, updated_at: new Date().toISOString() })
    .eq("id", projectId)

  await (supabase as any)
    .from("vertical_slices")
    .update({ status: "building", updated_at: new Date().toISOString() })
    .eq("id", sliceId)

  // Fetch slice details for the build request
  const { data: slice } = await (supabase as any)
    .from("vertical_slices")
    .select("name, behavioral_contract, code_contract")
    .eq("id", sliceId)
    .single() as { data: { name: string; behavioral_contract: unknown; code_contract: unknown } | null }

  await (supabase as any).from("agent_events").insert({
    project_id: projectId,
    slice_id: sliceId,
    event_type: "thought",
    content: `Starting build for slice "${slice?.name ?? sliceId}"`,
    metadata: { pipeline_event: "slice_build_start" },
  })

  // Fire-and-forget — don't await so the API returns immediately.
  // Errors are caught and persisted to DB asynchronously.
  buildSliceInSandbox(
    projectId,
    sliceId,
    slice?.name ?? sliceId,
    _userId,
  ).catch(async (err: unknown) => {
    const message = err instanceof Error ? err.message : "Unknown build error"
    console.error(`[SliceBuilder] Build failed for slice ${sliceId}:`, message)

    await (supabase as any)
      .from("vertical_slices")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", sliceId)

    await setErrorContext(projectId, {
      step: `slice:${sliceId}`,
      message,
      timestamp: new Date().toISOString(),
      retryable: true,
      stack: err instanceof Error ? err.stack : undefined,
    })
  })
}

/**
 * Called when a slice completes successfully.
 * Triggers the next slice in the pipeline.
 */
export async function onSliceComplete(
  projectId: string,
  sliceId: string,
  userId: string
): Promise<void> {
  await (supabase as any)
    .from("vertical_slices")
    .update({ status: "complete", updated_at: new Date().toISOString() })
    .eq("id", sliceId)

  const { data: slice } = await (supabase as any)
    .from("vertical_slices")
    .select("name")
    .eq("id", sliceId)
    .single() as { data: { name: string } | null }

  await (supabase as any).from("agent_events").insert({
    project_id: projectId,
    slice_id: sliceId,
    event_type: "thought",
    content: `Slice "${slice?.name ?? sliceId}" completed successfully!`,
    metadata: { pipeline_event: "slice_complete" },
  })

  await triggerNextSliceBuild(projectId, userId)
}

/**
 * Called when a slice fails.
 * Increments retry count and either self-heals or marks as failed.
 */
export async function onSliceFailed(
  projectId: string,
  sliceId: string,
  userId: string,
  maxRetries: number = MAX_SLICE_RETRIES
): Promise<void> {
  const { data: slice } = await (supabase as any)
    .from("vertical_slices")
    .select("retry_count, name")
    .eq("id", sliceId)
    .single() as { data: { retry_count: number; name: string } | null }

  const currentRetries = slice?.retry_count ?? 0
  const newRetryCount = currentRetries + 1

  if (newRetryCount < maxRetries) {
    // Under max retries — enter self-healing
    await (supabase as any)
      .from("vertical_slices")
      .update({
        status: "self_healing",
        retry_count: newRetryCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sliceId)

    await (supabase as any).from("agent_events").insert({
      project_id: projectId,
      slice_id: sliceId,
      event_type: "thought",
      content: `Slice "${slice?.name ?? sliceId}" failed, attempting self-heal (retry ${newRetryCount}/${maxRetries})`,
      metadata: { pipeline_event: "slice_self_heal", retry_count: newRetryCount },
    })
  } else {
    // Max retries exceeded — mark as failed
    await (supabase as any)
      .from("vertical_slices")
      .update({
        status: "failed",
        retry_count: newRetryCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sliceId)

    await setErrorContext(projectId, {
      step: `slice:${sliceId}`,
      message: `Slice "${slice?.name ?? sliceId}" failed after ${newRetryCount} retries`,
      timestamp: new Date().toISOString(),
      retryable: true,
    })

    await (supabase as any).from("agent_events").insert({
      project_id: projectId,
      slice_id: sliceId,
      event_type: "thought",
      content: `Slice "${slice?.name ?? sliceId}" failed after ${newRetryCount} retries. Pipeline paused.`,
      metadata: { pipeline_event: "slice_failed_final", retry_count: newRetryCount },
    })

    // Pipeline stops — triggerNextSliceBuild will detect the failed slice
    await triggerNextSliceBuild(projectId, userId)
  }
}
