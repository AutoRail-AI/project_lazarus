"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Database } from "@/lib/db/types"
import { useAgentEvents } from "@/hooks/use-agent-events"
import { ConfidenceGauge } from "./confidence-gauge"
import { PlanPaneEnhanced } from "./plan-pane-enhanced"
import { WorkPaneEnhanced } from "./work-pane-enhanced"
import { ThoughtsPane } from "./thoughts-pane"
import { HeaderStats } from "./header-stats"
import { ActivityTimeline } from "./activity-timeline"
import { VictoryLap } from "./victory-lap"
import { PaneConnectionLines, BreathingGlow } from "./ambient-effects"
import { deriveStats, getConfidenceHistory } from "./derive-stats"
import {
  deriveBuildStep,
  deriveBuildPhase,
  deriveActiveBrain,
  groupSelfHealCycles,
  extractMCPToolCalls,
} from "./derive-build-phase"
import { BuildNarrativeBar } from "./build-narrative-bar"
import { BuildPipelineTracker } from "./build-pipeline-tracker"
import { CostTicker } from "./cost-ticker"
import { ChaosButton } from "./chaos-button"
import { MCPToolInspector } from "./mcp-tool-inspector"

type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

interface GlassBrainDashboardProps {
  projectId: string
  projectName: string
  slices: Slice[]
}

/* -------------------------------------------------------------------------- */
/*  Boot Sequence Overlay                                                      */
/* -------------------------------------------------------------------------- */

