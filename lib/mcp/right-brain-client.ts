/**
 * HTTP client for the Right Brain (Browse Automation / Knowledge Extraction Service).
 *
 * Base path: /api/knowledge
 * API Spec: /docs/API_SPECS.md in the browse-automation-service repo.
 */

import { env } from "@/env.mjs"

// ── Types ───────────────────────────────────────────────────────────────────

export interface IngestStartResponse {
  job_id: string
  workflow_id?: string
  status: string
  knowledge_id?: string
  message?: string
}

export interface WorkflowStatusResponse {
  job_id: string
  status: "pending" | "processing" | "complete" | "failed"
  progress?: number
  error?: string
}

export interface ContractResponse {
  success?: boolean
  contract_id: string
  contract?: unknown
  knowledge_id?: string
  slice_name?: string
  status?: string
  confidence?: number
  content?: unknown
}

export interface LeftBrainContractFormat {
  slice_id: string
  name: string
  priority: number
  confidence_threshold: number
  behavioral_contract: {
    inputs: unknown[]
    expected_outputs: unknown[]
    visual_assertions: unknown[]
    scenarios: unknown[]
  }
  business_rules: unknown[]
  depends_on: string[]
  metadata: Record<string, unknown>
}

export interface KnowledgeQueryResponse {
  knowledge_id: string
  screens: unknown[]
  tasks: unknown[]
  actions: unknown[]
  transitions: unknown[]
  business_functions?: unknown[]
  workflows?: unknown[]
  statistics: {
    total_screens: number
    total_tasks: number
    total_actions: number
    total_transitions: number
    total_business_functions?: number
  }
}

export interface CorrelationGraphResponse {
  knowledge_id: string
  nodes: {
    user_actions: unknown[]
    app_states: unknown[]
    network_calls: unknown[]
  }
  edges: unknown[]
}

export interface ConfidenceCalculateResponse {
  overall: number
  components: Record<string, number>
  weights: Record<string, number>
  threshold: number
  passed: boolean
}

export interface ConfidenceHistoryResponse {
  job_id: string
  timeline: Array<{
    timestamp: string
    overall: number
    phase?: string | null
    event?: string | null
    components?: Record<string, number> | null
  }>
}

export interface DiagnosisResponse {
  diagnosis_id: string
  thought_signature: {
    observation: string
    legacy_context: string
    root_cause: string
    confidence: number
  }
  strategy: {
    strategy: string
    recommendation: string
    reasoning: string
    action_plan: string[]
  }
  affected_files: string[]
  created_at: string
}

export interface VerificationStatusResponse {
  verification_job_id: string
  status: "queued" | "running" | "completed" | "failed"
  progress: number
  screens_verified: number
  actions_replayed: number
  discrepancies_found: number
  discrepancies: unknown[]
  started_at?: string | null
  updated_at?: string | null
}

export interface VerificationReportResponse {
  report_id: string
  verification_job_id: string
  status: string
  started_at: string
  completed_at?: string | null
  duration_seconds: number
  success: boolean
  screens_verified: number
  actions_replayed: number
  discrepancies: unknown[]
  enrichments: unknown[]
  success_rate: number
  metadata: Record<string, unknown>
}

// ── Client ──────────────────────────────────────────────────────────────────

export class RightBrainClient {
  constructor(private baseUrl: string) {}

