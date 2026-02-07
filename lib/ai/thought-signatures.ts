import type { Database } from "@/lib/db/types"
import { getGeminiClient } from "./gemini"
import {
  thoughtSignatureSchema,
  type ThoughtSignatureSchema,
} from "./schemas"

type AgentEvent = Database["public"]["Tables"]["agent_events"]["Row"]

export type ThoughtSignature = ThoughtSignatureSchema

export async function generateThoughtSignature(
  events: AgentEvent[]
): Promise<ThoughtSignature> {
  const client = getGeminiClient()

  const eventLog = events
    .map((e) => `[${e.event_type}] ${e.content}`)
    .join("\n")

  const prompt = `
    You are the "inner voice" of an AI coding agent. Analyze the following recent events and summarize the current thought process.
    
    Events:
    ${eventLog}
    
    Output a JSON object with:
    1. "summary": A concise, 1-2 sentence summary of what is happening (e.g., "Detected a test failure in the login component; diagnosing root cause.").
    2. "category": One of "Planning", "Implementing", "Testing", "Debugging", "Healing".
    3. "confidenceImpact": A float between -0.2 and 0.2 estimating how these events affect overall confidence (positive for progress/success, negative for failures).
    
    Output ONLY valid JSON.
  `

  try {
    return await client.generateStructured(prompt, thoughtSignatureSchema)
  } catch (error) {
    console.error("Failed to generate thought signature:", error)
    // Fallback
    return {
      summary: "Processing...",
      category: "Implementing",
      confidenceImpact: 0
    }
  }
}
