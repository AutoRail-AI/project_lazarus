/**
 * Shared pipeline helpers — event emission and pacing utilities.
 */

import { supabase } from "@/lib/db"

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Insert a thought event into the agent_events table.
 */
export async function insertThought(
    projectId: string,
    content: string
): Promise<void> {
    await (supabase as any).from("agent_events").insert({
        project_id: projectId,
        slice_id: null,
        event_type: "thought",
        content,
    })
}

/**
 * Emit a thought with a preceding pause (for pacing).
 */
export async function pacedLog(
    projectId: string,
    content: string,
    delayMs: number
): Promise<void> {
    await sleep(delayMs)
    console.log(`[Pipeline] ${content}`)
    await insertThought(projectId, content)
}
