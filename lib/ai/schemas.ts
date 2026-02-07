/**
 * Zod schemas for Gemini structured outputs.
 * Used with responseMimeType: "application/json" + responseJsonSchema.
 * Reference: https://ai.google.dev/gemini-api/docs/structured-output
 */

import { z } from "zod"

/** Single vertical slice schema for migration planning */
export const sliceContractSchema = z
  .record(z.string(), z.any())
  .describe("Contract object (behavioral or code)")

export const generatedSliceSchema = z.object({
  name: z.string().describe("Short identifier for the slice"),
  description: z.string().describe("What this slice implements"),
  priority: z.number().int().min(1).describe("Order (1 = first)"),
  behavioral_contract: sliceContractSchema.describe(
    "Inputs, outputs, visual assertions"
  ),
  code_contract: sliceContractSchema.describe("Functions, schema"),
  modernization_flags: sliceContractSchema.describe(
    "Flags like use_mcp, use_chat_interface"
  ),
  dependencies: z
    .array(z.string())
    .describe("Names of previous slices this depends on"),
})

export const generatedSlicesArraySchema = z.array(generatedSliceSchema)

export type GeneratedSliceSchema = z.infer<typeof generatedSliceSchema>

/** Thought signature for agent reasoning summary */
export const thoughtSignatureSchema = z.object({
  summary: z
    .string()
    .describe(
      "1-2 sentence summary of what is happening in the agent's reasoning"
    ),
  category: z
    .enum(["Planning", "Implementing", "Testing", "Debugging", "Healing"])
    .describe("Category of the current thought process"),
  confidenceImpact: z
    .number()
    .min(-0.2)
    .max(0.2)
    .describe(
      "Estimate of how these events affect overall confidence (-0.2 to 0.2)"
    ),
})

export type ThoughtSignatureSchema = z.infer<typeof thoughtSignatureSchema>

/** Confidence explanation (free-form text in a structured wrapper) */
export const confidenceExplanationSchema = z.object({
  explanation: z
    .string()
    .describe(
      "2-3 sentence explanation of the confidence score: what is working well and what needs improvement"
    ),
})

export type ConfidenceExplanationSchema = z.infer<
  typeof confidenceExplanationSchema
>
