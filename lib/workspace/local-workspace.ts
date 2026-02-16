/**
 * Local filesystem workspace manager — replaces Daytona sandbox SDK.
 *
 * All operations are pure Node.js `fs` + `child_process`.
 * Workspace location: `$WORKSPACE_ROOT/<projectId>/`
 *
 * Boilerplate: https://github.com/10xR-AI/nextjs_fullstack_boilerplate
 */

import { execSync, spawn, type ChildProcess } from "child_process"
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs"
import { rm } from "fs/promises"
import { join, dirname } from "path"

const BOILERPLATE_URL =
  "https://github.com/10xR-AI/nextjs_fullstack_boilerplate.git"
const DEFAULT_WORKSPACE_ROOT = "/Users/jaswanth/IdeaProjects/workspace"

function getWorkspaceRoot(): string {
  return process.env.WORKSPACE_ROOT || DEFAULT_WORKSPACE_ROOT
}

export function getWorkspacePath(projectId: string): string {
  return join(getWorkspaceRoot(), projectId)
}

/* -------------------------------------------------------------------------- */
/*  getOrCreateWorkspace                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Clone the boilerplate into a local directory if it doesn't exist yet.
 * On subsequent calls, returns the existing workspace path.
 */
export function getOrCreateWorkspace(projectId: string): {
  workspacePath: string
  isNew: boolean
} {
  const workspacePath = getWorkspacePath(projectId)

  if (existsSync(join(workspacePath, "package.json"))) {
    console.log(
      `[LocalWorkspace] Reusing existing workspace at ${workspacePath}`
    )
    return { workspacePath, isNew: false }
  }

  // Ensure parent exists
  const root = getWorkspaceRoot()
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true })
  }

  console.log(
    `[LocalWorkspace] Cloning boilerplate into ${workspacePath}...`
  )
  execSync(`git clone --depth 1 ${BOILERPLATE_URL} ${workspacePath}`, {
    stdio: "pipe",
    timeout: 120_000,
  })

  console.log("[LocalWorkspace] Installing dependencies (pnpm install)...")
  execSync("pnpm install --frozen-lockfile || pnpm install", {
    cwd: workspacePath,
    stdio: "pipe",
    timeout: 300_000,
  })

  // Install Playwright chromium (best-effort)
  try {
    console.log("[LocalWorkspace] Installing Playwright chromium...")
    execSync("npx playwright install --with-deps chromium", {
      cwd: workspacePath,
      stdio: "pipe",
      timeout: 120_000,
    })
  } catch (err: unknown) {
    console.warn(
      "[LocalWorkspace] Playwright install failed (non-fatal):",
      err instanceof Error ? err.message : err
    )
  }

  console.log(`[LocalWorkspace] Workspace ready at ${workspacePath}`)
  return { workspacePath, isNew: true }
}

/* -------------------------------------------------------------------------- */
/*  snapshotDirectoryTree                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Recursively list all files, excluding node_modules, .git, .next, etc.
 * Returns a newline-separated string of relative paths.
 */
export function snapshotDirectoryTree(workspacePath: string): string {
  const results: string[] = []
  const EXCLUDE = new Set([
    "node_modules",
    ".git",
    ".next",
    "playwright-report",
    "test-results",
    ".turbo",
  ])

  function walk(dir: string, prefix: string): void {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      if (EXCLUDE.has(entry)) continue
      const fullPath = join(dir, entry)
      const relPath = prefix ? `${prefix}/${entry}` : entry
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath, relPath)
        } else {
          results.push(relPath)
        }
      } catch {
        // Skip files we can't stat
      }
    }
  }

  try {
    walk(workspacePath, "")
    results.sort()
    return results.join("\n")
  } catch (err: unknown) {
    console.warn(
      "[LocalWorkspace] Directory tree snapshot failed:",
      err instanceof Error ? err.message : err
    )
    return "(directory tree unavailable)"
  }
}

/* -------------------------------------------------------------------------- */
/*  writeFiles                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Write multiple files to the workspace. Creates parent directories as needed.
 */
export function writeFiles(
  workspacePath: string,
  files: Array<{ path: string; content: string }>
): void {
  for (const file of files) {
    const fullPath = file.path.startsWith("/")
      ? file.path
      : join(workspacePath, file.path)
    const dir = dirname(fullPath)

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(fullPath, file.content, "utf-8")
  }
}

/* -------------------------------------------------------------------------- */
/*  readFile                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Read a single file from the workspace.
 */
export function readFile(workspacePath: string, filePath: string): string {
  const fullPath = filePath.startsWith("/")
    ? filePath
    : join(workspacePath, filePath)
  return readFileSync(fullPath, "utf-8")
}

/* -------------------------------------------------------------------------- */
/*  executeCommand                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Execute a shell command in the workspace directory.
 * Returns stdout as a string. Throws on non-zero exit.
 */
export function executeCommand(
  command: string,
  workdir: string,
  timeoutMs: number = 120_000
): string {
  return execSync(command, {
    cwd: workdir,
    stdio: "pipe",
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024, // 10 MB
  }).toString("utf-8")
}

/* -------------------------------------------------------------------------- */
/*  startDevServer                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Start `pnpm dev` as a detached child process.
 * Returns the ChildProcess so the caller can kill it later.
 */
export function startDevServer(workdir: string): ChildProcess {
  const child = spawn("pnpm", ["dev"], {
    cwd: workdir,
    stdio: "ignore",
    detached: true,
  })

  // Prevent the parent from waiting on this child
  child.unref()

  return child
}

/* -------------------------------------------------------------------------- */
/*  writeEnvLocal                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Write a .env.local file from a key-value map.
 */
export function writeEnvLocal(
  workspacePath: string,
  envVars: Record<string, string>
): void {
  const lines = Object.entries(envVars).map(
    ([key, value]) => `${key}=${value}`
  )
  const content = lines.join("\n") + "\n"
  writeFileSync(join(workspacePath, ".env.local"), content, "utf-8")
}

/* -------------------------------------------------------------------------- */
/*  cleanupWorkspace                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Remove the entire workspace directory for a project.
 */
export async function cleanupWorkspace(projectId: string): Promise<void> {
  const workspacePath = getWorkspacePath(projectId)
  if (existsSync(workspacePath)) {
    await rm(workspacePath, { recursive: true, force: true })
    console.log(`[LocalWorkspace] Cleaned up workspace at ${workspacePath}`)
  }
}
