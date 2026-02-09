"use client"

import type { ConfidencePoint } from "./derive-stats"

interface ConfidenceSparklineProps {
  history: ConfidencePoint[]
  width?: number
  height?: number
  className?: string
}

export function ConfidenceSparkline({
  history,
  width = 200,
  height = 24,
  className,
}: ConfidenceSparklineProps) {
  if (history.length < 2) return null

  const padding = 2
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  // Normalize timestamps to [0, innerWidth]
  const firstTs = history[0]?.timestamp ?? 0
  const lastTs = history[history.length - 1]?.timestamp ?? 1
  const timeRange = Math.max(lastTs - firstTs, 1)

  const points = history.map((p) => {
    const x = padding + ((p.timestamp - firstTs) / timeRange) * innerWidth
    const y = padding + innerHeight - p.value * innerHeight
    return { x, y }
  })

  // Build polyline string
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ")

  // Build fill polygon (close at bottom)
  const lastPoint = points[points.length - 1]
  const firstPoint = points[0]
  const fillPoints = [
    ...points.map((p) => `${p.x},${p.y}`),
    `${lastPoint?.x ?? 0},${height}`,
    `${firstPoint?.x ?? 0},${height}`,
  ].join(" ")

  const currentDot = lastPoint

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
        </linearGradient>
        <filter id="sparkline-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>
      </defs>

      {/* Fill area */}
      <polygon points={fillPoints} fill="url(#sparkline-fill)" />

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#00E5FF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current value dot with glow */}
      {currentDot && (
        <>
          <circle
            cx={currentDot.x}
            cy={currentDot.y}
            r={4}
            fill="#00E5FF"
            opacity={0.3}
            filter="url(#sparkline-glow)"
          />
          <circle
            cx={currentDot.x}
            cy={currentDot.y}
            r={3}
            fill="#00E5FF"
          />
        </>
      )}
    </svg>
  )
}
