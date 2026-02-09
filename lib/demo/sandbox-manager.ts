/**
 * Sandbox lifecycle manager for demo slice builds.
 *
 * Manages one Daytona sandbox per project:
 * - Creates or reconnects to existing sandbox
 * - Clones the 10xR-AI/nextjs_fullstack_boilerplate
 * - Installs dependencies and Playwright browsers
 * - Provides file read/write utilities
 * - Snapshots directory tree for Gemini context
 */

import { supabase } from "@/lib/db"
import {
  createDaytonaSandbox,
  cloneRepoInSandbox,
  executeCommand,
  getSandboxById,
  destroySandbox,
} from "@/lib/daytona/runner"

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const BOILERPLATE_URL = "https://github.com/10xR-AI/nextjs_fullstack_boilerplate.git"
const APP_DIR = "/home/daytona/app"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface SandboxInfo {
  sandboxId: string
  appDir: string
  isNew: boolean
}

/* -------------------------------------------------------------------------- */
/*  getOrCreateSandbox                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Get an existing sandbox for the project or create a new one.
 * Persists sandbox_id in the project's pipeline_checkpoint.
 *
 * On first invocation:
 * 1. Create Daytona sandbox
 * 2. Clone boilerplate repo
 * 3. Run pnpm install
 * 4. Install Playwright chromium browser
 * 5. Save sandbox_id to checkpoint
 *
 * On subsequent invocations:
 * - Reconnect to existing sandbox via saved ID
 */
