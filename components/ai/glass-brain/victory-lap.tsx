"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface VictoryLapProps {
  score: number
  stats: {
    linesOfCode: number
    testsPassed: number
    testsTotal: number
    selfHeals: number
    elapsedSeconds: number
  }
  projectId: string
  onDismiss: () => void
}

/* -------------------------------------------------------------------------- */
/*  Animated stat counter                                                      */
/* -------------------------------------------------------------------------- */

function StatCounter({ value, label }: { value: number | string; label: string }) {
  const numValue = typeof value === "number" ? value : 0
  const isNumber = typeof value === "number"
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!isNumber) return
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setDisplay(numValue)
      return
    }

    const duration = 1200
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(numValue * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [numValue, isNumber])

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-2xl font-bold text-foreground">
        {isNumber ? display : value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Particle burst                                                             */
/* -------------------------------------------------------------------------- */

function Particles() {
  const prefersReduced = useRef(false)

  useEffect(() => {
    prefersReduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  const particles = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 600,
      y: (Math.random() - 0.5) * 600,
      delay: Math.random() * 0.5,
      size: 2 + Math.random() * 4,
      color: ["#00FF88", "#00E5FF", "#8134CE", "#FFB800"][Math.floor(Math.random() * 4)] ?? "#00FF88",
    }))
  }, [])

  if (prefersReduced.current) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: [1, 1, 0],
            scale: [0, 1, 0.5],
          }}
          transition={{
            duration: 2,
            delay: p.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Victory Lap                                                                */
/* -------------------------------------------------------------------------- */

export function VictoryLap({ score, stats, projectId, onDismiss }: VictoryLapProps) {
  const [visible, setVisible] = useState(true)

  // Auto-dismiss after 8s
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 500) // Wait for exit animation
    }, 8000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  const scorePercent = Math.round(score * 100)

  // Format elapsed time
  const elapsedFormatted = useMemo(() => {
    const m = Math.floor(stats.elapsedSeconds / 60)
    const s = stats.elapsedSeconds % 60
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }, [stats.elapsedSeconds])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Particles */}
          <Particles />

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close victory overlay"
            className="absolute right-6 top-6 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-sm"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content */}
          <motion.div
            className="relative flex flex-col items-center gap-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.2 }}
          >
            {/* Score */}
            <motion.div
              className="text-7xl font-bold text-success"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.3 }}
              style={{
                textShadow: "0 0 40px rgba(0,255,136,0.4), 0 0 80px rgba(0,255,136,0.2)",
              }}
            >
              {scorePercent}%
            </motion.div>

            {/* Title */}
            <motion.h2
              className="font-grotesk text-lg font-semibold uppercase tracking-[0.3em] text-electric-cyan"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              Transmutation Complete
            </motion.h2>

            {/* Stats grid */}
            <motion.div
              className="grid grid-cols-2 gap-6 rounded-xl border border-border bg-slate-grey/30 px-8 py-6 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <StatCounter value={stats.linesOfCode} label="Lines of Code" />
              <StatCounter
                value={stats.testsTotal > 0 ? `${stats.testsPassed}/${stats.testsTotal}` : "0"}
                label="Tests Passed"
              />
              <StatCounter value={stats.selfHeals} label="Self-Heals" />
              <StatCounter value={elapsedFormatted} label="Time Elapsed" />
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <Link href={`/projects/${projectId}/plan`}>
                <Button
                  size="sm"
                  className="glow-success-strong bg-success/20 text-success hover:bg-success/30"
                  onClick={handleClose}
                >
                  View Plan
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
