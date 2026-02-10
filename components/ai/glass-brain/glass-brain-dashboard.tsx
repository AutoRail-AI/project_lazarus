"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Terminal, Globe, X, CheckCircle2, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/db/types"
import { useAgentEvents } from "@/hooks/use-agent-events"
import { HeaderStats } from "./header-stats"
import { VictoryLap } from "./victory-lap"
import { BreathingGlow } from "./ambient-effects"
import { deriveStats } from "./derive-stats"
import { extractMCPToolCalls } from "./derive-build-phase"
import { CostTicker } from "./cost-ticker"
import { ChaosButton } from "./chaos-button"
import { MCPToolInspector } from "./mcp-tool-inspector"
import { WorkspaceExplorer } from "./workspace-explorer"
import { BuildConsole } from "./build-console"
import { ChatPane } from "./chat-pane"
import { FileViewer } from "./file-viewer"
import { BrowserTestPanel } from "./browser-test-panel"

type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

interface GlassBrainDashboardProps {
  projectId: string
  projectName: string
  slices: Slice[]
  /** True when the project has completed — renders in read-only audit mode */
  isComplete?: boolean
  /** Callback to switch to overview page */
  onShowOverview?: () => void
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
  isComplete = false,
  onShowOverview,
}: GlassBrainDashboardProps) {
  // Skip boot animation for completed projects — show data immediately
  const [booted, setBooted] = useState(isComplete)
  const [panesVisible, setPanesVisible] = useState(isComplete)
  const [mcpInspectorOpen, setMcpInspectorOpen] = useState(false)

  // Editor tabs (top half of center pane)
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [activeFileTab, setActiveFileTab] = useState<string | null>(null)
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set())

  // Bottom panel tabs (Console / Browser)
  const [activeBottomTab, setActiveBottomTab] = useState<"console" | "browser">("console")

  const { events, confidence, activeSliceId } =
    useAgentEvents(projectId, {
      initialConfidence: 0,
      soundEnabled: false,
    })

  // Elapsed time ref for VictoryLap
  const elapsedRef = useRef<number>(0)

  // MCP tool calls (keep for inspector)
  const mcpToolCalls = useMemo(() => extractMCPToolCalls(events), [events])

  // Browser events detection
  const hasBrowserEvents = useMemo(
    () => events.some((e) => e.event_type === "screenshot" || e.event_type === "browser_action" || e.event_type === "app_start"),
    [events]
  )

  // Victory lap: triggers once when confidence >= 0.85 (never for completed/audit mode)
  const [showVictory, setShowVictory] = useState(false)
  const victoryTriggeredRef = useRef(isComplete)

  useEffect(() => {
    if (confidence >= 0.85 && !victoryTriggeredRef.current) {
      victoryTriggeredRef.current = true
      setShowVictory(true)
    }
  }, [confidence])

  const handleBootComplete = useCallback(() => {
    setBooted(true)
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

  const hasOpenFiles = openFiles.length > 0

  // File tab handlers
  const handleFileSelect = useCallback((path: string) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]))
    setActiveFileTab(path)
  }, [])

  const handleCloseFile = useCallback((path: string) => {
    setOpenFiles((prev) => {
      const next = prev.filter((p) => p !== path)
      // If we closed the active tab, switch to the last remaining or null
      setActiveFileTab((cur) => {
        if (cur !== path) return cur
        const lastFile = next[next.length - 1]
        return lastFile ?? null
      })
      return next
    })
    setDirtyFiles((prev) => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }, [])

  const handleDirtyChange = useCallback((path: string, dirty: boolean) => {
    setDirtyFiles((prev) => {
      const next = new Set(prev)
      if (dirty) next.add(path)
      else next.delete(path)
      return next
    })
  }, [])

  // Derive selectedPath for workspace explorer highlight
  const selectedPath = activeFileTab ?? undefined

  // Find the currently building slice
  const activeSlice = useMemo(
    () => slices.find((s) => s.id === activeSliceId) ?? slices.find((s) => s.status === "building"),
    [slices, activeSliceId]
  )

  // Derived stats for victory lap
  const stats = useMemo(() => deriveStats(events, confidence), [events, confidence])

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
          slices={slices}
          elapsedRef={elapsedRef}
          mcpCallCount={mcpToolCalls.length}
          onToggleMCPInspector={handleToggleMCPInspector}
        />
      </motion.div>

      {/* Three panes: File Explorer | Tabbed Center | Chat */}
      <div className="relative grid min-h-0 flex-1 grid-cols-[1fr_2fr_1fr] gap-3">
        {/* Workspace Explorer */}
        <motion.div
          className="min-h-0"
          custom={0}
          variants={paneVariants}
          initial="hidden"
          animate={panesVisible ? "visible" : "hidden"}
        >
          <WorkspaceExplorer
            projectId={projectId}
            events={events}
            onFileSelect={handleFileSelect}
            selectedPath={selectedPath}
          />
        </motion.div>

        {/* Center Pane — IntelliJ-style vertical split: Editor (top) + Console/Browser (bottom) */}
        <motion.div
          className="flex min-h-0 flex-col overflow-hidden"
          custom={1}
          variants={paneVariants}
          initial="hidden"
          animate={panesVisible ? "visible" : "hidden"}
        >
          {/* ── Editor area (top) — only when files are open ── */}
          {hasOpenFiles && (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Editor tab bar */}
              <div className="flex rounded-t-lg border border-b-0 border-border bg-card/30 shrink-0 overflow-x-auto">
                {openFiles.map((path) => {
                  const fileName = path.split("/").pop() ?? path
                  const isDirty = dirtyFiles.has(path)
                  return (
                    <button
                      key={path}
                      type="button"
                      onClick={() => setActiveFileTab(path)}
                      className={cn(
                        "group flex items-center gap-1 shrink-0 border-b-2 px-2.5 py-1.5 text-xs transition-colors",
                        activeFileTab === path
                          ? "border-electric-cyan text-electric-cyan"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {isDirty && (
                        <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                      )}
                      <span className="truncate max-w-[120px]">{fileName}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCloseFile(path)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation()
                            handleCloseFile(path)
                          }
                        }}
                        className="ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-foreground/10 transition-all"
                      >
                        <X className="h-2.5 w-2.5" />
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Editor content */}
              <div className="flex-1 min-h-0">
                {openFiles.map((path) =>
                  activeFileTab === path ? (
                    <FileViewer
                      key={path}
                      projectId={projectId}
                      filePath={path}
                      onClose={() => handleCloseFile(path)}
                      onDirtyChange={handleDirtyChange}
                    />
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* ── Bottom panel: Console / Browser ── */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Bottom tab bar */}
            <div className={cn(
              "flex border border-b-0 border-border bg-card/30 shrink-0 overflow-x-auto",
              hasOpenFiles ? "rounded-none border-t border-border" : "rounded-t-lg"
            )}>
              <button
                type="button"
                onClick={() => setActiveBottomTab("console")}
                className={cn(
                  "flex items-center gap-1.5 shrink-0 border-b-2 px-3 py-1.5 text-xs transition-colors",
                  activeBottomTab === "console"
                    ? "border-electric-cyan text-electric-cyan"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Terminal className="h-3 w-3" />
                Console
              </button>
              {hasBrowserEvents && (
                <button
                  type="button"
                  onClick={() => setActiveBottomTab("browser")}
                  className={cn(
                    "flex items-center gap-1.5 shrink-0 border-b-2 px-3 py-1.5 text-xs transition-colors",
                    activeBottomTab === "browser"
                      ? "border-electric-cyan text-electric-cyan"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Globe className="h-3 w-3" />
                  Browser
                </button>
              )}
            </div>

            {/* Bottom content */}
            <div className="flex-1 min-h-0">
              {activeBottomTab === "console" && <BuildConsole events={events} />}
              {activeBottomTab === "browser" && (
                <BrowserTestPanel projectId={projectId} events={events} />
              )}
            </div>
          </div>
        </motion.div>

        {/* Chat Pane */}
        <motion.div
          className="min-h-0"
          custom={2}
          variants={paneVariants}
          initial="hidden"
          animate={panesVisible ? "visible" : "hidden"}
        >
          <ChatPane projectId={projectId} events={events} />
        </motion.div>
      </div>

      {/* Bottom bar: completion badge (left) + cost ticker (right) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={panesVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="flex items-center justify-between"
      >
        {isComplete ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span className="text-xs font-medium text-success">Build Complete</span>
              <span className="text-[10px] text-muted-foreground ml-1">
                {events.length} events logged
              </span>
            </div>
            {onShowOverview && (
              <button
                type="button"
                onClick={onShowOverview}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Overview
              </button>
            )}
          </div>
        ) : (
          <div />
        )}
        <CostTicker events={events} />
      </motion.div>

      {/* Chaos Button (floating) — only during active builds */}
      {!isComplete && (
        <ChaosButton projectId={projectId} sliceId={activeSliceId} />
      )}

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
