/**
 * OpenHands Prompt Builder
 *
 * Builds the detailed task prompt that is sent to OpenHands as the initial
 * user message when creating a conversation. This is the most critical file
 * in the integration — the quality of the prompt determines how well OpenHands
 * behaves as an agentic coder.
 *
 * The prompt includes boilerplate conventions, full behavioral/code contracts,
 * and test-first instructions.
 */

import type { SliceContract } from "@/lib/ai/gemini-codegen"
import { env } from "@/env.mjs"

/* -------------------------------------------------------------------------- */
/*  Boilerplate conventions (reused from gemini-codegen.ts)                    */
/* -------------------------------------------------------------------------- */

const BOILERPLATE_CONVENTIONS = `
PROJECT CONVENTIONS (10xR-AI/nextjs_fullstack_boilerplate):

FRAMEWORK: Next.js 16 App Router, React 19, TypeScript strict mode.

MONGOOSE MODELS (lib/models/*.ts):
  - Define interface: export interface IExample extends mongoose.Document { ... }
  - Define schema: const ExampleSchema = new Schema<IExample>({ ... }, { timestamps: true })
  - Export model: export const Example = mongoose.models.Example || mongoose.model<IExample>("Example", ExampleSchema)
  - Always add indexes for query patterns.
  - Import connectDB: import { connectDB } from "@/lib/db/mongoose"

API ROUTES (app/api/*/route.ts):
  - Auth guard: const session = await auth.api.getSession({ headers: await headers() })
  - Import auth: import { auth } from "@/lib/auth"; import { headers } from "next/headers"
  - Use Zod for request validation.
  - Always await connectDB() before Mongoose queries.
  - Return NextResponse.json(...).

PAGES (app/(dashboard)/*/page.tsx):
  - Server Components by default (no "use client" unless needed).
  - Data fetching with await directly in the component.
  - Wrap data in <Suspense> with <Skeleton> fallback.

CLIENT COMPONENTS (components/**/*.tsx):
  - Add "use client" at top.
  - Use shadcn/ui primitives: Button, Card, CardContent, Input, Badge, Dialog, DataTable.
  - Always import from "@/components/ui/...".
  - Tailwind CSS v4 for styling. Dark theme (bg-background, text-foreground).

TESTS — VITEST (*.test.ts or *.test.tsx):
  - Import: import { describe, it, expect, vi } from "vitest"
  - Mock Mongoose models with vi.mock().
  - Test API routes by calling the handler function directly.
  - Co-locate tests next to source or put in __tests__/ directory.

TESTS — PLAYWRIGHT E2E (e2e/*.spec.ts):
  - Import: import { test, expect } from "@playwright/test"
  - Base URL is http://127.0.0.1:3000 (configured in playwright.config.ts).
  - Navigate, interact, assert visible text/elements.
  - Use page.goto(), page.click(), page.fill(), expect(page.locator(...)).

IMPORTANT PATTERNS:
  - Use "use server" for Server Actions.
  - Use @/lib/utils for cn() classname merging.
  - Error handling: catch (error: unknown) { ... }
  - No default exports for components (named exports only, except pages).
  - Pages use default export.
`.trim()

/* -------------------------------------------------------------------------- */
/*  Agentic loop instructions                                                  */
/* -------------------------------------------------------------------------- */

const AGENTIC_INSTRUCTIONS = `
## AGENTIC WORKFLOW — Follow this exact sequence:

1. **CLONE & SETUP**:
   - The workspace already has the boilerplate cloned.
   - Run \`pnpm install\` if needed.
   - Read the project structure to understand the codebase.

2. **UNDERSTAND CONTRACTS**:
   - Read the behavioral contract and code contract below carefully.
   - Plan your implementation approach BEFORE writing any code.
   - Explain your reasoning at each step (your thoughts will be displayed to the user).

3. **WRITE TESTS FIRST (TDD)**:
   - Create Vitest unit tests for the core logic/API routes.
   - Create Playwright E2E tests for user flows.
   - Run the tests — they should FAIL initially (red phase).

4. **IMPLEMENT ONE FILE AT A TIME**:
   - Write each file incrementally, starting with models, then API routes, then UI.
   - After EACH file, run \`pnpm build\` to check for TypeScript errors.
   - Fix any build errors immediately before moving on.

5. **RUN TESTS**:
   - Run \`pnpm test\` for unit tests.
   - If tests fail: read the error output carefully, diagnose the issue, fix the specific file, re-run.
   - Iterate until all unit tests pass.

6. **E2E TESTING**:
   - Start the dev server: \`pnpm dev &\`
   - Run Playwright E2E tests: \`npx playwright test\`
   - If E2E tests fail: diagnose, fix, re-test.

7. **SELF-HEAL LOOP**:
   - If any test fails, DO NOT regenerate the entire file.
   - Instead: read the error, identify the specific line/issue, make a targeted fix.
   - This is how a senior engineer works — precise fixes, not wholesale rewrites.

8. **FINAL VERIFICATION**:
   - Ensure all tests pass (unit + E2E).
   - Ensure \`pnpm build\` succeeds with zero errors.
   - Report your confidence in the implementation.

## COMMUNICATION RULES:
- Think out loud — explain your decisions as you work.
- When you write a file, explain WHY you structured it that way.
- When a test fails, explain your diagnosis before fixing.
- Be specific about what you're doing at each step.
- Use clear, engineer-level language (this is displayed to a technical audience).
`.trim()


