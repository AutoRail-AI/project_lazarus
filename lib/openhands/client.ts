/**
 * OpenHands REST + Socket.IO Client
 *
 * Thin TypeScript client wrapping the OpenHands API at `OPENHANDS_API_URL`.
 * Handles conversation lifecycle (create, status, stop) and real-time event
 * streaming via Socket.IO.
 *
 * Uses lazy initialization pattern per RULESETS.
 */

import { env } from "@/env.mjs"
import { logger } from "@/lib/utils/logger"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Raw event emitted by OpenHands over Socket.IO */
export interface OpenHandsEvent {
  id: number
  source: "agent" | "user" | "environment"
  timestamp: string
  // Message/thought events
  message?: string
  cause?: number
  // Action events
  action?: string
  args?: Record<string, unknown>
  // Observation events
  observation?: string
  content?: string
  extras?: Record<string, unknown>
}

/** Conversation status returned by OpenHands API */
export interface ConversationStatus {
  conversation_id: string
  status: "running" | "paused" | "stopped" | "error" | "finished"
  title?: string
  created_at?: string
  last_updated_at?: string
}

/** Options for creating a conversation */
export interface CreateConversationOptions {
  initialMessage: string
  /** Optional repository URL to clone into the workspace */
  repoUrl?: string
}

/** Callback for streaming events */
export type EventCallback = (event: OpenHandsEvent) => void | Promise<void>

/** Disconnect function returned by connectEventStream */
export type DisconnectFn = () => void

/* -------------------------------------------------------------------------- */
/*  Lazy Socket.IO import                                                      */
/* -------------------------------------------------------------------------- */

let ioModule: typeof import("socket.io-client") | null = null

async function getSocketIO(): Promise<typeof import("socket.io-client")> {
  if (!ioModule) {
    ioModule = await import("socket.io-client")
  }
  return ioModule
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

function getBaseUrl(): string {
  const url = env.OPENHANDS_API_URL
  if (!url) {
    throw new Error(
      "[OpenHands] OPENHANDS_API_URL is not configured. " +
        "Set it in .env.local (e.g. http://localhost:3001)."
    )
  }
  return url.replace(/\/$/, "") // strip trailing slash
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getBaseUrl()
  const url = `${base}${path}`

  logger.info(`[OpenHands] API ${options.method ?? "GET"} ${path}`)

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "no body")
    throw new Error(
      `[OpenHands] API ${options.method ?? "GET"} ${path} returned ${res.status}: ${body}`
    )
  }

  return (await res.json()) as T
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Check if OpenHands is available and configured.
 */
export function isOpenHandsAvailable(): boolean {
  try {
    getBaseUrl()
    return true
  } catch {
    return false
  }
}

/**
 * Create a new OpenHands conversation.
 *
 * Sends the initial user message which kicks off the agentic loop.
 * Returns the conversation ID.
 */
export async function createConversation(
  options: CreateConversationOptions
): Promise<string> {
  const body: Record<string, unknown> = {
    initial_user_msg: options.initialMessage,
  }

  if (options.repoUrl) {
    body.selected_repository = options.repoUrl
  }

  const result = await apiRequest<{
    conversation_id: string
    status?: string
  }>("/api/conversations", {
    method: "POST",
    body: JSON.stringify(body),
  })

  logger.info(`[OpenHands] Created conversation ${result.conversation_id}`)
  return result.conversation_id
}

/**
 * Get conversation status.
 */
export async function getConversationStatus(
  conversationId: string
): Promise<ConversationStatus> {
  return apiRequest<ConversationStatus>(
    `/api/conversations/${conversationId}`
  )
}

/**
 * Stop a running conversation.
 */
export async function stopConversation(
  conversationId: string
): Promise<void> {
  await apiRequest<unknown>(
    `/api/conversations/${conversationId}/stop`,
    { method: "POST" }
  )
  logger.info(`[OpenHands] Stopped conversation ${conversationId}`)
}

/**
 * Send a user action/message to a running conversation.
 * Uses Socket.IO to emit the event.
 */
