/**
 * Gemini API client — single source of truth for all Google Gemini calls.
 * Uses @google/genai SDK with structured outputs (Zod + JSON Schema).
 * Decoupled: only this file imports @google/genai.
 *
 * Reference: https://ai.google.dev/gemini-api/docs/structured-output
 */

import { GoogleGenAI } from "@google/genai"
import { z } from "zod"

/** Default model. Use GEMINI_MODEL env to override. */
const DEFAULT_MODEL = "gemini-2.0-flash"

/**
 * Public interface for Gemini API calls.
 * All consumers use getGeminiClient() — no raw SDK exposure.
 */
export interface IGeminiClient {
  /** Generate plain text */
  generateText(
    prompt: string,
    options?: { systemInstruction?: string }
  ): Promise<string>
  /** Generate structured JSON using Zod schema (responseMimeType + responseJsonSchema) */
  generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: { systemInstruction?: string }
  ): Promise<T>
}

let ai: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set")
    }
    ai = new GoogleGenAI({ apiKey })
  }
  return ai
}

const modelId = () => process.env.GEMINI_MODEL || DEFAULT_MODEL

const geminiClient: IGeminiClient = {
  async generateText(prompt, options) {
    const client = getClient()
    const fullPrompt = options?.systemInstruction
      ? `${options.systemInstruction}\n\n${prompt}`
      : prompt

    const response = await client.models.generateContent({
      model: modelId(),
      contents: fullPrompt,
    })

    return response.text ?? ""
  },

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: { systemInstruction?: string }
  ) {
    const client = getClient()
    const fullPrompt = options?.systemInstruction
      ? `${options.systemInstruction}\n\n${prompt}`
      : prompt

    const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>

    const response = await client.models.generateContent({
      model: modelId(),
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
      },
    })

    const text = response.text ?? "{}"
    const parsed = JSON.parse(text) as unknown
    return schema.parse(parsed) as T
  },
}

/**
 * Returns the canonical Gemini client. Use this for all Gemini API calls.
 * Do not import @google/genai elsewhere.
 */
export function getGeminiClient(): IGeminiClient {
  return geminiClient
}
