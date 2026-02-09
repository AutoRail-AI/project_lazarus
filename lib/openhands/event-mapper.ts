/**
 * OpenHands Event Mapper
 *
 * Maps raw OpenHands `oh_event` structures into our internal `AgentEventType`
 * format used by the Glass Brain dashboard. Each mapped event includes a
 * confidence delta that drives the theatrical confidence arc.
 */

import type { AgentEventType } from "@/lib/db/types"
import type { OpenHandsEvent } from "./client"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface MappedEvent {
  eventType: AgentEventType
  content: string
  metadata: Record<string, unknown>
  confidenceDelta: number
}

/* -------------------------------------------------------------------------- */
/*  Confidence deltas per event type                                           */
/* -------------------------------------------------------------------------- */

const CONFIDENCE_DELTAS: Record<string, number> = {
  thought_planning: 0.02,
  code_write: 0.03,
  build_success: 0.10,
  test_run: 0.0,
  test_pass: 0.15,
  test_fail: -0.05,
  self_heal: 0.02,
  app_start: 0.05,
  screenshot: 0.08,
  browser_action: 0.03,
  observation: 0.01,
}

/* -------------------------------------------------------------------------- */
/*  Mapper                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Map a single OpenHands event to our internal format.
 * Returns null if the event should be skipped (not relevant for Glass Brain).
 */
export function mapOpenHandsEvent(event: OpenHandsEvent): MappedEvent | null {
  // Agent thought/message -> "thought"
  if (event.source === "agent" && event.message && !event.action) {
    return {
      eventType: "thought",
      content: event.message,
      metadata: {
        category: "Planning",
        oh_event_id: event.id,
        source: event.source,
      },
      confidenceDelta: CONFIDENCE_DELTAS.thought_planning ?? 0,
    }
  }

  // Action: write or edit file -> "code_write"
  if (event.action === "write" || event.action === "edit") {
    const filePath = (event.args?.path as string) ?? "unknown"
    const content = (event.args?.content as string) ?? ""
    const lineCount = content.split("\n").length
    const preview = content.length > 500 ? content.slice(0, 500) + "..." : content

    return {
      eventType: "code_write",
      content: `Writing ${filePath} (${lineCount} lines)`,
      metadata: {
        file_path: filePath,
        lines_written: lineCount,
        content_preview: preview,
        oh_event_id: event.id,
        action: event.action,
      },
      confidenceDelta: CONFIDENCE_DELTAS.code_write ?? 0,
    }
  }

  // Action: run command
  if (event.action === "run") {
    const command = (event.args?.command as string) ?? ""
    return mapRunCommand(event, command)
  }

  // Observation: command output
  if (event.observation === "run") {
    return mapRunObservation(event)
  }

  // Observation: file read (can be interesting for Glass Brain)
  if (event.observation === "read") {
    const filePath = (event.extras?.path as string) ?? "unknown"
    return {
      eventType: "observation",
      content: `Reading ${filePath}`,
      metadata: {
        file_path: filePath,
        oh_event_id: event.id,
        observation: event.observation,
      },
      confidenceDelta: CONFIDENCE_DELTAS.observation ?? 0,
    }
  }

  // Observation: browser screenshot
  if (
    event.observation === "browse" &&
    event.extras?.screenshot
  ) {
    return {
      eventType: "screenshot",
      content: "Browser screenshot captured",
      metadata: {
        screenshot_base64: event.extras.screenshot,
        url: event.extras.url ?? "unknown",
        oh_event_id: event.id,
      },
      confidenceDelta: CONFIDENCE_DELTAS.screenshot ?? 0,
    }
  }

  // Agent state changed (finish)
  if (event.action === "finish") {
    return {
      eventType: "thought",
      content:
        (event.message as string) ??
        "Agent completed the task",
      metadata: {
        category: "Completion",
        oh_event_id: event.id,
        is_finish: true,
      },
      confidenceDelta: 0,
    }
  }

  // Skip low-value events (internal state changes, etc.)
  return null
}

