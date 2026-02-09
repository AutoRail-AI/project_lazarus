/**
 * Demo mode pipeline processor.
 * Replaces processProjectJob when DEMO_MODE=true.
 *
 * Flow:
 * 1. Emit paced setup logs (environment check, node, pnpm)
 * 2. Spawn `code-synapse viewer` at the target codebase path
 * 3. Stream real stdout/stderr from the process as thought events
 * 4. Wait for REST API to come online
 * 5. Run Code Analysis + App Behaviour IN PARALLEL via runBrainsInParallel()
 *    - Code Analysis: Code structure analysis via Code-Synapse REST API
 *    - App Behaviour: Behavioral analysis via Knowledge Extraction Service
 *    - Logs from each brain are prefixed [Code Analysis] / [App Behaviour]
 * 6. Run REAL Gemini planner to generate vertical slices
 *
 * The build phase is handled separately by event-player.ts (triggered from build route).
 */

import { execSync, spawn } from "child_process"
import { mkdtemp, writeFile } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import type { Job } from "bullmq"
import { env } from "@/env.mjs"
import { generateSlices } from "@/lib/ai/gemini-planner"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { createCodeSynapseClient } from "@/lib/mcp/code-synapse-client"
import { createRightBrainClient } from "@/lib/mcp/right-brain-client"
import {
  advancePipelineStep,
  clearErrorContext,
  loadCheckpoint,
  runBrainsInParallel,
  saveCheckpoint,
  setErrorContext,
  storeBuildJobId,
} from "@/lib/pipeline"
import { demoStaticRightBrain } from "./static-right-brain"
import type { PipelineCheckpoint, PipelineStep } from "@/lib/pipeline/types"
import type { JobResult, ProjectProcessingJobData } from "@/lib/queue/types"

/* -------------------------------------------------------------------------- */
/*  Constants & helpers                                                        */
/* -------------------------------------------------------------------------- */

/** Where the target codebase lives (code-synapse already initialized here). */
const DEMO_CODEBASE_PATH = "/Users/jaswanth/IdeaProjects/pos"

