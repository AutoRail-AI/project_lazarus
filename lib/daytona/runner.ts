/**
 * Daytona sandbox orchestration.
 * Uses Daytona REST API to create sandboxes, clone repos, and run commands.
 */

import { env } from "@/env.mjs"

function getDaytonaConfig() {
  const apiKey = env.DAYTONA_API_KEY
  const apiUrl = env.DAYTONA_API_URL
  if (!apiKey || !apiUrl) {
    throw new Error("DAYTONA_API_KEY and DAYTONA_API_URL are required")
  }
  return { apiKey, apiUrl }
}

async function daytonaFetch(path: string, options: RequestInit = {}) {
  const { apiKey, apiUrl } = getDaytonaConfig()
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`Daytona API error ${response.status}: ${text}`)
  }

  return response
}

/**
 * Create a new Daytona sandbox.
 * Critical: autoStopInterval must be 0 to prevent mid-process auto-stop.
 */
export async function createDaytonaSandbox(): Promise<string> {
  const response = await daytonaFetch("/sandboxes", {
    method: "POST",
    body: JSON.stringify({
      language: "javascript",
      autoStopInterval: 0,
      resources: { cpu: 2, memory: 4, disk: 8 },
    }),
  })

  const data = (await response.json()) as { id: string }
  return data.id
}

/**
 * Clone a GitHub repo into the sandbox.
 */
export async function cloneRepoInSandbox(
  sandboxId: string,
  githubUrl: string,
  targetPath: string
): Promise<void> {
  await daytonaFetch(`/sandboxes/${sandboxId}/git/clone`, {
    method: "POST",
    body: JSON.stringify({ url: githubUrl, path: targetPath }),
  })
}

/**
 * Execute a blocking command in the sandbox.
 */
export async function executeCommand(
  sandboxId: string,
  command: string,
  workdir: string
): Promise<string> {
  const response = await daytonaFetch(
    `/sandboxes/${sandboxId}/process/execute`,
    {
      method: "POST",
      body: JSON.stringify({ command, cwd: workdir }),
    }
  )

  const data = (await response.json()) as { output: string; exitCode: number }
  if (data.exitCode !== 0) {
    throw new Error(`Command failed (exit ${data.exitCode}): ${data.output}`)
  }
  return data.output
}

/**
 * Start a background process in the sandbox via sessions.
 */
export async function startBackgroundProcess(
  sandboxId: string,
  sessionName: string,
  command: string,
  workdir: string
): Promise<void> {
  // Create session
  await daytonaFetch(`/sandboxes/${sandboxId}/process/sessions`, {
    method: "POST",
    body: JSON.stringify({ name: sessionName }),
  })

  // Execute command async in session
  await daytonaFetch(
    `/sandboxes/${sandboxId}/process/sessions/${sessionName}/execute`,
    {
      method: "POST",
      body: JSON.stringify({ command, cwd: workdir, runAsync: true }),
    }
  )
}

/**
 * Get preview link for a port on the sandbox.
 */
export async function getPreviewLink(
  sandboxId: string,
  port: number
): Promise<{ url: string; token?: string }> {
  const response = await daytonaFetch(
    `/sandboxes/${sandboxId}/preview/${port}`
  )

  const data = (await response.json()) as { url: string; token?: string }
  return data
}

/**
 * Destroy a sandbox.
 */
export async function destroySandbox(sandboxId: string): Promise<void> {
  await daytonaFetch(`/sandboxes/${sandboxId}`, { method: "DELETE" })
}
