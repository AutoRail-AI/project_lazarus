/**
 * Project resource cleanup — orchestrates teardown of local workspaces,
 * MCP processes, and BullMQ jobs.
 *
 * All functions are best-effort: they log warnings on failure and continue.
 */

import { execSync } from "child_process"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import {
  getProjectProcessingQueue,
  getSliceBuildQueue,
} from "@/lib/queue"
import { cleanupWorkspace } from "@/lib/workspace/local-workspace"
import { getWorkspacePath } from "@/lib/workspaces/checkout"
import { rm } from "fs/promises"
import { logger } from "@/lib/utils/logger"

type Project = Database["public"]["Tables"]["projects"]["Row"]

/**
 * Orchestrate all cleanup for a project.
 * Best-effort: logs and continues on individual failures.
 */
export async function cleanupProjectResources(projectId: string): Promise<void> {
  logger.info("[Cleanup] Starting resource cleanup", { projectId })

  // 1. Fetch project for cleanup context
  let project: Project | null = null
  try {
    const { data } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single() as { data: Project | null }
    project = data
  } catch (err: unknown) {
    logger.warn("[Cleanup] Failed to fetch project (continuing)", {
      projectId,
      error: err instanceof Error ? err.message : "unknown",
    })
  }

  const checkpoint = project?.pipeline_checkpoint as Record<string, unknown> | null
  const buildJobId = project?.build_job_id ?? undefined
  const mcpUrl = checkpoint?.mcp_url as string | undefined

  // 2. Cancel BullMQ jobs
  await cancelBullMQJobs(projectId, buildJobId ?? undefined)

  // 3. Clean up demo workspace (local build workspace)
  await cleanupDemoWorkspace(projectId)

  // 4. Clean up code-synapse local workspace
  await cleanupLocalWorkspace(projectId)

  // 5. Kill local MCP process
  if (mcpUrl) {
    await killLocalMcpProcess(mcpUrl)
  }

  logger.info("[Cleanup] Resource cleanup complete", { projectId })
}

/**
 * Cancel BullMQ jobs related to a project.
 * Removes the build job by ID, and scans slice-build queue for matching jobs.
 */
export async function cancelBullMQJobs(
  projectId: string,
  buildJobId?: string
): Promise<void> {
  // Cancel main processing job
  if (buildJobId) {
    try {
      const queue = getProjectProcessingQueue()
      const job = await queue.getJob(buildJobId)
      if (job) {
        await job.remove()
        logger.info("[Cleanup] Removed project processing job", {
          projectId,
          jobId: buildJobId,
        })
      }
    } catch (err: unknown) {
      logger.warn("[Cleanup] Failed to remove project processing job (best-effort)", {
        projectId,
        jobId: buildJobId,
        error: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  // Cancel slice build jobs
  try {
    const sliceQueue = getSliceBuildQueue()
    const jobs = await sliceQueue.getJobs(["active", "waiting", "delayed"])
    for (const job of jobs) {
      if (job.data?.projectId === projectId) {
        try {
          await job.remove()
          logger.info("[Cleanup] Removed slice build job", {
            projectId,
            jobId: job.id,
          })
        } catch {
          // Job may have completed between getJobs and remove
        }
      }
    }
  } catch (err: unknown) {
    logger.warn("[Cleanup] Failed to scan slice build queue (best-effort)", {
      projectId,
      error: err instanceof Error ? err.message : "unknown",
    })
  }
}

/**
 * Clean up the demo build workspace (local-workspace module).
 */
async function cleanupDemoWorkspace(projectId: string): Promise<void> {
  try {
    await cleanupWorkspace(projectId)
    logger.info("[Cleanup] Removed demo workspace", { projectId })
  } catch (err: unknown) {
    logger.warn("[Cleanup] Failed to remove demo workspace (best-effort)", {
      projectId,
      error: err instanceof Error ? err.message : "unknown",
    })
  }
}

/**
 * Stop workspace for project — no-op for local filesystem.
 * Kept for backward compatibility with pipeline index exports.
 */
export async function stopWorkspaceForProject(_projectId: string): Promise<void> {
  // No-op — local workspaces don't need to be "stopped"
}

/**
 * Remove local workspace directory for a project (code-synapse checkout workspace).
 */
export async function cleanupLocalWorkspace(projectId: string): Promise<void> {
  try {
    const wsPath = getWorkspacePath(projectId)
    // getWorkspacePath returns .../projectId/repo — we want to remove the parent (projectId dir)
    const projectDir = wsPath.replace(/\/repo$/, "")
    await rm(projectDir, { recursive: true, force: true })
    logger.info("[Cleanup] Removed local workspace", { projectId, path: projectDir })
  } catch (err: unknown) {
    logger.warn("[Cleanup] Failed to remove local workspace (best-effort)", {
      projectId,
      error: err instanceof Error ? err.message : "unknown",
    })
  }
}

/**
 * Kill a local MCP process by its URL port.
 * Only acts on localhost URLs — Daytona preview URLs are not local processes.
 */
export async function killLocalMcpProcess(mcpUrl: string): Promise<void> {
  const match = mcpUrl.match(/^https?:\/\/localhost:(\d+)/)
  const port = match?.[1]
  if (!port) return // Not a local URL

  try {
    const pids = execSync(`lsof -ti :${port}`, { stdio: "pipe" })
      .toString()
      .trim()
    if (pids) {
      execSync(`kill -9 ${pids}`, { stdio: "pipe" })
      logger.info("[Cleanup] Killed local MCP process", { port, pids })
    }
  } catch {
    // Process may already be dead or lsof not available
  }
}
