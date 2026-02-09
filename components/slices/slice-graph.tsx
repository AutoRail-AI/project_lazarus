"use client"

import { useCallback, useMemo } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type EdgeProps,
  MiniMap,
  type Node,
  type NodeProps,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { motion } from "framer-motion"
import {
  CheckCircle2,
  Clock,
  FlaskConical,
  GitBranch,
  Heart,
  Loader2,
  Target,
  XCircle,
} from "lucide-react"
import type { SliceStatus } from "@/lib/db/types"
import type { Slice } from "./plan-types"
import { computeGraphLayout, getDependencyChain } from "./plan-utils"

/* -------------------------------------------------------------------------- */
/*  Style maps                                                                 */
/* -------------------------------------------------------------------------- */

const STATUS_STYLES: Record<
  SliceStatus,
  { border: string; shadow: string; accent: string }
> = {
  pending: { border: "rgba(250,250,250,0.1)", shadow: "none", accent: "#666" },
  selected: {
    border: "#6E18B3",
    shadow: "0 0 12px rgba(110,24,179,0.4)",
    accent: "#8134CE",
  },
  building: {
    border: "#00E5FF",
    shadow: "0 0 16px rgba(0,229,255,0.5)",
    accent: "#00E5FF",
  },
  testing: {
    border: "#FFB800",
    shadow: "0 0 12px rgba(255,184,0,0.4)",
    accent: "#FFB800",
  },
  self_healing: {
    border: "#6E18B3",
    shadow: "0 0 12px rgba(110,24,179,0.4)",
    accent: "#8134CE",
  },
  complete: {
    border: "#00FF88",
    shadow: "0 0 12px rgba(0,255,136,0.4)",
    accent: "#00FF88",
  },
  failed: {
    border: "#FF3366",
    shadow: "0 0 12px rgba(255,51,102,0.4)",
    accent: "#FF3366",
  },
}

const STATUS_ICONS: Record<SliceStatus, React.ElementType> = {
  pending: Clock,
  selected: Target,
  building: Loader2,
  testing: FlaskConical,
  self_healing: Heart,
  complete: CheckCircle2,
  failed: XCircle,
}

function getConfidenceColor(value: number): string {
  if (value < 40) return "#FF3366"
  if (value < 70) return "#FFB800"
  if (value < 85) return "#00E5FF"
  return "#00FF88"
}

/* -------------------------------------------------------------------------- */
/*  Custom node                                                                */
/* -------------------------------------------------------------------------- */

function SliceNode({ data }: NodeProps) {
  const status = (data.status as SliceStatus) ?? "pending"
  const confidence = (data.confidence as number) ?? 0
  const depCount = (data.depCount as number) ?? 0
  const isSelected = data.isSelected === true
  const isDimmed = data.isDimmed === true
  const styles = STATUS_STYLES[status]
  const Icon = STATUS_ICONS[status]

  const borderColor = isSelected ? "#00E5FF" : styles.border
  const shadow = isSelected ? "0 0 20px rgba(0,229,255,0.5)" : styles.shadow
  const confidenceColor = getConfidenceColor(confidence)

  // Mini confidence ring
  const ringSize = 24
  const ringStroke = 2.5
  const ringRadius = (ringSize - ringStroke) / 2
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference - (confidence / 100) * ringCircumference

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: isDimmed ? 0.2 : 1 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "rgba(30, 30, 40, 0.8)",
        backdropFilter: "blur(8px)",
        color: "#FAFAFA",
        border: `2px solid ${borderColor}`,
        borderLeft: `4px solid ${styles.accent}`,
        borderRadius: 12,
        padding: "10px 14px",
        minWidth: 180,
        maxWidth: 240,
        fontFamily: "var(--font-grotesk), 'Space Grotesk', sans-serif",
        fontSize: 12,
        boxShadow: shadow,
        cursor: "pointer",
        transition: "opacity 0.3s, box-shadow 0.3s",
      }}
    >
      {/* Top row: name + status icon */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon
          style={{
            width: 14,
            height: 14,
            color: styles.accent,
            flexShrink: 0,
            ...(status === "building" ? { animation: "spin 1s linear infinite" } : {}),
          }}
        />
        <div
          style={{
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {data.label as string}
        </div>
      </div>

      {/* Bottom row: confidence ring + dep count */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        {confidence > 0 && (
          <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringRadius}
              fill="none"
              stroke="rgba(250,250,250,0.08)"
              strokeWidth={ringStroke}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringRadius}
              fill="none"
              stroke={confidenceColor}
              strokeWidth={ringStroke}
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
            />
          </svg>
        )}
        <span style={{ fontSize: 10, color: confidenceColor, fontFamily: "var(--font-mono)" }}>
          {Math.round(confidence)}%
        </span>
        {depCount > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 10, opacity: 0.6, marginLeft: "auto" }}>
            <GitBranch style={{ width: 10, height: 10 }} />
            {depCount}
          </span>
        )}
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Custom synapse edge                                                        */
/* -------------------------------------------------------------------------- */

function SynapseEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isAnimated = data?.animated === true
  const isDimmed = data?.isDimmed === true
  const edgeOpacity = isDimmed ? 0.08 : 0.2

  return (
    <g>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke="rgba(250,250,250,0.15)"
        strokeWidth={1.5}
        style={{ ...style, opacity: edgeOpacity, transition: "opacity 0.3s" }}
      />
      {isAnimated && !isDimmed && (
        <motion.circle
          r={3}
          fill="#00E5FF"
          filter="drop-shadow(0 0 4px rgba(0,229,255,0.8))"
          initial={{ offsetDistance: "0%" }}
          animate={{ offsetDistance: "100%" }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            offsetPath: `path('${edgePath}')`,
          }}
        />
      )}
    </g>
  )
}

/* -------------------------------------------------------------------------- */
/*  Inner graph (needs ReactFlowProvider above it)                             */
/* -------------------------------------------------------------------------- */

const nodeTypes = { slice: SliceNode }
const edgeTypes = { synapse: SynapseEdge }

interface SliceGraphInnerProps {
  slices: Slice[]
  onNodeClick?: (slice: Slice) => void
  selectedSliceId?: string | null
  focusedSliceId?: string | null
  onNodeHover?: (sliceId: string | null) => void
}

function SliceGraphInner({
  slices,
  onNodeClick,
  selectedSliceId,
  focusedSliceId,
  onNodeHover,
}: SliceGraphInnerProps) {
  const sliceMap = useMemo(() => {
    const map = new Map<string, Slice>()
    for (const s of slices) map.set(s.id, s)
    return map
  }, [slices])

  const positions = useMemo(() => computeGraphLayout(slices), [slices])

  // Dependency chain for focus highlighting
  const focusChain = useMemo(() => {
    if (!focusedSliceId) return null
    return getDependencyChain(focusedSliceId, slices)
  }, [focusedSliceId, slices])

  const nodes: Node[] = useMemo(
    () =>
      slices.map((slice) => {
        const pos = positions.get(slice.id) ?? { x: 0, y: 0 }
        const isDimmed = focusChain !== null && !focusChain.has(slice.id)
        return {
          id: slice.id,
          type: "slice",
          position: pos,
          data: {
            label: slice.name,
            status: slice.status,
            confidence: slice.confidence_score,
            depCount: slice.dependencies?.length ?? 0,
            isSelected: slice.id === selectedSliceId,
            isDimmed,
          },
        }
      }),
    [slices, positions, selectedSliceId, focusChain]
  )

  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = []
    for (const slice of slices) {
      const deps = slice.dependencies ?? []
      for (const depId of deps) {
        const sourceSlice = sliceMap.get(depId)
        const isDimmed =
          focusChain !== null &&
          (!focusChain.has(depId) || !focusChain.has(slice.id))
        result.push({
          id: `${depId}->${slice.id}`,
          source: depId,
          target: slice.id,
          type: "synapse",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: "rgba(250,250,250,0.2)",
          },
          data: {
            animated: sourceSlice?.status === "building",
            isDimmed,
          },
        })
      }
    }
    return result
  }, [slices, sliceMap, focusChain])

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const slice = sliceMap.get(node.id)
      if (slice && onNodeClick) {
        onNodeClick(slice)
      }
    },
    [sliceMap, onNodeClick]
  )

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeHover?.(node.id)
    },
    [onNodeHover]
  )

  const handleNodeMouseLeave = useCallback(() => {
    onNodeHover?.(null)
  }, [onNodeHover])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={handleNodeClick}
      onNodeMouseEnter={handleNodeMouseEnter}
      onNodeMouseLeave={handleNodeMouseLeave}
      fitView
      minZoom={0.3}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      style={{ fontSize: 12 }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        color="rgba(250,250,250,0.03)"
        gap={24}
      />
      <Controls />
      <MiniMap
        nodeColor={(node) => {
          const status = (node.data?.status as SliceStatus) ?? "pending"
          return STATUS_STYLES[status].accent
        }}
        maskColor="rgba(10, 10, 15, 0.8)"
        style={{
          backgroundColor: "rgba(30, 30, 40, 0.6)",
          borderRadius: 8,
        }}
      />
    </ReactFlow>
  )
}

/* -------------------------------------------------------------------------- */
/*  Public component                                                           */
/* -------------------------------------------------------------------------- */

interface SliceGraphProps {
  slices: Slice[]
  onNodeClick?: (slice: Slice) => void
  selectedSliceId?: string | null
  focusedSliceId?: string | null
  onNodeHover?: (sliceId: string | null) => void
}

export function SliceGraph({
  slices,
  onNodeClick,
  selectedSliceId,
  focusedSliceId,
  onNodeHover,
}: SliceGraphProps) {
  return (
    <div
      className="h-full w-full"
      style={{ background: "#0A0A0F" }}
    >
      <ReactFlowProvider>
        <SliceGraphInner
          slices={slices}
          onNodeClick={onNodeClick}
          selectedSliceId={selectedSliceId}
          focusedSliceId={focusedSliceId}
          onNodeHover={onNodeHover}
        />
      </ReactFlowProvider>
    </div>
  )
}
