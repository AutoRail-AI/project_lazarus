"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ConfidenceSparkline } from "./confidence-sparkline"
import { getConfidenceBreakdown } from "./derive-stats"
import type { ConfidencePoint } from "./derive-stats"

interface ConfidenceGaugeProps {
  /** Confidence score 0-1 */
  score: number
  /** Confidence trajectory over time */
  history?: ConfidencePoint[]
  className?: string
}

const SHIP_READY_THRESHOLD = 0.85
const MILESTONES = [0.25, 0.5, 0.75]

function getGaugeColor(score: number): string {
  if (score < 0.4) return "#FF3366"
  if (score < 0.7) return "#FFB800"
  if (score < 0.85) return "#00E5FF"
  return "#00FF88"
}

function getGlowClass(score: number): string {
  if (score < 0.4) return ""
  if (score < 0.7) return "shadow-[0_0_20px_rgba(255,184,0,0.15)]"
  if (score < 0.85) return "shadow-[0_0_20px_rgba(0,229,255,0.2)]"
  return "shadow-[0_0_30px_rgba(0,255,136,0.25)] animate-pulse-glow"
}

export function ConfidenceGauge({ score, history, className }: ConfidenceGaugeProps) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100)
  const color = getGaugeColor(score)
  const glowClass = getGlowClass(score)
  const [displayPct, setDisplayPct] = useState(0)
  const prevPctRef = useRef(0)

  const breakdown = getConfidenceBreakdown(score)

  // Animate displayed percentage
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setDisplayPct(pct)
      prevPctRef.current = pct
      return
    }

    const start = prevPctRef.current
    const diff = pct - start
    if (diff === 0) return

    const duration = 800
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayPct(Math.round(start + diff * eased))
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        prevPctRef.current = pct
      }
    }

    requestAnimationFrame(animate)
  }, [pct])

  return (
    <div
      className={cn(
        "glass-panel relative overflow-hidden rounded-lg border border-border",
        glowClass,
        className
      )}
    >
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Label */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Confidence
          </span>
        </div>

        {/* Sparkline */}
        {history && history.length >= 2 && (
          <ConfidenceSparkline history={history} width={120} height={20} />
        )}

        {/* Bar container */}
        <div className="relative flex-1">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-grey/50">
            {/* Gradient fill */}
            <motion.div
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, #FF3366, #FFB800, #00E5FF, #00FF88)",
              }}
              initial={{ width: "0%" }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          {/* Milestone tick marks */}
          {MILESTONES.map((m) => (
            <div
              key={m}
              className="absolute top-0 h-full"
              style={{ left: `${m * 100}%` }}
            >
              <div className="h-3 w-px bg-cloud-white/20" />
            </div>
          ))}

          {/* Ship Ready threshold marker */}
          <div
            className="absolute top-0 h-full"
            style={{ left: `${SHIP_READY_THRESHOLD * 100}%` }}
          >
            <div className="h-3 w-0.5 bg-cloud-white/40" />
            <span className="absolute -translate-x-1/2 pt-0.5 text-[9px] text-muted-foreground/60">
              Ship&nbsp;Ready
            </span>
          </div>
        </div>

        {/* Score with tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={displayPct}
                    initial={{ scale: 1.2, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="min-w-[3.5rem] cursor-help text-right font-grotesk text-2xl font-bold"
                    style={{ color }}
                  >
                    {displayPct}%
                  </motion.span>
                </AnimatePresence>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="w-48">
              <div className="space-y-1.5 text-xs">
                <p className="font-semibold">Confidence Breakdown</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Code Quality</span>
                  <span>{breakdown.codeQuality}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Test Coverage</span>
                  <span>{breakdown.testCoverage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Self-Heal Success</span>
                  <span>{breakdown.selfHealSuccess}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span>{breakdown.overallProgress}%</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
