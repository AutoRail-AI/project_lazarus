import { Queue, type QueueOptions } from "bullmq"
import { getRedis } from "./redis"
import {
  type EmailJobData,
  type ProcessingJobData,
  type ProjectProcessingJobData,
  QUEUE_NAMES,
  type SliceBuildJobData,
  type WebhookJobData,
} from "./types"

// Default queue options
const defaultQueueOptions: Partial<QueueOptions> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 60 * 60, // Keep for 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs for debugging
      age: 7 * 24 * 60 * 60, // Keep for 7 days
    },
  },
}

// Queue instances (lazy loaded) - let TypeScript infer the exact type to avoid BullMQ v5 type issues
let emailQueue: Queue<EmailJobData> | null = null
let processingQueue: Queue<ProcessingJobData> | null = null
let webhooksQueue: Queue<WebhookJobData> | null = null
let projectProcessingQueue: Queue<ProjectProcessingJobData> | null = null
let sliceBuildQueue: Queue<SliceBuildJobData> | null = null

/**
 * Get or create the email queue
 * Only creates queue at runtime, not during build
 */
export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    // Only create queue when actually called at runtime
    // Don't specify generics in constructor - let TypeScript infer to avoid type conflicts
    // Use type assertion for connection to handle ioredis version compatibility
    emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
      connection: getRedis() as any,
      ...defaultQueueOptions,
    }) as Queue<EmailJobData>
  }
  return emailQueue
}

/**
 * Get or create the processing queue
 * Only creates queue at runtime, not during build
 */
export function getProcessingQueue(): Queue<ProcessingJobData> {
  if (!processingQueue) {
    // Only create queue when actually called at runtime
    // Don't specify generics in constructor - let TypeScript infer to avoid type conflicts
    // Use type assertion for connection to handle ioredis version compatibility
    processingQueue = new Queue(QUEUE_NAMES.PROCESSING, {
      connection: getRedis() as any,
      ...defaultQueueOptions,
    }) as Queue<ProcessingJobData>
  }
  return processingQueue
}

/**
 * Get or create the webhooks queue
 * Only creates queue at runtime, not during build
 */
export function getWebhooksQueue(): Queue<WebhookJobData> {
  if (!webhooksQueue) {
    // Only create queue when actually called at runtime
    // Don't specify generics in constructor - let TypeScript infer to avoid type conflicts
    // Use type assertion for connection to handle ioredis version compatibility
    webhooksQueue = new Queue(QUEUE_NAMES.WEBHOOKS, {
      connection: getRedis() as any,
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 5, // More retries for webhooks
      },
    }) as Queue<WebhookJobData>
  }
  return webhooksQueue
}

/**
 * Add an email job to the queue
 */
export async function queueEmail(
  data: EmailJobData,
  options?: { delay?: number; priority?: number }
) {
  const queue = getEmailQueue()
  return queue.add("send-email", data, {
    delay: options?.delay,
    priority: options?.priority,
  })
}

/**
 * Add a processing job to the queue
 */
export async function queueProcessing(
  data: ProcessingJobData,
  options?: { delay?: number; priority?: number }
) {
  const queue = getProcessingQueue()
  return queue.add("process-task", data, {
    delay: options?.delay,
    priority: options?.priority,
  })
}

/**
 * Add a webhook job to the queue
 */
export async function queueWebhook(
  data: WebhookJobData,
  options?: { delay?: number; priority?: number }
) {
  const queue = getWebhooksQueue()
  return queue.add("send-webhook", data, {
    delay: options?.delay,
    priority: options?.priority,
  })
}

/**
 * Get or create the project processing queue
 * Only creates queue at runtime, not during build
 */
export function getProjectProcessingQueue(): Queue<ProjectProcessingJobData> {
  if (!projectProcessingQueue) {
    projectProcessingQueue = new Queue(QUEUE_NAMES.PROJECT_PROCESSING, {
      connection: getRedis() as any,
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 2,
      },
    }) as Queue<ProjectProcessingJobData>
  }
  return projectProcessingQueue
}

/**
 * Add a project processing job to the queue
 */
export async function queueProjectProcessing(
  data: ProjectProcessingJobData,
  options?: { delay?: number; priority?: number }
) {
  const queue = getProjectProcessingQueue()
  return queue.add("process-project", data, {
    delay: options?.delay,
    priority: options?.priority,
  })
}

/**
 * Get or create the slice build queue
 * Orchestrator manages retries, so BullMQ attempts = 1
 */
export function getSliceBuildQueue(): Queue<SliceBuildJobData> {
  if (!sliceBuildQueue) {
    sliceBuildQueue = new Queue(QUEUE_NAMES.SLICE_BUILD, {
      connection: getRedis() as any,
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 1, // Orchestrator manages retries
      },
    }) as Queue<SliceBuildJobData>
  }
  return sliceBuildQueue
}

/**
 * Add a slice build job to the queue
 * Uses deterministic job ID so duplicate queuing is idempotent
 */
export async function queueSliceBuild(data: SliceBuildJobData) {
  const queue = getSliceBuildQueue()
  return queue.add("build-slice", data, {
    jobId: `slice-build-${data.sliceId}`,
  })
}

/**
 * Close all queue connections gracefully
 */
export async function closeAllQueues(): Promise<void> {
  const queues = [emailQueue, processingQueue, webhooksQueue, projectProcessingQueue, sliceBuildQueue].filter(Boolean)
  await Promise.all(queues.map((q) => q?.close()))
  emailQueue = null
  processingQueue = null
  webhooksQueue = null
  projectProcessingQueue = null
  sliceBuildQueue = null
}
