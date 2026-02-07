import type { Database } from "@/lib/db/types"
import { getGeminiClient } from "./gemini"
import {
  generatedSlicesArraySchema,
  type GeneratedSliceSchema,
} from "./schemas"

type Project = Database["public"]["Tables"]["projects"]["Row"]

export type GeneratedSlice = GeneratedSliceSchema

export async function generateSlices(
  project: Project
): Promise<GeneratedSlice[]> {
  const client = getGeminiClient()

  const metadata = (project.metadata as Record<string, unknown>) || {}
  const codeAnalysis = (metadata.code_analysis as Record<string, unknown>) || {}
  const behavioralAnalysis =
    (metadata.behavioral_analysis as Record<string, unknown>) || {}
  const targetFramework = project.target_framework || "Next.js"

  const prompt = `
    You are a software migration planner. 
    
    Legacy System Context:
    - Code Analysis (Left Brain): ${JSON.stringify(codeAnalysis, null, 2)}
    - Behavioral Analysis (Right Brain): ${JSON.stringify(behavioralAnalysis, null, 2)}
    
    Goal: Decompose this legacy application into vertical slices for migration to ${targetFramework}.
    
    Requirements:
    1. Each slice must be a self-contained, independently buildable feature.
    2. Order slices by dependency (foundational slices first, e.g., Auth, Layout).
    3. "priority" should be an integer starting at 1.
    4. "dependencies" should be an array of names of *previous* slices that this slice depends on.
    5. Include detailed "behavioral_contract" (inputs, outputs, visual assertions) and "code_contract" (functions, schema).
    6. Suggest "modernization_flags" (e.g., use_mcp, use_chat_interface).
    
    Output ONLY a valid JSON array of slice objects. No markdown formatting.
  `

  try {
    const slices = await client.generateStructured(
      prompt,
      generatedSlicesArraySchema
    )
    return slices
  } catch (error) {
    console.error("Failed to generate slices with Gemini:", error)
    return []
  }
}
