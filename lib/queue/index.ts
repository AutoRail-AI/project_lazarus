// Redis connection
export { getRedis, createRedisConnection, closeRedis } from "./redis"

// Queues
export {
  getEmailQueue,
  getProcessingQueue,
  getWebhooksQueue,
  getProjectProcessingQueue,
  queueEmail,
  queueProcessing,
  queueWebhook,
  queueProjectProcessing,
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
  type WebhookJobData,
  type JobData,
  type JobResult,
} from "./types"