/* -------------------------------------------------------------------------- */
/*  Run command mapping                                                        */
/* -------------------------------------------------------------------------- */

function mapRunCommand(
  event: OpenHandsEvent,
  command: string
): MappedEvent | null {
  const lowerCmd = command.toLowerCase()

  // Test commands
  if (
    lowerCmd.includes("vitest") ||
    lowerCmd.includes("jest") ||
    lowerCmd.includes("pnpm test") ||
    lowerCmd.includes("npm test") ||
    lowerCmd.includes("npx test")
  ) {
    return {
      eventType: "test_run",
      content: `Running tests: ${truncate(command, 120)}`,
      metadata: {
        command,
        oh_event_id: event.id,
        test_type: "unit",
      },
      confidenceDelta: CONFIDENCE_DELTAS.test_run ?? 0,
    }
  }

  // Playwright E2E
  if (
    lowerCmd.includes("playwright") ||
    lowerCmd.includes("e2e")
  ) {
    return {
      eventType: "browser_action",
      content: `Running E2E tests: ${truncate(command, 120)}`,
      metadata: {
        command,
        oh_event_id: event.id,
        test_type: "e2e",
      },
      confidenceDelta: CONFIDENCE_DELTAS.browser_action ?? 0,
    }
  }

  // Dev server start
  if (
    lowerCmd.includes("pnpm dev") ||
    lowerCmd.includes("npm run dev") ||
    lowerCmd.includes("next dev")
  ) {
    return {
      eventType: "app_start",
      content: "Starting development server",
      metadata: {
        command,
        oh_event_id: event.id,
      },
      confidenceDelta: CONFIDENCE_DELTAS.app_start ?? 0,
    }
  }

  // Build commands
  if (
    lowerCmd.includes("pnpm build") ||
    lowerCmd.includes("npm run build") ||
    lowerCmd.includes("next build")
  ) {
    return {
      eventType: "tool_call",
      content: `Running build: ${truncate(command, 120)}`,
      metadata: {
        command,
        oh_event_id: event.id,
        tool: "build",
      },
      confidenceDelta: 0,
    }
  }

  // Install deps
  if (
    lowerCmd.includes("pnpm install") ||
    lowerCmd.includes("npm install") ||
    lowerCmd.includes("pnpm add")
  ) {
    return {
      eventType: "tool_call",
      content: `Installing dependencies: ${truncate(command, 120)}`,
      metadata: {
        command,
        oh_event_id: event.id,
        tool: "install",
      },
      confidenceDelta: 0,
    }
  }

  // Generic command
  return {
    eventType: "tool_call",
    content: `Running: ${truncate(command, 120)}`,
    metadata: {
      command,
      oh_event_id: event.id,
    },
    confidenceDelta: 0,
  }
}

/* -------------------------------------------------------------------------- */
/*  Run observation mapping (command output)                                    */
/* -------------------------------------------------------------------------- */

