import type { AgentEvent } from "@/hooks/use-agent-events"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type BuildPipelineStep =
  | "contracts"
  | "test_gen"
  | "implement"
  | "unit_test"
  | "e2e_test"
  | "visual_check"
  | "ship_ready"

export type BuildPhase = "analysis" | "generation" | "testing" | "healing" | "complete"
export type StepStatus = "pending" | "active" | "complete" | "failed"
export type ActiveBrain = "left" | "right" | "agent" | "idle"

export interface SelfHealCycle {
  id: string
  failureEvent: AgentEvent
  diagnosisEvent: AgentEvent | null
  resolutionEvent: AgentEvent | null
  retryAttempt: number
  maxRetries: number
  isActive: boolean
  startedAt: string
}

export interface MCPToolCall {
  event: AgentEvent
  toolName: string
  source: "left_brain" | "right_brain" | "builtin"
  durationMs: number | null
  status: "success" | "error" | "pending"
}

export const PIPELINE_STEPS: BuildPipelineStep[] = [
  "contracts",
  "test_gen",
  "implement",
  "unit_test",
  "e2e_test",
  "visual_check",
  "ship_ready",
]

/* -------------------------------------------------------------------------- */
/*  deriveBuildStep                                                            */
/* -------------------------------------------------------------------------- */

export function deriveBuildStep(events: AgentEvent[]): {
  step: BuildPipelineStep
  stepStatuses: Record<BuildPipelineStep, StepStatus>
} {
  const statuses: Record<BuildPipelineStep, StepStatus> = {
    contracts: "pending",
    test_gen: "pending",
    implement: "pending",
    unit_test: "pending",
    e2e_test: "pending",
    visual_check: "pending",
    ship_ready: "pending",
  }

  let current: BuildPipelineStep = "contracts"

  for (const e of events) {
    const meta = e.metadata as Record<string, unknown> | null

    if (e.event_type === "tool_call") {
      if (statuses.contracts === "pending") statuses.contracts = "active"
      current = "contracts"
    } else if (e.event_type === "code_write") {
      const isTest = meta?.filename
        ? String(meta.filename).includes("test") || String(meta.filename).includes("spec")
        : false
      if (isTest) {
        statuses.contracts = "complete"
        statuses.test_gen = "active"
        current = "test_gen"
      } else {
        statuses.contracts = "complete"
        if (statuses.test_gen === "active") statuses.test_gen = "complete"
        statuses.implement = "active"
        current = "implement"
      }
    } else if (e.event_type === "test_run") {
      statuses.implement = statuses.implement === "active" ? "complete" : statuses.implement
      const testType = meta?.type as string | undefined
      if (testType === "e2e") {
        statuses.unit_test = statuses.unit_test !== "complete" ? "complete" : statuses.unit_test
        statuses.e2e_test = "active"
        current = "e2e_test"
      } else {
        statuses.unit_test = "active"
        current = "unit_test"
      }
    } else if (e.event_type === "test_result") {
      const passed = meta?.passed === true || meta?.result === "pass"
      if (current === "unit_test") {
        statuses.unit_test = passed ? "complete" : "failed"
      } else if (current === "e2e_test") {
        statuses.e2e_test = passed ? "complete" : "failed"
      }
    } else if (e.event_type === "self_heal") {
      // On self-heal, reset the failed step back to active
      if (statuses.unit_test === "failed") statuses.unit_test = "active"
      if (statuses.e2e_test === "failed") statuses.e2e_test = "active"
      if (statuses.implement === "failed") statuses.implement = "active"
    } else if (e.event_type === "app_start") {
      // App start means we're moving to visual verification
      statuses.implement = statuses.implement === "active" ? "complete" : statuses.implement
      statuses.unit_test = statuses.unit_test === "pending" ? "complete" : statuses.unit_test
    } else if (e.event_type === "browser_action") {
      statuses.visual_check = "active"
      current = "visual_check"
    } else if (e.event_type === "screenshot") {
      // Screenshot during visual check — keep visual_check active
      if (statuses.visual_check !== "active") statuses.visual_check = "active"
      current = "visual_check"
    }
  }

  // Check for ship_ready based on confidence from recent events
  const lastConfEvent = [...events].reverse().find((e) => e.confidence_delta != null)
  if (lastConfEvent) {
    let accumulated = 0
    for (const e of events) {
      if (e.confidence_delta != null) {
        accumulated = Math.max(0, Math.min(1, accumulated + e.confidence_delta))
      }
    }
    if (accumulated >= 0.85) {
      statuses.visual_check = "complete"
      statuses.ship_ready = "complete"
      current = "ship_ready"
    }
  }

  return { step: current, stepStatuses: statuses }
}

/* -------------------------------------------------------------------------- */
/*  deriveBuildPhase                                                           */
/* -------------------------------------------------------------------------- */

