/**
 * Abstraction over Daytona vs local for running Code-Synapse.
 * Auto-detects: if DAYTONA_API_KEY + DAYTONA_API_URL set → use Daytona; else → local.
 */

import { execSync, spawn } from "child_process"
import { env } from "@/env.mjs"
import {
  cloneRepoInSandbox,
  createDaytonaSandbox,
  executeCommand,
  getPreviewLink,
  startBackgroundProcess,
} from "@/lib/daytona/runner"
import {
  type CodeSynapseClient,
  createCodeSynapseClient,
} from "@/lib/mcp/code-synapse-client"
import { checkoutRepo } from "./checkout"

interface CodeSynapseResult {
  client: CodeSynapseClient
  metadata: {
    mcpUrl: string
    sandboxId?: string
    workspacePath?: string
  }
}

function getCliPath(): string {
  return env.CODE_SYNAPSE_CLI_PATH || "code-synapse"
}

function shouldSkipJustify(): boolean {
  return env.CODE_SYNAPSE_SKIP_JUSTIFY === true
}

function useDaytona(): boolean {
  return Boolean(env.DAYTONA_API_KEY && env.DAYTONA_API_URL)
}

/**
 * Wait for the MCP server to become available.
 */
async function waitForMcp(url: string, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          method: "tools/list",
          params: {},
        }),
      })
      if (res.ok) return
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error(`MCP server at ${url} did not become available`)
}

/**
 * Run Code-Synapse on a project and return a client + metadata.
 */
export async function runCodeSynapse(
  projectId: string,
  githubUrl: string
): Promise<CodeSynapseResult> {
  // If LEFT_BRAIN_MCP_URL is pre-configured, skip clone+CLI and just connect
  if (env.LEFT_BRAIN_MCP_URL) {
    const client = createCodeSynapseClient(env.LEFT_BRAIN_MCP_URL)
    return {
      client,
      metadata: { mcpUrl: env.LEFT_BRAIN_MCP_URL },
    }
  }

  if (useDaytona()) {
    return runWithDaytona(projectId, githubUrl)
  }

  return runLocally(projectId, githubUrl)
}

async function runWithDaytona(
  projectId: string,
  githubUrl: string
): Promise<CodeSynapseResult> {
  const cli = getCliPath()
  const repoPath = "workspace/repo"

  // 1. Create sandbox
  console.log(`[Code-Synapse] Creating Daytona sandbox for project ${projectId}`)
  const sandboxId = await createDaytonaSandbox()

  // 2. Clone repo
  console.log(`[Code-Synapse] Cloning ${githubUrl} into sandbox`)
  await cloneRepoInSandbox(sandboxId, githubUrl, repoPath)

  // 3. Index
  console.log(`[Code-Synapse] Running index...`)
  await executeCommand(sandboxId, `${cli} index`, repoPath)

  // 4. Justify (unless skipped)
  if (!shouldSkipJustify()) {
    console.log(`[Code-Synapse] Running justify...`)
    await executeCommand(sandboxId, `${cli} justify`, repoPath)
  }

  // 5. Start MCP server in background
  console.log(`[Code-Synapse] Starting MCP server...`)
  await startBackgroundProcess(
    sandboxId,
    "code-synapse-mcp",
    `${cli} start --port 3100`,
    repoPath
  )

  // 6. Get preview URL
  const preview = await getPreviewLink(sandboxId, 3100)
  const mcpUrl = preview.url

  // 7. Wait for server
  await waitForMcp(mcpUrl)

  const client = createCodeSynapseClient(mcpUrl)

  return {
    client,
    metadata: { mcpUrl, sandboxId },
  }
}

async function runLocally(
  projectId: string,
  githubUrl: string
): Promise<CodeSynapseResult> {
  const cli = getCliPath()

  // 1. Clone repo
  const workspacePath = checkoutRepo(projectId, githubUrl)

  // 2. Index
  console.log(`[Code-Synapse] Running index locally...`)
  execSync(`${cli} index`, {
    cwd: workspacePath,
    stdio: "pipe",
    timeout: 10 * 60 * 1000, // 10 min
  })

  // 3. Justify (unless skipped)
  if (!shouldSkipJustify()) {
    console.log(`[Code-Synapse] Running justify locally...`)
    execSync(`${cli} justify`, {
      cwd: workspacePath,
      stdio: "pipe",
      timeout: 15 * 60 * 1000, // 15 min
    })
  }

  // 4. Start MCP server in background (find available port)
  const port = 3100 + Math.floor(Math.random() * 900)
  console.log(`[Code-Synapse] Starting MCP server on port ${port}...`)

  const proc = spawn(cli, ["start", "--port", String(port)], {
    cwd: workspacePath,
    stdio: "ignore",
    detached: true,
  })
  proc.unref()

  const mcpUrl = `http://localhost:${port}`

  // 5. Wait for server
  await waitForMcp(mcpUrl)

  const client = createCodeSynapseClient(mcpUrl)

  return {
    client,
    metadata: { mcpUrl, workspacePath },
  }
}
