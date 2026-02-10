"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Code,
  Download,
  FlaskConical,
  LayoutGrid,
  RotateCw,
  Timer,
  Wrench,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AgentEvent } from "@/hooks/use-agent-events"
import type { Database } from "@/lib/db/types"
import { SliceStatusBadge } from "@/components/slices/slice-status-badge"
import { ProjectImmersiveActions } from "@/components/projects/project-immersive-actions"
import { deriveStats, getAgentStatusLabel, getEventTypeColor } from "./derive-stats"

type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

interface HeaderStatsProps {
  projectId: string
  events: AgentEvent[]
  confidence: number
  projectName: string
  activeSlice?: Slice | null
  slices?: Slice[]
  elapsedRef: React.RefObject<number>
  mcpCallCount?: number
  onToggleMCPInspector?: () => void
}

/* -------------------------------------------------------------------------- */
/*  Animated counter — rAF-based number animation                              */
/* -------------------------------------------------------------------------- */

function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setDisplay(value)
      prevRef.current = value
      return
    }

    const start = prevRef.current
    const diff = value - start
    if (diff === 0) return

    const duration = 600
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + diff * eased))
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        prevRef.current = value
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  return <span className={className}>{display}</span>
}

/* -------------------------------------------------------------------------- */
/*  Elapsed Timer                                                              */
/* -------------------------------------------------------------------------- */

