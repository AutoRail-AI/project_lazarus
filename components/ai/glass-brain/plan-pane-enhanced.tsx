"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { GitBranch, List } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Database, SliceStatus } from "@/lib/db/types"
import type { AgentEvent } from "@/hooks/use-agent-events"
import { ConfidenceRing } from "@/components/slices/confidence-ring"
import { SliceStatusBadge } from "@/components/slices/slice-status-badge"
import { SliceGraph } from "@/components/slices/slice-graph"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getAgentStatusLabel } from "./derive-stats"

type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

interface PlanPaneEnhancedProps {
  slices: Slice[]
  activeSliceId?: string | null
  events: AgentEvent[]
}

/* -------------------------------------------------------------------------- */
/*  Status color map for progress bar                                          */
/* -------------------------------------------------------------------------- */

const STATUS_COLORS: Record<SliceStatus, string> = {
  pending: "#666666",
  selected: "#8134CE",
  building: "#00E5FF",
  testing: "#FFB800",
  self_healing: "#8134CE",
  complete: "#00FF88",
  failed: "#FF3366",
}

/* -------------------------------------------------------------------------- */
/*  Mini Progress Bar                                                          */
/* -------------------------------------------------------------------------- */

function MiniProgressBar({ slices }: { slices: Slice[] }) {
  const statusCounts = useMemo(() => {
    const counts = new Map<SliceStatus, number>()
    for (const s of slices) {
      counts.set(s.status, (counts.get(s.status) ?? 0) + 1)
    }
    return counts
  }, [slices])

  const total = slices.length
  if (total === 0) return null

  const pending = statusCounts.get("pending") ?? 0
  const building =
    (statusCounts.get("building") ?? 0) +
    (statusCounts.get("testing") ?? 0) +
    (statusCounts.get("self_healing") ?? 0) +
    (statusCounts.get("selected") ?? 0)
  const complete = statusCounts.get("complete") ?? 0

  return (
    <div className="px-3 py-2">
      {/* Stacked bar */}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-grey/50">
        {Array.from(statusCounts.entries()).map(([status, count]) => (
          <motion.div
            key={status}
            className="h-full"
            style={{ backgroundColor: STATUS_COLORS[status] }}
            initial={{ width: "0%" }}
            animate={{ width: `${(count / total) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        ))}
      </div>
      {/* Labels */}
      <div className="mt-1 flex gap-2 text-[9px] text-muted-foreground/60">
        {pending > 0 && <span>{pending} pending</span>}
        {building > 0 && <span className="text-electric-cyan">{building} building</span>}
        {complete > 0 && <span className="text-success">{complete} complete</span>}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Active Slice Spotlight                                                     */
/* -------------------------------------------------------------------------- */

function ActiveSliceSpotlight({
  slice,
  events,
}: {
  slice: Slice
  events: AgentEvent[]
}) {
  // Get the latest activity for this slice
  const sliceEvents = useMemo(
    () => events.filter((e) => e.slice_id === slice.id),
    [events, slice.id]
  )
  const currentStep = useMemo(
    () => getAgentStatusLabel(sliceEvents),
    [sliceEvents]
  )

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-3 mb-2 rounded-lg border border-electric-cyan/30 bg-electric-cyan/5 p-3"
      style={{
        boxShadow: "0 0 12px rgba(0,229,255,0.15), inset 0 0 12px rgba(0,229,255,0.05)",
      }}
    >
      <div className="flex items-start gap-3">
        <ConfidenceRing value={slice.confidence_score} size={32} showLabel animated />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-grotesk text-sm font-semibold text-foreground">
              {slice.name}
            </span>
            <SliceStatusBadge status={slice.status} />
          </div>
          <p className="mt-0.5 truncate text-[10px] text-electric-cyan/80">
            {currentStep}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Slice Mini Card                                                            */
/* -------------------------------------------------------------------------- */

function SliceMiniCard({ slice }: { slice: Slice }) {
  const statusColor = STATUS_COLORS[slice.status]

  return (
    <div className="flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors hover:bg-slate-grey/30">
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: statusColor }}
      />
      <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">
        {slice.name}
      </span>
      <ConfidenceRing value={slice.confidence_score} size={24} showLabel={false} animated={false} strokeWidth={2} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Plan Pane Enhanced                                                         */
/* -------------------------------------------------------------------------- */

export function PlanPaneEnhanced({ slices, activeSliceId, events }: PlanPaneEnhancedProps) {
  const [view, setView] = useState<"list" | "graph">("list")

  const completedCount = useMemo(
    () => slices.filter((s) => s.status === "complete").length,
    [slices]
  )

  const activeSlice = useMemo(
    () => slices.find((s) => s.id === activeSliceId) ?? slices.find((s) => s.status === "building"),
    [slices, activeSliceId]
  )

  // Sort other slices by priority
  const otherSlices = useMemo(
    () =>
      slices
        .filter((s) => s.id !== activeSlice?.id)
        .sort((a, b) => a.priority - b.priority),
    [slices, activeSlice?.id]
  )

  return (
    <div className="glass-panel flex flex-col overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-grotesk text-sm font-semibold text-foreground">
          The Plan
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            <span className="text-success">{completedCount}</span>/{slices.length}
          </span>
          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-slate-grey/30 p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              className={cn(
                "rounded p-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                view === "list" ? "bg-electric-cyan/20 text-electric-cyan" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setView("graph")}
              aria-label="Graph view"
              className={cn(
                "rounded p-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                view === "graph" ? "bg-electric-cyan/20 text-electric-cyan" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GitBranch className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <MiniProgressBar slices={slices} />

      {/* Content */}
      <div className="min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {view === "list" ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col"
            >
              {/* Active spotlight */}
              {activeSlice && (
                <ActiveSliceSpotlight slice={activeSlice} events={events} />
              )}

              {/* Other slices */}
              <ScrollArea className="flex-1">
                <div className="space-y-0.5 pb-2">
                  {otherSlices.map((slice) => (
                    <SliceMiniCard key={slice.id} slice={slice} />
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          ) : (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <SliceGraph slices={slices} selectedSliceId={activeSliceId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