export async function sendUserAction(
  conversationId: string,
  message: string
): Promise<void> {
  const base = getBaseUrl()
  const { io } = await getSocketIO()

  return new Promise((resolve, reject) => {
    const socket = io(base, {
      transports: ["websocket", "polling"],
      query: { conversation_id: conversationId },
      timeout: 10000,
    })

    socket.on("connect", () => {
      socket.emit("oh_user_action", {
        action: "message",
        args: { content: message },
      })
      // Give it a moment to send
      setTimeout(() => {
        socket.disconnect()
        resolve()
      }, 500)
    })

    socket.on("connect_error", (err: Error) => {
      socket.disconnect()
      reject(
        new Error(`[OpenHands] Socket.IO connect error: ${err.message}`)
      )
    })

    // Timeout safety
    setTimeout(() => {
      socket.disconnect()
      reject(new Error("[OpenHands] Socket.IO connect timeout"))
    }, 15000)
  })
}

/**
 * Connect to the OpenHands event stream via Socket.IO.
 *
 * Returns a disconnect function. The `onEvent` callback is called for
 * every `oh_event` received from the server.
 *
 * Also returns a Promise that resolves when the stream finishes
 * (agent is done or connection is closed).
 */
export async function connectEventStream(
  conversationId: string,
  onEvent: EventCallback,
  options: { timeoutMs?: number } = {}
): Promise<{
  disconnect: DisconnectFn
  done: Promise<void>
}> {
  const base = getBaseUrl()
  const { io } = await getSocketIO()
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000 // 10 minute default

  const socket = io(base, {
    transports: ["websocket", "polling"],
    query: { conversation_id: conversationId },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 30000,
  })

  let isDone = false

  const done = new Promise<void>((resolve, reject) => {
    // Timeout
    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true
        logger.warn(
          `[OpenHands] Event stream timeout after ${timeoutMs}ms for ${conversationId}`
        )
        socket.disconnect()
        resolve()
      }
    }, timeoutMs)

    socket.on("connect", () => {
      logger.info(
        `[OpenHands] Socket.IO connected for conversation ${conversationId}`
      )
    })

    socket.on("oh_event", async (event: OpenHandsEvent) => {
      try {
        await onEvent(event)

        // Check if this is a completion event
        if (isCompletionEvent(event)) {
          isDone = true
          clearTimeout(timer)
          socket.disconnect()
          resolve()
        }
      } catch (err: unknown) {
        logger.error(
          "[OpenHands] Error in event callback",
          err instanceof Error ? err : undefined,
          { conversationId }
        )
      }
    })

    socket.on("disconnect", (reason: string) => {
      logger.info(
        `[OpenHands] Socket.IO disconnected: ${reason} (conversation ${conversationId})`
      )
      if (!isDone) {
        isDone = true
        clearTimeout(timer)
        resolve()
      }
    })

    socket.on("connect_error", (err: Error) => {
      logger.error(
        "[OpenHands] Socket.IO connect error",
        err,
        { conversationId }
      )
      if (!isDone) {
        isDone = true
        clearTimeout(timer)
        reject(
          new Error(
            `[OpenHands] Socket.IO connection failed: ${err.message}`
          )
        )
      }
    })
  })

  const disconnect: DisconnectFn = () => {
    if (!isDone) {
      isDone = true
      socket.disconnect()
    }
  }

  return { disconnect, done }
}

/* -------------------------------------------------------------------------- */
/*  Internal: Detect completion                                                */
/* -------------------------------------------------------------------------- */

function isCompletionEvent(event: OpenHandsEvent): boolean {
  // Agent finished action
  if (event.action === "finish") return true

  // Agent message indicating done
  if (
    event.source === "agent" &&
    event.message &&
    /(?:task completed|all done|finished|implementation complete)/i.test(
      event.message
    )
  ) {
    return true
  }

  // Observation indicating agent stopped
  if (
    event.observation === "agent_state_changed" &&
    event.extras?.agent_state === "stopped"
  ) {
    return true
  }

  return false
}
