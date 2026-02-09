/**
 * Abstraction over Daytona vs local for running Code-Synapse.
 * Auto-detects: if DAYTONA_API_KEY + DAYTONA_API_URL set → use Daytona; else → local.
 *
 * Before any Code-Synapse command, bootstraps the CLI from source:
 * 1. Clone https://github.com/AutoRail-AI/code-synapse
 * 2. Ensure node 22+ and pnpm are available
 * 3. Run pnpm install && pnpm build && pnpm link --global
 * 4. Then run config, index, justify, start
 *
 * Supports reconnecting to an existing Daytona sandbox via options.instanceId.
 * On failure, stops (not deletes) the sandbox for retry.
 */

import { execFileSync, execSync, spawn } from "child_process"
import { existsSync, mkdirSync } from "fs"
import { join, resolve } from "path"
import { env } from "@/env.mjs"
import {
  cloneRepoInSandbox,
  createDaytonaSandbox,
  executeCommand,
  getPreviewLink,
  getSandboxById,
  startBackgroundProcess,
  stopSandbox,
} from "@/lib/daytona/runner"
import {
  type CodeSynapseClient,
  createCodeSynapseClient,
} from "@/lib/mcp/code-synapse-client"
import { checkoutRepo } from "./checkout"

const CODE_SYNAPSE_REPO = "https://github.com/AutoRail-AI/code-synapse"
const MIN_NODE_MAJOR = 22

interface CodeSynapseResult {
  client: CodeSynapseClient
  metadata: {
    mcpUrl: string
    sandboxId?: string
    workspacePath?: string
  }
}

interface CodeSynapseOptions {
  instanceId?: string
}

function getWorkspacesRoot(): string {
  return env.WORKSPACES_ROOT || resolve(process.cwd(), "workspaces")
}

function getCliPath(): string {
  return env.CODE_SYNAPSE_CLI_PATH || "code-synapse"
}

/** Check that Node.js meets the minimum version requirement. */
function ensureNodeVersion(minMajor: number = MIN_NODE_MAJOR): void {
  try {
    const output = execSync("node --version", { stdio: "pipe" }).toString().trim()
    const match = output.match(/^v(\d+)/)
    const major = match?.[1] ? parseInt(match[1], 10) : 0
    if (major < minMajor) {
      throw new Error(`Node.js ${minMajor}+ required, found ${output}`)
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("required")) throw err
    throw new Error("Node.js is not installed or not in PATH")
  }
}

/** Check that pnpm is available. */
function ensurePnpm(): void {
  try {
    execSync("pnpm --version", { stdio: "pipe" })
  } catch {
    throw new Error(
      "pnpm is required for Code-Synapse. Install pnpm (corepack enable && corepack prepare pnpm@latest --activate) and ensure it is in PATH."
    )
  }
}

