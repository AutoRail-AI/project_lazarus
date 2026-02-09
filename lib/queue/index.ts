// Redis connection
export { getRedis, createRedisConnection, closeRedis } from "./redis"

// Queues
export {
  getEmailQueue,
  getProcessingQueue,
  getWebhooksQueue,
  getProjectProcessingQueue,
  getSliceBuildQueue,
  queueEmail,
  queueProcessing,
  queueWebhook,
  queueProjectProcessing,
  queueSliceBuild,
  closeAllQueues,
} from "./queues"

// Workers
export { startWorkers, stopWorkers } from "./workers"

// Types
export {
  QUEUE_NAMES,
  type QueueName,
  type EmailJobData,
  type ProcessingJobData,
  type ProjectProcessingJobData,
  type SliceBuildJobData,
  type WebhookJobData,
  type JobData,
  type JobResult,
} from "./types"
