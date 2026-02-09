"use client"

import { useMemo } from "react"
import type { Database } from "@/lib/db/types"
import { SliceGraph } from "@/components/slices/slice-graph"

type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

interface PlanPaneProps {
  slices: Slice[]
  activeSliceId?: string | null
}

export function PlanPane({ slices, activeSliceId }: PlanPaneProps) {
  const completedCount = useMemo(
    () => slices.filter((s) => s.status === "complete").length,
    [slices]
  )

  return (
    <div className="glass-panel flex flex-col overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-grotesk text-sm font-semibold text-foreground">
          The Plan
        </span>
        <span className="text-xs text-muted-foreground">
          <span className="text-success">{completedCount}</span>/{slices.length}
        </span>
      </div>

      {/* Graph */}
      <div className="flex-1">
        <SliceGraph
          slices={slices}
          selectedSliceId={activeSliceId}
        />
      </div>
    </div>
  )
}
