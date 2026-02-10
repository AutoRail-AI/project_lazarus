import { existsSync } from "fs"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { getGeminiClient } from "@/lib/ai/gemini"
import {
  getWorkspacePath,
  snapshotDirectoryTree,
  writeFiles,
} from "@/lib/workspace/local-workspace"

type Project = Database["public"]["Tables"]["projects"]["Row"]
type AgentEvent = Database["public"]["Tables"]["agent_events"]["Row"]

const requestSchema = z.object({
  message: z.string().min(1).max(4000),
})

const responseSchema = z.object({
  reply: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    })
  ),
})

export async function POST(
  req: NextRequest,
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
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single()) as { data: Project | null }

    if (!project) {
      return new NextResponse("Not Found", { status: 404 })
    }

    const body = requestSchema.parse(await req.json())

    // Check workspace exists
    const workspacePath = getWorkspacePath(id)
    if (!existsSync(workspacePath)) {
      return NextResponse.json({
        reply: "No workspace found. Start a build first.",
        filesModified: [],
      })
    }

    // Get file tree for context
    const fileTree = snapshotDirectoryTree(workspacePath)

    // Fetch recent events for context (last 20)
    const { data: recentEvents } = (await (supabase as any)
      .from("agent_events")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(20)) as { data: AgentEvent[] | null }

    const eventsContext = (recentEvents ?? [])
      .reverse()
      .map(
        (e) =>
          `[${e.event_type}] ${e.content}${
            e.metadata
              ? ` (metadata: ${JSON.stringify(e.metadata).slice(0, 200)})`
              : ""
          }`
      )
      .join("\n")

    // Build Gemini prompt
    const systemInstruction = `You are an AI coding assistant for Project Lazarus. You help modify code in the project workspace.

Current workspace file tree:
${fileTree}

Recent build events:
${eventsContext || "(no recent events)"}

When the user asks to modify code, generate the file changes needed. Return a reply explaining what you did and an array of file objects with path and content.
If the user is just asking a question (not requesting code changes), return an empty files array.
File paths should be relative to the workspace root.`

    const gemini = getGeminiClient()
    const result = await gemini.generateStructured(
      body.message,
      responseSchema,
      { systemInstruction }
    )

    // Apply file changes if any
    const filesModified: string[] = []
    if (result.files.length > 0) {
      writeFiles(workspacePath, result.files)

      // Insert code_write events for each file
      for (const file of result.files) {
        const lineCount = file.content.split("\n").length
        await (supabase as any).from("agent_events").insert({
          project_id: id,
          event_type: "code_write",
          content: `Chat modification: ${file.path}`,
          metadata: {
            file: file.path,
            lines_added: lineCount,
            chat_modification: true,
          },
        })
        filesModified.push(file.path)
      }

      // Insert a thought event with the AI reply
      await (supabase as any).from("agent_events").insert({
        project_id: id,
        event_type: "thought",
        content: result.reply,
        metadata: { chat_reply: true },
      })
    }

    return NextResponse.json({
      reply: result.reply,
      filesModified,
    })
  } catch (error: unknown) {
    console.error("Chat API error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      )
    }
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
