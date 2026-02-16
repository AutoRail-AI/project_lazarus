/**
 * Code-Synapse process lifecycle manager.
 *
 * Manages spawning and killing of code-synapse viewer processes.
 * Extracted from the pipeline processor for reuse across pipelines.
 */

import { execSync, spawn } from "child_process"
import { env } from "@/env.mjs"
import { isPortOpen, killProcessOnPort } from "@/lib/utils/process"
import { insertThought, pacedLog, sleep } from "@/lib/pipeline/helpers"

/** Default port for the Code-Synapse server. */
export const CODE_SYNAPSE_PORT = 3100

/** Callbacks for the ready-signal watcher inside streamLogs. */
let readyCallbacks: { onReady: () => void; onFailed: (msg: string) => void } | null = null

/** PIDs of code-synapse processes we spawned. */
const spawnedPids = new Set<number>()

/**
 * Start code-synapse viewer at the target codebase and stream logs as thought events.
 * Returns the base URL once the server is online.
 */
export async function startCodeSynapseWithLogs(
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
                console.log(`[CodeSynapse] ${logLine}`)
                insertThought(projectId, logLine).catch(() => { })

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
        console.error("[CodeSynapse] process error:", err)
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

/**
 * Kill all code-synapse processes spawned by the pipeline.
 * Called on worker shutdown to avoid orphaned processes.
 * Kills the entire process group (detached processes create their own group).
 */
export function cleanupSpawnedProcesses(): void {
    Array.from(spawnedPids).forEach((pid) => {
        try {
            // Kill the process group (negative PID) since we used detached: true
            process.kill(-pid, "SIGTERM")
            console.log(`[CodeSynapse] Sent SIGTERM to process group ${pid}`)
        } catch {
            // Process may already be dead
            try {
                process.kill(pid, "SIGTERM")
                console.log(`[CodeSynapse] Sent SIGTERM to process ${pid}`)
            } catch {
                // Already gone
            }
        }
    })
    spawnedPids.clear()

    // Belt-and-suspenders: also kill anything on the default port
    try {
        execSync(`lsof -ti:${CODE_SYNAPSE_PORT} | xargs kill -9 2>/dev/null`, {
            stdio: "pipe",
            timeout: 5000,
        })
        console.log(`[CodeSynapse] Killed processes on port ${CODE_SYNAPSE_PORT}`)
    } catch {
        // Nothing on port
    }
}
