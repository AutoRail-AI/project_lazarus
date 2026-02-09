import type { AgentEvent } from "@/hooks/use-agent-events"
import type { AgentEventType } from "@/lib/db/types"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface DerivedStats {
  linesOfCode: number
  testsTotal: number
  testsPassed: number
  testsFailed: number
  toolsUsed: number
  selfHeals: number
  currentActivity: string
  confidenceHistory: ConfidencePoint[]
  eventsBySlice: Map<string, AgentEvent[]>
}

export interface ConfidencePoint {
  timestamp: number
  value: number
}

export interface ConfidenceBreakdown {
  codeQuality: number
  testCoverage: number
  selfHealSuccess: number
  overallProgress: number
}

export interface TestSummary {
  total: number
  passed: number
  failed: number
}

/* -------------------------------------------------------------------------- */
/*  Event type → color mapping                                                 */
/* -------------------------------------------------------------------------- */

const EVENT_COLORS: Record<AgentEventType, string> = {
  thought: "#888888",
  tool_call: "#00E5FF",
  observation: "#666666",
  code_write: "#FAFAFA",
  test_run: "#FFB800",
  test_result: "#00FF88",
  self_heal: "#8134CE",
  confidence_update: "#00E5FF",
  browser_action: "#FF9500",
  screenshot: "#AF52DE",
  app_start: "#30D158",
}

export function getEventTypeColor(eventType: AgentEventType): string {
  return EVENT_COLORS[eventType] ?? "#888888"
}

/* -------------------------------------------------------------------------- */
/*  Time helpers                                                               */
/* -------------------------------------------------------------------------- */

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

/* -------------------------------------------------------------------------- */
/*  Lines of code                                                              */
/* -------------------------------------------------------------------------- */

export function countLinesOfCode(events: AgentEvent[]): number {
  let total = 0
  for (const e of events) {
    if (e.event_type === "code_write" && e.content) {
      total += e.content.split("\n").length
    }
  }
  return total
}

/* -------------------------------------------------------------------------- */
/*  Test summary                                                               */
/* -------------------------------------------------------------------------- */

export function getTestSummary(events: AgentEvent[]): TestSummary {
  let passed = 0
  let failed = 0
  for (const e of events) {
    if (e.event_type === "test_result") {
      const meta = e.metadata as Record<string, unknown> | null
      if (meta?.passed === true || meta?.result === "pass") {
        passed++
      } else {
        failed++
      }
    }
  }
  return { total: passed + failed, passed, failed }
}

/* -------------------------------------------------------------------------- */
/*  Confidence history                                                         */
/* -------------------------------------------------------------------------- */

export function getConfidenceHistory(
  events: AgentEvent[],
  initial = 0
): ConfidencePoint[] {
  const history: ConfidencePoint[] = [{ timestamp: Date.now() - 60000, value: initial }]
  let accumulated = initial

  for (const e of events) {
    if (e.confidence_delta != null && e.confidence_delta !== 0) {
      accumulated = Math.max(0, Math.min(1, accumulated + e.confidence_delta))
      history.push({
        timestamp: new Date(e.created_at).getTime(),
        value: accumulated,
      })
    }
  }

  return history
}

/* -------------------------------------------------------------------------- */
/*  Confidence breakdown (deterministic weighted)                              */
/* -------------------------------------------------------------------------- */

export function getConfidenceBreakdown(score: number): ConfidenceBreakdown {
  // Deterministic weighted split for tooltip display
  const codeQuality = Math.round(score * 30)
  const testCoverage = Math.round(score * 35)
  const selfHealSuccess = Math.round(score * 15)
  const overallProgress = Math.round(score * 20)
  return { codeQuality, testCoverage, selfHealSuccess, overallProgress }
}

/* -------------------------------------------------------------------------- */
/*  Agent status label                                                         */
/* -------------------------------------------------------------------------- */

export function getAgentStatusLabel(events: AgentEvent[]): string {
  if (events.length === 0) return "Initializing..."

  const lastEvent = events[events.length - 1]
  if (!lastEvent) return "Initializing..."

  switch (lastEvent.event_type) {
    case "code_write":
      return "Writing code..."
    case "test_run":
      return "Running tests..."
    case "test_result": {
      const meta = lastEvent.metadata as Record<string, unknown> | null
      if (meta?.passed === true || meta?.result === "pass") {
        return "Tests passed"
      }
      return "Tests failed — analyzing..."
    }
    case "self_heal":
      return "Self-healing..."
    case "tool_call": {
      const meta = lastEvent.metadata as Record<string, unknown> | null
      const toolName = (meta?.tool as string) ?? "tool"
      return `Using ${toolName}...`
    }
    case "thought":
      return "Analyzing..."
    case "observation":
      return "Observing..."
    case "confidence_update":
      return "Updating confidence..."
    case "browser_action": {
      const bmeta = lastEvent.metadata as Record<string, unknown> | null
      const action = (bmeta?.action as string) ?? "interacting"
      return `Browser: ${action}...`
    }
    case "screenshot":
      return "Capturing screenshot..."
    case "app_start":
      return "Starting application..."
    default:
      return "Working..."
  }
}

/* -------------------------------------------------------------------------- */
/*  Derive all stats                                                           */
/* -------------------------------------------------------------------------- */

export function deriveStats(events: AgentEvent[], confidence: number): DerivedStats {
  const linesOfCode = countLinesOfCode(events)
  const tests = getTestSummary(events)
  const toolsUsed = events.filter((e) => e.event_type === "tool_call").length
  const selfHeals = events.filter((e) => e.event_type === "self_heal").length
  const currentActivity = getAgentStatusLabel(events)
  const confidenceHistory = getConfidenceHistory(events, 0)

  // Group events by slice
  const eventsBySlice = new Map<string, AgentEvent[]>()
  for (const e of events) {
    const sliceId = e.slice_id ?? "__none__"
    const existing = eventsBySlice.get(sliceId)
    if (existing) {
      existing.push(e)
    } else {
      eventsBySlice.set(sliceId, [e])
    }
  }

  return {
    linesOfCode,
    testsTotal: tests.total,
    testsPassed: tests.passed,
    testsFailed: tests.failed,
    toolsUsed,
    selfHeals,
    currentActivity,
    confidenceHistory,
    eventsBySlice,
  }
}
