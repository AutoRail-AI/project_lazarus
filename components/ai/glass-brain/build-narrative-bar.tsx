"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import type { AgentEvent } from "@/hooks/use-agent-events"
import type { BuildPhase } from "./derive-build-phase"

interface BuildNarrativeBarProps {
  events: AgentEvent[]
  currentPhase: BuildPhase
}

function deriveNarrative(events: AgentEvent[], currentPhase: BuildPhase): string {
  if (events.length === 0) {
    return "Initializing the build pipeline..."
  }

  const lastEvent = events[events.length - 1]
  if (!lastEvent) return "Processing..."

  const meta = lastEvent.metadata as Record<string, unknown> | null

  switch (lastEvent.event_type) {
    case "thought":
      return lastEvent.content.length > 120
        ? lastEvent.content.slice(0, 117) + "..."
        : lastEvent.content

    case "code_write": {
      const filename = (meta?.filename as string) ?? null
      return filename
        ? `Writing implementation code in ${filename}...`
        : "Writing implementation code for the current feature..."
    }

    case "tool_call": {
      const toolName = (meta?.tool as string) ?? "a tool"
      return `Using ${toolName} to gather context and requirements...`
    }

    case "test_run":
      return "Running the test suite to verify the implementation..."

    case "test_result": {
      const passed = meta?.passed === true || meta?.result === "pass"
      return passed
        ? "All tests passing! Calculating confidence..."
        : "Tests failed \u2014 the agent is analyzing what went wrong..."
    }

    case "self_heal":
      return "Detected an issue \u2014 diagnosing root cause and preparing a fix..."

    case "observation":
      return lastEvent.content.length > 120
        ? lastEvent.content.slice(0, 117) + "..."
        : lastEvent.content

    case "confidence_update":
      return currentPhase === "complete"
        ? "Build confidence threshold reached! Ship ready."
        : "Recalculating confidence based on latest results..."

    case "browser_action": {
      const action = (meta?.action as string) ?? "interacting with"
      const target = (meta?.target as string) ?? "the page"
      return `The agent is ${action} ${target} in the browser...`
    }

    case "screenshot":
      return "Captured a screenshot to verify the visual output..."

    case "app_start": {
      const url = (meta?.url as string) ?? "the application"
      return `Starting ${url} for live browser testing...`
    }

    default:
      return "Processing..."
  }
}

export function BuildNarrativeBar({ events, currentPhase }: BuildNarrativeBarProps) {
  const narrative = useMemo(
    () => deriveNarrative(events, currentPhase),
    [events, currentPhase]
  )

  const lastEventId = events[events.length - 1]?.id ?? "empty"

  return (
    <div className="glass-panel flex h-8 items-center gap-2 overflow-hidden rounded-lg border border-border px-3">
      <Sparkles className="h-3 w-3 shrink-0 text-electric-cyan/60" />
      <AnimatePresence mode="wait">
        <motion.span
          key={lastEventId}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="truncate text-xs text-muted-foreground"
        >
          {narrative}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
