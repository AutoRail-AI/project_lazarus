// Job Types - Define your job payloads here
export interface EmailJobData {
  to: string
  subject: string
  body: string
  templateId?: string
  variables?: Record<string, string>
}

export interface ProcessingJobData {
  userId: string
  taskId: string
  payload: Record<string, unknown>
}

// Add more job types as needed
export interface WebhookJobData {
  url: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  headers?: Record<string, string>
  body?: Record<string, unknown>
  retries?: number
}

export interface ProjectProcessingJobData {
  projectId: string
  userId: string
  githubUrl?: string
  targetFramework?: string
}

export interface SliceBuildJobData {
  projectId: string
  sliceId: string
  userId: string
}

// Union of all job data types
export type JobData = EmailJobData | ProcessingJobData | WebhookJobData | ProjectProcessingJobData | SliceBuildJobData

// Job result types
export interface JobResult {
  success: boolean
  message?: string
  data?: unknown
  error?: string
}

// Queue names - centralized for type safety
export const QUEUE_NAMES = {
  EMAIL: "email",
  PROCESSING: "processing",
  WEBHOOKS: "webhooks",
  PROJECT_PROCESSING: "project-processing",
  SLICE_BUILD: "slice-build",
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]
