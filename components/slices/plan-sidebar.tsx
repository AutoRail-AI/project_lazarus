"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Slice } from "./plan-types"
import { SliceCard } from "./slice-card"

interface PlanSidebarProps {
  slices: Slice[]
  selectedSliceId: string | null
  search: string
  onSelect: (slice: Slice) => void
  open: boolean
}

export function PlanSidebar({
  slices,
  selectedSliceId,
  search,
  onSelect,
  open,
}: PlanSidebarProps) {
  if (!open) return null

  return (
    <div className="flex w-[280px] shrink-0 flex-col border-r border-border bg-obsidian/60 backdrop-blur-sm">
      <ScrollArea className="flex-1 p-3">
        <AnimatePresence mode="popLayout">
          {slices.map((slice, i) => (
            <motion.div
              key={slice.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className="mb-2"
            >
              <SliceCard
                slice={slice}
                onClick={onSelect}
                selected={slice.id === selectedSliceId}
                search={search}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {slices.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No matching slices
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
