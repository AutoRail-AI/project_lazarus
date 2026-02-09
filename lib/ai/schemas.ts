/**
 * Zod schemas for Gemini structured outputs.
 * Used with responseMimeType: "application/json" + responseJsonSchema.
 * Reference: https://ai.google.dev/gemini-api/docs/structured-output
 */

import { z } from "zod"

/* -------------------------------------------------------------------------- */
/*  Architect Plan (Phase 1)                                                   */
/* -------------------------------------------------------------------------- */

/** A single phase in the high-level migration plan. */
export const architectPlanEntrySchema = z.object({
  name: z
    .string()
    .describe("Short name for the phase, e.g. 'Database & Infrastructure'"),
  description: z
    .string()
    .describe(
      "2-3 sentence overview of what this phase accomplishes and why it matters"
    ),
  category: z
    .string()
    .describe(
      "Phase category: infrastructure, auth, layout, core_feature, page, integration, or polish"
    ),
  key_responsibilities: z
    .array(z.string())
    .describe("3-6 bullet points of what this phase delivers"),
  depends_on: z
    .array(z.string())
    .describe(
      "Names of phases that must complete before this one can start"
    ),
})

export const architectPlanSchema = z.array(architectPlanEntrySchema).max(10)
export type ArchitectPlanEntry = z.infer<typeof architectPlanEntrySchema>

/* -------------------------------------------------------------------------- */
/*  Detailed Vertical Slice (Phase 2)                                          */
/* -------------------------------------------------------------------------- */

/** File operation in an implementation guide. */
const fileEntrySchema = z.object({
  path: z.string().describe("File path relative to project root, e.g. 'lib/db/schema.ts'"),
  action: z.string().describe("'create' for new files, 'modify' for existing files"),
  description: z
    .string()
    .describe("What this file does and key contents"),
})

/** A single implementation step. */
const implementationStepSchema = z.object({
  title: z.string().describe("Step title, e.g. 'Define Database Schema'"),
  details: z
    .string()
    .describe(
      "Detailed instructions: what to implement, key fields/types, patterns to use. Include pseudo-code inline when helpful."
    ),
})

/** Rich vertical slice with IMPLEMENTATION.md-quality detail. */
export const generatedSliceSchema = z.object({
  name: z.string().describe("Short identifier for the slice"),
  description: z
    .string()
    .describe(
      "Rich overview paragraph: what this slice implements, why it matters, how it fits into the architecture. 3-5 sentences."
    ),
  priority: z.number().int().min(1).describe("Build order (1 = first)"),
  dependencies: z
    .array(z.string())
    .describe("Names of slices that must be built before this one"),
  behavioral_contract: z.object({
    user_flows: z
      .array(z.string())
      .describe("End-to-end user flows this slice enables"),
    inputs: z
      .array(z.string())
      .describe("User inputs and data sources"),
    expected_outputs: z
      .array(z.string())
      .describe("Expected results, responses, and state changes"),
    visual_assertions: z
      .array(z.string())
      .describe("What should be visually verifiable on screen"),
  }),
  code_contract: z.object({
    files: z
      .array(fileEntrySchema)
      .describe("Files to create or modify, with descriptions"),
    implementation_steps: z
      .array(implementationStepSchema)
      .describe("Ordered steps to build this slice"),
    key_decisions: z
      .array(z.string())
      .describe(
        "Architecture decisions: why this approach, trade-offs considered"
      ),
    pseudo_code: z
      .string()
      .describe(
        "Key pseudo-code snippets showing the most important logic, data models, or API signatures"
      ),
    verification: z
      .array(z.string())
      .describe("Checklist items to verify this slice is complete and working"),
  }),
  modernization_flags: z.object({
    uses_server_components: z.boolean().describe("Whether this slice uses React Server Components"),
    uses_api_routes: z.boolean().describe("Whether this slice defines API routes"),
    uses_database: z.boolean().describe("Whether this slice interacts with the database"),
    uses_auth: z.boolean().describe("Whether this slice requires authentication"),
    uses_realtime: z.boolean().describe("Whether this slice uses realtime/websocket features"),
  }),
})

export const generatedSlicesArraySchema = z.array(generatedSliceSchema)

export type GeneratedSliceSchema = z.infer<typeof generatedSliceSchema>

/* -------------------------------------------------------------------------- */
/*  Legacy compat — sliceContractSchema (used by some callers)                 */
/* -------------------------------------------------------------------------- */

export const sliceContractSchema = z
  .record(z.string(), z.any())
  .describe("Contract object (behavioral or code)")

/* -------------------------------------------------------------------------- */
/*  Thought signatures & confidence                                            */
/* -------------------------------------------------------------------------- */

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
