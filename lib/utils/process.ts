/**
 * Generic process management utilities.
 *
 * - isPortOpen: TCP connectivity check
 * - killProcessOnPort: Kill any process on a given port
 */

import { execSync } from "child_process"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Check if a TCP port is accepting connections.
 */
export function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
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
export async function killProcessOnPort(port: number): Promise<void> {
    try {
        const pids = execSync(`lsof -ti:${port} 2>/dev/null`, { stdio: "pipe" })
            .toString()
            .trim()
        if (pids) {
            console.log(`[Process] Killing existing process(es) on port ${port}: ${pids}`)
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