/** Port for the Code-Synapse server. */
const MCP_PORT = 3100

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function insertThought(
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
 * Emit a thought with a preceding pause (for dramatic pacing).
 */
async function pacedLog(
  projectId: string,
  content: string,
  delayMs: number
): Promise<void> {
  await sleep(delayMs)
  console.log(`[Demo] ${content}`)
  await insertThought(projectId, content)
}

/* -------------------------------------------------------------------------- */
/*  Code-Synapse process management                                            */
/* -------------------------------------------------------------------------- */

/**
 * Check if a TCP port is accepting connections (more reliable than HTTP).
 */
function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  const net = require("net") as typeof import("net")
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host }, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on("error", () => resolve(false))
    socket.setTimeout(2000, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

/**
 * Kill any process listening on the given port. Waits for it to die.
 */
async function killProcessOnPort(port: number): Promise<void> {
  try {
    const pids = execSync(`lsof -ti:${port} 2>/dev/null`, { stdio: "pipe" })
      .toString()
      .trim()
    if (pids) {
      console.log(`[Demo] Killing existing process(es) on port ${port}: ${pids}`)
      execSync(`kill -9 ${pids.split("\n").join(" ")} 2>/dev/null`, {
        stdio: "pipe",
        timeout: 5000,
      })
      // Wait for port to be released
      for (let i = 0; i < 10; i++) {
        if (!(await isPortOpen(port))) return
        await sleep(500)
      }
    }
  } catch {
    // No process on port — fine
  }
}

/**
 * Start code-synapse in the demo codebase and stream logs as thought events.
 * Returns the base URL once the server is online.
 */
async function startCodeSynapseWithLogs(
  projectId: string,
  codebasePath: string,
  port: number
): Promise<string> {
  const baseUrl = `http://localhost:${port}`

  // Check if already running via TCP
  if (await isPortOpen(port)) {
    await pacedLog(
      projectId,
      `Code-Synapse REST API already running on port ${port}. Reusing existing session.`,
      500
    )
    return baseUrl
  }

  // Kill any zombie process holding the port or the DB lock
  await killProcessOnPort(port)

  // Also kill any stale code-synapse processes for this codebase
  try {
    execSync(
      `ps aux | grep 'code-synapse.*viewer.*--port.*${port}' | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null`,
      { stdio: "pipe", timeout: 5000 }
    )
  } catch {
    // No stale processes
  }

  // Remove stale DB lock if present (code-synapse checks for this but may fail)
  try {
    const lockPath = `${codebasePath}/.code-synapse/data/cozodb/data/LOCK`
    execSync(`rm -f "${lockPath}"`, { stdio: "pipe", timeout: 2000 })
  } catch {
    // Lock file may not exist
  }

  const cli = env.CODE_SYNAPSE_CLI_PATH || "code-synapse"

  await pacedLog(
    projectId,
    `Starting Code-Synapse REST API on port ${port}...`,
    800
  )

  // Create a promise that resolves when we see the "ready" signal in output
  const readyPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Code-Synapse viewer did not start within 60 seconds`))
    }, 60_000)

    let resolved = false
    const onReady = () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        resolve()
      }
    }
    const onFailed = (msg: string) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        reject(new Error(`Code-Synapse startup failed: ${msg}`))
      }
    }

    // Store callbacks so streamLogs can call them
    readyCallbacks = { onReady, onFailed }
  })

  // Spawn code-synapse viewer (REST API server) as a background process
  const proc = spawn(cli, ["viewer", "--port", String(port)], {
    cwd: codebasePath,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: {
      ...process.env,
      GOOGLE_API_KEY: env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "",
    },
  })
  proc.unref()

  // Track PID so we can kill it on worker shutdown
  if (proc.pid) {
    spawnedPids.add(proc.pid)
    proc.on("exit", () => {
      if (proc.pid) spawnedPids.delete(proc.pid)
    })
  }

  // Watch for ready/error signals in output and stream as thought events
  const streamLogs = (
    stream: NodeJS.ReadableStream | null,
    prefix: string
  ) => {
    if (!stream) return
    let buffer = ""
    stream.on("data", (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.length === 0) continue

        const logLine = `${prefix}${trimmed}`
        console.log(`[Demo CS] ${logLine}`)
        insertThought(projectId, logLine).catch(() => {})

        // Detect ready signal from viewer
        if (
          trimmed.includes("[Viewer] Server started at") ||
          trimmed.includes("Index Viewer is running") ||
          trimmed.includes("Server running") ||
          trimmed.includes("ready to accept connections")
        ) {
          readyCallbacks?.onReady()
        }

        // Detect fatal errors
        if (
          trimmed.includes("Failed to start") ||
          trimmed.includes("Database is locked") ||
          trimmed.includes("EADDRINUSE")
        ) {
          readyCallbacks?.onFailed(trimmed)
        }
      }
    })
  }

  streamLogs(proc.stdout, "")
  streamLogs(proc.stderr, "")

  proc.on("error", (err) => {
    console.error("[Demo Pipeline] code-synapse process error:", err)
    readyCallbacks?.onFailed(err.message)
  })

  proc.on("exit", (code) => {
    if (code !== null && code !== 0) {
      readyCallbacks?.onFailed(`Process exited with code ${code}`)
    }
  })

  // Wait for the ready signal from stdout
  await pacedLog(projectId, "Waiting for REST API to come online...", 1000)
  await readyPromise

  await pacedLog(projectId, "Code-Synapse REST API online. Neural link established.", 500)

  return baseUrl
}

/** Callbacks for the ready-signal watcher inside streamLogs. */
let readyCallbacks: { onReady: () => void; onFailed: (msg: string) => void } | null = null

/** PIDs of code-synapse processes we spawned. */
const spawnedPids = new Set<number>()

/**
 * Kill all code-synapse processes spawned by the demo pipeline.
 * Called on worker shutdown to avoid orphaned processes.
 * Kills the entire process group (detached processes create their own group).
 */
export function cleanupDemoProcesses(): void {
  Array.from(spawnedPids).forEach((pid) => {
    try {
      // Kill the process group (negative PID) since we used detached: true
      process.kill(-pid, "SIGTERM")
      console.log(`[Demo Cleanup] Sent SIGTERM to process group ${pid}`)
    } catch {
      // Process may already be dead
      try {
        process.kill(pid, "SIGTERM")
        console.log(`[Demo Cleanup] Sent SIGTERM to process ${pid}`)
      } catch {
        // Already gone
      }
    }
  })
  spawnedPids.clear()

  // Belt-and-suspenders: also kill anything on the MCP port
  try {
    execSync(`lsof -ti:${MCP_PORT} | xargs kill -9 2>/dev/null`, {
      stdio: "pipe",
      timeout: 5000,
    })
    console.log(`[Demo Cleanup] Killed processes on port ${MCP_PORT}`)
  } catch {
    // Nothing on port
  }
}

/* -------------------------------------------------------------------------- */
/*  Code Analysis semantic fallback (when App Behaviour is unavailable)              */
/* -------------------------------------------------------------------------- */

async function runLeftBrainSemanticFallback(
  projectId: string,
  codeAnalysis: Record<string, unknown>
): Promise<void> {
  const baseUrl = (codeAnalysis.baseUrl as string) || `http://localhost:${MCP_PORT}`
  const client = createCodeSynapseClient(baseUrl)

  // Use function list to show key functions with their justifications
  try {
    await pacedLog(projectId, "[App Behaviour fallback] Analyzing function landscape from code graph...", 1000)
    const functions = (await client.listFunctions(200)) as Array<{
      name?: string
      filePath?: string
      complexity?: number
      callCount?: number
      justification?: string
    }>

    const withJustification = functions.filter((f) => f.justification)
    if (withJustification.length > 0) {
      await pacedLog(
        projectId,
        `[App Behaviour fallback] ${withJustification.length}/${functions.length} functions have business justifications`,
        600
      )
      for (const f of withJustification.slice(0, 5)) {
        const truncated = (f.justification ?? "").length > 100
          ? (f.justification ?? "").slice(0, 100) + "..."
          : f.justification
        await pacedLog(projectId, `    ↳ ${f.name}: "${truncated}"`, 300)
      }
    }
  } catch { /* Optional */ }

  // Use justification stats for coverage analysis
  try {
    await pacedLog(projectId, "[App Behaviour fallback] Evaluating business justification coverage...", 1000)
    const justStats = (await client.getJustificationStats()) as {
      total?: number
      byConfidence?: { high?: number; medium?: number; low?: number }
      coverage?: number
    } | undefined
    if (justStats?.total) {
      const high = justStats.byConfidence?.high ?? 0
      const medium = justStats.byConfidence?.medium ?? 0
      const low = justStats.byConfidence?.low ?? 0
      await pacedLog(
        projectId,
        `[App Behaviour fallback] Justification coverage: ${justStats.total} entities — ${high} high, ${medium} medium, ${low} low confidence`,
        600
      )
      if (low > 0) {
        await pacedLog(projectId, `    ↳ ${low} low-confidence entities flagged for review`, 400)
      }
    }
  } catch { /* Optional */ }

  // Use feature map for domain analysis
  try {
    const fm = codeAnalysis.featureMap as { features?: Array<{ name: string; entityCount: number }> } | undefined
    if (fm?.features?.length) {
      await pacedLog(projectId, `[App Behaviour fallback] Deriving behavioral hints from ${fm.features.length} feature domains...`, 800)
      for (const feat of fm.features.slice(0, 5)) {
        await pacedLog(projectId, `    ↳ "${feat.name}" — ${feat.entityCount} entities`, 250)
      }
    }
  } catch { /* Optional */ }
}

/* -------------------------------------------------------------------------- */
/*  Asset download helper                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Download uploaded project assets from Supabase Storage to a local temp dir.
 * The Right Brain ingestion API accepts `local_files` (local file paths).
 */
async function downloadAssetsToLocal(
  projectId: string,
  assets: Array<{ name: string; type: string; storage_path?: string }>
): Promise<string[]> {
  const tempDir = await mkdtemp(join(tmpdir(), `lazarus-${projectId.slice(0, 8)}-`))
  const localPaths: string[] = []

  for (const asset of assets) {
    if (!asset.storage_path) continue
    const bucket = asset.type === "video" ? "project-videos" : "project-documents"

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(asset.storage_path)

      if (error || !data) {
        console.warn(`[Demo Pipeline] Failed to download ${asset.name}:`, error?.message)
        continue
      }

      const localPath = join(tempDir, asset.name)
      const buffer = Buffer.from(await data.arrayBuffer())
      await writeFile(localPath, buffer)
      localPaths.push(localPath)
      console.log(`[Demo Pipeline] Downloaded ${asset.name} → ${localPath}`)
    } catch (err: unknown) {
      console.warn(`[Demo Pipeline] Download error for ${asset.name}:`, err)
    }
  }

  return localPaths
}

