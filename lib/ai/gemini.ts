/**
 * Gemini API client — single source of truth for all Google Gemini calls.
 * Uses @google/genai SDK with structured outputs (Zod + JSON Schema).
 * Decoupled: only this file imports @google/genai.
 *
 * Features:
 * - Automatic retry with exponential backoff on 429 (rate limit)
 * - Falls back to a lighter model after retries are exhausted on the primary
 *
 * Reference: https://ai.google.dev/gemini-api/docs/structured-output
 */

import { GoogleGenAI } from "@google/genai"
import { z } from "zod"

/** Default model. Use GEMINI_MODEL env to override. */
const DEFAULT_MODEL = "gemini-3-pro-preview"

/** Fallback model used when primary hits persistent 429s or errors. */
const FALLBACK_MODEL = "gemini-3-flash-preview"

/** Max retries per model before falling back / throwing. */
const MAX_RETRIES = 3

/** Base delay for exponential backoff (ms). */
const BASE_DELAY_MS = 2000

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

const primaryModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function is429(err: unknown): boolean {
  if (typeof err === "object" && err !== null && "status" in err) {
    return (err as { status: number }).status === 429
  }
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")
}

/**
 * Call Gemini with retry + model fallback.
 * Tries the primary model up to MAX_RETRIES times with exponential backoff.
 * If all retries fail with 429, tries the fallback model with the same retry logic.
 */
async function callWithRetry<R>(
  fn: (model: string) => Promise<R>
): Promise<R> {
  const models = [primaryModel(), FALLBACK_MODEL]

  for (const model of models) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn(model)
      } catch (err: unknown) {
        if (!is429(err) || attempt === MAX_RETRIES - 1) {
          // Non-429 error or last attempt for this model — try fallback
          if (model === models[0] && is429(err)) {
            console.warn(
              `[Gemini] ${model} exhausted after ${MAX_RETRIES} retries (429), falling back to ${FALLBACK_MODEL}`
            )
            break // move to fallback model
          }
          throw err
        }
        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        console.warn(
          `[Gemini] 429 on ${model}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        )
        await sleep(delay)
      }
    }
  }

  // Should not reach here, but satisfy TS
  throw new Error("All Gemini retries exhausted")
}

const geminiClient: IGeminiClient = {
  async generateText(prompt, options) {
    const client = getClient()
    const fullPrompt = options?.systemInstruction
      ? `${options.systemInstruction}\n\n${prompt}`
      : prompt

    return callWithRetry(async (model) => {
      const response = await client.models.generateContent({
        model,
        contents: fullPrompt,
      })
      return response.text ?? ""
    })
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

    return callWithRetry(async (model) => {
      const response = await client.models.generateContent({
        model,
        contents: fullPrompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      })

      const text = response.text ?? "{}"
      const parsed = JSON.parse(text) as unknown
      return schema.parse(parsed) as T
    })
  },
}

/**
 * Returns the canonical Gemini client. Use this for all Gemini API calls.
 * Do not import @google/genai elsewhere.
 */
export function getGeminiClient(): IGeminiClient {
  return geminiClient
}