function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      onComplete()
      return
    }

    const timers = [
      setTimeout(() => setPhase(1), 500),   // Lines radiate
      setTimeout(() => setPhase(2), 1200),  // Text appears
      setTimeout(() => setPhase(3), 2200),  // "Materializing panes..."
      setTimeout(() => setPhase(4), 2800),  // Fade out
      setTimeout(() => onComplete(), 3400), // Done
    ]

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase >= 4 ? 0 : 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Pulsing dot */}
      <motion.div
        className="rounded-full bg-electric-cyan"
        initial={{ width: 8, height: 8, opacity: 0.5 }}
        animate={{
          width: phase >= 1 ? 16 : 8,
          height: phase >= 1 ? 16 : 8,
          opacity: [0.5, 1, 0.5],
          boxShadow: phase >= 1
            ? "0 0 40px rgba(0,229,255,0.6), 0 0 80px rgba(0,229,255,0.3)"
            : "0 0 20px rgba(0,229,255,0.4)",
        }}
        transition={{ opacity: { duration: 1, repeat: Infinity }, default: { duration: 0.5 } }}
      />

      {/* Radiating lines */}
      {phase >= 1 && (
        <motion.div
          className="absolute"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.3, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-px bg-electric-cyan/30"
              style={{
                width: 120,
                left: "50%",
                top: "50%",
                transformOrigin: "0 0",
                transform: `rotate(${i * 60}deg)`,
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            />
          ))}
        </motion.div>
      )}

      {/* Text: Neural Link */}
      {phase >= 2 && (
        <motion.p
          className="mt-8 font-grotesk text-sm font-semibold uppercase tracking-[0.3em] text-electric-cyan"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Neural Link Established
        </motion.p>
      )}

      {/* Text: Materializing */}
      {phase >= 3 && (
        <motion.p
          className="mt-2 font-grotesk text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.3 }}
        >
          Materializing panes...
        </motion.p>
      )}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export function GlassBrainDashboard({
  projectId,
  projectName,
  slices,
}: GlassBrainDashboardProps) {
  const [booted, setBooted] = useState(false)
  const [panesVisible, setPanesVisible] = useState(false)
  const [mcpInspectorOpen, setMcpInspectorOpen] = useState(false)

  const { events, confidence, muted, toggleMute, activeSliceId } =
    useAgentEvents(projectId, {
      initialConfidence: 0,
      soundEnabled: true,
    })

  // Elapsed time ref for VictoryLap
  const elapsedRef = useRef<number>(0)

  // ---- noVNC + screenshots ----
  const novncUrl = process.env.NEXT_PUBLIC_NOVNC_URL ?? null

  const screenshots = useMemo(
    () => events.filter((e) => e.event_type === "screenshot"),
    [events]
  )

  // ---- Build Experience derived values ----
  const { step: currentStep, stepStatuses } = useMemo(
    () => deriveBuildStep(events),
    [events]
  )
  const currentPhase = useMemo(
    () => deriveBuildPhase(events, confidence),
    [events, confidence]
  )
  const activeBrain = useMemo(() => deriveActiveBrain(events), [events])
  const selfHealCycles = useMemo(() => groupSelfHealCycles(events), [events])
  const activeSelfHealCycle = useMemo(
    () => selfHealCycles.find((c) => c.isActive) ?? null,
    [selfHealCycles]
  )
  const mcpToolCalls = useMemo(() => extractMCPToolCalls(events), [events])

  // Self-heal spotlight: driven by activeSelfHealCycle
  const healSpotlight = activeSelfHealCycle?.isActive ?? false

  // Legacy heal spotlight timer (for dims) — keep for pane dimming
  const lastHealCountRef = useMemo(() => ({ value: 0 }), [])
  const [healDim, setHealDim] = useState(false)

  useEffect(() => {
    const healEvents = events.filter((e) => e.event_type === "self_heal")
    if (healEvents.length > lastHealCountRef.value) {
      lastHealCountRef.value = healEvents.length
      setHealDim(true)
      const timer = setTimeout(() => setHealDim(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [events, lastHealCountRef])

  const shouldDim = healSpotlight || healDim

  // Victory lap: triggers once when confidence >= 0.85
  const [showVictory, setShowVictory] = useState(false)
  const victoryTriggeredRef = useRef(false)

  useEffect(() => {
    if (confidence >= 0.85 && !victoryTriggeredRef.current) {
      victoryTriggeredRef.current = true
      setShowVictory(true)
    }
  }, [confidence])

  const handleBootComplete = useCallback(() => {
    setBooted(true)
    // Stagger pane reveal after boot
    setTimeout(() => setPanesVisible(true), 200)
  }, [])

  const handleDismissVictory = useCallback(() => {
    setShowVictory(false)
  }, [])

  const handleToggleMCPInspector = useCallback(() => {
    setMcpInspectorOpen((prev) => !prev)
  }, [])

  const handleCloseMCPInspector = useCallback(() => {
    setMcpInspectorOpen(false)
  }, [])

  // Find the currently building slice
  const activeSlice = useMemo(
    () => slices.find((s) => s.id === activeSliceId) ?? slices.find((s) => s.status === "building"),
    [slices, activeSliceId]
  )

  // Derived stats for victory lap
  const stats = useMemo(() => deriveStats(events, confidence), [events, confidence])
  const confidenceHistory = useMemo(() => getConfidenceHistory(events, 0), [events])

  // Pane stagger animation
  const paneVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.15, duration: 0.4, ease: "easeOut" as const },
    }),
  }

  return (
    <BreathingGlow confidence={confidence} className="relative flex h-full flex-col gap-3 p-3">
      {/* Boot sequence overlay */}
      <AnimatePresence>
        {!booted && <BootSequence onComplete={handleBootComplete} />}
      </AnimatePresence>

      {/* Header bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={panesVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.3 }}
      >
        <HeaderStats
          projectId={projectId}
          events={events}
          confidence={confidence}
          projectName={projectName}
          activeSlice={activeSlice}
          muted={muted}
          toggleMute={toggleMute}
          elapsedRef={elapsedRef}
          currentPhase={currentPhase}
          activeBrain={activeBrain}
          mcpCallCount={mcpToolCalls.length}
          onToggleMCPInspector={handleToggleMCPInspector}
        />
      </motion.div>

      {/* Narrative bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={panesVisible ? { opacity: 1 } : {}}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <BuildNarrativeBar events={events} currentPhase={currentPhase} />
      </motion.div>

      {/* Build pipeline tracker */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={panesVisible ? { opacity: 1 } : {}}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <BuildPipelineTracker stepStatuses={stepStatuses} currentStep={currentStep} />
      </motion.div>

      {/* Three panes with connection lines */}
      <div className="relative grid min-h-0 flex-1 grid-cols-[1fr_2fr_1fr] gap-3">
        {/* Connection lines overlay */}
        <PaneConnectionLines />

        {/* Plan Pane */}
        <motion.div
          className="min-h-0"
          custom={0}
          variants={paneVariants}
          initial="hidden"
          animate={panesVisible ? "visible" : "hidden"}
        >
          <motion.div
            className="h-full"
            animate={{ opacity: shouldDim ? 0.4 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <PlanPaneEnhanced slices={slices} activeSliceId={activeSliceId} events={events} />
          </motion.div>
        </motion.div>

        {/* Work Pane */}
        <motion.div
          className="min-h-0"
          custom={1}
          variants={paneVariants}
          initial="hidden"
          animate={panesVisible ? "visible" : "hidden"}
        >
          <motion.div
            className="h-full"
            animate={{ opacity: shouldDim ? 0.4 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <WorkPaneEnhanced
              events={events}
              slices={slices}
              activeSelfHealCycle={activeSelfHealCycle}
              novncUrl={novncUrl}
              screenshots={screenshots}
            />
          </motion.div>
        </motion.div>

        {/* Thoughts Pane */}
        <motion.div
          className="min-h-0"
          custom={2}
          variants={paneVariants}
          initial="hidden"
          animate={panesVisible ? "visible" : "hidden"}
        >
          <ThoughtsPane events={events} healSpotlight={shouldDim} />
        </motion.div>
      </div>

      {/* Activity Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={panesVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <ActivityTimeline events={events} slices={slices} />
      </motion.div>

      {/* Confidence gauge + Cost ticker row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={panesVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.6, duration: 0.3 }}
        className="flex gap-3"
      >
        <div className="flex-1">
          <ConfidenceGauge score={confidence} history={confidenceHistory} />
        </div>
        <CostTicker events={events} />
      </motion.div>

      {/* Chaos Button (floating) */}
      <ChaosButton projectId={projectId} sliceId={activeSliceId} />

      {/* MCP Tool Inspector (slide-over) */}
      <MCPToolInspector
        toolCalls={mcpToolCalls}
        isOpen={mcpInspectorOpen}
        onClose={handleCloseMCPInspector}
      />

      {/* Victory Lap overlay */}
      <AnimatePresence>
        {showVictory && (
          <VictoryLap
            score={confidence}
            stats={{
              linesOfCode: stats.linesOfCode,
              testsPassed: stats.testsPassed,
              testsTotal: stats.testsTotal,
              selfHeals: stats.selfHeals,
              elapsedSeconds: elapsedRef.current,
            }}
            projectId={projectId}
            onDismiss={handleDismissVictory}
          />
        )}
      </AnimatePresence>
    </BreathingGlow>
  )
}