  /** Generic GET helper. */
  private async get<T = unknown>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
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
      const text = await response.text().catch(() => "")
      throw new Error(`Right Brain API error ${response.status}: ${text.slice(0, 200)}`)
    }
    return (await response.json()) as T
  }

  /** Generic POST helper. */
  private async post<T = unknown>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`Right Brain API error ${response.status}: ${text.slice(0, 200)}`)
    }
    return (await response.json()) as T
  }

  /** Generic PATCH helper. */
  private async patch<T = unknown>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`Right Brain API error ${response.status}: ${text.slice(0, 200)}`)
    }
    return (await response.json()) as T
  }

  // ── Ingestion & Workflows ───────────────────────────────────────────────

  /** Start knowledge ingestion workflow. */
  async startIngestion(params: {
    website_url?: string
    knowledge_id?: string
    documentation_urls?: string[]
    s3_references?: unknown[]
    local_files?: string[]
  }): Promise<IngestStartResponse> {
    return this.post<IngestStartResponse>(
      "/api/knowledge/ingest/start",
      params as Record<string, unknown>
    )
  }

  /** Get workflow status by job ID. */
  async getWorkflowStatus(jobId: string): Promise<WorkflowStatusResponse> {
    return this.get<WorkflowStatusResponse>(
      `/api/knowledge/workflows/status/${jobId}`
    )
  }

  /** List workflows. */
  async listWorkflows(params?: Record<string, string>): Promise<unknown[]> {
    return this.get<unknown[]>("/api/knowledge/workflows/list", params)
  }

  /** Poll until workflow is complete or failed. */
  async waitForWorkflow(
    jobId: string,
    maxAttempts = 60,
    intervalMs = 5000
  ): Promise<WorkflowStatusResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getWorkflowStatus(jobId)
      if (status.status === "complete" || status.status === "failed") {
        return status
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error(
      `Workflow ${jobId} did not complete within ${maxAttempts} attempts`
    )
  }

  // ── Knowledge Definitions ───────────────────────────────────────────────

  /** Get all knowledge for a knowledge_id (screens, tasks, actions, transitions, statistics). */
  async queryKnowledge(knowledgeId: string, jobId?: string): Promise<KnowledgeQueryResponse> {
    return this.get<KnowledgeQueryResponse>(
      `/api/knowledge/query/${knowledgeId}`,
      jobId ? { job_id: jobId } : {}
    )
  }

  /** List screens. */
  async getScreens(knowledgeId: string, limit = 100): Promise<unknown[]> {
    return this.get<unknown[]>("/api/knowledge/screens", { knowledge_id: knowledgeId, limit })
  }

  /** Get screen by ID. */
  async getScreen(screenId: string): Promise<unknown> {
    return this.get(`/api/knowledge/screens/${screenId}`)
  }

  /** List tasks. */
  async getTasks(knowledgeId: string, limit = 100): Promise<unknown[]> {
    return this.get<unknown[]>("/api/knowledge/tasks", { knowledge_id: knowledgeId, limit })
  }

  /** Get task by ID. */
  async getTask(taskId: string): Promise<unknown> {
    return this.get(`/api/knowledge/tasks/${taskId}`)
  }

  /** List actions. */
  async getActions(knowledgeId: string, limit = 100): Promise<unknown[]> {
    return this.get<unknown[]>("/api/knowledge/actions", { knowledge_id: knowledgeId, limit })
  }

  /** Get action by ID. */
  async getAction(actionId: string): Promise<unknown> {
    return this.get(`/api/knowledge/actions/${actionId}`)
  }

  /** List transitions. */
  async getTransitions(knowledgeId: string, limit = 100): Promise<unknown[]> {
    return this.get<unknown[]>("/api/knowledge/transitions", { knowledge_id: knowledgeId, limit })
  }

  /** List business functions. */
  async getBusinessFunctions(knowledgeId: string, limit = 100): Promise<unknown[]> {
    return this.get<unknown[]>("/api/knowledge/business-functions", { knowledge_id: knowledgeId, limit })
  }

  /** List workflows for a knowledge base. */
  async getKnowledgeWorkflows(knowledgeId: string, limit = 100): Promise<unknown[]> {
    return this.get<unknown[]>("/api/knowledge/workflows", { knowledge_id: knowledgeId, limit })
  }

  // ── Graph Query ─────────────────────────────────────────────────────────

  /** Query the knowledge graph (shortest path, adjacent screens, search, transitions). */
  async queryGraph(body: {
    query_type: "find_shortest_path" | "get_adjacent_screens" | "search_screens" | "get_transitions"
    [key: string]: unknown
  }): Promise<unknown> {
    return this.post("/api/knowledge/graph/query", body)
  }

  // ── Right Brain Event Streams ───────────────────────────────────────────

  /** Get visual events (Gemini-extracted from video). */
  async getVisualEvents(knowledgeId: string): Promise<unknown[]> {
    return this.get<unknown[]>("/api/knowledge/visual-events", { knowledge_id: knowledgeId })
  }

  /** Get interaction events. */
  async getInteractionEvents(knowledgeId: string): Promise<unknown[]> {
    return this.get<unknown[]>("/api/knowledge/interaction-events", { knowledge_id: knowledgeId })
  }

  /** Get network events. */
  async getNetworkEvents(knowledgeId: string): Promise<unknown[]> {
    return this.get<unknown[]>("/api/knowledge/network-events", { knowledge_id: knowledgeId })
  }

  // ── Correlation Graph ───────────────────────────────────────────────────

  /** Get merged correlation graph (user actions + app states + network calls). */
  async getCorrelationGraph(knowledgeId: string): Promise<CorrelationGraphResponse> {
    return this.get<CorrelationGraphResponse>(
      `/api/knowledge/correlation-graph/${knowledgeId}`
    )
  }

  // ── Behavioral Contracts ────────────────────────────────────────────────

  /** Generate a behavioral contract from the knowledge graph. */
  async generateContract(
    knowledgeId: string,
    sliceName: string,
    sliceDescription?: string
  ): Promise<ContractResponse> {
    return this.post<ContractResponse>(
      "/api/knowledge/contracts/generate",
      {
        knowledge_id: knowledgeId,
        slice_name: sliceName,
        ...(sliceDescription ? { slice_description: sliceDescription } : {}),
      }
    )
  }

  /** Get contract by ID. */
  async getContract(contractId: string): Promise<unknown> {
    return this.get(`/api/knowledge/contracts/${contractId}`)
  }

  /** Get contract in Left Brain consumption format. */
  async getContractLeftBrain(contractId: string): Promise<LeftBrainContractFormat> {
    return this.get<LeftBrainContractFormat>(
      `/api/knowledge/contracts/${contractId}/left-brain`
    )
  }

  /** List contracts for a knowledge base. */
  async listContracts(knowledgeId: string, status?: string, limit = 100): Promise<ContractResponse[]> {
    return this.get<ContractResponse[]>(
      "/api/knowledge/contracts",
      { knowledge_id: knowledgeId, ...(status ? { status } : {}), limit }
    )
  }

  /** Update contract status, confidence, or metadata. */
  async updateContract(
    contractId: string,
    update: { status?: string; confidence?: number; metadata?: Record<string, unknown> }
  ): Promise<unknown> {
    return this.patch(
      `/api/knowledge/contracts/${contractId}`,
      update as Record<string, unknown>
    )
  }

  // ── Verification ────────────────────────────────────────────────────────

  /** Start a verification workflow. */
  async startVerification(params: {
    target_type: "screen" | "task" | "action"
    [key: string]: unknown
  }): Promise<{ verification_job_id: string }> {
    return this.post("/api/knowledge/verify/start", params)
  }

  /** Get verification progress. */
  async getVerificationStatus(jobId: string): Promise<VerificationStatusResponse> {
    return this.get<VerificationStatusResponse>(
      `/api/knowledge/verify/status/${jobId}`
    )
  }

  /** Get full verification report (completed workflows only). */
  async getVerificationReport(jobId: string): Promise<VerificationReportResponse> {
    return this.get<VerificationReportResponse>(
      `/api/knowledge/verify/report/${jobId}`
    )
  }

  // ── Confidence Scoring ──────────────────────────────────────────────────

  /** Calculate weighted confidence score from test results. */
  async calculateConfidence(params: {
    job_id?: string
    knowledge_id?: string
    test_results: {
      unit?: { passed: number; total: number }
      e2e?: { passed: number; total: number }
      visual?: { diff_pixels: number; total_pixels: number }
      behavioral?: { passed: number; total: number }
      video?: { similarity: number }
    }
  }): Promise<ConfidenceCalculateResponse> {
    return this.post<ConfidenceCalculateResponse>(
      "/api/knowledge/confidence/calculate",
      params as Record<string, unknown>
    )
  }

  /** Get confidence score timeline for a job. */
  async getConfidenceHistory(jobId: string, limit = 50): Promise<ConfidenceHistoryResponse> {
    return this.get<ConfidenceHistoryResponse>(
      "/api/knowledge/confidence/history",
      { job_id: jobId, limit }
    )
  }

  // ── Self-Healing Diagnosis ──────────────────────────────────────────────

  /** Submit a test failure for Gemini-powered diagnosis. */
  async diagnose(params: {
    knowledge_id?: string
    contract_id?: string
    test_type: "unit" | "e2e" | "visual" | "video"
    failure_summary: string
    test_file?: string
    stack_trace?: string
    affected_functions?: string[]
  }): Promise<DiagnosisResponse> {
    return this.post<DiagnosisResponse>(
      "/api/knowledge/diagnose/analyze",
      params as Record<string, unknown>
    )
  }

  /** Retrieve a previously generated diagnosis. */
  async getDiagnosis(diagnosisId: string): Promise<DiagnosisResponse> {
    return this.get<DiagnosisResponse>(
      `/api/knowledge/diagnose/${diagnosisId}`
    )
  }

  // ── Agent Query ─────────────────────────────────────────────────────────

  /** Agent-friendly query (navigate_to_screen, execute_task, etc.). */
  async agentQuery(
    knowledgeId: string,
    instruction: {
      instruction_type: "navigate_to_screen" | "execute_task" | "find_screen" | "get_actions" | "get_screen_context"
      target?: string
      context?: Record<string, unknown>
    }
  ): Promise<unknown> {
    return this.post(
      `/api/knowledge/${knowledgeId}/query`,
      instruction as Record<string, unknown>
    )
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createRightBrainClient(
  baseUrl?: string
): RightBrainClient {
  const url = baseUrl || env.RIGHT_BRAIN_API_URL
  if (!url) {
    throw new Error("RIGHT_BRAIN_API_URL is required")
  }
  return new RightBrainClient(url)
}
