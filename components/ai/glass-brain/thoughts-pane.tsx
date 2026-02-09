"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { AgentEvent } from "@/hooks/use-agent-events"

/* -------------------------------------------------------------------------- */
/*  Category detection                                                         */
/* -------------------------------------------------------------------------- */

type ThoughtCategory = "Planning" | "Implementing" | "Testing" | "Debugging" | "Healing"

const CATEGORY_STYLES: Record<ThoughtCategory, string> = {
  Planning: "bg-rail-purple/20 text-quantum-violet",
  Implementing: "bg-electric-cyan/15 text-electric-cyan",
  Testing: "bg-warning/15 text-warning",
  Debugging: "bg-error/15 text-error",
  Healing: "bg-rail-purple/15 text-quantum-violet",
}

function detectCategory(event: AgentEvent): ThoughtCategory {
  if (event.event_type === "self_heal") return "Healing"

  const content = event.content.toLowerCase()
  if (content.includes("test") || content.includes("assert") || content.includes("spec"))
    return "Testing"
  if (content.includes("debug") || content.includes("error") || content.includes("fix") || content.includes("fail"))
    return "Debugging"
  if (content.includes("implement") || content.includes("writ") || content.includes("creat") || content.includes("generat"))
    return "Implementing"
  return "Planning"
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

/* -------------------------------------------------------------------------- */
/*  Thought Card                                                               */
/* -------------------------------------------------------------------------- */

function ThoughtCard({
  event,
  index,
  isHealSpotlight,
}: {
  event: AgentEvent
  index: number
  isHealSpotlight: boolean
}) {
  const category = detectCategory(event)
  const isSelfHeal = event.event_type === "self_heal"
  const opacity = Math.max(0.3, 1 - index * 0.1)

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity, y: 0 }}
      exit={{ opacity: 0, y: 16, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-lg border bg-card/30 p-3",
        isSelfHeal
          ? "border-rail-purple/40 glow-purple"
          : "border-border",
        isHealSpotlight && isSelfHeal && "animate-pulse-glow border-rail-purple"
      )}
    >
      {/* Top: category + timestamp */}
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            CATEGORY_STYLES[category]
          )}
        >
          {isSelfHeal ? "Diagnosis" : category}
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          {timeAgo(event.created_at)}
        </span>
      </div>

      {/* Content */}
      <p className="text-xs leading-relaxed text-foreground/80">
        {event.content}
      </p>

      {/* Confidence delta */}
      {event.confidence_delta != null && event.confidence_delta !== 0 && (
        <div className="mt-1.5 text-[10px]">
          <span
            className={
              event.confidence_delta > 0 ? "text-success" : "text-error"
            }
          >
            {event.confidence_delta > 0 ? "+" : ""}
            {(event.confidence_delta * 100).toFixed(1)}% confidence
          </span>
        </div>
      )}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Thoughts Pane                                                              */
/* -------------------------------------------------------------------------- */

interface ThoughtsPaneProps {
  events: AgentEvent[]
  /** Whether self-heal spotlight mode is active */
  healSpotlight?: boolean
}

export function ThoughtsPane({ events, healSpotlight = false }: ThoughtsPaneProps) {
  // Filter for thoughts and self_heal events, reverse chronological
  const thoughts = useMemo(
    () =>
      events
        .filter((e) => e.event_type === "thought" || e.event_type === "self_heal")
        .reverse(),
    [events]
  )

  return (
    <div className="glass-panel flex flex-col overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-grotesk text-sm font-semibold text-foreground">
          The Thoughts
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {thoughts.length}
        </span>
      </div>

      {/* Thought cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {thoughts.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
            Agent thoughts will appear here...
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {thoughts.map((event, i) => (
              <ThoughtCard
                key={event.id}
                event={event}
                index={i}
                isHealSpotlight={healSpotlight}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
