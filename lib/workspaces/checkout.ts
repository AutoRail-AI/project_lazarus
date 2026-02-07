/**
 * Local git clone fallback for when Daytona is not configured.
 */

import { execSync } from "child_process"
import { existsSync, mkdirSync } from "fs"
import { join, resolve } from "path"
import { env } from "@/env.mjs"

function getWorkspacesRoot(): string {
  return env.WORKSPACES_ROOT || resolve(process.cwd(), "workspaces")
}

/**
 * Get the workspace path for a project.
 */
export function getWorkspacePath(projectId: string): string {
  return join(getWorkspacesRoot(), projectId, "repo")
}

/**
 * Clone a GitHub repo to the local workspace.
 * Uses --depth 1 for shallow clone.
 */
export function checkoutRepo(projectId: string, githubUrl: string): string {
  const workspacePath = getWorkspacePath(projectId)

  // Create parent directory if needed
  const parentDir = join(getWorkspacesRoot(), projectId)
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }

  // Skip if already cloned
  if (existsSync(workspacePath)) {
    console.log(`Workspace already exists at ${workspacePath}, reusing`)
    return workspacePath
  }

  console.log(`Cloning ${githubUrl} to ${workspacePath}`)
  execSync(`git clone --depth 1 ${githubUrl} ${workspacePath}`, {
    stdio: "pipe",
    timeout: 5 * 60 * 1000, // 5 minute timeout
  })

  return workspacePath
}
