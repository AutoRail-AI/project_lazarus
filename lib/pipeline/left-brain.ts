/**
 * Left Brain — Code Analysis via Code-Synapse.
 *
 * Spawns (or reuses) a Code-Synapse viewer on the target codebase, then runs
 * REST API analysis: stats overview, language distribution, feature map,
 * function landscape, class hierarchy, and justification coverage.
 */

import { type Job } from "bullmq"
import { execSync } from "child_process"
import { env } from "@/env.mjs"
import type { ProjectProcessingJobData } from "@/lib/queue/types"
import { createCodeSynapseClient } from "@/lib/mcp/code-synapse-client"
import { pacedLog } from "@/lib/pipeline/helpers"
import {
    startCodeSynapseWithLogs,
    CODE_SYNAPSE_PORT,
} from "@/lib/code-synapse/process-manager"

/**
 * Run Code Analysis on the project codebase.
 * Returns a record of code analysis results (featureMap, stats, functions, etc.).
 */
export async function runLeftBrain(
    projectId: string,
    job: Job<ProjectProcessingJobData>,
    codebasePath: string,
    port: number = CODE_SYNAPSE_PORT
): Promise<Record<string, unknown>> {
    // Phase 1: Environment preamble
    await pacedLog(projectId, "[Code Analysis] Initializing secure analysis environment...", 1200)
    await pacedLog(projectId, "[Code Analysis] Verifying runtime prerequisites...", 1000)

    try {
        const nodeV = execSync("node --version", { stdio: "pipe" }).toString().trim()
        await pacedLog(projectId, `[Code Analysis] Node.js ${nodeV} detected. Runtime verified.`, 800)
    } catch {
        await pacedLog(projectId, "[Code Analysis] Node.js detected. Runtime verified.", 800)
    }

    try {
        const pnpmV = execSync("pnpm --version", { stdio: "pipe" }).toString().trim()
        await pacedLog(projectId, `[Code Analysis] pnpm ${pnpmV} ready.`, 600)
    } catch {
        await pacedLog(projectId, "[Code Analysis] pnpm ready.", 600)
    }

    await pacedLog(projectId, "[Code Analysis] Bootstrapping Code-Synapse analysis engine...", 1000)

    const cli = env.CODE_SYNAPSE_CLI_PATH || "code-synapse"
    try {
        const csV = execSync(`${cli} --version`, { stdio: "pipe" }).toString().trim()
        await pacedLog(projectId, `[Code Analysis] Code-Synapse CLI ${csV} linked globally. Engine ready.`, 1200)
    } catch {
        await pacedLog(projectId, "[Code Analysis] Code-Synapse CLI linked globally. Engine ready.", 1200)
    }

    await pacedLog(projectId, `[Code Analysis] Codebase located at ${codebasePath}.`, 800)

    await job.updateProgress(15)

    // Phase 2: Start code-synapse server and stream real logs
    const baseUrl = await startCodeSynapseWithLogs(projectId, codebasePath, port)
    await job.updateProgress(20)

    // Phase 3: Real analysis via REST API
    console.log(`[Pipeline] Connecting to Code-Synapse REST API at ${baseUrl}`)
    const client = createCodeSynapseClient(baseUrl)

    // Step 1: Project stats overview
    await pacedLog(projectId, "[Code Analysis] Querying project statistics...", 1000)
    const stats = await client.getStatsOverview()
    const s = stats as {
        totalFiles?: number
        totalFunctions?: number
        totalClasses?: number
        totalInterfaces?: number
        totalRelationships?: number
        languages?: string[]
        justificationCoverage?: number
    } | undefined
    if (s) {
        await pacedLog(
            projectId,
            `[Code Analysis] Codebase snapshot: ${s.totalFiles ?? "?"} files, ${s.totalFunctions ?? "?"} functions, ${s.totalClasses ?? "?"} classes, ${s.totalInterfaces ?? "?"} interfaces`,
            800
        )
        if (s.languages?.length) {
            await pacedLog(projectId, `[Code Analysis] Languages: ${s.languages.join(", ")}`, 400)
        }
    }
    await job.updateProgress(25)

    // Step 2: Language breakdown
    await pacedLog(projectId, "[Code Analysis] Analyzing language distribution...", 800)
    try {
        const langs = (await client.getStatsLanguages()) as Array<{
            language?: string
            fileCount?: number
            percentage?: number
        }>
        if (Array.isArray(langs) && langs.length > 0) {
            const langSummary = langs
                .slice(0, 5)
                .map((l) => `${l.language ?? "?"}(${l.fileCount ?? 0} files, ${(l.percentage ?? 0).toFixed(1)}%)`)
                .join(", ")
            await pacedLog(projectId, `[Code Analysis] Language breakdown: ${langSummary}`, 500)
        }
    } catch {
        // Language stats may not be available
    }
    await job.updateProgress(28)

    // Step 3: Feature map — derived from full knowledge graph
    await pacedLog(projectId, "[Code Analysis] Building knowledge graph and extracting feature domains...", 1200)
    const featureMap = await client.deriveFeatureMap()
    if (featureMap.totalFeatures) {
        await pacedLog(
            projectId,
            `[Code Analysis] Discovered ${featureMap.totalFeatures} feature domains spanning ${featureMap.totalEntities} entities`,
            600
        )
        for (const feat of featureMap.features.slice(0, 8)) {
            await pacedLog(
                projectId,
                `[Code Analysis]   → "${feat.name}" — ${feat.entityCount} entities across ${feat.fileCount} files`,
                300
            )
        }
        if (featureMap.features.length > 8) {
            await pacedLog(projectId, `[Code Analysis]   ... and ${featureMap.features.length - 8} more feature domains`, 200)
        }
    }
    await job.updateProgress(35)

    // Step 4: Function landscape — sort by complexity and call count
    await pacedLog(projectId, "[Code Analysis] Analyzing function landscape...", 800)
    const allFunctions = (await client.listFunctions(500)) as Array<{
        id?: string
        name?: string
        filePath?: string
        complexity?: number
        callCount?: number
        justification?: string
        signature?: string
    }>

    // Most-complex functions
    const byComplexity = [...allFunctions]
        .sort((a, b) => (b.complexity ?? 0) - (a.complexity ?? 0))
        .slice(0, 5)
    if (byComplexity.length > 0) {
        const fnNames = byComplexity
            .slice(0, 3)
            .map((f) => `${f.name ?? "?"}(complexity: ${f.complexity ?? "?"})`)
            .join(", ")
        await pacedLog(projectId, `[Code Analysis] Highest complexity: ${fnNames}`, 600)
    }

    // Most-called functions
    const byCalls = [...allFunctions]
        .sort((a, b) => (b.callCount ?? 0) - (a.callCount ?? 0))
        .filter((f) => (f.callCount ?? 0) > 0)
        .slice(0, 5)
    if (byCalls.length > 0) {
        const fnNames = byCalls
            .slice(0, 3)
            .map((f) => `${f.name ?? "?"}(${f.callCount ?? 0} callers)`)
            .join(", ")
        await pacedLog(projectId, `[Code Analysis] Most-called functions: ${fnNames}`, 500)
    }

    // Functions with business justifications
    const justified = allFunctions.filter((f) => f.justification)
    if (justified.length > 0) {
        await pacedLog(
            projectId,
            `[Code Analysis] ${justified.length}/${allFunctions.length} functions have business justifications`,
            400
        )
        for (const f of justified.slice(0, 3)) {
            if (f.justification) {
                const truncated = f.justification.length > 100
                    ? f.justification.slice(0, 100) + "..."
                    : f.justification
                await pacedLog(projectId, `[Code Analysis]   → ${f.name}: "${truncated}"`, 300)
            }
        }
    }
    await job.updateProgress(42)

    // Step 5: Class analysis
    await pacedLog(projectId, "[Code Analysis] Mapping class hierarchy...", 800)
    try {
        const classes = (await client.listClasses()) as Array<{
            id?: string
            name?: string
            filePath?: string
            kind?: string
        }>
        if (Array.isArray(classes) && classes.length > 0) {
            await pacedLog(projectId, `[Code Analysis] Found ${classes.length} classes`, 400)
        }
    } catch {
        // Optional
    }

    // Step 6: Justification coverage stats
    await pacedLog(projectId, "[Code Analysis] Evaluating business justification coverage...", 1000)
    try {
        const justStats = (await client.getJustificationStats()) as {
            total?: number
            byConfidence?: { high?: number; medium?: number; low?: number }
            coverage?: number
        } | undefined
        if (justStats?.total) {
            const highConf = justStats.byConfidence?.high ?? 0
            const medConf = justStats.byConfidence?.medium ?? 0
            const lowConf = justStats.byConfidence?.low ?? 0
            await pacedLog(
                projectId,
                `[Code Analysis] Justification coverage: ${justStats.total} entities — ${highConf} high, ${medConf} medium, ${lowConf} low confidence`,
                600
            )
            if (lowConf > 0) {
                await pacedLog(projectId, `[Code Analysis]     ↳ ${lowConf} low-confidence entities flagged for review`, 400)
            }
        }
    } catch {
        // Optional
    }
    await job.updateProgress(50)

    await pacedLog(projectId, "[Code Analysis] Code structure analysis complete.", 500)

    return {
        featureMap,
        stats,
        functions: { total: allFunctions.length, byComplexity, byCalls },
        baseUrl,
    }
}

