import { existsSync, readdirSync, statSync } from "fs"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { join } from "path"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { getWorkspacePath } from "@/lib/workspace/local-workspace"

type Project = Database["public"]["Tables"]["projects"]["Row"]

interface FileEntry {
  name: string
  path: string
  type: "file" | "directory"
  children: FileEntry[]
}

const EXCLUDE = new Set([
  "node_modules",
  ".git",
  ".next",
  ".lazarus",
  "playwright-report",
  "test-results",
  ".turbo",
  ".pnpm-store",
])

function buildTree(dir: string, prefix: string): FileEntry[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }

  const results: FileEntry[] = []

  for (const entry of entries) {
    if (EXCLUDE.has(entry)) continue
    const fullPath = join(dir, entry)
    const relPath = prefix ? `${prefix}/${entry}` : entry

    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        results.push({
          name: entry,
          path: relPath,
          type: "directory",
          children: buildTree(fullPath, relPath),
        })
      } else {
        results.push({
          name: entry,
          path: relPath,
          type: "file",
          children: [],
        })
      }
    } catch {
      // Skip files we can't stat
    }
  }

  // Sort: directories first, then alphabetical
  results.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return results
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id } = await params

    const { data: project } = (await (supabase as any)
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single()) as { data: Project | null }

    if (!project) {
      return new NextResponse("Not Found", { status: 404 })
    }

    const workspacePath = getWorkspacePath(id)
    if (!existsSync(workspacePath)) {
      return NextResponse.json({ tree: [], exists: false })
    }

    const tree = buildTree(workspacePath, "")

    return NextResponse.json({ tree, exists: true })
  } catch (error: unknown) {
    console.error("Workspace API error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
