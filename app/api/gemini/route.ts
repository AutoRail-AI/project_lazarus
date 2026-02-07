import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { getGeminiClient } from "@/lib/ai/gemini"
import { auth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await req.json()) as { prompt?: string; context?: string }
    const { prompt, context } = body

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const client = getGeminiClient()
    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt
    const text = await client.generateText(fullPrompt)

    return NextResponse.json({ text })
  } catch (error) {
    console.error("Gemini API error:", error)
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    )
  }
}
