"use client"

import { GitBranch, RefreshCw } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { Slice } from "./plan-types"
import { SliceStatusBadge } from "./slice-status-badge"
import { ConfidenceRing } from "./confidence-ring"

interface SliceCardProps {
  slice: Slice
  onClick?: (slice: Slice) => void
  selected?: boolean
  search?: string
  className?: string
}

function HighlightText({ text, search }: { text: string; search?: string }) {
  if (!search?.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(search.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-electric-cyan/20 text-electric-cyan">
        {text.slice(idx, idx + search.length)}
      </mark>
      {text.slice(idx + search.length)}
    </>
  )
}

export function SliceCard({
  slice,
  onClick,
  selected = false,
  search,
  className,
}: SliceCardProps) {
  const depCount = slice.dependencies?.length ?? 0
  const hasBc = slice.behavioral_contract != null
  const hasCc = slice.code_contract != null

  return (
    <motion.button
      type="button"
      onClick={() => onClick?.(slice)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "glass-card w-full rounded-lg p-4 text-left transition-all",
        "hover:glow-purple hover:border-rail-purple/30 hover:bg-card/70",
        selected && "border-electric-cyan glow-cyan",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-grotesk text-sm font-semibold text-foreground">
              <HighlightText text={slice.name} search={search} />
            </span>
            <SliceStatusBadge status={slice.status} />
          </div>

          {slice.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {slice.description}
            </p>
          )}
        </div>

        <span className="shrink-0 rounded bg-slate-grey/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          #{slice.priority}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        {slice.confidence_score > 0 && (
          <ConfidenceRing
            value={slice.confidence_score}
            size={24}
            showLabel={false}
            animated={false}
          />
        )}

        {depCount > 0 && (
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {depCount}
          </span>
        )}

        {hasBc && (
          <span className="rounded bg-quantum-violet/15 px-1.5 py-0.5 text-quantum-violet">
            BC
          </span>
        )}
        {hasCc && (
          <span className="rounded bg-electric-cyan/15 px-1.5 py-0.5 text-electric-cyan">
            CC
          </span>
        )}

        {slice.retry_count > 0 && (
          <span className="flex items-center gap-1 text-warning">
            <RefreshCw className="h-3 w-3" />
            {slice.retry_count}
          </span>
        )}
      </div>
    </motion.button>
  )
}