export function deriveBuildPhase(events: AgentEvent[], confidence: number): BuildPhase {
  if (events.length === 0) return "analysis"
  if (confidence >= 0.85) return "complete"

  const lastEvent = events[events.length - 1]
  if (!lastEvent) return "analysis"

  if (lastEvent.event_type === "self_heal") return "healing"
  if (lastEvent.event_type === "browser_action" || lastEvent.event_type === "screenshot") return "testing"
  if (lastEvent.event_type === "app_start") return "generation"
  if (lastEvent.event_type === "test_run" || lastEvent.event_type === "test_result") return "testing"
  if (lastEvent.event_type === "code_write") return "generation"
  return "analysis"
}

/* -------------------------------------------------------------------------- */
/*  deriveActiveBrain                                                          */
/* -------------------------------------------------------------------------- */

export function deriveActiveBrain(events: AgentEvent[]): ActiveBrain {
  if (events.length === 0) return "idle"

  // Find the latest tool_call or browser event
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (!e) continue
    if (e.event_type === "browser_action" || e.event_type === "app_start") {
      return "agent"
    }
    if (e.event_type === "tool_call") {
      const meta = e.metadata as Record<string, unknown> | null
      const tool = (meta?.tool as string) ?? ""
      if (tool.includes("code_synapse") || tool.includes("code-synapse") || tool.includes("left_brain")) {
        return "left"
      }
      if (tool.includes("knowledge") || tool.includes("right_brain") || tool.includes("search")) {
        return "right"
      }
      return "agent"
    }
    // Only look back a few events
    if (events.length - 1 - i > 5) break
  }

  return "idle"
}

/* -------------------------------------------------------------------------- */
/*  groupSelfHealCycles                                                        */
/* -------------------------------------------------------------------------- */

export function groupSelfHealCycles(events: AgentEvent[]): SelfHealCycle[] {
  const cycles: SelfHealCycle[] = []
  let cycleCount = 0

  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (!e) continue

    // Look for test failures
    if (e.event_type === "test_result") {
      const meta = e.metadata as Record<string, unknown> | null
      const passed = meta?.passed === true || meta?.result === "pass"
      if (passed) continue

      cycleCount++
      const cycle: SelfHealCycle = {
        id: `heal-${cycleCount}`,
        failureEvent: e,
        diagnosisEvent: null,
        resolutionEvent: null,
        retryAttempt: cycleCount,
        maxRetries: 5,
        isActive: true,
        startedAt: e.created_at,
      }

      // Look ahead for self_heal (diagnosis) and code_write (resolution)
      for (let j = i + 1; j < events.length && j < i + 10; j++) {
        const next = events[j]
        if (!next) continue

        if (next.event_type === "self_heal" && !cycle.diagnosisEvent) {
          cycle.diagnosisEvent = next
        } else if (next.event_type === "code_write" && cycle.diagnosisEvent && !cycle.resolutionEvent) {
          cycle.resolutionEvent = next
        } else if (next.event_type === "test_result") {
          const nextMeta = next.metadata as Record<string, unknown> | null
          const nextPassed = nextMeta?.passed === true || nextMeta?.result === "pass"
          if (nextPassed && cycle.resolutionEvent) {
            cycle.isActive = false
          }
          break
        }
      }

      // Mark inactive if resolution found and we're past it
      if (cycle.resolutionEvent) {
        const resIdx = events.indexOf(cycle.resolutionEvent)
        if (resIdx >= 0 && resIdx < events.length - 3) {
          cycle.isActive = false
        }
      }

      cycles.push(cycle)
    }
  }

  return cycles
}

/* -------------------------------------------------------------------------- */
/*  extractMCPToolCalls                                                        */
/* -------------------------------------------------------------------------- */

export function extractMCPToolCalls(events: AgentEvent[]): MCPToolCall[] {
  const calls: MCPToolCall[] = []

  for (const e of events) {
    if (e.event_type !== "tool_call") continue
    const meta = e.metadata as Record<string, unknown> | null
    const tool = (meta?.tool as string) ?? "unknown"
    const duration = typeof meta?.duration_ms === "number" ? meta.duration_ms : null
    const error = meta?.error as boolean | undefined

    let source: MCPToolCall["source"] = "builtin"
    if (tool.includes("code_synapse") || tool.includes("code-synapse") || tool.includes("left_brain")) {
      source = "left_brain"
    } else if (tool.includes("knowledge") || tool.includes("right_brain") || tool.includes("search")) {
      source = "right_brain"
    }

    calls.push({
      event: e,
      toolName: tool,
      source,
      durationMs: duration,
      status: error ? "error" : duration != null ? "success" : "pending",
    })
  }

  return calls
}

/* -------------------------------------------------------------------------- */
/*  estimateCost                                                               */
/* -------------------------------------------------------------------------- */

export function estimateCost(events: AgentEvent[]): {
  traditional: number
  lazarus: number
  savingsPercent: number
} {
  // Traditional cost: LOC x ($150/hr / 40 lines/hr) = LOC x $3.75
  let totalLines = 0
  for (const e of events) {
    if (e.event_type === "code_write" && e.content) {
      totalLines += e.content.split("\n").length
    }
  }
  const traditional = Math.max(500, totalLines * 3.75)

  // Lazarus cost: events x $0.001
  const lazarus = events.length * 0.001

  const savingsPercent = traditional > 0 ? ((traditional - lazarus) / traditional) * 100 : 0

  return { traditional, lazarus, savingsPercent }
}