function ElapsedTimer({ elapsedRef }: { elapsedRef: React.RefObject<number> }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000)
      setElapsed(secs)
      if (elapsedRef.current !== undefined) {
        elapsedRef.current = secs
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [elapsedRef])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`

  return (
    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
      <Timer className="h-3 w-3" />
      {formatted}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Header Stats                                                               */
/* -------------------------------------------------------------------------- */

export function HeaderStats({
  projectId,
  events,
  confidence,
  projectName,
  activeSlice,
  slices,
  elapsedRef,
  mcpCallCount,
  onToggleMCPInspector,
}: HeaderStatsProps) {
  const stats = deriveStats(events, confidence)
  const statusLabel = getAgentStatusLabel(events)

  const handleExportPlan = useCallback(() => {
    const allSlices = slices ?? []
    if (allSlices.length === 0) {
      toast.error("No slices to export")
      return
    }

    const lines: string[] = [
      `# ${projectName} — Implementation Plan`,
      "",
      `**Project ID:** ${projectId}`,
      `**Total Slices:** ${allSlices.length}`,
      `**Exported:** ${new Date().toISOString()}`,
      "",
      "---",
      "",
    ]

    for (const s of allSlices) {
      lines.push(`## ${s.priority ?? ""}. ${s.name}`)
      lines.push("")
      if (s.description) {
        lines.push(s.description)
        lines.push("")
      }
      lines.push(`**Status:** ${s.status} | **Confidence:** ${((s.confidence_score ?? 0) * 100).toFixed(0)}%`)
      lines.push("")

      const bc = s.behavioral_contract as Record<string, unknown> | null
      if (bc) {
        const flows = bc.user_flows as string[] | undefined
        if (flows && flows.length > 0) {
          lines.push("### User Flows")
          for (const f of flows) {
            lines.push(`- ${f}`)
          }
          lines.push("")
        }
        const acceptance = bc.acceptance_criteria as string[] | undefined
        if (acceptance && acceptance.length > 0) {
          lines.push("### Acceptance Criteria")
          for (const a of acceptance) {
            lines.push(`- ${a}`)
          }
          lines.push("")
        }
      }

      const cc = s.code_contract as Record<string, unknown> | null
      if (cc) {
        const files = cc.files as Array<{ path: string; description?: string }> | undefined
        if (files && files.length > 0) {
          lines.push("### Files")
          for (const f of files) {
            lines.push(`- \`${f.path}\`${f.description ? ` — ${f.description}` : ""}`)
          }
          lines.push("")
        }
        const steps = cc.implementation_steps as string[] | undefined
        if (steps && steps.length > 0) {
          lines.push("### Implementation Steps")
          for (let i = 0; i < steps.length; i++) {
            lines.push(`${i + 1}. ${steps[i]}`)
          }
          lines.push("")
        }
        const pseudoCode = cc.pseudo_code as string | undefined
        if (pseudoCode) {
          lines.push("### Pseudo Code")
          lines.push("```")
          lines.push(pseudoCode)
          lines.push("```")
          lines.push("")
        }
      }

      lines.push("---")
      lines.push("")
    }

    const content = lines.join("\n")
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}_plan.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Plan exported!")
  }, [projectId, projectName, slices])

  // Determine pulse dot color from the latest event type
  const lastEvent = events[events.length - 1]
  const pulseColor = lastEvent ? getEventTypeColor(lastEvent.event_type) : "#00E5FF"

  return (
    <div className="glass-panel flex items-center justify-between rounded-lg border border-border px-4 py-2">
      {/* Left: Agent status pulse + status text */}
      <div className="flex items-center gap-3">
        {/* Pulsing status dot */}
        <div className="relative flex items-center">
          <motion.div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: pulseColor }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.div
            className="absolute h-2 w-2 rounded-full"
            style={{ backgroundColor: pulseColor }}
            animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>

        {/* Status text with AnimatePresence */}
        <div className="w-40 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={statusLabel}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="block truncate text-xs text-muted-foreground"
            >
              {statusLabel}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* Center: Live counters */}
      <div className="flex items-center gap-4">
        {/* Lines of Code */}
        <div className="flex items-center gap-1.5">
          <Code className="h-3 w-3 text-foreground/60" />
          <AnimatedCounter value={stats.linesOfCode} className="font-mono text-xs font-semibold text-foreground" />
        </div>

        {/* Tests */}
        <div className="flex items-center gap-1.5">
          <FlaskConical className="h-3 w-3 text-foreground/60" />
          <span className="font-mono text-xs font-semibold">
            <span className={stats.testsFailed > 0 ? "text-error" : "text-success"}>
              <AnimatedCounter value={stats.testsPassed} />
            </span>
            <span className="text-muted-foreground">/</span>
            <AnimatedCounter value={stats.testsTotal} className="text-foreground" />
          </span>
        </div>

        {/* Tools Used */}
        <div className="flex items-center gap-1.5">
          <Wrench className="h-3 w-3 text-foreground/60" />
          <AnimatedCounter value={stats.toolsUsed} className="font-mono text-xs font-semibold text-foreground" />
        </div>

        {/* Self-Heals */}
        {stats.selfHeals > 0 && (
          <div className="flex items-center gap-1.5">
            <RotateCw className="h-3 w-3 text-quantum-violet" />
            <AnimatedCounter value={stats.selfHeals} className="font-mono text-xs font-semibold text-quantum-violet" />
          </div>
        )}
      </div>

      {/* Right: Project/slice + timer + mute */}
      <div className="flex items-center gap-3">
        <span className="font-grotesk text-sm font-semibold">{projectName}</span>
        {activeSlice && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="max-w-32 truncate text-sm text-electric-cyan">{activeSlice.name}</span>
            <SliceStatusBadge status={activeSlice.status} />
          </>
        )}
        <ElapsedTimer elapsedRef={elapsedRef} />

        {/* View Plan */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-electric-cyan hover:text-electric-cyan/80"
          asChild
        >
          <Link href={`/projects/${projectId}/plan`}>
            <LayoutGrid className="h-3 w-3" />
            Plan
          </Link>
        </Button>

        {/* Export Plan */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-electric-cyan"
          onClick={handleExportPlan}
        >
          <Download className="h-3 w-3" />
          Export
        </Button>

        {/* MCP Inspector toggle */}
        {onToggleMCPInspector && (
          <Button
            variant="ghost"
            size="icon"
            className="relative h-7 w-7"
            onClick={onToggleMCPInspector}
          >
            <Wrench className="h-3.5 w-3.5 text-electric-cyan/60" />
            {mcpCallCount != null && mcpCallCount > 0 && (
              <Badge
                variant="outline"
                className="absolute -right-1 -top-1 h-4 min-w-4 border-electric-cyan/30 px-0.5 text-[8px] text-electric-cyan"
              >
                {mcpCallCount}
              </Badge>
            )}
          </Button>
        )}
        <ProjectImmersiveActions projectId={projectId} projectName={projectName} />
      </div>
    </div>
  )
}
