/**
 * Gemini-powered migration planner.
 *
 * Two-phase generation:
 * 1. ARCHITECT phase: Generate a high-level migration plan (ordered phases)
 * 2. DETAIL phase: For each phase, generate IMPLEMENTATION.md-quality
 *    implementation guides with files, steps, pseudo_code, key_decisions,
 *    and verification checklists.
 *
 * The architect thinks like a senior engineer:
 *   Phase 1 → DB, caching, infrastructure
 *   Phase 2 → Authentication & user management
 *   Phase 3 → Layout & navigation shell
 *   Phase N → Individual pages from visual/behavioral standpoint
 */

import type { Database } from "@/lib/db/types"
import { getGeminiClient } from "./gemini"
import {
  architectPlanSchema,
  generatedSlicesArraySchema,
  type ArchitectPlanEntry,
  type GeneratedSliceSchema,
} from "./schemas"

type Project = Database["public"]["Tables"]["projects"]["Row"]

export type GeneratedSlice = GeneratedSliceSchema

/** Max slices per detail-generation prompt. */
const SLICES_PER_DETAIL_BATCH = 3

/* -------------------------------------------------------------------------- */
/*  Data summarisation (keep prompts within token limits)                       */
/* -------------------------------------------------------------------------- */

/**
 * Summarize code analysis to keep the Gemini prompt within token limits.
 * Strips full entity arrays, keeps feature names + counts + top functions.
 */
function summarizeCodeAnalysis(raw: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {}

  if (raw.stats) {
    summary.stats = raw.stats
  }

  const fm = raw.featureMap as {
    features?: Array<{ name: string; entityCount: number; fileCount: number; entities?: unknown[] }>
    totalFeatures?: number
    totalEntities?: number
  } | undefined

  if (fm?.features) {
    summary.featureMap = {
      totalFeatures: fm.totalFeatures,
      totalEntities: fm.totalEntities,
      features: fm.features.map((f) => ({
        name: f.name,
        entityCount: f.entityCount,
        fileCount: f.fileCount,
      })),
    }
  }

  const fns = raw.functions as {
    total?: number
    byComplexity?: Array<{ name?: string; complexity?: number }>
    byCalls?: Array<{ name?: string; callCount?: number }>
  } | undefined

  if (fns) {
    summary.functions = {
      total: fns.total,
      mostComplex: (fns.byComplexity ?? []).slice(0, 5).map((f) => ({
        name: f.name,
        complexity: f.complexity,
      })),
      mostCalled: (fns.byCalls ?? []).slice(0, 5).map((f) => ({
        name: f.name,
        callCount: f.callCount,
      })),
    }
  }

  return summary
}

/**
 * Summarize behavioral analysis — keep structure but trim large arrays.
 */
function summarizeBehavioralAnalysis(raw: Record<string, unknown>): Record<string, unknown> {
  if (!raw || Object.keys(raw).length === 0) return {}

  const summary: Record<string, unknown> = {}

  const knowledge = raw.knowledge as { statistics?: unknown; screens?: unknown[] } | undefined
  if (knowledge?.statistics) {
    summary.statistics = knowledge.statistics
    summary.screenCount = (knowledge.screens as unknown[] | undefined)?.length ?? 0
  }

  const bizFns = raw.businessFunctions as Array<{ name?: string; description?: string }> | undefined
  if (bizFns?.length) {
    summary.businessFunctions = bizFns.slice(0, 10).map((b) => ({
      name: b.name,
      description: b.description,
    }))
  }

  const contracts = raw.contracts as unknown[] | undefined
  if (contracts?.length) {
    summary.contractCount = contracts.length
  }

  return summary
}

/**
 * Extract feature list from code analysis summary.
 */
function extractFeatures(
  codeAnalysis: Record<string, unknown>
): Array<{ name: string; entityCount: number; fileCount: number }> {
  const fm = codeAnalysis.featureMap as {
    features?: Array<{ name: string; entityCount: number; fileCount: number }>
  } | undefined
  return fm?.features ?? []
}

