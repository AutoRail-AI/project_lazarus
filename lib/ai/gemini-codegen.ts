/**
 * Gemini-powered code generation for slice builds.
 *
 * Three main functions:
 * 1. generateSliceCode — generates implementation files from slice contracts
 * 2. generateSliceTests — generates Vitest + Playwright tests
 * 3. diagnoseAndFix — self-healing: diagnose test failures and return fixed code
 *
 * All prompts include boilerplate context so Gemini generates code that fits
 * into the 10xR-AI/nextjs_fullstack_boilerplate project structure.
 */

import { getGeminiClient } from "@/lib/ai/gemini"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface FileOutput {
    path: string
    content: string
}

export interface CodeGenResult {
    files: FileOutput[]
    reasoning: string[]
}

export interface SliceContract {
    name: string
    description?: string | null
    behavioral_contract: {
        user_flows?: string[]
        inputs?: string[]
        expected_outputs?: string[]
        visual_assertions?: string[]
    } | null
    code_contract: {
        files?: Array<{ path: string; action: string; description: string }>
        implementation_steps?: Array<{ title: string; details: string }>
        key_decisions?: string[]
        pseudo_code?: string
        verification?: string[]
    } | null
    modernization_flags?: {
        uses_server_components?: boolean
        uses_api_routes?: boolean
        uses_database?: boolean
        uses_auth?: boolean
        uses_realtime?: boolean
    } | null
}

/* -------------------------------------------------------------------------- */
/*  Boilerplate conventions                                                    */
/* -------------------------------------------------------------------------- */

export const BOILERPLATE_CONVENTIONS = `
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
/*  File output parser                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Parse Gemini output that uses file-marker blocks:
 *   ===FILE: path/to/file.ts===
 *   ...content...
 *   ===END_FILE===
 *
 * Also extracts reasoning lines (lines before the first ===FILE or between ===END_FILE and ===FILE).
 */
export function parseFileOutput(raw: string): CodeGenResult {
    const files: FileOutput[] = []
    const reasoning: string[] = []

    const fileRegex = /===FILE:\s*(.+?)===\n([\s\S]*?)===END_FILE===/g
    let match: RegExpExecArray | null = null

    // Extract reasoning: everything outside file blocks
    let lastEnd = 0
    const fileBlockRegex = /===FILE:\s*.+?===[\s\S]*?===END_FILE===/g
    let blockMatch: RegExpExecArray | null = null
    while ((blockMatch = fileBlockRegex.exec(raw)) !== null) {
        const before = raw.slice(lastEnd, blockMatch.index).trim()
        if (before) {
            reasoning.push(
                ...before
                    .split("\n")
                    .map((l) => l.trim())
                    .filter((l) => l.length > 0 && !l.startsWith("```"))
            )
        }
        lastEnd = blockMatch.index + blockMatch[0].length
    }
    const trailing = raw.slice(lastEnd).trim()
    if (trailing) {
        reasoning.push(
            ...trailing
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0 && !l.startsWith("```"))
        )
    }

    // Extract files
    while ((match = fileRegex.exec(raw)) !== null) {
        const path = (match[1] ?? "").trim()
        const content = (match[2] ?? "").trimEnd()
        if (path && content) {
            files.push({ path, content })
        }
    }

    return { files, reasoning }
}

/* -------------------------------------------------------------------------- */
/*  1. Generate slice code                                                     */
/* -------------------------------------------------------------------------- */

const CODE_GEN_SYSTEM = `You are an expert Next.js developer adding features to an existing production project.
You write clean, modern TypeScript code following the project's established conventions.
You think like a senior engineer — explaining your decisions as you go.

CRITICAL RULES:
- Output files using ===FILE: path=== and ===END_FILE=== markers.
- Before the file blocks, write 3-5 lines of reasoning explaining your approach.
- Between file blocks, add brief reasoning lines explaining what comes next.
- Code must be complete and runnable — no placeholders like "// TODO" or "...".
- Follow the project conventions exactly (imports, patterns, naming).
- Include TypeScript types for all function parameters and return values.
- Include error handling (try/catch with unknown typing).
- For UI components, include proper loading states and empty states.`