function mapRunObservation(event: OpenHandsEvent): MappedEvent | null {
  const output = (event.content ?? "").toLowerCase()
  const exitCode = event.extras?.exit_code as number | undefined

  // Build success
  if (
    output.includes("compiled successfully") ||
    output.includes("build completed") ||
    (output.includes("ready") && output.includes("started"))
  ) {
    return {
      eventType: "observation",
      content: "Build compiled successfully",
      metadata: {
        oh_event_id: event.id,
        exit_code: exitCode,
        pipeline_event: "build_success",
      },
      confidenceDelta: CONFIDENCE_DELTAS.build_success ?? 0,
    }
  }

  // Test results — pass
  if (
    (output.includes("tests passed") || output.includes("test passed")) &&
    !output.includes("failed")
  ) {
    const { passed, total } = parseTestCounts(event.content ?? "")
    return {
      eventType: "test_result",
      content: `Tests passed: ${passed}/${total}`,
      metadata: {
        oh_event_id: event.id,
        exit_code: exitCode,
        tests_passed: passed,
        tests_total: total,
        result: "pass",
      },
      confidenceDelta: CONFIDENCE_DELTAS.test_pass ?? 0,
    }
  }

  // Test results — failure
  if (
    output.includes("test failed") ||
    output.includes("tests failed") ||
    output.includes("fail ") ||
    (exitCode !== undefined && exitCode !== 0 && output.includes("test"))
  ) {
    const { passed, total } = parseTestCounts(event.content ?? "")
    return {
      eventType: "test_result",
      content: `Tests failed: ${passed}/${total} passed`,
      metadata: {
        oh_event_id: event.id,
        exit_code: exitCode,
        tests_passed: passed,
        tests_total: total,
        result: "fail",
        error_preview: truncate(event.content ?? "", 500),
      },
      confidenceDelta: CONFIDENCE_DELTAS.test_fail ?? 0,
    }
  }

  // Self-healing detection (agent diagnosing after failure)
  if (
    output.includes("diagnos") ||
    output.includes("fixing") ||
    output.includes("let me fix") ||
    output.includes("error in")
  ) {
    return {
      eventType: "self_heal",
      content: "Diagnosing and fixing issues...",
      metadata: {
        oh_event_id: event.id,
        exit_code: exitCode,
        diagnostic_preview: truncate(event.content ?? "", 300),
      },
      confidenceDelta: CONFIDENCE_DELTAS.self_heal ?? 0,
    }
  }

  // Skip uninteresting command outputs
  if (exitCode === 0 && !output.includes("error") && !output.includes("fail")) {
    return null
  }

  // Default: generic observation
  return {
    eventType: "observation",
    content: truncate(event.content ?? "Command output", 200),
    metadata: {
      oh_event_id: event.id,
      exit_code: exitCode,
    },
    confidenceDelta: 0,
  }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str
}

function parseTestCounts(output: string): { passed: number; total: number } {
  // Try patterns: "5 passed", "5/10 tests"
  const passMatch = output.match(/(\d+)\s*(?:tests?\s+)?pass(?:ed)?/i)
  const totalMatch = output.match(/(\d+)\s*(?:tests?\s+)?(?:total|found)/i)
  const failMatch = output.match(/(\d+)\s*(?:tests?\s+)?fail(?:ed)?/i)

  const passed = passMatch ? parseInt(passMatch[1] ?? "0", 10) : 0
  const failed = failMatch ? parseInt(failMatch[1] ?? "0", 10) : 0
  const total = totalMatch
    ? parseInt(totalMatch[1] ?? "0", 10)
    : passed + failed

  return { passed, total: total || passed }
}

/**
 * Check if an OpenHands event indicates the agent is in a self-heal cycle.
 * Useful for the build graph to track self-heal count.
 */
export function isSelfHealEvent(event: OpenHandsEvent): boolean {
  const msg = (event.message ?? "").toLowerCase()
  const content = (event.content ?? "").toLowerCase()
  const combined = msg + " " + content

  return (
    combined.includes("diagnos") ||
    combined.includes("fix") ||
    combined.includes("error") ||
    combined.includes("let me correct") ||
    combined.includes("self-heal")
  )
}

/**
 * Check if an OpenHands event indicates tests passed.
 */
export function isTestPassEvent(event: OpenHandsEvent): boolean {
  const content = (event.content ?? "").toLowerCase()
  return (
    (content.includes("test") && content.includes("pass")) ||
    content.includes("tests passed")
  )
}

/**
 * Check if an OpenHands event indicates code was written.
 */
export function isCodeWriteEvent(event: OpenHandsEvent): boolean {
  return event.action === "write" || event.action === "edit"
}

/**
 * Extract lines written from a write/edit event.
 */
export function extractLinesWritten(event: OpenHandsEvent): number {
  if (!isCodeWriteEvent(event)) return 0
  const content = (event.args?.content as string) ?? ""
  return content.split("\n").length
}
