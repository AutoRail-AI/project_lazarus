"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  CheckCircle,
  Code,
  FlaskConical,
  Microscope,
  RotateCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BuildPhase } from "./derive-build-phase"

const PHASES: { key: BuildPhase; label: string; icon: React.ElementType }[] = [
  { key: "analysis", label: "Analysis", icon: Microscope },
  { key: "generation", label: "Generation", icon: Code },
  { key: "testing", label: "Testing", icon: FlaskConical },
  { key: "healing", label: "Healing", icon: RotateCw },
  { key: "complete", label: "Complete", icon: CheckCircle },
]

interface BuildPhaseIndicatorProps {
  currentPhase: BuildPhase
}

export function BuildPhaseIndicator({ currentPhase }: BuildPhaseIndicatorProps) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase)

  return (
    <div className="flex items-center gap-1.5">
      <AnimatePresence mode="popLayout">
        {PHASES.map((phase, i) => {
          const Icon = phase.icon
          const isActive = phase.key === currentPhase
          const isComplete = i < currentIdx
          const isUpcoming = i > currentIdx

          return (
            <motion.div
              key={phase.key}
              layoutId={`phase-${phase.key}`}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                isActive && phase.key === "healing"
                  ? "border-rail-purple/30 bg-rail-purple/20 text-quantum-violet"
                  : isActive
                    ? "border-electric-cyan/30 bg-electric-cyan/20 text-electric-cyan"
                    : isComplete
                      ? "border-success/20 bg-success/15 text-success"
                      : "border-border text-muted-foreground/40"
              )}
              animate={isActive ? { scale: [1, 1.05, 1] } : {}}
              transition={isActive ? { duration: 2, repeat: Infinity } : undefined}
            >
              <Icon className={cn("h-3 w-3", isUpcoming && "opacity-40")} />
              <span className={cn(isUpcoming && "opacity-40")}>
                {phase.label}
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