export async function generateSliceCode(
    slice: SliceContract,
    boilerplateTree: string,
    previousSliceFiles?: string[]
): Promise<CodeGenResult> {
    const client = getGeminiClient()

    const bc = slice.behavioral_contract
    const cc = slice.code_contract

    const prompt = `
You are adding the "${slice.name}" feature to an existing Next.js project.

${slice.description ? `FEATURE DESCRIPTION:\n${slice.description}` : ""}

PROJECT DIRECTORY TREE (current state):
${boilerplateTree.slice(0, 3000)}

${BOILERPLATE_CONVENTIONS}

${previousSliceFiles?.length ? `FILES FROM PREVIOUS SLICES (already in project):\n${previousSliceFiles.join("\n")}` : ""}

BEHAVIORAL CONTRACT:
- User flows: ${bc?.user_flows?.join("; ") ?? "N/A"}
- Inputs: ${bc?.inputs?.join("; ") ?? "N/A"}
- Expected outputs: ${bc?.expected_outputs?.join("; ") ?? "N/A"}
- Visual assertions: ${bc?.visual_assertions?.join("; ") ?? "N/A"}

CODE CONTRACT — FILES TO CREATE/MODIFY:
${cc?.files?.map((f) => `  ${f.action.toUpperCase()}: ${f.path} — ${f.description}`).join("\n") ?? "N/A"}

IMPLEMENTATION STEPS:
${cc?.implementation_steps?.map((s, i) => `  ${i + 1}. ${s.title}: ${s.details}`).join("\n") ?? "N/A"}

KEY DECISIONS: ${cc?.key_decisions?.join("; ") ?? "N/A"}

PSEUDO-CODE REFERENCE:
${cc?.pseudo_code ?? "N/A"}

MODERNIZATION FLAGS:
${JSON.stringify(slice.modernization_flags ?? {}, null, 2)}

Generate all the files needed for this feature. Remember:
- Write reasoning before and between file blocks.
- Make all code production-quality and fully functional.
  `

    const raw = await client.generateText(prompt, {
        systemInstruction: CODE_GEN_SYSTEM,
    })

    return parseFileOutput(raw)
}

/* -------------------------------------------------------------------------- */
/*  2. Generate tests                                                          */
/* -------------------------------------------------------------------------- */

const TEST_GEN_SYSTEM = `You are a QA engineer writing tests for a Next.js project.
You write thorough, meaningful tests — not just "renders without error" but tests that
verify real behavior, API responses, data transformations, and UI interactions.

CRITICAL RULES:
- Output files using ===FILE: path=== and ===END_FILE=== markers.
- Write reasoning before and between file blocks.
- Generate BOTH Vitest unit tests and Playwright E2E tests when applicable.
- Vitest tests go in __tests__/ or co-located *.test.ts files.
- Playwright E2E tests go in e2e/*.spec.ts files.
- Tests must be specific: assert exact values, check specific DOM elements.
- Test thoroughly — exercise all code paths including edge cases.
- For Playwright tests: use realistic user interactions (goto, click, fill, waitFor).
- For Vitest tests: mock external deps (Mongoose, fetch) with vi.mock().
- Include at least 5 unit tests and 2 E2E tests per slice.`

export async function generateSliceTests(
    slice: SliceContract,
    generatedCode: FileOutput[],
    boilerplateTree: string
): Promise<CodeGenResult> {
    const client = getGeminiClient()

    const bc = slice.behavioral_contract
    const cc = slice.code_contract

    // Build a summary of generated code for context
    const codeSummary = generatedCode
        .map((f) => {
            const preview = f.content.slice(0, 500)
            return `--- ${f.path} (${f.content.split("\n").length} lines) ---\n${preview}${f.content.length > 500 ? "\n..." : ""}`
        })
        .join("\n\n")

    const prompt = `
Write tests for the "${slice.name}" feature that was just implemented.

${BOILERPLATE_CONVENTIONS}

GENERATED CODE TO TEST:
${codeSummary}

BEHAVIORAL CONTRACT (use for E2E tests):
- User flows: ${bc?.user_flows?.join("; ") ?? "N/A"}
- Visual assertions: ${bc?.visual_assertions?.join("; ") ?? "N/A"}
- Expected outputs: ${bc?.expected_outputs?.join("; ") ?? "N/A"}

VERIFICATION CHECKLIST (use for unit tests):
${cc?.verification?.map((v, i) => `  ${i + 1}. ${v}`).join("\n") ?? "N/A"}

PROJECT TREE: ${boilerplateTree.slice(0, 1500)}

Generate comprehensive tests. Remember:
- At least 5 Vitest unit tests covering model, API, and component logic.
- At least 2 Playwright E2E tests covering key user flows.
- Write reasoning explaining what each test verifies.
- Tests should be thorough enough to catch subtle bugs in the implementation.
  `

    const raw = await client.generateText(prompt, {
        systemInstruction: TEST_GEN_SYSTEM,
    })

    return parseFileOutput(raw)
}

