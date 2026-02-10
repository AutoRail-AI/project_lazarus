/**
 * Sandbox lifecycle manager for demo slice builds.
 *
 * Delegates to local-workspace for all filesystem operations.
 * No Daytona dependency — everything runs on the local machine.
 */

import { supabase } from "@/lib/db"
import {
  getOrCreateWorkspace,
  getWorkspacePath,
  snapshotDirectoryTree as snapshotTree,
  writeFiles as writeFilesLocal,
  readFile as readFileLocal,
  cleanupWorkspace,
} from "@/lib/workspace/local-workspace"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface SandboxInfo {
  /** Local workspace path (replaces Daytona sandbox UUID) */
  sandboxId: string
  appDir: string
  isNew: boolean
}

/* -------------------------------------------------------------------------- */
/*  getOrCreateSandbox                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Get an existing workspace for the project or create a new one.
 * Persists workspace_path in the project's pipeline_checkpoint.
 */
export async function getOrCreateSandbox(projectId: string): Promise<SandboxInfo> {
  const { workspacePath, isNew } = getOrCreateWorkspace(projectId)

  // Save workspace path to project checkpoint
  const { data: project } = await (supabase as any)
    .from("projects")
    .select("pipeline_checkpoint")
    .eq("id", projectId)
    .single() as { data: { pipeline_checkpoint: Record<string, unknown> | null } | null }

  const checkpoint = project?.pipeline_checkpoint
  const updatedCheckpoint = {
    ...(checkpoint ?? {}),
    workspace_path: workspacePath,
    last_updated: new Date().toISOString(),
  }

  await (supabase as any)
    .from("projects")
    .update({
      pipeline_checkpoint: updatedCheckpoint,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)

  console.log(`[SandboxManager] Workspace ready for project ${projectId} at ${workspacePath}`)

  return { sandboxId: workspacePath, appDir: workspacePath, isNew }
}

/* -------------------------------------------------------------------------- */
/*  snapshotDirectoryTree                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Capture the full file tree of the project workspace.
 * Returns as a string for Gemini context. Excludes node_modules, .git, .next.
 */
export async function snapshotDirectoryTree(workspacePath: string): Promise<string> {
  return snapshotTree(workspacePath)
}

/* -------------------------------------------------------------------------- */
/*  writeFiles                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Write multiple files into the workspace.
 * Creates parent directories automatically.
 */
export async function writeFiles(
  workspacePath: string,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  writeFilesLocal(workspacePath, files)
}

/* -------------------------------------------------------------------------- */
/*  readFile                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Read a single file from the workspace.
 */
export async function readFile(workspacePath: string, filePath: string): Promise<string> {
  return readFileLocal(workspacePath, filePath)
}

/* -------------------------------------------------------------------------- */
/*  cleanup                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Destroy the workspace and clear it from the project checkpoint.
 */
export async function cleanupSandbox(projectId: string): Promise<void> {
  await cleanupWorkspace(projectId)

  // Clear workspace_path from checkpoint
  const { data: project } = await (supabase as any)
    .from("projects")
    .select("pipeline_checkpoint")
    .eq("id", projectId)
    .single() as { data: { pipeline_checkpoint: Record<string, unknown> | null } | null }

  if (project?.pipeline_checkpoint) {
    const updatedCheckpoint = {
      ...(project.pipeline_checkpoint),
      workspace_path: undefined,
      last_updated: new Date().toISOString(),
    }

    await (supabase as any)
      .from("projects")
      .update({
        pipeline_checkpoint: updatedCheckpoint,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
  }
}
