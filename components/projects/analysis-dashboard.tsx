"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Pause } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BreathingGlow } from "@/components/ai/glass-brain/ambient-effects"
import { useAgentEvents } from "@/hooks/use-agent-events"
import { AnalysisPipelineTracker } from "./analysis-pipeline-tracker"
import { ProjectImmersiveActions } from "./project-immersive-actions"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/db/types"

type Project = Database["public"]["Tables"]["projects"]["Row"]
type AgentEvent = Database["public"]["Tables"]["agent_events"]["Row"]

interface PipelineCheckpointData {
  completed_steps?: string[]
}

interface AnalysisDashboardProps {
  projectId: string
  project: Project
  onPause: () => void
}

/* -------------------------------------------------------------------------- */
/*  Boot Sequence                                                              */
/* -------------------------------------------------------------------------- */

function AnalysisBootSequence({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      onComplete()
      return
    }

    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => onComplete(), 1500),
    ]

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase >= 2 ? 0 : 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="rounded-full bg-electric-cyan"
        initial={{ width: 8, height: 8, opacity: 0.5 }}
        animate={{
          width: phase >= 1 ? 12 : 8,
          height: phase >= 1 ? 12 : 8,
          opacity: [0.5, 1, 0.5],
          boxShadow: phase >= 1
            ? "0 0 30px rgba(0,229,255,0.5), 0 0 60px rgba(0,229,255,0.2)"
            : "0 0 15px rgba(0,229,255,0.3)",
        }}
        transition={{ opacity: { duration: 1, repeat: Infinity }, default: { duration: 0.4 } }}
      />
      {phase >= 1 && (
        <motion.p
          className="mt-6 font-grotesk text-sm font-semibold uppercase tracking-[0.3em] text-electric-cyan"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          Initializing Analysis...
        </motion.p>
      )}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Header                                                                     */
/* -------------------------------------------------------------------------- */