/* -------------------------------------------------------------------------- */
/*  3. Diagnose and fix (self-healing)                                         */
/* -------------------------------------------------------------------------- */

const SELF_HEAL_SYSTEM = `You are a senior debugging engineer. A feature was implemented but tests are failing.
Your job is to:
1. Analyze the error output carefully.
2. Identify the exact root cause (file, function, line).
3. Provide a human-readable diagnosis (2-3 sentences).
4. Return ONLY the fixed files (not the whole codebase — just the files that need changes).

CRITICAL RULES:
- Start with a DIAGNOSIS section (plain text, 2-3 sentences) explaining the root cause.
  Be specific: name the file, the function, and the exact issue.
  Explain WHY it fails and what the fix is.
- Then output fixed files using ===FILE: path=== and ===END_FILE=== markers.
- Only include files that changed. Do not output unchanged files.
- The fix must be minimal and targeted — change as few lines as possible.
- After the fix, the tests MUST pass.`

export interface DiagnoseResult {
    diagnosis: string
    fixDescription: string
    files: FileOutput[]
}

export async function diagnoseAndFix(
    errorOutput: string,
    currentFiles: FileOutput[],
    sliceName: string
): Promise<DiagnoseResult> {
    const client = getGeminiClient()

    const fileSummary = currentFiles
        .map((f) => `--- ${f.path} ---\n${f.content}`)
        .join("\n\n")

    const prompt = `
The "${sliceName}" feature has failing tests. Diagnose and fix.

ERROR OUTPUT:
${errorOutput.slice(0, 4000)}

CURRENT SOURCE FILES:
${fileSummary.slice(0, 8000)}

Provide:
1. DIAGNOSIS: 2-3 sentences identifying the exact root cause.
2. FIX: Return only the files that need to change.
  `

    const raw = await client.generateText(prompt, {
        systemInstruction: SELF_HEAL_SYSTEM,
    })

    // Extract diagnosis from the text before the first ===FILE block
    const firstFileIdx = raw.indexOf("===FILE:")
    const diagnosisText = firstFileIdx >= 0 ? raw.slice(0, firstFileIdx).trim() : raw.trim()

    // Parse out the diagnosis lines
    const diagLines = diagnosisText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("```") && !l.startsWith("#"))

    // Find the diagnosis content (after DIAGNOSIS: label if present)
    let diagnosis = ""
    let fixDescription = ""
    let inDiagnosis = false
    let inFix = false

    for (const line of diagLines) {
        const lower = line.toLowerCase()
        if (lower.startsWith("diagnosis") || lower.startsWith("root cause")) {
            inDiagnosis = true
            inFix = false
            const afterColon = line.split(":").slice(1).join(":").trim()
            if (afterColon) diagnosis += afterColon + " "
            continue
        }
        if (lower.startsWith("fix") || lower.startsWith("solution") || lower.startsWith("resolution")) {
            inFix = true
            inDiagnosis = false
            const afterColon = line.split(":").slice(1).join(":").trim()
            if (afterColon) fixDescription += afterColon + " "
            continue
        }
        if (inDiagnosis) diagnosis += line + " "
        else if (inFix) fixDescription += line + " "
        else diagnosis += line + " " // Default to diagnosis
    }

    diagnosis = diagnosis.trim() || "Test failure detected. Analyzing and applying fix."
    fixDescription = fixDescription.trim() || "Applying targeted code fix based on error analysis."

    // Extract fixed files
    const { files } = parseFileOutput(raw)

    return { diagnosis, fixDescription, files }
}