/**
 * Chunk an array into batches of a given size.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/* -------------------------------------------------------------------------- */
/*  Phase 1: Architect — high-level plan                                       */
/* -------------------------------------------------------------------------- */

const ARCHITECT_SYSTEM = `You are a senior software architect planning a legacy application migration. You think in terms of:
1. INFRASTRUCTURE FIRST: Database schemas, caching, config, environment setup
2. AUTHENTICATION NEXT: Login, registration, session management, user roles
3. LAYOUT & NAVIGATION: App shell, sidebar, header, routing structure
4. CORE DATA & APIs: Data models, API endpoints, CRUD operations
5. INDIVIDUAL PAGES: Each page/screen as its own vertical, driven by the visual/behavioral analysis
6. INTEGRATION & POLISH: Cross-cutting concerns, testing, optimization

You produce a migration plan where each phase is independently buildable and the ordering respects dependencies.`

async function generateArchitectPlan(
  project: Project,
  codeAnalysis: Record<string, unknown>,
  behavioralAnalysis: Record<string, unknown>,
  targetFramework: string,
  boilerplateUrl?: string,
  techPreferences?: string,
): Promise<ArchitectPlanEntry[]> {
  const client = getGeminiClient()
  const features = extractFeatures(codeAnalysis)

  const boilerplateContext = boilerplateUrl
    ? `\n    STARTER BOILERPLATE: The team will use ${boilerplateUrl} as a starter boilerplate. Assume this boilerplate provides basic project structure (routing, layout shell, build config), so skip boilerplate setup. Focus on features specific to the legacy application being migrated.`
    : ""
  const techPrefsContext = techPreferences
    ? `\n    TECHNOLOGY PREFERENCES: ${techPreferences}. Incorporate these into your architectural decisions.`
    : ""

  const prompt = `
    Plan a migration for "${project.name}" to ${targetFramework}.
    ${project.description ? `Project description: ${project.description}` : ""}
    ${boilerplateContext}${techPrefsContext}

    CODEBASE ANALYSIS:
    ${JSON.stringify(codeAnalysis.stats ?? {}, null, 2)}
    ${features.length > 0
      ? `Feature domains discovered (${features.length}):\n${features.map((f) => `  - "${f.name}" (${f.entityCount} entities, ${f.fileCount} files)`).join("\n")}`
      : "No feature map available."}
    ${codeAnalysis.functions ? `Top functions: ${JSON.stringify(codeAnalysis.functions, null, 2)}` : ""}

    ${Object.keys(behavioralAnalysis).length > 0
      ? `BEHAVIORAL ANALYSIS:\n${JSON.stringify(behavioralAnalysis, null, 2)}`
      : "No behavioral analysis available."}

    Generate an ordered migration plan. Each entry is a phase that becomes a vertical slice.

    RULES:
    1. Phase 1 MUST be infrastructure: database schema, caching, environment config.
    2. Phase 2 should be authentication & user management (if the app has login).
    3. Phase 3 should be the app shell: layout, sidebar, navigation, routing.
    4. Remaining phases: one per major page/feature, ordered by dependency.
       - Each page from the behavioral analysis should have its own phase.
       - Group small utilities into a single "Core Utilities" phase.
    5. Each phase must be independently buildable given its dependencies.
    6. Set category to one of: infrastructure, auth, layout, core_feature, page, integration, polish.
    7. depends_on should reference names of phases that must complete first.
    8. Generate between 5-15 phases total.${boilerplateUrl ? "\n    9. Since a starter boilerplate is provided, you may skip basic infrastructure setup (project init, build config) and focus on domain-specific infrastructure (database schema, caching, API setup)." : ""}
  `

  return client.generateStructured(prompt, architectPlanSchema, {
    systemInstruction: ARCHITECT_SYSTEM,
  })
}

/* -------------------------------------------------------------------------- */
/*  Phase 2: Detail — implementation guides per slice                          */
/* -------------------------------------------------------------------------- */

