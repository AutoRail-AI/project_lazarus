export type PipelineStep = "left_brain" | "right_brain" | "planning" | `slice:${string}`

export interface PipelineCheckpoint {
  completed_steps: PipelineStep[]
  left_brain_result?: Record<string, unknown>
  right_brain_result?: Record<string, unknown>
  sandbox_id?: string
  mcp_url?: string
  slices_generated?: boolean
  last_updated: string // ISO timestamp
}

export interface ErrorContext {
  step: string
  message: string
  timestamp: string
  retryable: boolean
  stack?: string
  details?: Record<string, unknown>
}

export const MAX_SLICE_RETRIES = 5
export const CONFIDENCE_THRESHOLD = 0.85