/** Check if code-synapse CLI is available. */
function isCodeSynapseAvailable(cli: string): boolean {
  try {
    execSync(`${cli} --version`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/**
 * Bootstrap Code-Synapse CLI from source (local).
 * Clone repo, pnpm install, pnpm link --global. Skips if CODE_SYNAPSE_CLI_PATH is set or CLI already works.
 */
function ensureCodeSynapseCliLocal(): string {
  const cli = getCliPath()
  if (env.CODE_SYNAPSE_CLI_PATH) {
    if (!isCodeSynapseAvailable(cli)) {
      throw new Error(
        `CODE_SYNAPSE_CLI_PATH is set to '${cli}' but the command is not available. Install code-synapse or remove CODE_SYNAPSE_CLI_PATH to bootstrap from source.`
      )
    }
    return cli
  }
  if (isCodeSynapseAvailable("code-synapse")) {
    return "code-synapse"
  }

  ensureNodeVersion()
  ensurePnpm()

  const root = getWorkspacesRoot()
  const cliDir = join(root, ".code-synapse-cli")

  if (!existsSync(cliDir)) {
    mkdirSync(join(root), { recursive: true })
    console.log(`[Code-Synapse] Cloning ${CODE_SYNAPSE_REPO}...`)
    execSync(`git clone --depth 1 ${CODE_SYNAPSE_REPO} ${cliDir}`, {
      stdio: "pipe",
      timeout: 5 * 60 * 1000,
    })
  }

  console.log(`[Code-Synapse] Installing dependencies and linking globally...`)
  execSync("pnpm install", {
    cwd: cliDir,
    stdio: "pipe",
    timeout: 5 * 60 * 1000,
  })
  execSync("pnpm build", {
    cwd: cliDir,
    stdio: "pipe",
    timeout: 5 * 60 * 1000,
  })
  execSync("pnpm link --global", {
    cwd: cliDir,
    stdio: "pipe",
    timeout: 60_000,
  })

  return "code-synapse"
}

/**
 * Bootstrap Code-Synapse CLI inside a Daytona sandbox.
 * Broken into discrete steps with individual error handling and logging.
 */
async function ensureCodeSynapseCliInSandbox(
  sandboxId: string,
  onLog?: (msg: string) => Promise<void>
): Promise<void> {
  const log = async (msg: string) => {
    console.log(msg)
    if (onLog) await onLog(msg)
  }

  const cliDir = "/tmp/code-synapse-cli"

  // Step 1: Check if already cloned, clone if not
  await log("[Code-Synapse] Checking for existing CLI in sandbox...")
  let alreadyCloned = false
  try {
    await executeCommand(sandboxId, `test -d ${cliDir}`, "/tmp")
    alreadyCloned = true
    await log("[Code-Synapse] CLI source already present, skipping clone.")
  } catch {
    alreadyCloned = false
  }

  if (!alreadyCloned) {
    await log(`[Code-Synapse] Cloning ${CODE_SYNAPSE_REPO} into sandbox...`)
    try {
      await executeCommand(
        sandboxId,
        `git clone --depth 1 ${CODE_SYNAPSE_REPO} ${cliDir}`,
        "/tmp"
      )
    } catch (err: unknown) {
      // Clean up partial clone on failure
      try { await executeCommand(sandboxId, `rm -rf ${cliDir}`, "/tmp") } catch { /* ignore */ }
      throw new Error(
        `git clone failed: ${err instanceof Error ? err.message : "unknown error"}`
      )
    }
  }

  // Step 2: Check Node.js version
  await log("[Code-Synapse] Checking Node.js version in sandbox...")
  try {
    const nodeOutput = await executeCommand(sandboxId, "node --version", "/tmp")
    const match = nodeOutput.match(/^v(\d+)/)
    const major = match?.[1] ? parseInt(match[1], 10) : 0
    if (major < MIN_NODE_MAJOR) {
      throw new Error(`Node.js ${MIN_NODE_MAJOR}+ required, found ${nodeOutput.trim()}`)
    }
    await log(`[Code-Synapse] Node.js version OK: ${nodeOutput.trim()}`)
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("required")) throw err
    throw new Error(
      `Node.js check failed in sandbox: ${err instanceof Error ? err.message : "unknown"}`
    )
  }

  // Step 3: Ensure pnpm is available (use npm install -g pnpm to avoid corepack writing to /usr/bin)
  await log("[Code-Synapse] Checking pnpm in sandbox...")
  try {
    await executeCommand(sandboxId, "pnpm --version", "/tmp")
  } catch {
    await log("[Code-Synapse] pnpm not found, installing via npm...")
    try {
      await executeCommand(sandboxId, "npm install -g pnpm", "/tmp")
    } catch (err: unknown) {
      throw new Error(
        `Failed to install pnpm via npm: ${err instanceof Error ? err.message : "unknown"}`
      )
    }
  }

  // Step 4: pnpm install (no --frozen-lockfile; lockfile may be stale and would leave node_modules empty)
  await log("[Code-Synapse] Running pnpm install...")
  try {
    await executeCommand(sandboxId, "pnpm install", cliDir)
  } catch (err: unknown) {
    // Clean up node_modules on failure
    try { await executeCommand(sandboxId, `rm -rf ${cliDir}/node_modules`, "/tmp") } catch { /* ignore */ }
    throw new Error(
      `pnpm install failed: ${err instanceof Error ? err.message : "unknown error"}`
    )
  }

  // Step 5: pnpm build
  await log("[Code-Synapse] Running pnpm build...")
  try {
    await executeCommand(sandboxId, "pnpm build", cliDir)
  } catch (err: unknown) {
    throw new Error(
      `pnpm build failed (check build errors in code-synapse): ${err instanceof Error ? err.message : "unknown"}`
    )
  }

  // Step 6: pnpm link --global
  await log("[Code-Synapse] Linking CLI globally...")
  try {
    await executeCommand(sandboxId, "pnpm link --global", cliDir)
  } catch (err: unknown) {
    throw new Error(
      `pnpm link --global failed: ${err instanceof Error ? err.message : "unknown error"}`
    )
  }

  await log("[Code-Synapse] CLI bootstrap complete in sandbox.")
}

function shouldSkipJustify(): boolean {
  return env.CODE_SYNAPSE_SKIP_JUSTIFY === true
}

/** Get Google API key for Code-Synapse (project uses GEMINI_API_KEY, CLI expects GOOGLE_API_KEY). */
function getGoogleApiKey(): string {
  const key = env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY or GOOGLE_API_KEY required for Code-Synapse. Set one in .env.local."
    )
  }
  return key
}