async function generateDetailBatch(
  project: Project,
  plan: ArchitectPlanEntry[],
  phaseBatch: ArchitectPlanEntry[],
  allPhaseNames: string[],
  existingSliceNames: string[],
  codeAnalysis: Record<string, unknown>,
  behavioralAnalysis: Record<string, unknown>,
  targetFramework: string,
  batchIndex: number,
  totalBatches: number,
  boilerplateUrl?: string,
  techPreferences?: string,
): Promise<GeneratedSlice[]> {
  const client = getGeminiClient()
  const features = extractFeatures(codeAnalysis)

  const boilerplateContext = boilerplateUrl
    ? `\n    STARTER BOILERPLATE: The team is using ${boilerplateUrl} as a starter boilerplate. Reference its structure in file paths and implementation steps where relevant. Do not include steps for basic project initialization.`
    : ""
  const techPrefsContext = techPreferences
    ? `\n    TECHNOLOGY PREFERENCES: ${techPreferences}. Use these technologies in your implementation guides.`
    : ""

  const prompt = `
    You are implementing the migration plan for "${project.name}" to ${targetFramework}.
    ${project.description ? `Project description: ${project.description}` : ""}${boilerplateContext}${techPrefsContext}

    OVERALL MIGRATION PLAN (${plan.length} phases):
    ${plan.map((p, i) => `  ${i + 1}. ${p.name} [${p.category}]: ${p.description}`).join("\n")}

    CODEBASE CONTEXT:
    Stats: ${JSON.stringify(codeAnalysis.stats ?? {}, null, 2)}
    ${features.length > 0
      ? `Feature domains:\n${features.map((f) => `  - "${f.name}" (${f.entityCount} entities, ${f.fileCount} files)`).join("\n")}`
      : ""}
    ${codeAnalysis.functions ? `Key functions: ${JSON.stringify(codeAnalysis.functions, null, 2)}` : ""}
    ${Object.keys(behavioralAnalysis).length > 0
      ? `Behavioral context: ${JSON.stringify(behavioralAnalysis, null, 2)}`
      : ""}

    ${existingSliceNames.length > 0 ? `Slices already detailed in previous batches:\n${existingSliceNames.map((n) => `  - ${n}`).join("\n")}` : ""}

    YOUR TASK (batch ${batchIndex + 1}/${totalBatches}): Generate detailed implementation guides for THESE phases:
    ${phaseBatch.map((p) => `  - "${p.name}" [${p.category}]: ${p.key_responsibilities.join(", ")}`).join("\n")}

    For each phase, produce an IMPLEMENTATION.md-quality vertical slice with:

    1. **description**: Rich overview paragraph (3-5 sentences). Explain what this slice builds, why it matters, and how it fits into the overall architecture.

    2. **behavioral_contract**: User-facing behavior.
       - user_flows: End-to-end user journeys this slice enables
       - inputs: What the user provides or what data sources are used
       - expected_outputs: Expected results, UI changes, API responses
       - visual_assertions: What should be visually verifiable on screen

    3. **code_contract**: Implementation guide (the most important part).
       - files: Array of {path, action, description} — every file to create or modify
       - implementation_steps: Ordered steps with detailed instructions, like a senior developer writing a task spec. Each step should have enough detail that another developer (or LLM) can implement it without ambiguity.
       - key_decisions: Architecture decisions — which patterns to use and why
       - pseudo_code: Key code snippets showing data models, API signatures, component structure. Use TypeScript.
       - verification: Checklist of items to verify the slice works correctly

    4. **modernization_flags**: Boolean flags for what this slice uses.

    5. **dependencies**: Names of other slices this depends on.

    6. **priority**: Integer matching the position in the overall plan.

    Generate exactly ${phaseBatch.length} detailed slice(s). Output ONLY a valid JSON array.
  `

  return client.generateStructured(prompt, generatedSlicesArraySchema, {
    systemInstruction: ARCHITECT_SYSTEM,
  })
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Progress callback for multi-prompt generation.
 */
export interface SliceGenerationProgress {
  phase: "architect" | "detail"
  batch: number
  totalBatches: number
  slicesGenerated: number
  currentFeatures: string[]
}

/**
 * Generate vertical slices using a two-phase architect→detail approach.
 *
 * Phase 1 (Architect): Generate a high-level migration plan with ordered phases.
 *   Thinks like a senior engineer: infra → auth → layout → pages → polish.
 *
 * Phase 2 (Detail): For each phase, generate IMPLEMENTATION.md-quality
 *   implementation guides. Batched in groups of 3 to stay within token limits.
 *
 * Throws on complete failure. Returns partial results if some batches succeed.
 */
export async function generateSlices(
  project: Project,
  onProgress?: (progress: SliceGenerationProgress) => void
): Promise<GeneratedSlice[]> {
  const metadata = (project.metadata as Record<string, unknown>) || {}
  const rawCodeAnalysis = (metadata.code_analysis as Record<string, unknown>) || {}
  const rawBehavioralAnalysis =
    (metadata.behavioral_analysis as Record<string, unknown>) || {}
  const targetFramework = project.target_framework || "Next.js"

  const codeAnalysis = summarizeCodeAnalysis(rawCodeAnalysis)
  const behavioralAnalysis = summarizeBehavioralAnalysis(rawBehavioralAnalysis)
  const boilerplateUrl = metadata.boilerplate_url as string | undefined
  const techPreferences = metadata.tech_preferences as string | undefined

  // ── Phase 1: Architect Plan ──────────────────────────────────────────────
  onProgress?.({
    phase: "architect",
    batch: 0,
    totalBatches: 0,
    slicesGenerated: 0,
    currentFeatures: ["Generating migration architecture..."],
  })

  let plan: ArchitectPlanEntry[]
  try {
    plan = await generateArchitectPlan(
      project,
      codeAnalysis,
      behavioralAnalysis,
      targetFramework,
      boilerplateUrl,
      techPreferences,
    )
  } catch (err: unknown) {
    console.error("[Gemini Planner] Architect phase failed:", err)
    // Fallback: generate a basic plan from features
    plan = generateFallbackPlan(codeAnalysis)
    if (plan.length === 0) {
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  if (plan.length === 0) {
    return generateFallbackSlices(project, codeAnalysis, targetFramework)
  }

  const allPhaseNames = plan.map((p) => p.name)

  // ── Phase 2: Detail Generation ───────────────────────────────────────────
  const batches = chunk(plan, SLICES_PER_DETAIL_BATCH)
  const allSlices: GeneratedSlice[] = []
  let lastError: Error | null = null

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    if (!batch) continue

    const existingSliceNames = allSlices.map((s) => s.name)

    onProgress?.({
      phase: "detail",
      batch: i + 1,
      totalBatches: batches.length,
      slicesGenerated: allSlices.length,
      currentFeatures: batch.map((p) => p.name),
    })

    try {
      const batchSlices = await generateDetailBatch(
        project,
        plan,
        batch,
        allPhaseNames,
        existingSliceNames,
        codeAnalysis,
        behavioralAnalysis,
        targetFramework,
        i,
        batches.length,
        boilerplateUrl,
        techPreferences,
      )
      allSlices.push(...batchSlices)
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`[Gemini Planner] Detail batch ${i + 1}/${batches.length} failed:`, err)
      // Continue with remaining batches — partial results are better than none
    }
  }

  // If ALL batches failed, throw the last error
  if (allSlices.length === 0 && lastError) {
    throw lastError
  }

  // Re-number priorities sequentially
  const sorted = allSlices.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
  return sorted.map((slice, i) => ({
    ...slice,
    priority: i + 1,
  }))
}

/* -------------------------------------------------------------------------- */
/*  Fallbacks                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Generate a basic architect plan from feature map when Gemini fails.
 */
function generateFallbackPlan(
  codeAnalysis: Record<string, unknown>
): ArchitectPlanEntry[] {
  const features = extractFeatures(codeAnalysis)
  if (features.length === 0) return []

  const plan: ArchitectPlanEntry[] = [
    {
      name: "Database & Infrastructure",
      description: "Set up database schema, caching, and core infrastructure.",
      category: "infrastructure",
      key_responsibilities: ["Database schema", "Connection config", "Environment setup"],
      depends_on: [],
    },
    {
      name: "Authentication & Users",
      description: "User authentication, registration, and session management.",
      category: "auth",
      key_responsibilities: ["Login flow", "Registration", "Session management"],
      depends_on: ["Database & Infrastructure"],
    },
    {
      name: "Layout & Navigation",
      description: "Application shell with sidebar, header, and routing.",
      category: "layout",
      key_responsibilities: ["App shell", "Sidebar", "Routing"],
      depends_on: ["Authentication & Users"],
    },
  ]

  // Add one phase per feature domain
  for (const feat of features) {
    plan.push({
      name: feat.name,
      description: `Migrate the "${feat.name}" feature domain (${feat.entityCount} entities across ${feat.fileCount} files).`,
      category: "page",
      key_responsibilities: [`${feat.name} UI`, `${feat.name} data`, `${feat.name} logic`],
      depends_on: ["Layout & Navigation"],
    })
  }

  return plan
}

/**
 * Last-resort fallback: generate minimal slices without architect phase.
 */
function generateFallbackSlices(
  project: Project,
  codeAnalysis: Record<string, unknown>,
  targetFramework: string,
): GeneratedSlice[] {
  const features = extractFeatures(codeAnalysis)
  if (features.length === 0) {
    return [{
      name: "Full Migration",
      description: `Migrate "${project.name}" to ${targetFramework}. No feature decomposition available — implement as a single vertical slice.`,
      priority: 1,
      dependencies: [],
      behavioral_contract: {
        user_flows: ["Complete application flow"],
        inputs: ["All user inputs from original application"],
        expected_outputs: ["Fully functional migrated application"],
        visual_assertions: ["Application renders and behaves like the original"],
      },
      code_contract: {
        files: [{ path: "app/page.tsx", action: "create", description: "Main application entry point" }],
        implementation_steps: [{ title: "Full Implementation", details: `Migrate the entire application to ${targetFramework}. Refer to the original codebase for structure and logic.` }],
        key_decisions: [`Using ${targetFramework} as the target framework`],
        pseudo_code: "// Refer to original codebase structure",
        verification: ["Application builds without errors", "All pages render correctly"],
      },
      modernization_flags: {
        uses_server_components: true,
        uses_api_routes: true,
        uses_database: true,
        uses_auth: true,
        uses_realtime: false,
      },
    }]
  }

  return features.slice(0, 12).map((f, i) => ({
    name: f.name,
    description: `Migrate the "${f.name}" feature domain (${f.entityCount} entities across ${f.fileCount} files) to ${targetFramework}.`,
    priority: i + 1,
    dependencies: i > 0 ? [features[0]?.name ?? ""].filter(Boolean) : [],
    behavioral_contract: {
      user_flows: [`${f.name} user flow`],
      inputs: [`${f.name} data inputs`],
      expected_outputs: [`${f.name} renders correctly`],
      visual_assertions: [`${f.name} page is visually complete`],
    },
    code_contract: {
      files: [{ path: `app/${f.name.toLowerCase().replace(/\s+/g, "-")}/page.tsx`, action: "create" as const, description: `${f.name} page component` }],
      implementation_steps: [{ title: `Implement ${f.name}`, details: `Migrate ${f.entityCount} entities across ${f.fileCount} files for the ${f.name} feature.` }],
      key_decisions: [`${f.name} follows the established ${targetFramework} patterns`],
      pseudo_code: `// ${f.name} component\nexport default function ${f.name.replace(/\s+/g, "")}Page() {\n  return <div>...</div>\n}`,
      verification: [`${f.name} page renders`, `${f.name} data loads correctly`],
    },
    modernization_flags: {
      uses_server_components: true,
      uses_api_routes: false,
      uses_database: true,
      uses_auth: false,
      uses_realtime: false,
    },
  }))
}
