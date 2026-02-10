import { existsSync } from "fs"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import {
  getWorkspacePath,
  readFile,
  writeFiles,
} from "@/lib/workspace/local-workspace"

type Project = Database["public"]["Tables"]["projects"]["Row"]

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    json: "json",
    css: "css",
    html: "html",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    prisma: "prisma",
    env: "dotenv",
    toml: "toml",
    xml: "xml",
    svg: "xml",
  }
  return map[ext] ?? "plaintext"
}

function isPathSafe(filePath: string): boolean {
  // Reject directory traversal attempts
  if (filePath.includes("..")) return false
  // Reject absolute paths
  if (filePath.startsWith("/")) return false
  // Reject null bytes
  if (filePath.includes("\0")) return false
  return true
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id } = await params
    const filePath = req.nextUrl.searchParams.get("path")

    if (!filePath || !isPathSafe(filePath)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

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
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      )
    }

    try {
      const content = readFile(workspacePath, filePath)
      return NextResponse.json({
        content,
        language: detectLanguage(filePath),
      })
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
  } catch (error: unknown) {
    console.error("Workspace file GET error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id } = await params
    const body = (await req.json()) as { path?: string; content?: string }
    const { path: filePath, content } = body

    if (!filePath || typeof content !== "string" || !isPathSafe(filePath)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

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
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      )
    }

    writeFiles(workspacePath, [{ path: filePath, content }])
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Workspace file PUT error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