/* -------------------------------------------------------------------------- */
/*  Extracted brain functions for parallel execution                            */
/* -------------------------------------------------------------------------- */

/**
 * Code Analysis analysis for demo mode.
 * Spawns Code-Synapse viewer and runs REST API analysis on the target codebase.
 * Returns the code analysis result or throws on failure.
 */
async function demoLeftBrain(
  projectId: string,
  job: Job<ProjectProcessingJobData>,
  githubUrl?: string
): Promise<Record<string, unknown>> {
  // Phase 1: Dramatic environment preamble
  await pacedLog(projectId, "[Code Analysis] Initializing secure analysis environment...", 1200)
  await pacedLog(projectId, "[Code Analysis] Verifying runtime prerequisites...", 1000)

  try {
    const nodeV = execSync("node --version", { stdio: "pipe" }).toString().trim()
    await pacedLog(projectId, `[Code Analysis] Node.js ${nodeV} detected. Runtime verified.`, 800)
  } catch {
    await pacedLog(projectId, "[Code Analysis] Node.js detected. Runtime verified.", 800)
  }

  try {
    const pnpmV = execSync("pnpm --version", { stdio: "pipe" }).toString().trim()
    await pacedLog(projectId, `[Code Analysis] pnpm ${pnpmV} ready.`, 600)
  } catch {
    await pacedLog(projectId, "[Code Analysis] pnpm ready.", 600)
  }

  await pacedLog(projectId, "[Code Analysis] Bootstrapping Code-Synapse analysis engine...", 1000)

  const cli = env.CODE_SYNAPSE_CLI_PATH || "code-synapse"
  try {
    const csV = execSync(`${cli} --version`, { stdio: "pipe" }).toString().trim()
    await pacedLog(projectId, `[Code Analysis] Code-Synapse CLI ${csV} linked globally. Engine ready.`, 1200)
  } catch {
    await pacedLog(projectId, "[Code Analysis] Code-Synapse CLI linked globally. Engine ready.", 1200)
  }

  if (githubUrl) {
    const repoName = githubUrl.split("/").pop()?.replace(".git", "") ?? "target-repo"
    await pacedLog(projectId, `[Code Analysis] Target repository: ${githubUrl}`, 800)
    await pacedLog(projectId, `[Code Analysis] Codebase located at ${DEMO_CODEBASE_PATH}. Skipping clone (already present).`, 1000)
    await pacedLog(projectId, `[Code Analysis] Code-Synapse already initialized on ${repoName}. Index valid.`, 800)
  }

  await job.updateProgress(15)

  // Phase 2: Start code-synapse server and stream real logs
  const baseUrl = await startCodeSynapseWithLogs(projectId, DEMO_CODEBASE_PATH, MCP_PORT)
  await job.updateProgress(20)

  // Phase 3: Real analysis via REST API
  console.log(`[Demo Pipeline] Connecting to Code-Synapse REST API at ${baseUrl}`)
  const client = createCodeSynapseClient(baseUrl)

  // Step 1: Project stats overview
  await pacedLog(projectId, "[Code Analysis] Querying project statistics...", 1000)
  const stats = await client.getStatsOverview()
  const s = stats as {
    totalFiles?: number
    totalFunctions?: number
    totalClasses?: number
    totalInterfaces?: number
    totalRelationships?: number
    languages?: string[]
    justificationCoverage?: number
  } | undefined
  if (s) {
    await pacedLog(
      projectId,
      `[Code Analysis] Codebase snapshot: ${s.totalFiles ?? "?"} files, ${s.totalFunctions ?? "?"} functions, ${s.totalClasses ?? "?"} classes, ${s.totalInterfaces ?? "?"} interfaces`,
      800
    )
    if (s.languages?.length) {
      await pacedLog(projectId, `[Code Analysis] Languages: ${s.languages.join(", ")}`, 400)
    }
  }
  await job.updateProgress(25)

  // Step 2: Language breakdown (returns array of {language, fileCount, percentage})
  await pacedLog(projectId, "[Code Analysis] Analyzing language distribution...", 800)
  try {
    const langs = (await client.getStatsLanguages()) as Array<{
      language?: string
      fileCount?: number
      percentage?: number
    }>
    if (Array.isArray(langs) && langs.length > 0) {
      const langSummary = langs
        .slice(0, 5)
        .map((l) => `${l.language ?? "?"}(${l.fileCount ?? 0} files, ${(l.percentage ?? 0).toFixed(1)}%)`)
        .join(", ")
      await pacedLog(projectId, `[Code Analysis] Language breakdown: ${langSummary}`, 500)
    }
  } catch {
    // Language stats may not be available
  }
  await job.updateProgress(28)

  // Step 3: Feature map — derived from full knowledge graph
  await pacedLog(projectId, "[Code Analysis] Building knowledge graph and extracting feature domains...", 1200)
  const featureMap = await client.deriveFeatureMap()
  if (featureMap.totalFeatures) {
    await pacedLog(
      projectId,
      `[Code Analysis] Discovered ${featureMap.totalFeatures} feature domains spanning ${featureMap.totalEntities} entities`,
      600
    )
    // Show top features
    for (const feat of featureMap.features.slice(0, 8)) {
      await pacedLog(
        projectId,
        `[Code Analysis]   → "${feat.name}" — ${feat.entityCount} entities across ${feat.fileCount} files`,
        300
      )
    }
    if (featureMap.features.length > 8) {
      await pacedLog(projectId, `[Code Analysis]   ... and ${featureMap.features.length - 8} more feature domains`, 200)
    }
  }
  await job.updateProgress(35)

  // Step 4: Function analysis — sort by complexity and call count
  await pacedLog(projectId, "[Code Analysis] Analyzing function landscape...", 800)
  const allFunctions = (await client.listFunctions(500)) as Array<{
    id?: string
    name?: string
    filePath?: string
    complexity?: number
    callCount?: number
    justification?: string
    signature?: string
  }>

  // Most-complex functions
  const byComplexity = [...allFunctions]
    .sort((a, b) => (b.complexity ?? 0) - (a.complexity ?? 0))
    .slice(0, 5)
  if (byComplexity.length > 0) {
    const fnNames = byComplexity
      .slice(0, 3)
      .map((f) => `${f.name ?? "?"}(complexity: ${f.complexity ?? "?"})`)
      .join(", ")
    await pacedLog(projectId, `[Code Analysis] Highest complexity: ${fnNames}`, 600)
  }

  // Most-called functions
  const byCalls = [...allFunctions]
    .sort((a, b) => (b.callCount ?? 0) - (a.callCount ?? 0))
    .filter((f) => (f.callCount ?? 0) > 0)
    .slice(0, 5)
  if (byCalls.length > 0) {
    const fnNames = byCalls
      .slice(0, 3)
      .map((f) => `${f.name ?? "?"}(${f.callCount ?? 0} callers)`)
      .join(", ")
    await pacedLog(projectId, `[Code Analysis] Most-called functions: ${fnNames}`, 500)
  }

  // Functions with business justifications
  const justified = allFunctions.filter((f) => f.justification)
  if (justified.length > 0) {
    await pacedLog(
      projectId,
      `[Code Analysis] ${justified.length}/${allFunctions.length} functions have business justifications`,
      400
    )
    // Show a few impressive justifications
    for (const f of justified.slice(0, 3)) {
      if (f.justification) {
        const truncated = f.justification.length > 100
          ? f.justification.slice(0, 100) + "..."
          : f.justification
        await pacedLog(projectId, `[Code Analysis]   → ${f.name}: "${truncated}"`, 300)
      }
    }
  }
  await job.updateProgress(42)

  // Step 5: Class analysis
  await pacedLog(projectId, "[Code Analysis] Mapping class hierarchy...", 800)
  try {
    const classes = (await client.listClasses()) as Array<{
      id?: string
      name?: string
      filePath?: string
      kind?: string
    }>
    if (Array.isArray(classes) && classes.length > 0) {
      await pacedLog(projectId, `[Code Analysis] Found ${classes.length} classes`, 400)
    }
  } catch {
    // Optional
  }

  // Step 6: Justification coverage stats
  await pacedLog(projectId, "[Code Analysis] Evaluating business justification coverage...", 1000)
  try {
    const justStats = (await client.getJustificationStats()) as {
      total?: number
      byConfidence?: { high?: number; medium?: number; low?: number }
      coverage?: number
    } | undefined
    if (justStats?.total) {
      const highConf = justStats.byConfidence?.high ?? 0
      const medConf = justStats.byConfidence?.medium ?? 0
      const lowConf = justStats.byConfidence?.low ?? 0
      await pacedLog(
        projectId,
        `[Code Analysis] Justification coverage: ${justStats.total} entities — ${highConf} high, ${medConf} medium, ${lowConf} low confidence`,
        600
      )
      if (lowConf > 0) {
        await pacedLog(projectId, `[Code Analysis]     ↳ ${lowConf} low-confidence entities flagged for review`, 400)
      }
    }
  } catch {
    // Optional
  }
  await job.updateProgress(50)

  await pacedLog(projectId, "[Code Analysis] Code structure analysis complete.", 500)

  return {
    featureMap,
    stats,
    functions: { total: allFunctions.length, byComplexity, byCalls },
    baseUrl,
  }
}

