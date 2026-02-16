/**
 * Right Brain — App Behaviour analysis via Knowledge Extraction Service.
 *
 * Ingests uploaded project assets (videos/docs), waits for processing,
 * then queries the resulting knowledge graph for screens, transitions,
 * business functions, visual events, and correlation graphs.
 */

import { type Job } from "bullmq"
import { env } from "@/env.mjs"
import type { ProjectProcessingJobData } from "@/lib/queue/types"
import { createRightBrainClient } from "@/lib/mcp/right-brain-client"
import { pacedLog } from "@/lib/pipeline/helpers"
import { downloadAssetsToLocal } from "@/lib/pipeline/asset-downloader"

/**
 * Run App Behaviour analysis on a project.
 * Returns a record of behavioral analysis results.
 */
export async function runRightBrain(
    projectId: string,
    job: Job<ProjectProcessingJobData>,
    uploadedAssets: Array<{ id: string; name: string; type: string; storage_path?: string }>
): Promise<Record<string, unknown>> {
    const knowledgeId = projectId
    const rightBrain = createRightBrainClient()
    const rightBrainResult: Record<string, unknown> = {}

    await pacedLog(
        projectId,
        `[App Behaviour] Connecting to Knowledge Extraction Service at ${env.RIGHT_BRAIN_API_URL}...`,
        800
    )

    // Step 1: Download assets from Supabase Storage to local temp dir
    await pacedLog(
        projectId,
        `[App Behaviour] Downloading ${uploadedAssets.length} asset(s) for local ingestion...`,
        800
    )
    const localFiles = await downloadAssetsToLocal(projectId, uploadedAssets)

    if (localFiles.length === 0) {
        throw new Error("No assets could be downloaded for App Behaviour ingestion")
    }

    await pacedLog(
        projectId,
        `[App Behaviour] Starting video analysis with ${localFiles.length} local file(s)...`,
        1000
    )

    const ingestResult = await rightBrain.startIngestion({
        knowledge_id: knowledgeId,
        local_files: localFiles,
    })
    await pacedLog(
        projectId,
        `[App Behaviour] Ingestion started (job: ${ingestResult.job_id}). Waiting for completion...`,
        600
    )

    // Step 2: Wait for ingestion to complete
    const workflow = await rightBrain.waitForWorkflow(ingestResult.job_id)
    if (workflow.status === "failed") {
        throw new Error(`App Behaviour ingestion failed: ${workflow.error ?? "Unknown error"}`)
    }
    await pacedLog(projectId, "[App Behaviour] Ingestion complete. Querying knowledge graph...", 800)
    rightBrainResult.workflow = workflow

    await job.updateProgress(55)

    // Step 3: Query full knowledge base
    await pacedLog(projectId, "[App Behaviour] Querying behavioral knowledge graph...", 1000)
    const knowledge = await rightBrain.queryKnowledge(knowledgeId)
    const kStats = knowledge.statistics
    await pacedLog(
        projectId,
        `[App Behaviour] Knowledge graph loaded: ${kStats.total_screens} screens, ${kStats.total_tasks} tasks, ${kStats.total_actions} actions, ${kStats.total_transitions} transitions`,
        600
    )
    rightBrainResult.knowledge = knowledge

    // Step 4: List screens with details
    await pacedLog(projectId, "[App Behaviour] Mapping application screens...", 800)
    const screens = knowledge.screens as Array<{
        screen_id?: string
        name?: string
        description?: string
        visual_elements?: string[]
        url?: string
    }>
    for (const screen of screens.slice(0, 6)) {
        const elements = screen.visual_elements?.length ?? 0
        await pacedLog(
            projectId,
            `[App Behaviour]   → ${screen.name ?? "Unknown Screen"}: ${elements} visual elements${screen.url ? ` (${screen.url})` : ""}`,
            300
        )
    }
    if (screens.length > 6) {
        await pacedLog(projectId, `[App Behaviour]   ... and ${screens.length - 6} more screens`, 200)
    }

    await job.updateProgress(60)

    // Step 5: Analyze transitions (screen flow graph)
    await pacedLog(projectId, "[App Behaviour] Analyzing screen transition graph...", 800)
    const transitions = knowledge.transitions as Array<{
        from_screen?: string
        to_screen?: string
        trigger_action?: string
        description?: string
    }>
    if (transitions.length > 0) {
        for (const t of transitions.slice(0, 4)) {
            await pacedLog(
                projectId,
                `[App Behaviour]   → ${t.description ?? `${t.from_screen} → ${t.to_screen}`}`,
                250
            )
        }
        if (transitions.length > 4) {
            await pacedLog(projectId, `[App Behaviour]   ... ${transitions.length - 4} more transitions mapped`, 200)
        }
    }

    // Step 6: Business functions
    await pacedLog(projectId, "[App Behaviour] Identifying business functions...", 800)
    const bizFunctions = (knowledge.business_functions ?? []) as Array<{
        name?: string
        description?: string
        screens?: string[]
        tasks?: string[]
    }>
    if (bizFunctions.length > 0) {
        for (const biz of bizFunctions.slice(0, 5)) {
            await pacedLog(
                projectId,
                `[App Behaviour]   → ${biz.name ?? "?"}: ${biz.description ?? ""} (${biz.screens?.length ?? 0} screens, ${biz.tasks?.length ?? 0} tasks)`,
                350
            )
        }
    }
    rightBrainResult.businessFunctions = bizFunctions

    await job.updateProgress(65)

    // Step 7: Visual events from Gemini video analysis
    await pacedLog(projectId, "[App Behaviour] Processing Gemini-extracted visual events...", 1000)
    try {
        const visualEvents = await rightBrain.getVisualEvents(knowledgeId)
        await pacedLog(
            projectId,
            `[App Behaviour] Extracted ${(visualEvents as unknown[]).length} visual events from video stream`,
            500
        )
        const stateChanges = (visualEvents as Array<{ event_type?: string; description?: string }>)
            .filter((e) => e.event_type === "state_change")
        if (stateChanges.length > 0) {
            await pacedLog(projectId, `[App Behaviour]     ↳ ${stateChanges.length} state changes detected`, 300)
            for (const sc of stateChanges.slice(0, 3)) {
                await pacedLog(projectId, `[App Behaviour]       • ${sc.description ?? "State transition"}`, 200)
            }
        }
        rightBrainResult.visualEvents = visualEvents
    } catch {
        await pacedLog(projectId, "[App Behaviour]     ↳ Visual events not available (video not ingested)", 300)
    }

    // Step 8: Correlation graph (merged user action + app state + network)
    await pacedLog(projectId, "[App Behaviour] Building correlation graph...", 1200)
    try {
        const correlationGraph = await rightBrain.getCorrelationGraph(knowledgeId)
        const userActions = correlationGraph.nodes.user_actions as unknown[]
        const appStates = correlationGraph.nodes.app_states as unknown[]
        const networkCalls = correlationGraph.nodes.network_calls as unknown[]
        const edges = correlationGraph.edges as unknown[]
        await pacedLog(
            projectId,
            `[App Behaviour] Correlation graph: ${userActions.length} user actions, ${appStates.length} app states, ${networkCalls.length} network calls, ${edges.length} edges`,
            600
        )

        const highConfEdges = (edges as Array<{ edge_type?: string; confidence?: number; from_node_type?: string; to_node_type?: string }>)
            .filter((e) => (e.confidence ?? 0) > 0.9)
        if (highConfEdges.length > 0) {
            await pacedLog(
                projectId,
                `[App Behaviour]     ↳ ${highConfEdges.length} high-confidence causal links (>90%)`,
                400
            )
        }

        const apiCalls = (networkCalls as Array<{ method?: string; url?: string; status_code?: number }>)
            .slice(0, 3)
        for (const api of apiCalls) {
            await pacedLog(
                projectId,
                `[App Behaviour]     ↳ API: ${api.method ?? "?"} ${api.url ?? "?"} → ${api.status_code ?? "?"}`,
                250
            )
        }
        rightBrainResult.correlationGraph = correlationGraph
    } catch {
        await pacedLog(projectId, "[App Behaviour]     ↳ Correlation graph not available", 300)
    }

    await job.updateProgress(70)

    // Step 9: Generate behavioral contracts per business function
    if (bizFunctions.length > 0) {
        await pacedLog(projectId, "[App Behaviour] Generating behavioral contracts...", 1000)
        const contracts: unknown[] = []
        for (const biz of bizFunctions.slice(0, 5)) {
            if (biz.name) {
                try {
                    const contractRes = await rightBrain.generateContract(
                        knowledgeId,
                        biz.name,
                        biz.description
                    )
                    contracts.push(contractRes)

                    const contract = contractRes.contract as {
                        confidence?: number
                        scenarios?: unknown[]
                        business_rules?: unknown[]
                        inputs?: unknown[]
                    } | undefined
                    const scenarioCount = contract?.scenarios?.length ?? 0
                    const ruleCount = contract?.business_rules?.length ?? 0
                    const conf = ((contract?.confidence ?? 0) * 100).toFixed(0)
                    await pacedLog(
                        projectId,
                        `[App Behaviour]   → Contract "${biz.name}": ${scenarioCount} scenarios, ${ruleCount} business rules, ${conf}% confidence`,
                        400
                    )
                } catch (err: unknown) {
                    console.warn(`[Pipeline] Contract generation failed for ${biz.name}:`, err)
                    await pacedLog(
                        projectId,
                        `[App Behaviour]   → Contract "${biz.name}": generation skipped (${err instanceof Error ? err.message : "error"})`,
                        300
                    )
                }
            }
        }
        rightBrainResult.contracts = contracts
    }

    // Step 10: List all existing contracts for summary
    try {
        const allContracts = await rightBrain.listContracts(knowledgeId)
        if (allContracts.length > 0) {
            const draftCount = allContracts.filter((c) => c.status === "draft").length
            const validatedCount = allContracts.filter((c) => c.status === "validated").length
            await pacedLog(
                projectId,
                `[App Behaviour] Contract portfolio: ${allContracts.length} total (${draftCount} draft, ${validatedCount} validated)`,
                500
            )
        }
    } catch {
        // Optional
    }

    await pacedLog(projectId, "[App Behaviour] Behavioral analysis complete.", 500)

    return rightBrainResult
}