/* -------------------------------------------------------------------------- */
/*  MCP tool instructions                                                      */
/* -------------------------------------------------------------------------- */

function getMcpInstructions(): string {
  const leftBrain = env.LEFT_BRAIN_API_URL ?? "http://localhost:3000/api/mcp/left-brain"
  const rightBrain = env.RIGHT_BRAIN_API_URL ?? "http://localhost:3000/api/mcp/right-brain"

  return `
## MCP TOOL ENDPOINTS (if available):
- Left Brain (Analysis/Planning): ${leftBrain}
- Right Brain (UI/UX Contracts): ${rightBrain}
These can be queried for additional context about the legacy application being transmuted.
`.trim()
}

/* -------------------------------------------------------------------------- */
/*  Main prompt builder                                                        */
/* -------------------------------------------------------------------------- */

export interface BuildPromptOptions {
  slice: SliceContract
  /** Optional list of files from previous slices (for context) */
  previousSliceFiles?: string[]
  /** Optional boilerplate directory tree for context */
  boilerplateTree?: string
}

/**
 * Build the complete task prompt for OpenHands.
 */
export function buildSliceBuildPrompt(options: BuildPromptOptions): string {
  const { slice, previousSliceFiles, boilerplateTree } = options

  const sections: string[] = []

  // Header
  sections.push(`# Task: Implement "${slice.name}" Feature`)
  sections.push("")

  // Description
  if (slice.description) {
    sections.push(`## Feature Description`)
    sections.push(slice.description)
    sections.push("")
  }

  // Boilerplate conventions
  sections.push(`## Project Conventions`)
  sections.push(BOILERPLATE_CONVENTIONS)
  sections.push("")

  // Boilerplate tree
  if (boilerplateTree) {
    sections.push(`## Current Project Structure`)
    sections.push("```")
    sections.push(boilerplateTree)
    sections.push("```")
    sections.push("")
  }

  // Previous slice files (for multi-slice builds)
  if (previousSliceFiles && previousSliceFiles.length > 0) {
    sections.push(`## Previously Implemented Files`)
    sections.push("These files already exist from previous slices — do not overwrite them unless necessary:")
    for (const f of previousSliceFiles) {
      sections.push(`- ${f}`)
    }
    sections.push("")
  }

  // Behavioral contract
  const bc = slice.behavioral_contract
  if (bc) {
    sections.push(`## Behavioral Contract`)
    if (bc.user_flows && bc.user_flows.length > 0) {
      sections.push(`### User Flows`)
      for (const flow of bc.user_flows) {
        sections.push(`- ${flow}`)
      }
    }
    if (bc.inputs && bc.inputs.length > 0) {
      sections.push(`### Inputs`)
      for (const input of bc.inputs) {
        sections.push(`- ${input}`)
      }
    }
    if (bc.expected_outputs && bc.expected_outputs.length > 0) {
      sections.push(`### Expected Outputs`)
      for (const output of bc.expected_outputs) {
        sections.push(`- ${output}`)
      }
    }
    if (bc.visual_assertions && bc.visual_assertions.length > 0) {
      sections.push(`### Visual Assertions`)
      for (const assertion of bc.visual_assertions) {
        sections.push(`- ${assertion}`)
      }
    }
    sections.push("")
  }

  // Code contract
  const cc = slice.code_contract
  if (cc) {
    sections.push(`## Code Contract`)
    if (cc.files && cc.files.length > 0) {
      sections.push(`### Files to Create/Modify`)
      for (const file of cc.files) {
        sections.push(`- **${file.path}** (${file.action}): ${file.description}`)
      }
    }
    if (cc.implementation_steps && cc.implementation_steps.length > 0) {
      sections.push(`### Implementation Steps`)
      for (let i = 0; i < cc.implementation_steps.length; i++) {
        const step = cc.implementation_steps[i]
        if (step) {
          sections.push(`${i + 1}. **${step.title}**: ${step.details}`)
        }
      }
    }
    if (cc.key_decisions && cc.key_decisions.length > 0) {
      sections.push(`### Key Decisions`)
      for (const decision of cc.key_decisions) {
        sections.push(`- ${decision}`)
      }
    }
    if (cc.pseudo_code) {
      sections.push(`### Pseudo-code`)
      sections.push("```")
      sections.push(cc.pseudo_code)
      sections.push("```")
    }
    if (cc.verification && cc.verification.length > 0) {
      sections.push(`### Verification Criteria`)
      for (const v of cc.verification) {
        sections.push(`- ${v}`)
      }
    }
    sections.push("")
  }

  // Modernization flags
  const mf = slice.modernization_flags
  if (mf) {
    sections.push(`## Modernization Flags`)
    if (mf.uses_server_components) sections.push("- Uses React Server Components")
    if (mf.uses_api_routes) sections.push("- Uses Next.js API Routes")
    if (mf.uses_database) sections.push("- Uses Database (Mongoose/MongoDB)")
    if (mf.uses_auth) sections.push("- Uses Authentication (Better Auth)")
    if (mf.uses_realtime) sections.push("- Uses Realtime features")
    sections.push("")
  }

  // Agentic instructions
  sections.push(AGENTIC_INSTRUCTIONS)
  sections.push("")

  // MCP tools
  sections.push(getMcpInstructions())
  sections.push("")

  return sections.join("\n")
}
