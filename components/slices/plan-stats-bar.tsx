"use client"

import { useEffect, useRef } from "react"
import { Activity, CheckCircle2, Layers, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SliceStatus } from "@/lib/db/types"
import type { Project, Slice } from "./plan-types"
import { SliceStatusBadge } from "./slice-status-badge"
import { ConfidenceRing } from "./confidence-ring"
import { getStatusCounts } from "./plan-utils"

interface PlanStatsBarProps {
  project: Project
  slices: Slice[]
}

function AnimatedCount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const currentRef = useRef(0)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced || !ref.current) {
      if (ref.current) ref.current.textContent = String(value)
      return
    }

    const start = currentRef.current
    const diff = value - start
    if (diff === 0) return

    const duration = 600
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + diff * eased)
      if (ref.current) ref.current.textContent = String(current)
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        currentRef.current = value
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  return <span ref={ref}>{value}</span>
}

export function PlanStatsBar({ project, slices }: PlanStatsBarProps) {
  const counts = getStatusCounts(slices)
  const total = slices.length
  const completed = counts.complete
  const building = counts.building + counts.testing + counts.self_healing
  const buildable = slices.filter(
    (s) =>
      (s.status === "pending" || s.status === "selected") &&
      (s.dependencies ?? []).every((depId) =>
        slices.some((d) => d.id === depId && d.status === "complete")
      )
  ).length
  const avgConfidence =
    total > 0
      ? Math.round(slices.reduce((sum: number, s: Slice) => sum + s.confidence_score, 0) / total)
      : 0
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0

  const metrics: Array<{
    label: string
    value: number
    icon: React.ElementType
    colorClass: string
    isRing?: boolean
  }> = [
    { label: "Total", value: total, icon: Layers, colorClass: "text-cloud-white" },
    { label: "Complete", value: completed, icon: CheckCircle2, colorClass: "text-success" },
    { label: "Building", value: building, icon: Activity, colorClass: "text-electric-cyan" },
    { label: "Ready", value: buildable, icon: Zap, colorClass: "text-quantum-violet" },
    { label: "Avg Confidence", value: avgConfidence, icon: Zap, colorClass: "text-electric-cyan", isRing: true },
  ]

  return (
    <div className="glass-panel relative overflow-hidden rounded-lg border border-border">
      {/* Project header + metrics */}
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Project info */}
        <div className="flex items-center gap-3 border-r border-border pr-4">
          <h1 className="font-grotesk text-lg font-semibold text-foreground">
            {project.name}
          </h1>
          <SliceStatusBadge status={project.status} />
        </div>

        {/* Metric cells */}
        <div className="flex flex-1 items-center gap-6">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center gap-2">
              {m.isRing ? (
                <ConfidenceRing value={m.value} size={32} showLabel animated />
              ) : (
                <m.icon className={cn("h-4 w-4", m.colorClass)} />
              )}
              <div className="flex flex-col">
                <span className={cn("font-mono text-lg font-bold leading-tight", m.colorClass)}>
                  {m.isRing ? null : <AnimatedCount value={m.value} />}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{completionPct}%</span> done
        </div>
      </div>

      {/* Bottom progress bar */}
      <div className="h-1 w-full bg-slate-grey/50">
        <div
          className="h-full bg-automation-flow transition-all duration-700 ease-out"
          style={{ width: `${completionPct}%` }}
        />
      </div>
    </div>
  )
}
