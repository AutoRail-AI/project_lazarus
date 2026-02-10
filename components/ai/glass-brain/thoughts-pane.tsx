"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { AgentEvent } from "@/hooks/use-agent-events"

/* -------------------------------------------------------------------------- */
/*  Category detection                                                         */
/* -------------------------------------------------------------------------- */

type ThoughtCategory = "Planning" | "Implementing" | "Testing" | "Debugging" | "Healing"

const ALL_CATEGORIES: ThoughtCategory[] = [
  "Planning",
  "Implementing",
  "Testing",
  "Debugging",
  "Healing",
]

const CATEGORY_STYLES: Record<ThoughtCategory, string> = {
  Planning: "bg-rail-purple/20 text-quantum-violet",
  Implementing: "bg-electric-cyan/15 text-electric-cyan",
  Testing: "bg-warning/15 text-warning",
  Debugging: "bg-error/15 text-error",
  Healing: "bg-rail-purple/15 text-quantum-violet",
}

const CATEGORY_ACTIVE_STYLES: Record<ThoughtCategory, string> = {
  Planning: "bg-quantum-violet/30 text-quantum-violet border-quantum-violet/40",
  Implementing: "bg-electric-cyan/25 text-electric-cyan border-electric-cyan/40",
  Testing: "bg-warning/25 text-warning border-warning/40",
  Debugging: "bg-error/25 text-error border-error/40",
  Healing: "bg-rail-purple/25 text-quantum-violet border-quantum-violet/40",
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
        "rounded-lg border bg-card/30 p-3 shrink-0",
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
  const [activeFilter, setActiveFilter] = useState<ThoughtCategory | null>(null)

  // Filter for thoughts and self_heal events, reverse chronological
  const thoughts = useMemo(
    () =>
      events
        .filter((e) => e.event_type === "thought" || e.event_type === "self_heal")
        .reverse(),
    [events]
  )

  // Compute category counts for filter badges
  const categoryCounts = useMemo(() => {
    const counts: Record<ThoughtCategory, number> = {
      Planning: 0,
      Implementing: 0,
      Testing: 0,
      Debugging: 0,
      Healing: 0,
    }
    for (const t of thoughts) {
      const cat = detectCategory(t)
      counts[cat]++
    }
    return counts
  }, [thoughts])

  // Apply filter
  const filteredThoughts = useMemo(() => {
    if (!activeFilter) return thoughts
    return thoughts.filter((t) => detectCategory(t) === activeFilter)
  }, [thoughts, activeFilter])

  // Only show categories that have events
  const visibleCategories = ALL_CATEGORIES.filter((c) => categoryCounts[c] > 0)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
        <span className="font-grotesk text-sm font-semibold text-foreground">
          The Thoughts
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {filteredThoughts.length}{activeFilter ? `/${thoughts.length}` : ""}
        </span>
      </div>

      {/* Category filters */}
      {visibleCategories.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-border/50 px-2 py-1.5 shrink-0">
          <button
            onClick={() => setActiveFilter(null)}
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-medium border transition-colors",
              !activeFilter
                ? "bg-foreground/10 text-foreground border-foreground/20"
                : "text-muted-foreground/60 border-transparent hover:text-muted-foreground"
            )}
          >
            All
          </button>
          {visibleCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-medium border transition-colors",
                activeFilter === cat
                  ? CATEGORY_ACTIVE_STYLES[cat]
                  : "text-muted-foreground/60 border-transparent hover:text-muted-foreground"
              )}
            >
              {cat} ({categoryCounts[cat]})
            </button>
          ))}
        </div>
      )}

      {/* Thought cards — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {filteredThoughts.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
            {activeFilter
              ? `No ${activeFilter.toLowerCase()} thoughts yet...`
              : "Agent thoughts will appear here..."}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredThoughts.map((event, i) => (
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
