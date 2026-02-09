"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import type { AgentEvent } from "@/hooks/use-agent-events"
import type { Database } from "@/lib/db/types"
import { getEventTypeColor, timeAgo } from "./derive-stats"

type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

interface ActivityTimelineProps {
  events: AgentEvent[]
  slices: Slice[]
}

interface TooltipState {
  x: number
  event: AgentEvent
}

export function ActivityTimeline({ events, slices }: ActivityTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Build a slice name lookup
  const sliceMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of slices) {
      map.set(s.id, s.name)
    }
    return map
  }, [slices])

  // Normalize timestamps
  const { normalizedEvents, timeRange } = useMemo(() => {
    if (events.length === 0) return { normalizedEvents: [], timeRange: 1 }
    const firstTs = new Date(events[0]?.created_at ?? Date.now()).getTime()
    const lastTs = new Date(events[events.length - 1]?.created_at ?? Date.now()).getTime()
    const range = Math.max(lastTs - firstTs, 1)

    const normalized = events.map((e) => ({
      event: e,
      position: (new Date(e.created_at).getTime() - firstTs) / range,
    }))

    return { normalizedEvents: normalized, timeRange: range }
  }, [events])

  // Find slice ranges for background bands
  const sliceBands = useMemo(() => {
    if (events.length === 0) return []
    const firstTs = new Date(events[0]?.created_at ?? Date.now()).getTime()

    const bands: Array<{ sliceId: string; start: number; end: number; color: string }> = []
    let currentSlice: string | null = null
    let bandStart = 0

    for (const e of events) {
      if (e.slice_id && e.slice_id !== currentSlice) {
        if (currentSlice) {
          const pos = (new Date(e.created_at).getTime() - firstTs) / Math.max(timeRange, 1)
          bands.push({
            sliceId: currentSlice,
            start: bandStart,
            end: pos,
            color: getSliceColor(currentSlice),
          })
        }
        currentSlice = e.slice_id
        bandStart = (new Date(e.created_at).getTime() - firstTs) / Math.max(timeRange, 1)
      }
    }

    // Close last band
    if (currentSlice) {
      bands.push({
        sliceId: currentSlice,
        start: bandStart,
        end: 1,
        color: getSliceColor(currentSlice),
      })
    }

    return bands
  }, [events, timeRange])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || normalizedEvents.length === 0) {
        setTooltip(null)
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width

      // Find closest event
      let closest = normalizedEvents[0]
      let closestDist = Math.abs((closest?.position ?? 0) - x)

      for (const ne of normalizedEvents) {
        const dist = Math.abs(ne.position - x)
        if (dist < closestDist) {
          closest = ne
          closestDist = dist
        }
      }

      if (closest && closestDist < 0.05) {
        setTooltip({ x: e.clientX - rect.left, event: closest.event })
      } else {
        setTooltip(null)
      }
    },
    [normalizedEvents]
  )

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  if (events.length === 0) {
    return (
      <div className="glass-panel flex h-8 items-center justify-center rounded-lg border border-border">
        <span className="text-[10px] text-muted-foreground/40">No events yet</span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="glass-panel relative h-8 cursor-crosshair overflow-hidden rounded-lg border border-border"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Slice background bands */}
      {sliceBands.map((band, i) => (
        <div
          key={`band-${i}`}
          className="absolute inset-y-0"
          style={{
            left: `${band.start * 100}%`,
            width: `${(band.end - band.start) * 100}%`,
            backgroundColor: band.color,
            opacity: 0.06,
          }}
        />
      ))}

      {/* Event ticks */}
      {normalizedEvents.map(({ event, position }) => {
        const isLarger = event.event_type === "test_result" || event.event_type === "self_heal"
        return (
          <div
            key={event.id}
            className="absolute top-1 bottom-1"
            style={{
              left: `${position * 100}%`,
              width: isLarger ? 4 : 1,
              backgroundColor: getEventTypeColor(event.event_type),
              opacity: isLarger ? 0.9 : 0.5,
              borderRadius: isLarger ? 2 : 0,
            }}
          />
        )
      })}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute bottom-full z-50 mb-1 -translate-x-1/2 rounded-md border border-border bg-slate-grey/95 px-2.5 py-1.5 text-[10px] shadow-lg backdrop-blur-sm"
          style={{ left: tooltip.x }}
        >
          <div className="flex items-center gap-1.5">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: getEventTypeColor(tooltip.event.event_type) }}
            />
            <span className="font-semibold capitalize text-foreground">
              {tooltip.event.event_type.replace("_", " ")}
            </span>
          </div>
          <p className="mt-0.5 max-w-48 truncate text-muted-foreground">
            {tooltip.event.content.slice(0, 80)}
          </p>
          <span className="text-muted-foreground/50">{timeAgo(tooltip.event.created_at)}</span>
        </div>
      )}
    </div>
  )
}

/* Simple hash-based color for slice background bands */
function getSliceColor(sliceId: string): string {
  const colors = ["#00E5FF", "#8134CE", "#FFB800", "#00FF88", "#FF3366", "#2979FF"]
  let hash = 0
  for (let i = 0; i < sliceId.length; i++) {
    hash = ((hash << 5) - hash + sliceId.charCodeAt(i)) | 0
  }
  return colors[Math.abs(hash) % colors.length] ?? "#00E5FF"
}
