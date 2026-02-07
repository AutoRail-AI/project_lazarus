import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env.mjs"

export async function POST(req: NextRequest) {
  try {
    const mcpUrl = env.LEFT_BRAIN_MCP_URL
    if (!mcpUrl) {
      return NextResponse.json(
        { error: "LEFT_BRAIN_MCP_URL is not configured" },
        { status: 503 }
      )
    }

    const body = await req.text()

    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })

    const data = (await response.json()) as unknown
    return NextResponse.json(data, { status: response.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "MCP proxy error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
