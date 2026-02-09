/**
 * Code-Synapse REST API client.
 *
 * Talks to the Code-Synapse server via clean REST endpoints (plain JSON).
 * No MCP JSON-RPC or SSE parsing needed — all endpoints return JSON directly.
 *
 * API Spec: /docs/API_SPEC.md in the code-synapse repo.
 */

export class CodeSynapseClient {
  constructor(private baseUrl: string) {}

  /** Generic GET helper. */
  private async get<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(path, this.baseUrl)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v))
        }
      }
    }

    const response = await fetch(url.toString())
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Code-Synapse API error ${response.status}: ${text.slice(0, 200)}`)
    }
    return (await response.json()) as T
  }

  /** Generic POST helper. */
  private async post<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Code-Synapse API error ${response.status}: ${text.slice(0, 200)}`)
    }
    return (await response.json()) as T
  }

  // ── Statistics ─────────────────────────────────────────────────────────

  /** Aggregate counts: files, functions, classes, interfaces, relationships, embeddings. */
  async getStatsOverview() {
    return this.get("/api/stats/overview")
  }

  /** Entity counts by type. */
  async getStatsEntities() {
    return this.get("/api/stats/entities")
  }

  /** Relationship counts by type. */
  async getStatsRelationships() {
    return this.get("/api/stats/relationships")
  }

  /** File counts by language. */
  async getStatsLanguages() {
    return this.get("/api/stats/languages")
  }

  /** Function complexity distribution. */
  async getStatsComplexity() {
    return this.get("/api/stats/complexity")
  }

  // ── Feature Map & Migration ────────────────────────────────────────────

  /**
   * Derive feature map from the graph endpoint.
   * Groups graph nodes by their `featureContext` field to build feature domains.
   * This is the primary way to get feature data — works with both `viewer` and full server.
   */
  async deriveFeatureMap(): Promise<{
    features: Array<{
      name: string
      entityCount: number
      fileCount: number
      entities: Array<{ id: string; name: string; kind: string; filePath: string; justification?: string }>
    }>
    totalFeatures: number
    totalEntities: number
  }> {
    const graph = await this.get<{
      nodes: Array<{
        id: string
        label: string
        kind: string
        filePath: string
        featureContext?: string
        justification?: string
        confidence?: number
      }>
      edges: Array<{ source: string; target: string; kind: string }>
    }>("/api/graph", { limit: 5000 })

    const featureMap = new Map<
      string,
      {
        name: string
        entityCount: number
        fileCount: number
        entities: Array<{ id: string; name: string; kind: string; filePath: string; justification?: string }>
      }
    >()

    for (const node of graph.nodes) {
      const contexts = (node.featureContext ?? "")
        .split(", ")
        .filter(Boolean)
      for (const ctx of contexts) {
        let feature = featureMap.get(ctx)
        if (!feature) {
          feature = { name: ctx, entityCount: 0, fileCount: 0, entities: [] }
          featureMap.set(ctx, feature)
        }
        feature.entityCount++
        feature.entities.push({
          id: node.id,
          name: node.label,
          kind: node.kind,
          filePath: node.filePath,
          justification: node.justification,
        })
      }
    }

    // Count unique files per feature
    for (const feature of Array.from(featureMap.values())) {
      const files = new Set(feature.entities.map((e) => e.filePath).filter(Boolean))
      feature.fileCount = files.size
    }

    const features = Array.from(featureMap.values()).sort(
      (a, b) => b.entityCount - a.entityCount
    )
    return {
      features,
      totalFeatures: features.length,
      totalEntities: graph.nodes.length,
    }
  }

  /** Get feature map — business domains grouped by feature_context. */
  async getFeatureMap(includeEntities = false, limit = 50) {
    return this.get("/api/features", { includeEntities, limit })
  }

  /** Build a Code Contract for a feature slice. */
  async getMigrationContext(opts: {
    featureContext?: string
    entityIds?: string[]
    includeSource?: boolean
    includeDataFlow?: boolean
    includeSideEffects?: boolean
  }) {
    return this.post("/api/features/migration-context", opts as Record<string, unknown>)
  }

  /** Compute inter-feature dependency ordering for migration planning. */
  async getSliceDependencies(features?: string[]) {
    return this.get("/api/migration/slice-dependencies", features ? { features: features.join(",") } : {})
  }

  /** Migration progress aggregated by feature. */
  async getMigrationProgress(featureContext?: string) {
    return this.get("/api/migration/progress", featureContext ? { featureContext } : {})
  }

  // ── Entity Inspection ──────────────────────────────────────────────────

  /** Get source code of an entity. */
  async getEntitySource(entityId: string, contextLines = 0) {
    return this.get(`/api/entities/${entityId}/source`, { contextLines })
  }

  /** Multi-hop BFS impact analysis. */
  async getBlastRadius(entityId: string, maxDepth = 3, direction: "callers" | "callees" | "both" = "both") {
    return this.get(`/api/entities/${entityId}/blast-radius`, { maxDepth, direction })
  }

  /** Find test files covering an entity. */
  async getEntityTests(entityId: string) {
    return this.get(`/api/entities/${entityId}/tests`)
  }

  /** Resolve entity at a file location. */
  async resolveEntityAtLocation(filePath: string, line: number) {
    return this.get("/api/resolve", { filePath, line })
  }

  /** Get entity details by ID. */
  async getEntity(entityId: string) {
    return this.get(`/api/entities/${entityId}`)
  }

  /** Get entity relationships. */
  async getEntityRelationships(entityId: string) {
    return this.get(`/api/entities/${entityId}/relationships`)
  }

  // ── Entity Tagging ─────────────────────────────────────────────────────

  /** Tag an entity. */
  async tagEntity(entityId: string, tags: string[], source = "lazarus") {
    return this.post(`/api/entities/${entityId}/tags`, { tags, source })
  }

  /** Get entities by tag. */
  async getTaggedEntities(tag: string, entityType?: string) {
    return this.get(`/api/tags/${tag}/entities`, entityType ? { entityType } : {})
  }

  // ── Functions ──────────────────────────────────────────────────────────

  /** List functions. */
  async listFunctions(limit = 100, offset = 0) {
    return this.get("/api/functions", { limit, offset })
  }

  /** Functions sorted by caller count. */
  async getMostCalledFunctions(limit = 20) {
    return this.get("/api/functions/most-called", { limit })
  }

  /** Functions sorted by complexity. */
  async getMostComplexFunctions(limit = 20) {
    return this.get("/api/functions/most-complex", { limit })
  }

  /** Get function by ID. */
  async getFunction(functionId: string) {
    return this.get(`/api/functions/${functionId}`)
  }

  /** Get function callers. */
  async getFunctionCallers(functionId: string) {
    return this.get(`/api/functions/${functionId}/callers`)
  }

  /** Get function callees. */
  async getFunctionCallees(functionId: string) {
    return this.get(`/api/functions/${functionId}/callees`)
  }

  // ── Classes & Interfaces ───────────────────────────────────────────────

  async listClasses() {
    return this.get("/api/classes")
  }

  async getClass(classId: string) {
    return this.get(`/api/classes/${classId}`)
  }

  async getClassHierarchy(classId: string) {
    return this.get(`/api/classes/${classId}/hierarchy`)
  }

  async listInterfaces() {
    return this.get("/api/interfaces")
  }

  // ── Files ──────────────────────────────────────────────────────────────

  async listFiles(limit = 100, offset = 0, language?: string) {
    return this.get("/api/files", { limit, offset, ...(language ? { language } : {}) })
  }

  async getFileTree() {
    return this.get("/api/files/tree")
  }

  async getFileSymbols(filePath: string) {
    return this.get("/api/files/entities", { path: filePath })
  }

  async getFileContent(filePath: string) {
    return this.get("/api/files/content", { path: filePath })
  }

  async getFileImports(fileId: string) {
    return this.get(`/api/files/${fileId}/imports`)
  }

  async getFileImporters(fileId: string) {
    return this.get(`/api/files/${fileId}/importers`)
  }

  // ── Search ─────────────────────────────────────────────────────────────

  async search(query: string, type?: string, limit = 20) {
    return this.get("/api/search", { q: query, ...(type ? { type } : {}), limit })
  }

  async hybridSearch(query: string, businessContext?: string, limit = 30, enableSynthesis = false) {
    return this.post("/api/search/hybrid", { query, businessContext, limit, enableSynthesis })
  }

  // ── Semantic Analysis ──────────────────────────────────────────────────

  /** Deep semantic analysis of a function — params, return values, error handling. */
  async getFunctionSemantics(name: string, filePath?: string) {
    return this.get("/api/semantics/functions", { name, ...(filePath ? { filePath } : {}) })
  }

  /** Error propagation paths for a function. */
  async getErrorPaths(functionName: string, filePath?: string) {
    return this.get("/api/semantics/error-paths", { functionName, ...(filePath ? { filePath } : {}) })
  }

  /** Data flow analysis — purity, taint tracking, side effects. */
  async getDataFlow(functionName: string, filePath?: string, includeFullGraph = false) {
    return this.get("/api/semantics/data-flow", { functionName, ...(filePath ? { filePath } : {}), includeFullGraph })
  }

  /** Side effects analysis — I/O, mutations, async operations. */
  async getSideEffects(functionName: string, filePath?: string) {
    return this.get("/api/semantics/side-effects", { functionName, ...(filePath ? { filePath } : {}) })
  }

  // ── Design Patterns ────────────────────────────────────────────────────

  /** Find design patterns across the codebase. */
  async findPatterns(patternType?: string, minConfidence = 0.5, limit = 20) {
    return this.get("/api/patterns", {
      ...(patternType ? { patternType } : {}),
      minConfidence,
      limit,
    })
  }

  /** Get pattern details. */
  async getPattern(patternId: string) {
    return this.get(`/api/patterns/${patternId}`)
  }

  // ── Graph ──────────────────────────────────────────────────────────────

  /** Full graph data for visualization. */
  async getGraph(limit = 200) {
    return this.get("/api/graph", { limit })
  }

  /** Call graph. */
  async getCallGraph(limit = 200) {
    return this.get("/api/graph/calls", { limit })
  }

  /** Dependency graph. */
  async getDependencyGraph(limit = 200) {
    return this.get("/api/graph/dependencies", { limit })
  }

  // ── Justifications ─────────────────────────────────────────────────────

  async getJustificationStats() {
    return this.get("/api/justifications/stats")
  }

  async getJustificationFeatures() {
    return this.get("/api/justifications/features")
  }

  async getLowConfidenceEntities(limit = 20, threshold = 0.5) {
    return this.get("/api/justifications/low-confidence", { limit, threshold })
  }

  // ── Operations ─────────────────────────────────────────────────────────

  /** Enhance a prompt with codebase context. */
  async enhancePrompt(prompt: string, targetFile?: string, taskType?: string) {
    return this.post("/api/operations/enhance-prompt", {
      prompt,
      ...(targetFile ? { targetFile } : {}),
      ...(taskType ? { taskType } : {}),
    })
  }

  // ── Vibe Coding Sessions ───────────────────────────────────────────────

  async startSession(intent: string, targetFiles?: string[], relatedConcepts?: string[]) {
    return this.post("/api/sessions/start", { intent, targetFiles, relatedConcepts })
  }

  async recordSessionChange(sessionId: string, filePath: string, changeType: string, description: string) {
    return this.post(`/api/sessions/${sessionId}/changes`, { filePath, changeType, description })
  }

  async completeSession(sessionId: string, summary?: string) {
    return this.post(`/api/sessions/${sessionId}/complete`, { summary })
  }
}

export function createCodeSynapseClient(baseUrl: string): CodeSynapseClient {
  return new CodeSynapseClient(baseUrl)
}
