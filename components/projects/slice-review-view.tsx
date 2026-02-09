"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Download, FileText, LayoutGrid, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BreathingGlow } from "@/components/ai/glass-brain/ambient-effects"
import { SliceCard } from "@/components/slices/slice-card"
import { PlanReportView } from "./plan-report-view"
import { ProjectImmersiveActions } from "./project-immersive-actions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import type { Database } from "@/lib/db/types"

type Project = Database["public"]["Tables"]["projects"]["Row"]
type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

interface SliceReviewViewProps {
  projectId: string
  project: Project
  slices: Slice[]
  onBuildAll: () => void
}

export function SliceReviewView({
  projectId,
  project,
  slices,
  onBuildAll,
}: SliceReviewViewProps) {
  const [isBuildingAll, setIsBuildingAll] = useState(false)
  const [viewMode, setViewMode] = useState<"report" | "grid">("report")

  const handleBuildAll = async () => {
    if (isBuildingAll) return
    setIsBuildingAll(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/build`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || "Failed to start build pipeline")
      }
      toast.success("Build pipeline started for all slices")
      onBuildAll()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
    } finally {
      setIsBuildingAll(false)
    }
  }

  return (
    <BreathingGlow confidence={0.5} className="relative flex h-full flex-col gap-4 p-4">
      {/* Header */}
      <motion.div
        className="glass-panel flex items-center justify-between rounded-lg border border-border px-4 py-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <span className="font-grotesk text-sm font-semibold text-foreground">
            Analysis Complete
          </span>
          <div className="ml-3 flex items-center rounded-lg border border-border bg-card/30 p-0.5">
            <button
              onClick={() => setViewMode("report")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "report"
                  ? "bg-electric-cyan/15 text-electric-cyan"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="mr-1 inline h-3 w-3" />
              Report
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "grid"
                  ? "bg-electric-cyan/15 text-electric-cyan"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="mr-1 inline h-3 w-3" />
              Grid
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {slices.length} slice{slices.length !== 1 ? "s" : ""} generated
          </span>
          <Button size="sm" variant="ghost" asChild className="text-electric-cyan hover:text-electric-cyan/80">
            <Link href={`/projects/${projectId}/plan`} className="gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />
              Command Center
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              window.open(`/api/projects/${projectId}/export`, "_blank")
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Export .md
          </Button>
          <ProjectImmersiveActions projectId={projectId} projectName={project.name} />
        </div>
      </motion.div>

      {/* Hero section */}
      <motion.div
        className="flex flex-col items-center gap-4 py-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <p className="text-center text-sm text-muted-foreground max-w-lg">
          {slices.length} vertical slice{slices.length !== 1 ? "s" : ""} generated.
          Ready to build your modernized application.
        </p>
        <Button
          size="lg"
          onClick={handleBuildAll}
          disabled={isBuildingAll || slices.length === 0}
          className={cn(
            "bg-rail-fade text-white hover:opacity-90 shadow-glow-purple",
            "font-grotesk font-semibold tracking-wide"
          )}
        >
          <Zap className={cn("mr-2 h-4 w-4", isBuildingAll && "animate-pulse")} />
          {isBuildingAll ? "Starting Build..." : "Approve & Build All Slices"}
        </Button>
      </motion.div>

      {/* Content — Report or Grid */}
      {viewMode === "report" ? (
        <div className="flex-1 overflow-hidden">
          <PlanReportView
            projectName={project.name}
            targetFramework={project.target_framework}
            slices={slices}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 pb-4">
            {slices.map((slice, index) => (
              <motion.div
                key={slice.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + index * 0.08, duration: 0.3, ease: "easeOut" as const }}
              >
                <SliceCard slice={slice} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </BreathingGlow>
  )
}
