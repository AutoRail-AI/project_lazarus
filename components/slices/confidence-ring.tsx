"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface ConfidenceRingProps {
  value: number
  size?: 24 | 32 | 48 | 64 | 80
  strokeWidth?: number
  showLabel?: boolean
  animated?: boolean
  className?: string
}

function getColorTier(value: number): { color: string; glow: string } {
  if (value < 40) return { color: "#FF3366", glow: "rgba(255,51,102,0.4)" }
  if (value < 70) return { color: "#FFB800", glow: "rgba(255,184,0,0.4)" }
  if (value < 85) return { color: "#00E5FF", glow: "rgba(0,229,255,0.4)" }
  return { color: "#00FF88", glow: "rgba(0,255,136,0.4)" }
}

export function ConfidenceRing({
  value,
  size = 48,
  strokeWidth: strokeWidthProp,
  showLabel = true,
  animated = true,
  className,
}: ConfidenceRingProps) {
  const circleRef = useRef<SVGCircleElement>(null)
  const strokeWidth = strokeWidthProp ?? (size <= 32 ? 3 : size <= 48 ? 4 : 5)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference
  const { color, glow } = getColorTier(clamped)

  const filterId = `glow-${size}-${Math.round(value)}`
  const fontSize = size <= 32 ? 8 : size <= 48 ? 10 : 14

  useEffect(() => {
    if (!animated || !circleRef.current) return

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      circleRef.current.style.strokeDashoffset = String(offset)
      return
    }

    const el = circleRef.current
    el.style.strokeDashoffset = String(circumference)

    const raf = requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 0.8s ease-out"
      el.style.strokeDashoffset = String(offset)
    })

    return () => cancelAnimationFrame(raf)
  }, [animated, offset, circumference])

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(250,250,250,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Glow layer */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 2}
          strokeDasharray={circumference}
          strokeDashoffset={animated ? circumference : offset}
          strokeLinecap="round"
          filter={`url(#${filterId})`}
          opacity={0.4}
          ref={animated ? undefined : undefined}
          style={
            !animated
              ? { strokeDashoffset: offset }
              : undefined
          }
        />
        {/* Foreground arc */}
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={animated ? circumference : offset}
          strokeLinecap="round"
          style={
            !animated
              ? { strokeDashoffset: offset }
              : undefined
          }
        />
      </svg>
      {showLabel && size >= 32 && (
        <span
          className="absolute font-mono font-semibold"
          style={{ fontSize, color }}
        >
          {Math.round(clamped)}
        </span>
      )}
    </div>
  )
}