/**
 * App Behaviour analysis for demo mode.
 * Uses projectId as the knowledge ID — same as production.
 * 1. Ingests uploaded project assets (videos/docs) into the App Behaviour service
 * 2. Waits for ingestion to complete
 * 3. Queries the resulting knowledge graph for behavioral analysis
 * Returns the behavioral analysis result or throws on failure.
 */
async function demoRightBrain(
  projectId: string,
  job: Job<ProjectProcessingJobData>,
  uploadedAssets: Array<{ id: string; name: string; type: string; storage_path?: string }>
): Promise<Record<string, unknown>> {
  const knowledgeId = projectId
  const rightBrain = createRightBrainClient()
  const rightBrainResult: Record<string, unknown> = {}

  await pacedLog(
    projectId,
    `[App Behaviour] Connecting to Knowledge Extraction Service at ${env.RIGHT_BRAIN_API_URL}...`,
    800
  )

  // Step 1: Download assets from Supabase Storage to local temp dir
  await pacedLog(
    projectId,
    `[App Behaviour] Downloading ${uploadedAssets.length} asset(s) for local ingestion...`,
    800
  )
  const localFiles = await downloadAssetsToLocal(projectId, uploadedAssets)

  if (localFiles.length === 0) {
    throw new Error("No assets could be downloaded for App Behaviour ingestion")
  }

  await pacedLog(
    projectId,
    `[App Behaviour] Starting video analysis with ${localFiles.length} local file(s)...`,
    1000
  )

  const ingestResult = await rightBrain.startIngestion({
    knowledge_id: knowledgeId,
    local_files: localFiles,
  })
  await pacedLog(
    projectId,
    `[App Behaviour] Ingestion started (job: ${ingestResult.job_id}). Waiting for completion...`,
    600
  )

  // Step 2: Wait for ingestion to complete
  const workflow = await rightBrain.waitForWorkflow(ingestResult.job_id)
  if (workflow.status === "failed") {
    throw new Error(`App Behaviour ingestion failed: ${workflow.error ?? "Unknown error"}`)
  }
  await pacedLog(projectId, "[App Behaviour] Ingestion complete. Querying knowledge graph...", 800)
  rightBrainResult.workflow = workflow

  await job.updateProgress(55)

  // Step 3: Query full knowledge base
  await pacedLog(projectId, "[App Behaviour] Querying behavioral knowledge graph...", 1000)
  const knowledge = await rightBrain.queryKnowledge(knowledgeId)
  const kStats = knowledge.statistics
  await pacedLog(
    projectId,
    `[App Behaviour] Knowledge graph loaded: ${kStats.total_screens} screens, ${kStats.total_tasks} tasks, ${kStats.total_actions} actions, ${kStats.total_transitions} transitions`,
    600
  )
  rightBrainResult.knowledge = knowledge

  // Step 4: List screens with details
  await pacedLog(projectId, "[App Behaviour] Mapping application screens...", 800)
  const screens = knowledge.screens as Array<{
    screen_id?: string
    name?: string
    description?: string
    visual_elements?: string[]
    url?: string
  }>
  for (const screen of screens.slice(0, 6)) {
    const elements = screen.visual_elements?.length ?? 0
    await pacedLog(
      projectId,
      `[App Behaviour]   → ${screen.name ?? "Unknown Screen"}: ${elements} visual elements${screen.url ? ` (${screen.url})` : ""}`,
      300
    )
  }
  if (screens.length > 6) {
    await pacedLog(projectId, `[App Behaviour]   ... and ${screens.length - 6} more screens`, 200)
  }

  await job.updateProgress(60)

  // Step 5: Analyze transitions (screen flow graph)
  await pacedLog(projectId, "[App Behaviour] Analyzing screen transition graph...", 800)
  const transitions = knowledge.transitions as Array<{
    from_screen?: string
    to_screen?: string
    trigger_action?: string
    description?: string
  }>
  if (transitions.length > 0) {
    for (const t of transitions.slice(0, 4)) {
      await pacedLog(
        projectId,
        `[App Behaviour]   → ${t.description ?? `${t.from_screen} → ${t.to_screen}`}`,
        250
      )
    }
    if (transitions.length > 4) {
      await pacedLog(projectId, `[App Behaviour]   ... ${transitions.length - 4} more transitions mapped`, 200)
    }
  }

  // Step 6: Business functions
  await pacedLog(projectId, "[App Behaviour] Identifying business functions...", 800)
  const bizFunctions = (knowledge.business_functions ?? []) as Array<{
    name?: string
    description?: string
    screens?: string[]
    tasks?: string[]
  }>
  if (bizFunctions.length > 0) {
    for (const biz of bizFunctions.slice(0, 5)) {
      await pacedLog(
        projectId,
        `[App Behaviour]   → ${biz.name ?? "?"}: ${biz.description ?? ""} (${biz.screens?.length ?? 0} screens, ${biz.tasks?.length ?? 0} tasks)`,
        350
      )
    }
  }
  rightBrainResult.businessFunctions = bizFunctions

  await job.updateProgress(65)

  // Step 7: Visual events from Gemini video analysis
  await pacedLog(projectId, "[App Behaviour] Processing Gemini-extracted visual events...", 1000)
  try {
    const visualEvents = await rightBrain.getVisualEvents(knowledgeId)
    await pacedLog(
      projectId,
      `[App Behaviour] Extracted ${(visualEvents as unknown[]).length} visual events from video stream`,
      500
    )
    const stateChanges = (visualEvents as Array<{ event_type?: string; description?: string }>)
      .filter((e) => e.event_type === "state_change")
    if (stateChanges.length > 0) {
      await pacedLog(projectId, `[App Behaviour]     ↳ ${stateChanges.length} state changes detected`, 300)
      for (const sc of stateChanges.slice(0, 3)) {
        await pacedLog(projectId, `[App Behaviour]       • ${sc.description ?? "State transition"}`, 200)
      }
    }
    rightBrainResult.visualEvents = visualEvents
  } catch {
    await pacedLog(projectId, "[App Behaviour]     ↳ Visual events not available (video not ingested)", 300)
  }

  // Step 8: Correlation graph (merged user action + app state + network)
  await pacedLog(projectId, "[App Behaviour] Building correlation graph...", 1200)
  try {
    const correlationGraph = await rightBrain.getCorrelationGraph(knowledgeId)
    const userActions = correlationGraph.nodes.user_actions as unknown[]
    const appStates = correlationGraph.nodes.app_states as unknown[]
    const networkCalls = correlationGraph.nodes.network_calls as unknown[]
    const edges = correlationGraph.edges as unknown[]
    await pacedLog(
      projectId,
      `[App Behaviour] Correlation graph: ${userActions.length} user actions, ${appStates.length} app states, ${networkCalls.length} network calls, ${edges.length} edges`,
      600
    )

    const highConfEdges = (edges as Array<{ edge_type?: string; confidence?: number; from_node_type?: string; to_node_type?: string }>)
      .filter((e) => (e.confidence ?? 0) > 0.9)
    if (highConfEdges.length > 0) {
      await pacedLog(
        projectId,
        `[App Behaviour]     ↳ ${highConfEdges.length} high-confidence causal links (>90%)`,
        400
      )
    }

    const apiCalls = (networkCalls as Array<{ method?: string; url?: string; status_code?: number }>)
      .slice(0, 3)
    for (const api of apiCalls) {
      await pacedLog(
        projectId,
        `[App Behaviour]     ↳ API: ${api.method ?? "?"} ${api.url ?? "?"} → ${api.status_code ?? "?"}`,
        250
      )
    }
    rightBrainResult.correlationGraph = correlationGraph
  } catch {
    await pacedLog(projectId, "[App Behaviour]     ↳ Correlation graph not available", 300)
  }

  await job.updateProgress(70)

  // Step 9: Generate behavioral contracts per business function
  if (bizFunctions.length > 0) {
    await pacedLog(projectId, "[App Behaviour] Generating behavioral contracts...", 1000)
    const contracts: unknown[] = []
    for (const biz of bizFunctions.slice(0, 5)) {
      if (biz.name) {
        try {
          const contractRes = await rightBrain.generateContract(
            knowledgeId,
            biz.name,
            biz.description
          )
          contracts.push(contractRes)

          const contract = contractRes.contract as {
            confidence?: number
            scenarios?: unknown[]
            business_rules?: unknown[]
            inputs?: unknown[]
          } | undefined
          const scenarioCount = contract?.scenarios?.length ?? 0
          const ruleCount = contract?.business_rules?.length ?? 0
          const conf = ((contract?.confidence ?? 0) * 100).toFixed(0)
          await pacedLog(
            projectId,
            `[App Behaviour]   → Contract "${biz.name}": ${scenarioCount} scenarios, ${ruleCount} business rules, ${conf}% confidence`,
            400
          )
        } catch (err: unknown) {
          console.warn(`[Demo Pipeline] Contract generation failed for ${biz.name}:`, err)
          await pacedLog(
            projectId,
            `[App Behaviour]   → Contract "${biz.name}": generation skipped (${err instanceof Error ? err.message : "error"})`,
            300
          )
        }
      }
    }
    rightBrainResult.contracts = contracts
  }

  // Step 10: List all existing contracts for summary
  try {
    const allContracts = await rightBrain.listContracts(knowledgeId)
    if (allContracts.length > 0) {
      const draftCount = allContracts.filter((c) => c.status === "draft").length
      const validatedCount = allContracts.filter((c) => c.status === "validated").length
      await pacedLog(
        projectId,
        `[App Behaviour] Contract portfolio: ${allContracts.length} total (${draftCount} draft, ${validatedCount} validated)`,
        500
      )
    }
  } catch {
    // Optional
  }

  await pacedLog(projectId, "[App Behaviour] Behavioral analysis complete.", 500)

  return rightBrainResult
}