/** Configure Code-Synapse with Google provider before indexing (local). */
function configureCodeSynapse(cli: string, cwd: string): void {
  const apiKey = getGoogleApiKey()
  execFileSync(cli, ["config", "--provider", "google", "--api-key", apiKey], {
    cwd,
    stdio: "pipe",
    timeout: 30_000,
  })
}

/** Build config command for Daytona (shell string; escapes key for safety). */
function buildConfigCommand(cli: string): string {
  const apiKey = getGoogleApiKey()
  const escaped = apiKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return `${cli} config --provider google --api-key "${escaped}"`
}

function useDaytona(): boolean {
  // SDK uses DAYTONA_API_KEY, DAYTONA_API_URL (defaults to https://app.daytona.io/api), DAYTONA_TARGET
  return Boolean(process.env.DAYTONA_API_KEY)
}

/**
 * Wait for the Code-Synapse REST API (viewer) to become available.
 */
async function waitForApi(url: string, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/health`)
      if (res.ok) return
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error(`Code-Synapse API at ${url} did not become available`)
}

/**
 * Run Code-Synapse on a project and return a client + metadata.
 */
export async function runCodeSynapse(
  projectId: string,
  githubUrl: string,
  onLog?: (msg: string) => Promise<void>,
  options?: CodeSynapseOptions
): Promise<CodeSynapseResult> {
  // If LEFT_BRAIN_API_URL is pre-configured, skip clone+CLI and just connect
  if (env.LEFT_BRAIN_API_URL) {
    const client = createCodeSynapseClient(env.LEFT_BRAIN_API_URL)
    return {
      client,
      metadata: { mcpUrl: env.LEFT_BRAIN_API_URL },
    }
  }

  if (useDaytona()) {
    try {
      return await runWithDaytona(projectId, githubUrl, onLog, options)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[Code-Synapse] Daytona failed (${msg}), falling back to local execution`)
      if (onLog) await onLog(`Daytona unavailable, running locally: ${msg}`)
      return runLocally(projectId, githubUrl, onLog)
    }
  }

  return runLocally(projectId, githubUrl, onLog)
}

