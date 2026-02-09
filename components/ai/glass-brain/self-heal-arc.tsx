"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Brain, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SelfHealCycle } from "./derive-build-phase"

interface SelfHealArcProps {
  cycle: SelfHealCycle
  onDismiss?: () => void
}

function PulsingDots() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1 w-1 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  )
}

function FlowingParticle({
  delay,
  fromColor,
  toColor,
}: {
  delay: number
  fromColor: string
  toColor: string
}) {
  return (
    <motion.div
      className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
      style={{ background: fromColor }}
      animate={{
        left: ["0%", "100%"],
        opacity: [0, 1, 1, 0],
        background: [fromColor, toColor],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        delay,
        ease: "linear",
      }}
    />
  )
}

export function SelfHealArc({ cycle, onDismiss }: SelfHealArcProps) {
  const [autoDismiss, setAutoDismiss] = useState(false)

  // Auto-dismiss 3s after resolution arrives
  useEffect(() => {
    if (cycle.resolutionEvent && !cycle.isActive) {
      const timer = setTimeout(() => {
        setAutoDismiss(true)
        onDismiss?.()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [cycle.resolutionEvent, cycle.isActive, onDismiss])

  if (autoDismiss) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
      onClick={onDismiss}
    >
      <div className="grid grid-cols-3 gap-4">
        {/* --- Failure Card --- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.5, delay: 0 }}
          className={cn(
            "rounded-lg border p-3",
            "border-error/30 glow-red"
          )}
          style={{ background: "rgba(255,51,102,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-error" />
            <span className="text-xs font-semibold text-error">
              Failure Detected
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/70">
            {cycle.failureEvent.content.length > 150
              ? cycle.failureEvent.content.slice(0, 147) + "..."
              : cycle.failureEvent.content}
          </p>
        </motion.div>

        {/* --- Diagnosis Card --- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.5, delay: 0.8 }}
          className={cn(
            "rounded-lg border p-3",
            "border-rail-purple/30"
          )}
          style={{ background: "rgba(110,24,179,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-quantum-violet" />
            <span className="text-xs font-semibold text-quantum-violet">
              Root Cause Analysis
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/70">
            {cycle.diagnosisEvent ? (
              cycle.diagnosisEvent.content.length > 150
                ? cycle.diagnosisEvent.content.slice(0, 147) + "..."
                : cycle.diagnosisEvent.content
            ) : (
              <span className="flex items-center gap-1 text-quantum-violet/60">
                Analyzing <PulsingDots />
              </span>
            )}
          </p>
        </motion.div>

        {/* --- Resolution Card --- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.5, delay: 1.6 }}
          className={cn(
            "rounded-lg border p-3",
            cycle.resolutionEvent
              ? "border-success/30 glow-success"
              : "border-border"
          )}
          style={{
            background: cycle.resolutionEvent
              ? "rgba(0,255,136,0.08)"
              : "rgba(30,30,40,0.4)",
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle
              className={cn(
                "h-4 w-4",
                cycle.resolutionEvent ? "text-success" : "text-muted-foreground/40"
              )}
            />
            <span
              className={cn(
                "text-xs font-semibold",
                cycle.resolutionEvent ? "text-success" : "text-muted-foreground/40"
              )}
            >
              Fix Applied
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/70">
            {cycle.resolutionEvent ? (
              cycle.resolutionEvent.content.length > 150
                ? cycle.resolutionEvent.content.slice(0, 147) + "..."
                : cycle.resolutionEvent.content
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground/40">
                Waiting for fix <PulsingDots />
              </span>
            )}
          </p>
        </motion.div>
      </div>

      {/* Flowing particles between cards */}
      <div className="relative mx-auto mt-2 h-2 w-2/3">
        <div className="absolute inset-0 flex items-center">
          <div className="relative h-px w-full">
            <FlowingParticle delay={0} fromColor="#FF3366" toColor="#6E18B3" />
            <FlowingParticle delay={0.5} fromColor="#6E18B3" toColor="#00FF88" />
            <FlowingParticle delay={1} fromColor="#FF3366" toColor="#00FF88" />
          </div>
        </div>
      </div>

      {/* Retry indicator */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <span className="text-[10px] text-muted-foreground">
          Self-Heal Attempt {cycle.retryAttempt}/{cycle.maxRetries}
        </span>
        <div className="flex gap-0.5">
          {Array.from({ length: cycle.maxRetries }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 w-1 rounded-full",
                i < cycle.retryAttempt ? "bg-rail-purple" : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
