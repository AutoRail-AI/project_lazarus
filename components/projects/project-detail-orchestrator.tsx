"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2 } from "lucide-react"
import { useProjectPolling } from "@/hooks/use-project-polling"
import { OverviewView } from "./overview-view"
import { AnalysisDashboard } from "./analysis-dashboard"
import { AnalysisConfigView } from "./analysis-config-view"
import { SliceReviewView } from "./slice-review-view"
import { GlassBrainDashboard } from "@/components/ai/glass-brain/glass-brain-dashboard"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { Database, ProjectStatus } from "@/lib/db/types"

type Project = Database["public"]["Tables"]["projects"]["Row"]
type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

type ViewKey = "overview" | "analysis" | "config" | "slice-review" | "glass-brain"

function deriveView(status: ProjectStatus): ViewKey {
  switch (status) {
    case "processing":
      return "analysis"
    case "analyzed":
      return "config"
    case "ready":
      return "slice-review"
    case "building":
      return "glass-brain"
    default:
      // pending, complete, failed, paused → overview
      return "overview"
  }
}

interface ProjectDetailOrchestratorProps {
  projectId: string
  initialProject: Project
  initialSlices: Slice[]
}

const fadeVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 },
}

const fadeTransition = {
  enter: { duration: 0.4, ease: "easeOut" as const },
  exit: { duration: 0.3, ease: "easeIn" as const },
}

/* -------------------------------------------------------------------------- */
/*  Completion Overlay                                                         */
/* -------------------------------------------------------------------------- */

function CompletionOverlay({
  title,
  subtitle,
  onDone,
}: {
  title: string
  subtitle: string
  onDone: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <CheckCircle2 className="h-16 w-16 text-electric-cyan" />
      </motion.div>
      <motion.h2
        className="mt-4 font-grotesk text-2xl font-bold text-electric-cyan"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        {title}
      </motion.h2>
      <motion.p
        className="mt-2 text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        {subtitle}
      </motion.p>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Orchestrator                                                               */
/* -------------------------------------------------------------------------- */

export function ProjectDetailOrchestrator({
  projectId,
  initialProject,
  initialSlices,
}: ProjectDetailOrchestratorProps) {
  const router = useRouter()
  const { project, slices, refetch } = useProjectPolling({
    projectId,
    initialProject,
    initialSlices,
  })

  const currentView = deriveView(project.status)
  const prevViewRef = useRef<ViewKey>(currentView)
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionText, setCompletionText] = useState({ title: "", subtitle: "" })

  // Detect view transitions that need overlays
  useEffect(() => {
    const prevView = prevViewRef.current
    if (prevView === "analysis" && currentView === "config") {
      setCompletionText({
        title: "Analysis Complete!",
        subtitle: "Review your project insights and configure preferences.",
      })
      setShowCompletion(true)
    } else if (
      (prevView === "analysis" || prevView === "config") &&
      currentView === "slice-review"
    ) {
      setCompletionText({
        title: "Planning Complete!",
        subtitle: `${slices.length} vertical slice${slices.length !== 1 ? "s" : ""} generated`,
      })
      setShowCompletion(true)
    }
    prevViewRef.current = currentView
  }, [currentView, slices.length])

  const handleCompletionDone = useCallback(() => {
    setShowCompletion(false)
  }, [])

  // Action callbacks
  const handlePause = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || "Failed to pause")
      }
      toast.success("Processing paused")
      await refetch()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
    }
  }, [projectId, refetch])

  const handleBuildAll = useCallback(async () => {
    await refetch()
  }, [refetch])

  const handleConfigure = useCallback(async () => {
    await refetch()
  }, [refetch])

  const handleOverviewAction = useCallback(async () => {
    await refetch()
    router.refresh()
  }, [refetch, router])

  // Wrap immersive views in full-height container
  const isImmersive = currentView === "analysis" || currentView === "config" || currentView === "slice-review" || currentView === "glass-brain"

  return (
    <div className={isImmersive ? "h-[calc(100vh-3rem)] relative" : "relative"}>
      {/* Completion overlay */}
      <AnimatePresence>
        {showCompletion && (
          <CompletionOverlay
            title={completionText.title}
            subtitle={completionText.subtitle}
            onDone={handleCompletionDone}
          />
        )}
      </AnimatePresence>

      {/* View transitions */}
      <AnimatePresence mode="wait">
        {currentView === "overview" && (
          <motion.div
            key="ov"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={fadeTransition.enter}
          >
            <OverviewView
              project={project}
              slices={slices}
              projectId={projectId}
              onAction={handleOverviewAction}
            />
          </motion.div>
        )}

        {currentView === "analysis" && (
          <motion.div
            key="an"
            className="h-full"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={fadeTransition.enter}
          >
            <AnalysisDashboard
              projectId={projectId}
              project={project}
              onPause={handlePause}
            />
          </motion.div>
        )}

        {currentView === "config" && !showCompletion && (
          <motion.div
            key="cfg"
            className="h-full"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={fadeTransition.enter}
          >
            <AnalysisConfigView
              projectId={projectId}
              project={project}
              onConfigure={handleConfigure}
            />
          </motion.div>
        )}

        {currentView === "slice-review" && !showCompletion && (
          <motion.div
            key="sr"
            className="h-full"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={fadeTransition.enter}
          >
            <SliceReviewView
              projectId={projectId}
              project={project}
              slices={slices}
              onBuildAll={handleBuildAll}
            />
          </motion.div>
        )}

        {currentView === "glass-brain" && (
          <motion.div
            key="gb"
            className="h-full"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={fadeTransition.enter}
          >
            <GlassBrainDashboard
              projectId={projectId}
              projectName={project.name}
              slices={slices}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
