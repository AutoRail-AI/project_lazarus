"use client"

import { useCallback, useMemo, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Project, Slice } from "./plan-types"
import { getFilteredSlices, getNextBuildable } from "./plan-utils"
import { usePlanState } from "./use-plan-state"
import { PlanStatsBar } from "./plan-stats-bar"
import { PlanToolbar } from "./plan-toolbar"
import { PlanSidebar } from "./plan-sidebar"
import { SliceGraph } from "./slice-graph"
import { SliceList } from "./slice-list"
import { SliceDetailSheet } from "./slice-detail-sheet"
import { BreathingGlow } from "@/components/ai/glass-brain/ambient-effects"

interface PlanCommandCenterProps {
  project: Project
  initialSlices: Slice[]
}

export function PlanCommandCenter({
  project,
  initialSlices,
}: PlanCommandCenterProps) {
  const [slices, setSlices] = useState(initialSlices)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const {
    state,
    setView,
    setSearch,
    setStatuses,
    selectSlice,
    clearSelection,
    closeDetail,
    setFocusedSlice,
  } = usePlanState()

  const filteredSlices = useMemo(
    () => getFilteredSlices(slices, state.filters),
    [slices, state.filters]
  )

  const buildableCount = useMemo(
    () =>
      slices.filter(
        (s) =>
          (s.status === "pending" || s.status === "selected") &&
          (s.dependencies ?? []).every((depId) =>
            slices.some((d) => d.id === depId && d.status === "complete")
          )
      ).length,
    [slices]
  )

  const selectedSlice = useMemo(
    () => slices.find((s) => s.id === state.selectedSliceId) ?? null,
    [slices, state.selectedSliceId]
  )

  const handleBuildNext = useCallback(() => {
    const next = getNextBuildable(slices)
    if (next) {
      selectSlice(next.id)
    }
  }, [slices, selectSlice])

  const handleSliceSelect = useCallback(
    (slice: Slice) => {
      selectSlice(slice.id)
    },
    [selectSlice]
  )

  const handleDetailClose = useCallback(() => {
    closeDetail()
  }, [closeDetail])

  const handleSliceUpdate = useCallback(
    (updatedSlice: Slice) => {
      setSlices((prev) =>
        prev.map((s) => (s.id === updatedSlice.id ? updatedSlice : s))
      )
    },
    []
  )

  return (
    <TooltipProvider>
      <BreathingGlow confidence={project.confidence_score || 0.5} className="flex h-full flex-col p-4 gap-4">
        {/* Stats bar */}
        <PlanStatsBar project={project} slices={slices} />

        {/* Toolbar */}
        <PlanToolbar
          projectId={project.id}
          view={state.view}
          onViewChange={setView}
          search={state.filters.search}
          onSearchChange={setSearch}
          statuses={state.filters.statuses}
          onStatusesChange={setStatuses}
          onBuildNext={handleBuildNext}
          buildableCount={buildableCount}
          filteredCount={filteredSlices.length}
          totalCount={slices.length}
          sidebarOpen={sidebarOpen}
          onSidebarToggle={() => setSidebarOpen((p) => !p)}
        />

        {/* Main content: sidebar + viewport */}
        <div className="flex min-h-0 flex-1 gap-4">
          <PlanSidebar
            slices={filteredSlices}
            selectedSliceId={state.selectedSliceId}
            search={state.filters.search}
            onSelect={handleSliceSelect}
            open={sidebarOpen}
          />

          {/* Viewport */}
          <div className="min-h-0 flex-1 glass-panel rounded-lg border border-border/50 bg-card/20 overflow-hidden relative flex flex-col">
            {state.view === "graph" ? (
              <SliceGraph
                slices={filteredSlices}
                onNodeClick={handleSliceSelect}
                selectedSliceId={state.selectedSliceId}
                focusedSliceId={state.focusedSliceId}
                onNodeHover={setFocusedSlice}
              />
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <SliceList
                  slices={filteredSlices}
                  onSelect={handleSliceSelect}
                  selectedId={state.selectedSliceId}
                  search={state.filters.search}
                />
              </div>
            )}
          </div>
        </div>

        {/* Detail sheet */}
        <SliceDetailSheet
          slice={selectedSlice}
          allSlices={slices}
          projectId={project.id}
          open={state.detailOpen}
          onClose={handleDetailClose}
          onSliceSelect={handleSliceSelect}
          onSliceUpdate={handleSliceUpdate}
        />
      </BreathingGlow>
    </TooltipProvider>
  )
}