async function runWithDaytona(
  projectId: string,
  githubUrl: string,
  onLog?: (msg: string) => Promise<void>,
  options?: CodeSynapseOptions
): Promise<CodeSynapseResult> {
  const log = async (msg: string) => {
    console.log(msg)
    if (onLog) await onLog(msg)
  }

  const cli = getCliPath()
  const repoPath = "workspace/repo"
  let currentStep = "init"
  let sandboxId: string | undefined

  try {
    // 1. Create or reconnect to sandbox
    if (options?.instanceId) {
      currentStep = "reconnect-sandbox"
      await log(`[Code-Synapse] Reconnecting to existing sandbox ${options.instanceId}...`)
      try {
        await getSandboxById(options.instanceId)
        sandboxId = options.instanceId
        await log(`[Code-Synapse] Reconnected to sandbox ${sandboxId}`)
      } catch (err: unknown) {
        await log(
          `[Code-Synapse] Failed to reconnect (${err instanceof Error ? err.message : "unknown"}), creating new sandbox...`
        )
        // Fall through to create new sandbox
      }
    }

    if (!sandboxId) {
      currentStep = "create-sandbox"
      await log(`[Code-Synapse] Creating Daytona sandbox for project ${projectId}`)
      sandboxId = await createDaytonaSandbox()
    }

    // 2. Bootstrap CLI FIRST (sequential steps with individual error handling)
    currentStep = "bootstrap-cli"
    let cliInstalled = false
    try {
      await executeCommand(sandboxId, `${cli} --version`, "/tmp")
      cliInstalled = true
      await log("[Code-Synapse] CLI already installed in sandbox, skipping bootstrap.")
    } catch {
      cliInstalled = false
    }

    if (!cliInstalled) {
      await ensureCodeSynapseCliInSandbox(sandboxId, onLog)
    }

    // 3. Clone target repo (skip if already present from previous attempt)
    currentStep = "clone-repo"
    let repoPresent = false
    try {
      await executeCommand(sandboxId, `test -d ${repoPath}`, "workspace")
      repoPresent = true
      await log(`[Code-Synapse] Repo already present in sandbox, skipping clone.`)
    } catch {
      repoPresent = false
    }

    if (!repoPresent) {
      await log(`[Code-Synapse] Cloning ${githubUrl} into sandbox`)
      await cloneRepoInSandbox(sandboxId, githubUrl, repoPath)
    }

    // 4. Init Code-Synapse in project (required before index)
    currentStep = "init-project"
    await log(`[Code-Synapse] Initializing in project...`)
    try {
      await executeCommand(sandboxId, `${cli} init`, repoPath)
    } catch {
      // init may fail if already initialized; continue
    }

    // 5. Configure Code-Synapse with Google provider
    currentStep = "config"
    await log(`[Code-Synapse] Configuring with Google provider...`)
    await executeCommand(sandboxId, buildConfigCommand(cli), repoPath)

    // 6. Index
    currentStep = "index"
    await log(`[Code-Synapse] Running index...`)
    await executeCommand(sandboxId, `${cli} index`, repoPath)

    // 7. Justify (unless skipped)
    if (!shouldSkipJustify()) {
      currentStep = "justify"
      await log(`[Code-Synapse] Running justify...`)
      await executeCommand(sandboxId, `${cli} justify`, repoPath)
    }

    // 8. Start REST API viewer in background
    currentStep = "start-viewer"
    await log(`[Code-Synapse] Starting REST API viewer...`)
    await startBackgroundProcess(
      sandboxId,
      "code-synapse-viewer",
      `${cli} viewer --port 3100`,
      repoPath
    )

    // 9. Get preview URL
    currentStep = "get-preview"
    const preview = await getPreviewLink(sandboxId, 3100)
    const apiUrl = preview.url

    // 10. Wait for server
    currentStep = "wait-api"
    await waitForApi(apiUrl)

    const client = createCodeSynapseClient(apiUrl)

    return {
      client,
      metadata: { mcpUrl: apiUrl, sandboxId },
    }
  } catch (err: unknown) {
    // Self-healing: clean up sandbox state on failure
    if (sandboxId) {
      // Best-effort cleanup of partial state in sandbox
      try {
        await executeCommand(sandboxId, "rm -rf workspace/repo /tmp/code-synapse-cli", "/")
      } catch { /* ignore */ }

      // Stop (not delete) sandbox — preserves for retry
      try {
        await stopSandbox(sandboxId)
      } catch { /* ignore */ }
    }

    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Code-Synapse Daytona init failed at step "${currentStep}": ${message}`)
  }
}

async function runLocally(
  projectId: string,
  githubUrl: string,
  onLog?: (msg: string) => Promise<void>
): Promise<CodeSynapseResult> {
  const log = async (msg: string) => {
    console.log(msg)
    if (onLog) await onLog(msg)
  }

  // 1. Bootstrap Code-Synapse CLI (clone repo, pnpm install, pnpm link --global)
  const bootstrapCli = ensureCodeSynapseCliLocal()

  // 2. Clone repo
  const workspacePath = checkoutRepo(projectId, githubUrl)

  // 3. Init Code-Synapse in project (required before index)
  await log(`[Code-Synapse] Initializing in project...`)
  try {
    execFileSync(bootstrapCli, ["init"], { cwd: workspacePath, stdio: "pipe", timeout: 30_000 })
  } catch {
    // init may fail if already initialized; continue
  }

  // 4. Configure Code-Synapse with Google provider
  await log(`[Code-Synapse] Configuring with Google provider...`)
  configureCodeSynapse(bootstrapCli, workspacePath)

  // 5. Index
  await log(`[Code-Synapse] Running index locally...`)
  execSync(`${bootstrapCli} index`, {
    cwd: workspacePath,
    stdio: "pipe",
    timeout: 10 * 60 * 1000, // 10 min
  })

  // 6. Justify (unless skipped)
  if (!shouldSkipJustify()) {
    await log(`[Code-Synapse] Running justify locally...`)
    execSync(`${bootstrapCli} justify`, {
      cwd: workspacePath,
      stdio: "pipe",
      timeout: 15 * 60 * 1000, // 15 min
    })
  }

  // 7. Start REST API viewer in background (find available port)
  const port = 3100 + Math.floor(Math.random() * 900)
  await log(`[Code-Synapse] Starting REST API viewer on port ${port}...`)

  const proc = spawn(bootstrapCli, ["viewer", "--port", String(port)], {
    cwd: workspacePath,
    stdio: "ignore",
    detached: true,
  })
  proc.unref()

  const apiUrl = `http://localhost:${port}`

  // 8. Wait for server
  await waitForApi(apiUrl)

  const client = createCodeSynapseClient(apiUrl)

  return {
    client,
    metadata: { mcpUrl: apiUrl, workspacePath },
  }
}
