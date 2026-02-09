"use client"

import { useCallback, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Camera, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AgentEvent } from "@/hooks/use-agent-events"
import { timeAgo } from "./derive-stats"

interface ScreenshotGalleryProps {
  screenshots: AgentEvent[]
}

const MAX_DISPLAY = 12

export function ScreenshotGallery({ screenshots }: ScreenshotGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  // Show latest screenshots first, limit to MAX_DISPLAY
  const displayScreenshots = useMemo(
    () => [...screenshots].reverse().slice(0, MAX_DISPLAY),
    [screenshots]
  )

  const handleOpen = useCallback((index: number) => {
    setSelectedIndex(index)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedIndex(null)
  }, [])

  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev === null || prev <= 0) return prev
      return prev - 1
    })
  }, [])

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev === null || prev >= displayScreenshots.length - 1) return prev
      return prev + 1
    })
  }, [displayScreenshots.length])

  // Empty state
  if (screenshots.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Camera className="h-10 w-10 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium text-muted-foreground/60">
            No screenshots yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/40">
            Screenshots will appear here when the agent captures visual verification
          </p>
        </div>
      </div>
    )
  }

  const selectedScreenshot = selectedIndex !== null ? displayScreenshots[selectedIndex] : null
  const selectedMeta = selectedScreenshot?.metadata as Record<string, unknown> | null

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {displayScreenshots.map((screenshot, i) => {
          const meta = screenshot.metadata as Record<string, unknown> | null
          const imageUrl = (meta?.thumbnail_url as string) ?? (meta?.url as string) ?? null
          const step = (meta?.step as string) ?? null

          return (
            <motion.button
              key={screenshot.id}
              type="button"
              onClick={() => handleOpen(i)}
              className="group relative aspect-video overflow-hidden rounded-md border border-border bg-background/40 transition-colors hover:border-electric-cyan/40"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={screenshot.content || "Screenshot"}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Camera className="h-5 w-5 text-muted-foreground/30" />
                </div>
              )}

              {/* Caption overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void-black/80 to-transparent p-1.5">
                <p className="truncate text-[9px] text-foreground/80">
                  {step ?? screenshot.content?.slice(0, 40) ?? "Screenshot"}
                </p>
                <p className="text-[8px] text-muted-foreground/60">
                  {timeAgo(screenshot.created_at)}
                </p>
              </div>
            </motion.button>
          )
        })}
      </div>

      {screenshots.length > MAX_DISPLAY && (
        <p className="mt-2 text-center text-xs text-muted-foreground/50">
          Showing latest {MAX_DISPLAY} of {screenshots.length} screenshots
        </p>
      )}

      {/* Lightbox Dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl bg-background/95 border-border p-2">
          <DialogTitle className="sr-only">Screenshot viewer</DialogTitle>
          {selectedScreenshot && (
            <div className="relative">
              {/* Image */}
              <div className="relative aspect-video overflow-hidden rounded">
                {(selectedMeta?.url as string) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedMeta?.url as string}
                    alt={selectedScreenshot.content || "Screenshot"}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-background">
                    <Camera className="h-12 w-12 text-muted-foreground/20" />
                  </div>
                )}
              </div>

              {/* Caption */}
              <div className="mt-2 px-2">
                <p className="text-sm text-foreground">
                  {(selectedMeta?.step as string) ?? selectedScreenshot.content ?? "Screenshot"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {timeAgo(selectedScreenshot.created_at)}
                </p>
              </div>

              {/* Navigation */}
              <div className="absolute inset-y-0 left-0 flex items-center">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={selectedIndex === 0}
                  aria-label="Previous screenshot"
                  className="ml-1 rounded-full bg-background/60 p-1.5 text-foreground/80 transition-colors hover:bg-background/80 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={selectedIndex === displayScreenshots.length - 1}
                  aria-label="Next screenshot"
                  className="mr-1 rounded-full bg-background/60 p-1.5 text-foreground/80 transition-colors hover:bg-background/80 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
