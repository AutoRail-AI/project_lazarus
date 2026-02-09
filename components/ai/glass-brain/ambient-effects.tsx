"use client"

import { motion } from "framer-motion"

/* -------------------------------------------------------------------------- */
/*  Pane Connection Lines — shimmer lines at pane boundaries                   */
/* -------------------------------------------------------------------------- */

export function PaneConnectionLines() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Left pane → Center pane divider */}
      <div
        className="absolute top-12 bottom-12"
        style={{ left: "calc(25% + 2px)" }}
      >
        <div className="h-full w-px animate-shimmer bg-[length:200%_100%] bg-gradient-to-b from-transparent via-electric-cyan/20 to-transparent opacity-20" />
      </div>

      {/* Center pane → Right pane divider */}
      <div
        className="absolute top-12 bottom-12"
        style={{ left: "calc(75% - 2px)" }}
      >
        <div className="h-full w-px animate-shimmer bg-[length:200%_100%] bg-gradient-to-b from-transparent via-electric-cyan/20 to-transparent opacity-20" />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Breathing Glow — dynamic box-shadow wrapper that scales with confidence    */
/* -------------------------------------------------------------------------- */

interface BreathingGlowProps {
  confidence: number
  children: React.ReactNode
  className?: string
}

export function BreathingGlow({ confidence, children, className }: BreathingGlowProps) {
  const intensity = 20 + confidence * 40
  const alpha = 0.05 + confidence * 0.1

  return (
    <motion.div
      className={className}
      animate={{
        boxShadow: [
          `inset 0 0 ${intensity * 0.5}px rgba(0,229,255,${alpha * 0.5})`,
          `inset 0 0 ${intensity}px rgba(0,229,255,${alpha})`,
          `inset 0 0 ${intensity * 0.5}px rgba(0,229,255,${alpha * 0.5})`,
        ],
      }}
      transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
    >
      {children}
    </motion.div>
  )
}