function AnalysisHeader({
  projectId,
  projectName,
  currentPhaseLabel,
  onPause,
}: {
  projectId: string
  projectName: string
  currentPhaseLabel: string | null
  onPause: () => void
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`

  return (
    <div className="glass-panel flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <motion.div
          className="h-2.5 w-2.5 rounded-full bg-electric-cyan"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="font-grotesk text-sm font-semibold text-foreground">
          {projectName}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <AnimatePresence mode="wait">
          {currentPhaseLabel && (
            <motion.span
              key={currentPhaseLabel}
              className="text-xs font-medium text-electric-cyan"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              {currentPhaseLabel}
            </motion.span>
          )}
        </AnimatePresence>

        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {timeStr}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={onPause}
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          <Pause className="h-3.5 w-3.5 mr-1" />
          Pause
        </Button>

        <ProjectImmersiveActions projectId={projectId} projectName={projectName} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Narrative Bar                                                              */
/* -------------------------------------------------------------------------- */

function AnalysisNarrativeBar({ latestThought }: { latestThought: AgentEvent | null }) {
  const text = latestThought?.content ?? "Waiting for analysis events..."
  const truncated = text.length > 120 ? text.slice(0, 120) + "..." : text

  return (
    <div className="glass-panel flex items-center gap-3 rounded-lg border border-border px-4 py-2">
      <motion.div
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-electric-cyan/60"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <AnimatePresence mode="wait">
        <motion.p
          key={truncated}
          className="text-xs text-muted-foreground font-mono truncate"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{ duration: 0.2 }}
        >
          {truncated}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Log Terminal                                                               */
/* -------------------------------------------------------------------------- */

const CODE_ANALYSIS_PREFIX = "[Code Analysis]"
const APP_BEHAVIOUR_PREFIX = "[App Behaviour"  // matches "[App Behaviour]" and "[App Behaviour fallback]"
const PLANNER_PREFIX = "[Planner]"

/** Returns true if the event is a brain-specific log (Code Analysis or App Behaviour). */
function isBrainEvent(content: string): boolean {
  return content.startsWith(CODE_ANALYSIS_PREFIX) || content.startsWith(APP_BEHAVIOUR_PREFIX) || content.startsWith("[App Behaviour")
}

function LogPanel({
  title,
  events,
  accentColor = "electric-cyan",
}: {
  title: string
  events: AgentEvent[]
  accentColor?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [events])

  return (
    <div className="glass-panel flex flex-1 flex-col overflow-hidden rounded-lg border border-border min-w-0">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <div className="flex gap-1">
          <div className="h-2 w-2 rounded-full bg-error/60" />
          <div className="h-2 w-2 rounded-full bg-warning/60" />
          <div className="h-2 w-2 rounded-full bg-success/60" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider truncate">
          {title}
        </span>
        {events.length > 0 && (
          <span className={cn("ml-auto flex h-2 w-2 shrink-0 rounded-full animate-pulse", `bg-${accentColor}`)} />
        )}
      </div>
      <ScrollArea className="flex-1 p-3 font-mono text-[11px]" ref={scrollRef}>
        <div className="space-y-0.5">
          {events.length === 0 && (
            <div className="text-muted-foreground/40 italic">Waiting for events...</div>
          )}
          {events.map((event) => {
            // Strip known prefixes from display content
            let display = event.content
            if (display.startsWith(CODE_ANALYSIS_PREFIX)) {
              display = display.slice(CODE_ANALYSIS_PREFIX.length).trim()
            } else if (display.startsWith(APP_BEHAVIOUR_PREFIX)) {
              const closingBracket = display.indexOf("]")
              if (closingBracket !== -1) {
                display = display.slice(closingBracket + 1).trim()
              }
            } else if (display.startsWith(PLANNER_PREFIX)) {
              display = display.slice(PLANNER_PREFIX.length).trim()
            }

            return (
              <div key={event.id} className="flex gap-2 text-muted-foreground/80 hover:text-foreground/90 transition-colors">
                <span className="shrink-0 opacity-40 select-none text-[10px]">
                  {new Date(event.created_at).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span
                  className={cn(
                    "break-all",
                    event.content.toLowerCase().includes("fail") || event.content.toLowerCase().includes("error")
                      ? "text-destructive"
                      : event.content.toLowerCase().includes("complete") || event.content.toLowerCase().includes("success")
                      ? "text-success"
                      : ""
                  )}
                >
                  {display}
                </span>
              </div>
            )
          })}
          {events.length > 0 && (
            <div className="flex gap-2 text-muted-foreground/40 animate-pulse">
              <span className="shrink-0 opacity-40 text-[10px]">
                {new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span>_</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function AnalysisScreenshotStrip({ screenshots }: { screenshots: AgentEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [screenshots])

  return (
    <div className="glass-panel rounded-lg border border-rail-purple/20 p-2 shrink-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
          Captured Frames ({screenshots.length})
        </span>
      </div>
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1">
        {screenshots.map((event) => {
          const meta = event.metadata as Record<string, unknown> | null
          const url = (meta?.url as string) ?? null
          const step = (meta?.step as string) ?? null
          if (!url) return null
          return (
            <div key={event.id} className="shrink-0 flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={event.content}
                className="h-16 w-auto rounded border border-white/10 object-cover"
              />
              <span className="text-[9px] text-muted-foreground/60 truncate max-w-[100px]">
                {step ?? event.content.slice(0, 20)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AnalysisConsoles({ events, project }: { events: AgentEvent[]; project: Project }) {
  const thoughtEvents = useMemo(
    () => events.filter((e) => e.event_type === "thought"),
    [events]
  )

  const screenshotEvents = useMemo(
    () => events.filter((e) => e.event_type === "screenshot"),
    [events]
  )

  // Planner events: general events with no brain prefix (planner logs, setup, etc.)
  const plannerEvents = useMemo(
    () => thoughtEvents.filter((e) => !isBrainEvent(e.content)),
    [thoughtEvents]
  )

  const codeAnalysisEvents = useMemo(
    () => thoughtEvents.filter((e) => e.content.startsWith(CODE_ANALYSIS_PREFIX)),
    [thoughtEvents]
  )

  const appBehaviourEvents = useMemo(
    () => thoughtEvents.filter((e) => e.content.startsWith(APP_BEHAVIOUR_PREFIX)),
    [thoughtEvents]
  )

  // Console visibility conditions
  const showPlanner = project.pipeline_step === "planning" || project.pipeline_step === "generate_slices"
  const showCodeAnalysis = !!project.github_url
  const showAppBehaviour = !!project.right_brain_status
  const hasPlannerVisible = showPlanner && plannerEvents.length > 0

  // Count visible brain panels for grid columns
  const brainPanelCount = (showCodeAnalysis ? 1 : 0) + (showAppBehaviour ? 1 : 0)

  /*
   * Layout strategy:
   * - When planner + brain consoles all visible:
   *     Top row: Planner (full width) — flex: 2
   *     Bottom row: Code Analysis | App Behaviour side-by-side — flex: 3
   * - When only brain consoles visible:
   *     Full height side-by-side
   * - Fallback: single Pipeline panel
   *
   * All use flex-grow, never fixed heights, to prevent overflow.
   */

  // All three visible: 2-row layout
  if (hasPlannerVisible && brainPanelCount > 0) {
    return (
      <div className="flex flex-1 flex-col gap-3 min-h-0">
        {/* Top: Planner console (flex-[2]) */}
        <div className="flex min-h-0 flex-2">
          <LogPanel title="Planner" events={plannerEvents} accentColor="warning" />
        </div>

        {/* Bottom: Brain consoles side by side (flex-3) */}
        <div className="flex min-h-0 flex-3 gap-3">
          {showCodeAnalysis && (
            <LogPanel title="Code Analysis" events={codeAnalysisEvents} accentColor="electric-cyan" />
          )}
          {showAppBehaviour && (
            <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0">
              <LogPanel title="App Behaviour Analysis" events={appBehaviourEvents} accentColor="rail-purple" />
              {screenshotEvents.length > 0 && (
                <AnalysisScreenshotStrip screenshots={screenshotEvents} />
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Only planner visible (no brain panels)
  if (hasPlannerVisible) {
    return (
      <div className="flex flex-1 min-h-0">
        <LogPanel title="Planner" events={plannerEvents} accentColor="warning" />
      </div>
    )
  }

  // Only brain consoles (no planner)
  if (brainPanelCount > 0) {
    return (
      <div className="flex flex-1 gap-3 min-h-0">
        {showCodeAnalysis && (
          <LogPanel title="Code Analysis" events={codeAnalysisEvents} accentColor="electric-cyan" />
        )}
        {showAppBehaviour && (
          <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0">
            <LogPanel title="App Behaviour Analysis" events={appBehaviourEvents} accentColor="rail-purple" />
            {screenshotEvents.length > 0 && (
              <AnalysisScreenshotStrip screenshots={screenshotEvents} />
            )}
          </div>
        )}
      </div>
    )
  }

  // Fallback: single pipeline panel
  return (
    <div className="flex flex-1 min-h-0">
      <LogPanel title="Pipeline" events={plannerEvents} accentColor="electric-cyan" />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main Dashboard                                                             */
/* -------------------------------------------------------------------------- */

function getPipelinePhaseLabel(pipelineStep: string | null): string | null {
  if (!pipelineStep) return null
  const labels: Record<string, string> = {
    left_brain: "Running Code Analysis",
    right_brain: "Running App Behaviour Analysis",
    planning: "Generating Vertical Slices",
    generate_slices: "Generating Vertical Slices",
  }
  return labels[pipelineStep] ?? pipelineStep.replace(/_/g, " ")
}

export function AnalysisDashboard({ projectId, project, onPause }: AnalysisDashboardProps) {
  // Skip boot sequence when resuming from config (brains already done, planning step active)
  const shouldSkipBoot = project.pipeline_step === "planning"
  const [booted, setBooted] = useState(shouldSkipBoot)
  const [contentVisible, setContentVisible] = useState(shouldSkipBoot)

  const { events, latestThought } = useAgentEvents(projectId, {
    initialConfidence: project.confidence_score,
    soundEnabled: false,
  })

  const checkpoint = project.pipeline_checkpoint as unknown as PipelineCheckpointData | null
  const completedSteps = checkpoint?.completed_steps ?? []

  const handleBootComplete = useCallback(() => {
    setBooted(true)
    setTimeout(() => setContentVisible(true), 150)
  }, [])

  const currentPhaseLabel = getPipelinePhaseLabel(project.pipeline_step)

  return (
    <BreathingGlow confidence={0.3} className="relative flex h-full flex-col gap-3 p-3">
      {/* Boot sequence */}
      <AnimatePresence>
        {!booted && <AnalysisBootSequence onComplete={handleBootComplete} />}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={contentVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.3 }}
      >
        <AnalysisHeader
          projectId={projectId}
          projectName={project.name}
          currentPhaseLabel={currentPhaseLabel}
          onPause={onPause}
        />
      </motion.div>

      {/* Narrative bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={contentVisible ? { opacity: 1 } : {}}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <AnalysisNarrativeBar latestThought={latestThought} />
      </motion.div>

      {/* Pipeline tracker */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={contentVisible ? { opacity: 1 } : {}}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <AnalysisPipelineTracker
          currentStep={project.pipeline_step}
          completedSteps={completedSteps}
          leftBrainStatus={project.left_brain_status}
          rightBrainStatus={project.right_brain_status}
        />
      </motion.div>

      {/* Dual log consoles */}
      <motion.div
        className="flex flex-1 min-h-0"
        initial={{ opacity: 0, y: 10 }}
        animate={contentVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <AnalysisConsoles events={events} project={project} />
      </motion.div>
    </BreathingGlow>
  )
}
