/**
 * Daytona sandbox orchestration using the official @daytonaio/sdk only.
 * Uses env vars: DAYTONA_API_KEY, DAYTONA_API_URL, DAYTONA_TARGET (per SDK docs).
 * See: https://www.daytona.io/docs/en/typescript-sdk
 */

import { Daytona } from "@daytonaio/sdk"
import type { Sandbox } from "@daytonaio/sdk"

let daytonaClient: Daytona | null = null

/**
 * Get Daytona client. Uses SDK default: env vars DAYTONA_API_KEY, DAYTONA_API_URL, DAYTONA_TARGET.
 * Lazy init per RULESETS.
 */
function getDaytona(): Daytona {
  if (!daytonaClient) {
    daytonaClient = new Daytona()
  }
  return daytonaClient
}

export const sandboxCache = new Map<string, Sandbox>()

/**
 * Create a new Daytona sandbox via the official SDK.
 * Uses DAYTONA_SNAPSHOT if set (e.g. daytona-medium for 4GiB to avoid OOM during pnpm install).
 * Disables auto-stop so long-running Code-Synapse steps don't get stopped.
 */
export async function createDaytonaSandbox(): Promise<string> {
  const daytona = getDaytona()
  const snapshot =
    process.env.DAYTONA_SNAPSHOT ?? "daytona-medium"
  const sandbox = await daytona.create(
    {
      snapshot,
      language: "javascript",
      autoStopInterval: 0,
    },
    { timeout: 120 }
  )
  sandboxCache.set(sandbox.id, sandbox)
  return sandbox.id
}

function getSandbox(sandboxId: string): Sandbox {
  const sandbox = sandboxCache.get(sandboxId)
  if (!sandbox) {
    throw new Error(`Sandbox ${sandboxId} not found in cache. Create it first.`)
  }
  return sandbox
}

/**
 * Clone a GitHub repo into the sandbox using the SDK's git.clone.
 */
export async function cloneRepoInSandbox(
  sandboxId: string,
  githubUrl: string,
  targetPath: string
): Promise<void> {
  const sandbox = getSandbox(sandboxId)
  await sandbox.git.clone(githubUrl, targetPath)
}

/**
 * Execute a blocking command in the sandbox.
 */
export async function executeCommand(
  sandboxId: string,
  command: string,
  workdir: string
): Promise<string> {
  const sandbox = getSandbox(sandboxId)
  const response = await sandbox.process.executeCommand(command, workdir, undefined, 0)
  if (response.exitCode !== 0) {
    const output = (response as { result?: string }).result ?? response.artifacts?.stdout ?? ""
    throw new Error(`Command failed (exit ${response.exitCode}): ${output}`)
  }
  return (response as { result?: string }).result ?? response.artifacts?.stdout ?? ""
}

/**
 * Start a background process in the sandbox via a session.
 */
export async function startBackgroundProcess(
  sandboxId: string,
  sessionName: string,
  command: string,
  workdir: string
): Promise<void> {
  const sandbox = getSandbox(sandboxId)
  await sandbox.process.createSession(sessionName)
  const runCommand = workdir ? `cd ${workdir} && ${command}` : command
  await sandbox.process.executeSessionCommand(sessionName, {
    command: runCommand,
    runAsync: true,
  })
}

/**
 * Get preview link for a port on the sandbox.
 */
export async function getPreviewLink(
  sandboxId: string,
  port: number
): Promise<{ url: string; token?: string }> {
  const sandbox = getSandbox(sandboxId)
  const preview = await sandbox.getPreviewLink(port)
  return { url: preview.url, token: preview.token }
}

/**
 * Reconnect to an existing Daytona sandbox by ID.
 * Fetches the sandbox via SDK and adds it to the cache so subsequent
 * calls (executeCommand, etc.) can find it.
 */
export async function getSandboxById(sandboxId: string): Promise<Sandbox> {
  // Return from cache if already loaded
  const cached = sandboxCache.get(sandboxId)
  if (cached) return cached

  const daytona = getDaytona()
  const sandbox = await daytona.get(sandboxId)
  sandboxCache.set(sandbox.id, sandbox)
  return sandbox
}

/**
 * Stop a sandbox without deleting it (preserves for retry/resume).
 * Removes from sandboxCache since the in-memory reference isn't usable after stop.
 * Best-effort: logs warning on failure but does not throw.
 */
export async function stopSandbox(sandboxId: string): Promise<void> {
  try {
    const sandbox = sandboxCache.get(sandboxId) ?? (await getSandboxById(sandboxId))
    await sandbox.stop(60)
  } catch (err: unknown) {
    console.warn(
      `[Daytona] Failed to stop sandbox ${sandboxId} (best-effort):`,
      err instanceof Error ? err.message : err
    )
  } finally {
    sandboxCache.delete(sandboxId)
  }
}

/**
 * Destroy a sandbox and remove it from the cache.
 */
export async function destroySandbox(sandboxId: string): Promise<void> {
  const sandbox = sandboxCache.get(sandboxId)
  if (sandbox) {
    try {
      await sandbox.delete(60)
    } finally {
      sandboxCache.delete(sandboxId)
    }
  } else {
    // Not in cache — try to fetch and delete
    try {
      const fetched = await getSandboxById(sandboxId)
      await fetched.delete(60)
    } catch {
      // Sandbox may already be deleted
    } finally {
      sandboxCache.delete(sandboxId)
    }
  }
}
