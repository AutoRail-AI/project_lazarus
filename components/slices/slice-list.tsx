"use client"

import { Layers } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import type { Slice } from "./plan-types"
import { SliceCard } from "./slice-card"

interface SliceListProps {
  slices: Slice[]
  onSelect?: (slice: Slice) => void
  selectedId?: string | null
  search?: string
}

export function SliceList({
  slices,
  onSelect,
  selectedId,
  search,
}: SliceListProps) {
  if (slices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center">
        <Layers className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No slices generated yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Process the project to generate vertical slices
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      <AnimatePresence mode="popLayout">
        {slices.map((slice, i) => (
          <motion.div
            key={slice.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
          >
            <SliceCard
              slice={slice}
              onClick={onSelect}
              selected={slice.id === selectedId}
              search={search}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
