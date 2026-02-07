/**
 * HTTP client for the Right Brain (Browse Automation Service).
 * Base path: /api/knowledge
 */

import { env } from "@/env.mjs"

// --- Types ---

export interface IngestStartResponse {
  job_id: string
  status: string
  knowledge_id: string
}

export interface WorkflowStatusResponse {
  job_id: string
  status: "pending" | "processing" | "complete" | "failed"
  progress?: number
  error?: string
}

export interface ContractResponse {
  contract_id: string
  knowledge_id: string
  slice_name: string
  status: string
  content?: unknown
}

export interface LeftBrainContractFormat {
  behavioral_rules: unknown[]
  visual_assertions: unknown[]
  user_flows: unknown[]
  data_contracts: unknown[]
}

// --- Client ---

export class RightBrainClient {
  constructor(private baseUrl: string) {}

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(
        `Right Brain API error ${response.status}: ${text}`
      )
    }

    return (await response.json()) as T
  }

  /**
   * Start knowledge ingestion.
   */
  async startIngestion(params: {
    website_url?: string
    knowledge_id: string
    documentation_urls?: string[]
    s3_references?: string[]
  }): Promise<IngestStartResponse> {
    return this.request<IngestStartResponse>(
      "/api/knowledge/ingest/start",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    )
  }

  /**
   * Get workflow status by job ID.
   */
  async getWorkflowStatus(jobId: string): Promise<WorkflowStatusResponse> {
    return this.request<WorkflowStatusResponse>(
      `/api/knowledge/workflows/status/${jobId}`
    )
  }

  /**
   * Poll until workflow is complete or failed.
   */
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

  /**
   * Generate a behavioral contract for a vertical slice.
   */
  async generateContract(
    knowledgeId: string,
    sliceName: string,
    sliceDescription?: string
  ): Promise<ContractResponse> {
    return this.request<ContractResponse>(
      "/api/knowledge/contracts/generate",
      {
        method: "POST",
        body: JSON.stringify({
          knowledge_id: knowledgeId,
          slice_name: sliceName,
          slice_description: sliceDescription,
        }),
      }
    )
  }

  /**
   * Get contract in Left Brain format.
   */
  async getContractLeftBrain(
    contractId: string
  ): Promise<LeftBrainContractFormat> {
    return this.request<LeftBrainContractFormat>(
      `/api/knowledge/contracts/${contractId}/left-brain`
    )
  }

  /**
   * List contracts for a knowledge base.
   */
  async listContracts(knowledgeId: string): Promise<ContractResponse[]> {
    return this.request<ContractResponse[]>(
      `/api/knowledge/contracts?knowledge_id=${encodeURIComponent(knowledgeId)}`
    )
  }

  /**
   * Query knowledge base.
   */
  async queryKnowledge(knowledgeId: string): Promise<unknown> {
    return this.request(`/api/knowledge/query/${knowledgeId}`)
  }
}

export function createRightBrainClient(
  baseUrl?: string
): RightBrainClient {
  const url = baseUrl || env.RIGHT_BRAIN_MCP_URL
  if (!url) {
    throw new Error("RIGHT_BRAIN_MCP_URL is required")
  }
  return new RightBrainClient(url)
}