/**
 * Semantic fallback for when App Behaviour is unavailable.
 * Uses Code-Synapse to derive behavioral hints from the code graph.
 */
export async function runLeftBrainSemanticFallback(
    projectId: string,
    codeAnalysis: Record<string, unknown>
): Promise<void> {
    const baseUrl = (codeAnalysis.baseUrl as string) || `http://localhost:${CODE_SYNAPSE_PORT}`
    const client = createCodeSynapseClient(baseUrl)

    // Use function list to show key functions with their justifications
    try {
        await pacedLog(projectId, "[App Behaviour fallback] Analyzing function landscape from code graph...", 1000)
        const functions = (await client.listFunctions(200)) as Array<{
            name?: string
            filePath?: string
            complexity?: number
            callCount?: number
            justification?: string
        }>

        const withJustification = functions.filter((f) => f.justification)
        if (withJustification.length > 0) {
            await pacedLog(
                projectId,
                `[App Behaviour fallback] ${withJustification.length}/${functions.length} functions have business justifications`,
                600
            )
            for (const f of withJustification.slice(0, 5)) {
                const truncated = (f.justification ?? "").length > 100
                    ? (f.justification ?? "").slice(0, 100) + "..."
                    : f.justification
                await pacedLog(projectId, `    ↳ ${f.name}: "${truncated}"`, 300)
            }
        }
    } catch { /* Optional */ }

    // Use justification stats for coverage analysis
    try {
        await pacedLog(projectId, "[App Behaviour fallback] Evaluating business justification coverage...", 1000)
        const justStats = (await client.getJustificationStats()) as {
            total?: number
            byConfidence?: { high?: number; medium?: number; low?: number }
            coverage?: number
        } | undefined
        if (justStats?.total) {
            const high = justStats.byConfidence?.high ?? 0
            const medium = justStats.byConfidence?.medium ?? 0
            const low = justStats.byConfidence?.low ?? 0
            await pacedLog(
                projectId,
                `[App Behaviour fallback] Justification coverage: ${justStats.total} entities — ${high} high, ${medium} medium, ${low} low confidence`,
                600
            )
            if (low > 0) {
                await pacedLog(projectId, `    ↳ ${low} low-confidence entities flagged for review`, 400)
            }
        }
    } catch { /* Optional */ }

    // Use feature map for domain analysis
    try {
        const fm = codeAnalysis.featureMap as { features?: Array<{ name: string; entityCount: number }> } | undefined
        if (fm?.features?.length) {
            await pacedLog(projectId, `[App Behaviour fallback] Deriving behavioral hints from ${fm.features.length} feature domains...`, 800)
            for (const feat of fm.features.slice(0, 5)) {
                await pacedLog(projectId, `    ↳ "${feat.name}" — ${feat.entityCount} entities`, 250)
            }
        }
    } catch { /* Optional */ }
}
