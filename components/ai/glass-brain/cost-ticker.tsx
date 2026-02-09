"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { AgentEvent } from "@/hooks/use-agent-events"
import { estimateCost } from "./derive-build-phase"

interface CostTickerProps {
  events: AgentEvent[]
}

const dollarFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dollarFmtSmall = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

function AnimatedCost({
  value,
  className,
  small,
}: {
  value: number
  className?: string
  small?: boolean
}) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setDisplay(value)
      prevRef.current = value
      return
    }

    const start = prevRef.current
    const diff = value - start
    if (Math.abs(diff) < 0.0001) return

    const duration = 600
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + diff * eased)
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        prevRef.current = value
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  const formatted = small ? dollarFmtSmall.format(display) : dollarFmt.format(display)

  return <span className={className}>{formatted}</span>
}

export function CostTicker({ events }: CostTickerProps) {
  const cost = useMemo(() => estimateCost(events), [events])

  return (
    <div className="glass-panel flex items-center gap-4 rounded-lg border border-border px-4 py-2">
      {/* Traditional cost */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          Traditional
        </span>
        <AnimatedCost
          value={cost.traditional}
          className="font-mono text-xs text-muted-foreground line-through"
        />
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border" />

      {/* Lazarus cost */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-electric-cyan/60">
          Lazarus
        </span>
        <AnimatedCost
          value={cost.lazarus}
          className="font-mono text-xs font-semibold text-electric-cyan"
          small
        />
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border" />

      {/* Savings */}
      <motion.div
        className="flex items-center gap-1.5"
        animate={cost.savingsPercent > 90 ? { scale: [1, 1.03, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-[10px] uppercase tracking-wider text-success/60">
          Savings
        </span>
        <span
          className={cn(
            "font-mono text-xs font-semibold text-success",
            cost.savingsPercent > 90 && "animate-pulse-glow"
          )}
        >
          {cost.savingsPercent.toFixed(1)}%
        </span>
      </motion.div>
    </div>
  )
}