export async function getOrCreateSandbox(projectId: string): Promise<SandboxInfo> {
  // Check for existing sandbox in checkpoint
  const { data: project } = await (supabase as any)
    .from("projects")
    .select("pipeline_checkpoint")
    .eq("id", projectId)
    .single() as { data: { pipeline_checkpoint: Record<string, unknown> | null } | null }

  const checkpoint = project?.pipeline_checkpoint
  const existingSandboxId = checkpoint?.sandbox_id as string | undefined

  if (existingSandboxId) {
    try {
      await getSandboxById(existingSandboxId)
      console.log(`[SandboxManager] Reconnected to existing sandbox ${existingSandboxId}`)
      return { sandboxId: existingSandboxId, appDir: APP_DIR, isNew: false }
    } catch (err: unknown) {
      console.warn(
        `[SandboxManager] Failed to reconnect to sandbox ${existingSandboxId}, creating new:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  // Create fresh sandbox
  console.log("[SandboxManager] Creating new Daytona sandbox...")
  const sandboxId = await createDaytonaSandbox()
  console.log(`[SandboxManager] Created sandbox ${sandboxId}`)

  // Clone boilerplate
  console.log("[SandboxManager] Cloning boilerplate...")
  await cloneRepoInSandbox(sandboxId, BOILERPLATE_URL, APP_DIR)
  console.log("[SandboxManager] Boilerplate cloned.")

  // Install dependencies
  console.log("[SandboxManager] Installing dependencies (pnpm install)...")
  await executeCommand(sandboxId, "pnpm install --frozen-lockfile || pnpm install", APP_DIR)
  console.log("[SandboxManager] Dependencies installed.")

  // Install Playwright browsers (only chromium to save time)
  console.log("[SandboxManager] Installing Playwright chromium...")
  try {
    await executeCommand(sandboxId, "npx playwright install --with-deps chromium", APP_DIR)
    console.log("[SandboxManager] Playwright chromium installed.")
  } catch (err: unknown) {
    // Non-fatal — E2E tests will still attempt to run
    console.warn(
      "[SandboxManager] Playwright install failed (non-fatal):",
      err instanceof Error ? err.message : err
    )
  }

  // Save sandbox ID to project checkpoint
  const updatedCheckpoint = {
    ...(checkpoint ?? {}),
    sandbox_id: sandboxId,
    last_updated: new Date().toISOString(),
  }

  await (supabase as any)
    .from("projects")
    .update({
      pipeline_checkpoint: updatedCheckpoint,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)

  console.log(`[SandboxManager] Sandbox ${sandboxId} ready for project ${projectId}`)

  return { sandboxId, appDir: APP_DIR, isNew: true }
}

/* -------------------------------------------------------------------------- */
/*  snapshotDirectoryTree                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Capture the full file tree of the project in the sandbox.
 * Returns as a string for Gemini context. Excludes node_modules, .git, .next.
 */
export async function snapshotDirectoryTree(sandboxId: string): Promise<string> {
  try {
    const output = await executeCommand(
      sandboxId,
      `find ${APP_DIR} -type f ` +
        `-not -path "*/node_modules/*" ` +
        `-not -path "*/.git/*" ` +
        `-not -path "*/.next/*" ` +
        `-not -path "*/playwright-report/*" ` +
        `-not -path "*/test-results/*" ` +
        `| sort`,
      APP_DIR
    )
    return output.trim()
  } catch (err: unknown) {
    console.warn("[SandboxManager] Directory tree snapshot failed:", err instanceof Error ? err.message : err)
    return "(directory tree unavailable)"
  }
}

/* -------------------------------------------------------------------------- */
/*  writeFiles                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Write multiple files into the sandbox.
 * Creates parent directories automatically.
 */
export async function writeFiles(
  sandboxId: string,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  for (const file of files) {
    const fullPath = file.path.startsWith("/") ? file.path : `${APP_DIR}/${file.path}`
    const dir = fullPath.split("/").slice(0, -1).join("/")

    // Create parent directory
    await executeCommand(sandboxId, `mkdir -p ${dir}`, APP_DIR)

    // Write file using base64 to avoid heredoc escaping issues.
    // Split into chunks to avoid shell argument length limits on large files.
    const b64 = Buffer.from(file.content, "utf-8").toString("base64")
    const CHUNK_SIZE = 50000
    if (b64.length <= CHUNK_SIZE) {
      await executeCommand(
        sandboxId,
        `printf '%s' '${b64}' | base64 -d > ${fullPath}`,
        APP_DIR
      )
    } else {
      // Write base64 to a temp file in chunks, then decode
      const tmpB64 = `${fullPath}.b64tmp`
      await executeCommand(sandboxId, `printf '' > ${tmpB64}`, APP_DIR)
      for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
        const chunk = b64.slice(i, i + CHUNK_SIZE)
        await executeCommand(
          sandboxId,
          `printf '%s' '${chunk}' >> ${tmpB64}`,
          APP_DIR
        )
      }
      await executeCommand(
        sandboxId,
        `base64 -d ${tmpB64} > ${fullPath} && rm -f ${tmpB64}`,
        APP_DIR
      )
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  readFile                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Read a single file from the sandbox.
 */
export async function readFile(sandboxId: string, filePath: string): Promise<string> {
  const fullPath = filePath.startsWith("/") ? filePath : `${APP_DIR}/${filePath}`
  return await executeCommand(sandboxId, `cat ${fullPath}`, APP_DIR)
}

/* -------------------------------------------------------------------------- */
/*  cleanup                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Destroy the sandbox and clear it from the project checkpoint.
 */
export async function cleanupSandbox(projectId: string): Promise<void> {
  const { data: project } = await (supabase as any)
    .from("projects")
    .select("pipeline_checkpoint")
    .eq("id", projectId)
    .single() as { data: { pipeline_checkpoint: Record<string, unknown> | null } | null }

  const sandboxId = project?.pipeline_checkpoint?.sandbox_id as string | undefined

  if (sandboxId) {
    try {
      await destroySandbox(sandboxId)
      console.log(`[SandboxManager] Destroyed sandbox ${sandboxId}`)
    } catch (err: unknown) {
      console.warn(
        `[SandboxManager] Failed to destroy sandbox ${sandboxId}:`,
        err instanceof Error ? err.message : err
      )
    }

    // Clear sandbox_id from checkpoint
    const updatedCheckpoint = {
      ...(project?.pipeline_checkpoint ?? {}),
      sandbox_id: undefined,
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