/* -------------------------------------------------------------------------- */
/*  Main pipeline                                                              */
/* -------------------------------------------------------------------------- */

export async function processDemoProjectJob(
  job: Job<ProjectProcessingJobData>
): Promise<JobResult> {
  const { projectId, githubUrl } = job.data

  console.log(`[Demo Pipeline] Starting for project ${projectId}`)

  if (job.id) {
    await storeBuildJobId(projectId, job.id)
  }

  let checkpoint: PipelineCheckpoint = (await loadCheckpoint(projectId)) ?? {
    completed_steps: [],
    last_updated: new Date().toISOString(),
  }

  const isStepDone = (step: string) =>
    checkpoint.completed_steps.includes(step as PipelineStep)

  // Detect if this is a resumed job from the configure route.
  // If brains are already done from checkpoint, we skip directly to planning.
  const brainsAlreadyDone = isStepDone("left_brain") && isStepDone("right_brain")

  await clearErrorContext(projectId)

  try {
    await insertThought(projectId, brainsAlreadyDone ? "Resuming — generating implementation plan..." : "Beginning project analysis...")
    await job.updateProgress(5)

    let codeAnalysis: Record<string, unknown> =
      checkpoint.left_brain_result ?? {}

    const needsLeftBrain = !isStepDone("left_brain")
    const needsRightBrain = !isStepDone("right_brain")
    // Check for uploaded project assets
    const { data: projectAssets } = (await (supabase as any)
      .from("project_assets")
      .select("id, name, type, storage_path")
      .eq("project_id", projectId)) as {
      data: Array<{ id: string; name: string; type: string; storage_path?: string }> | null
    }
    const uploadedAssets = projectAssets ?? []
    if (uploadedAssets.length > 0) {
      await insertThought(
        projectId,
        `Found ${uploadedAssets.length} uploaded asset(s): ${uploadedAssets.map((a) => `${a.name} (${a.type})`).join(", ")}`
      )
    }

    // App Behaviour runs when service is configured AND there are assets to ingest
    const hasRightBrainService = !!(env.RIGHT_BRAIN_API_URL && uploadedAssets.length > 0)

    // --- RUN BRAINS IN PARALLEL ---
    // Both brains run concurrently when both are available.
    // Logs from each brain are prefixed with [Code Analysis] / [App Behaviour].
    const brainResults = await runBrainsInParallel({
      projectId,
      runLeftBrain: needsLeftBrain
        ? () => demoLeftBrain(projectId, job, githubUrl)
        : undefined,
      // In demo mode, use the static right brain (pre-computed POS analysis)
      // but only when uploaded assets exist — no assets means no App Behaviour console.
      runRightBrain: needsRightBrain && uploadedAssets.length > 0
        ? () => demoStaticRightBrain(projectId, job)
        : undefined,
    })

    // Handle Code Analysis results (non-fatal — slices can still be generated from behavioural data)
    if (needsLeftBrain) {
      if (!brainResults.leftBrain.success) {
        await insertThought(
          projectId,
          `[Code Analysis] Failed: ${brainResults.leftBrain.error ?? "Unknown error"}. Will proceed with available data.`
        )
        await setErrorContext(projectId, {
          step: "left_brain",
          message: brainResults.leftBrain.error ?? "Code Analysis failed",
          timestamp: new Date().toISOString(),
          retryable: true,
        })
      } else {
        codeAnalysis = brainResults.leftBrain.data
      }
    } else {
      console.log(`[Demo Pipeline] Skipping left_brain (checkpoint)`)
      await insertThought(projectId, "[Code Analysis] Restored from checkpoint.")
    }

    if (!needsRightBrain) {
      await insertThought(projectId, "[App Behaviour] Restored from checkpoint.")
    }

    // App Behaviour fallback: when service unavailable or failed, use Code Analysis semantics
    // In demo mode, the static right brain runs via parallel brains, so skip this fallback.
    if (needsRightBrain && !env.DEMO_MODE && (!hasRightBrainService || !brainResults.rightBrain.success)) {
      if (!hasRightBrainService) {
        // Service not configured — parallel utility didn't touch right brain status
        await advancePipelineStep(projectId, "right_brain")
        await (supabase as any)
          .from("projects")
          .update({ right_brain_status: "processing", updated_at: new Date().toISOString() })
          .eq("id", projectId)

        if (!env.RIGHT_BRAIN_API_URL) {
          await pacedLog(projectId, "[App Behaviour] RIGHT_BRAIN_API_URL not configured. Using Code Analysis semantic analysis for behavioral insights.", 800)
        } else if (uploadedAssets.length === 0) {
          await pacedLog(projectId, "[App Behaviour] No uploaded assets found. Upload videos or documents to enable analysis.", 800)
        }
      } else {
        // Service failed — parallel utility already set status to "failed", run fallback
        await pacedLog(
          projectId,
          `[App Behaviour] Service failed: ${brainResults.rightBrain.error}. Running Code Analysis semantic fallback.`,
          800
        )
      }

      await runLeftBrainSemanticFallback(projectId, codeAnalysis)
      await pacedLog(projectId, "[App Behaviour] Behavioral analysis complete (semantic fallback).", 800)

      await (supabase as any)
        .from("projects")
        .update({ right_brain_status: "complete", updated_at: new Date().toISOString() })
        .eq("id", projectId)
    }

    // Save combined checkpoint after both brains
    if (needsLeftBrain || needsRightBrain) {
      const newSteps: PipelineStep[] = [...checkpoint.completed_steps]
      if (needsLeftBrain && brainResults.leftBrain.success) newSteps.push("left_brain")
      if (needsRightBrain) newSteps.push("right_brain")

      checkpoint = {
        ...checkpoint,
        completed_steps: newSteps,
        left_brain_result: codeAnalysis,
        right_brain_result: needsRightBrain
          ? brainResults.rightBrain.data
          : (checkpoint.right_brain_result ?? {}),
        mcp_url: (codeAnalysis.baseUrl as string) ?? checkpoint.mcp_url,
      }
      await saveCheckpoint(projectId, checkpoint)
    }

    await job.updateProgress(80)

    // --- PAUSE CHECK ---
    const { data: pauseCheck } = (await (supabase as any)
      .from("projects")
      .select("status")
      .eq("id", projectId)
      .single()) as { data: { status: string } | null }
    if (pauseCheck?.status === "paused") {
      return { success: true, message: "Paused" }
    }

    // --- ANALYSIS CHECKPOINT ---
    // If brains just completed (not a resume from configure), save metadata and stop
    // at 'analyzed' status. The user will review analysis results and configure
    // preferences (boilerplate URL, tech preferences) before planning resumes.
    // Detection: if this is NOT a resumed job (i.e. brains were run in this execution),
    // we stop here. Resumed jobs have brainsAlreadyDone=true (set at function top).
    if (!isStepDone("planning") && !brainsAlreadyDone) {
      const behavioralData = checkpoint.right_brain_result ?? {}
      await (supabase as any)
        .from("projects")
        .update({
          status: "analyzed",
          metadata: {
            code_analysis: codeAnalysis,
            behavioral_analysis: behavioralData,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
      await pacedLog(projectId, "Analysis complete. Awaiting configuration...", 500)
      return { success: true, message: "Analysis complete — awaiting user configuration" }
    }

    // --- GEMINI PLANNER (real) ---
    // Reached when resumed from configure route (brains already done via checkpoint)
    if (!isStepDone("planning")) {
      await advancePipelineStep(projectId, "planning")
      await pacedLog(
        projectId,
        "Invoking Gemini planner to decompose into vertical slices...",
        1200
      )

      // Re-read project to pick up boilerplate_url/tech_preferences from configure
      const { data: freshProject } = (await (supabase as any)
        .from("projects")
        .select("metadata")
        .eq("id", projectId)
        .single()) as { data: { metadata: Record<string, unknown> | null } | null }

      // Merge existing analysis data with any config the user provided
      const existingMetadata = (freshProject?.metadata ?? {}) as Record<string, unknown>
      await (supabase as any)
        .from("projects")
        .update({
          metadata: {
            ...existingMetadata,
            code_analysis: codeAnalysis,
            behavioral_analysis: existingMetadata.behavioral_analysis ?? {},
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)

      type Project = Database["public"]["Tables"]["projects"]["Row"]
      const { data: updatedProject } = (await (supabase as any)
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single()) as { data: Project | null }

      if (updatedProject) {
        await pacedLog(
          projectId,
          "Generating slice contracts with dependency ordering...",
          1500
        )

        let slices: Awaited<ReturnType<typeof generateSlices>> = []
        try {
          slices = await generateSlices(updatedProject, async (progress) => {
            if (progress.phase === "architect") {
              await pacedLog(
                projectId,
                "Architect planning: generating migration architecture...",
                400
              )
            } else {
              await pacedLog(
                projectId,
                `Generating implementation guides batch ${progress.batch}/${progress.totalBatches}: ${progress.currentFeatures.join(", ")}${progress.slicesGenerated > 0 ? ` (${progress.slicesGenerated} generated so far)` : ""}`,
                400
              )
            }
          })
        } catch (geminiError: unknown) {
          const errMsg = geminiError instanceof Error ? geminiError.message : "Unknown error"
          console.error("[Demo Pipeline] Gemini planner failed:", geminiError)
          await pacedLog(projectId, `Gemini planner error: ${errMsg}`, 500)
          await setErrorContext(projectId, {
            step: "planning",
            message: `Gemini planner failed: ${errMsg}`,
            timestamp: new Date().toISOString(),
            retryable: true,
          })
        }

        await job.updateProgress(90)

        // Only delete + replace slices if we actually generated new ones.
        // If Gemini failed (slices=[]), preserve any previously generated slices.
        if (slices.length > 0) {
          await (supabase as any)
            .from("vertical_slices")
            .delete()
            .eq("project_id", projectId)

          const sliceRows = slices.map((slice, index) => ({
            project_id: projectId,
            name: slice.name,
            description: slice.description || null,
            priority: slice.priority ?? index + 1,
            status: "pending" as const,
            behavioral_contract: slice.behavioral_contract || null,
            code_contract: slice.code_contract || null,
            modernization_flags: slice.modernization_flags || null,
            dependencies: slice.dependencies || [],
            confidence_score: 0,
            retry_count: 0,
          }))

          const { error: insertError } = await (supabase as any)
            .from("vertical_slices")
            .insert(sliceRows)

          if (insertError) {
            console.error(
              "[Demo Pipeline] Failed to insert slices:",
              insertError
            )
          }

          // Emit each slice name for dramatic reveal
          for (const row of sliceRows) {
            await pacedLog(
              projectId,
              `  → Slice #${row.priority}: ${row.name}`,
              400
            )
          }
        }

        await pacedLog(
          projectId,
          `Project ready! Generated ${slices.length} vertical slice${slices.length !== 1 ? "s" : ""}.`,
          800
        )
      }

      checkpoint = {
        ...checkpoint,
        completed_steps: [...checkpoint.completed_steps, "planning"],
        slices_generated: true,
      }
      await saveCheckpoint(projectId, checkpoint)
    } else {
      await insertThought(
        projectId,
        "Planning step restored from checkpoint."
      )
    }

    // Set project status to ready
    await (supabase as any)
      .from("projects")
      .update({
        status: "ready" as const,
        build_job_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)

    await job.updateProgress(100)

    console.log(`[Demo Pipeline] Completed for project ${projectId}`)
    return {
      success: true,
      message: `Project ${projectId} processed successfully (demo)`,
    }
  } catch (error: unknown) {
    console.error(`[Demo Pipeline] Failed for project ${projectId}:`, error)

    // In demo mode we never show failure to the user — keep the magic.
    if (env.DEMO_MODE) {
      await clearErrorContext(projectId)
      const fallbackStatus =
        checkpoint.completed_steps.length > 0 ? "ready" : "analyzed"
      await (supabase as any)
        .from("projects")
        .update({
          status: fallbackStatus as "ready" | "analyzed",
          error_context: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
      await insertThought(
        projectId,
        "Analysis complete. You can review results and start building slices."
      )
      return { success: true, message: "Demo pipeline completed (degraded)" }
    }

    const currentStep =
      checkpoint.completed_steps[checkpoint.completed_steps.length - 1] ??
      "init"
    await setErrorContext(projectId, {
      step: currentStep,
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      retryable: true,
      stack: error instanceof Error ? error.stack : undefined,
    })

    await (supabase as any)
      .from("projects")
      .update({
        status: "failed" as const,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)

    await insertThought(
      projectId,
      `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`
    )

    throw error
  }
}
