"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Brain,
  Camera,
  CheckCircle,
  ChevronDown,
  Code,
  Eye,
  FileCode,
  Globe,
  List,
  Play,
  RotateCw,
  Wrench,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentEvent } from "@/hooks/use-agent-events"
import type { AgentEventType, Database } from "@/lib/db/types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { timeAgo } from "./derive-stats"
import type { SelfHealCycle } from "./derive-build-phase"
import { SelfHealArc } from "./self-heal-arc"
import { BrowserStreamPanel } from "./browser-stream-panel"
import { ScreenshotGallery } from "./screenshot-gallery"

type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

/* -------------------------------------------------------------------------- */
/*  Event type config                                                          */
/* -------------------------------------------------------------------------- */

const EVENT_CONFIG: Record<
  AgentEventType,
  { icon: React.ElementType; colorClass: string; label: string }
> = {
  thought: { icon: Brain, colorClass: "text-muted-foreground", label: "Thought" },
  tool_call: { icon: Wrench, colorClass: "text-electric-cyan", label: "Tool" },
  observation: { icon: Eye, colorClass: "text-muted-foreground/60", label: "Observation" },
  code_write: { icon: Code, colorClass: "text-foreground", label: "Code" },
  test_run: { icon: Play, colorClass: "text-warning", label: "Test Run" },
  test_result: { icon: CheckCircle, colorClass: "text-success", label: "Test Result" },
  self_heal: { icon: RotateCw, colorClass: "text-quantum-violet", label: "Self-Heal" },
  confidence_update: { icon: CheckCircle, colorClass: "text-muted-foreground", label: "Confidence" },
  browser_action: { icon: Globe, colorClass: "text-warning", label: "Browser" },
  screenshot: { icon: Camera, colorClass: "text-quantum-violet", label: "Screenshot" },
  app_start: { icon: Play, colorClass: "text-success", label: "App Start" },
}

function isTestFail(event: AgentEvent): boolean {
  const meta = event.metadata as Record<string, unknown> | null
  return (
    event.event_type === "test_result" &&
    (meta?.passed === false || meta?.result === "fail")
  )
}

/* -------------------------------------------------------------------------- */
/*  Ghost Typer                                                                */
/* -------------------------------------------------------------------------- */

function GhostTyper({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setDisplayed(text)
      setDone(true)
      return
    }

    let i = 0
    const speed = 15
    let lastTime = 0

    function step(time: number) {
      if (time - lastTime >= speed) {
        i++
        setDisplayed(text.slice(0, i))
        lastTime = time
      }
      if (i < text.length) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setDone(true)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [text])

  return (
    <span>
      {displayed}
      {!done && (
        <span className="inline-block h-4 w-2 animate-pulse bg-electric-cyan" />
      )}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Simple syntax highlighting                                                 */
/* -------------------------------------------------------------------------- */

function highlightCode(code: string): string {
  return code
    .replace(
      /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|new|async|await|try|catch|throw)\b/g,
      '<span class="text-electric-cyan">$1</span>'
    )
    .replace(
      /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
      '<span class="text-success">$1</span>'
    )
    .replace(
      /(\/\/.*$)/gm,
      '<span class="text-muted-foreground/50">$1</span>'
    )
}

/* -------------------------------------------------------------------------- */
/*  Slice Context Header                                                       */
/* -------------------------------------------------------------------------- */

function SliceContextHeader({ sliceName, status }: { sliceName: string; status?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-electric-cyan/10 bg-electric-cyan/5 px-3 py-1.5">
      <div className="h-1.5 w-1.5 rounded-full bg-electric-cyan" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-electric-cyan/80">
        {sliceName}
      </span>
      {status && (
        <span className="text-[9px] text-muted-foreground/50">
          {status}
        </span>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Test Result Card                                                           */
/* -------------------------------------------------------------------------- */

function TestResultCard({ event }: { event: AgentEvent }) {
  const meta = event.metadata as Record<string, unknown> | null
  const passed = meta?.passed === true || meta?.result === "pass"
  const failFile = (meta?.file as string) ?? null

  return (
    <div
      className={cn(
        "mx-3 my-1.5 rounded-md border px-3 py-2",
        passed
          ? "border-success/20 bg-success/5"
          : "border-error/20 bg-error/5"
      )}
    >
      <div className="flex items-center gap-2">
        {passed ? (
          <CheckCircle className="h-3.5 w-3.5 text-success" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-error" />
        )}
        <span className={cn("text-xs font-semibold", passed ? "text-success" : "text-error")}>
          {passed ? "Tests Passed" : "Tests Failed"}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-foreground/70">
        {event.content}
      </p>
      {failFile && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {failFile}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Single event row                                                           */
/* -------------------------------------------------------------------------- */

function EventRow({
  event,
  isLatest,
  showTimestamp,
}: {
  event: AgentEvent
  isLatest: boolean
  showTimestamp: boolean
}) {
  const config = EVENT_CONFIG[event.event_type]
  const Icon = isTestFail(event) ? XCircle : config.icon
  const colorClass = isTestFail(event) ? "text-error" : config.colorClass
  const isCode = event.event_type === "code_write"
  const isObservation = event.event_type === "observation"
  const isThought = event.event_type === "thought"
  const meta = event.metadata as Record<string, unknown> | null
  const filename = (meta?.filename as string) ?? null
  const language = (meta?.language as string) ?? null

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex gap-2 px-3 py-1.5 text-xs",
        isObservation && "ml-6 border-l-2 border-electric-cyan/15 opacity-70"
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", colorClass)} />
      <div className="min-w-0 flex-1">
        {isCode ? (
          <div>
            {/* Code block label */}
            {(filename ?? language) && (
              <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <FileCode className="h-3 w-3" />
                {filename ?? language}
              </div>
            )}
            <pre className="overflow-x-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed">
              {isLatest ? (
                <GhostTyper text={event.content} />
              ) : (
                <code
                  dangerouslySetInnerHTML={{
                    __html: highlightCode(
                      event.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")
                    ),
                  }}
                />
              )}
            </pre>
          </div>
        ) : (
          <span className={cn("leading-relaxed", colorClass, isThought && "italic")}>
            {event.content}
          </span>
        )}
      </div>

      {/* Relative timestamp */}
      {showTimestamp && (
        <span className="shrink-0 self-start text-[9px] text-muted-foreground/40">
          {timeAgo(event.created_at)}
        </span>
      )}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Work Pane Enhanced                                                         */
/* -------------------------------------------------------------------------- */

interface WorkPaneEnhancedProps {
  events: AgentEvent[]
  slices: Slice[]
  activeSelfHealCycle?: SelfHealCycle | null
  novncUrl?: string | null
  screenshots?: AgentEvent[]
}

export function WorkPaneEnhanced({ events, slices, activeSelfHealCycle, novncUrl, screenshots }: WorkPaneEnhancedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [glitch, setGlitch] = useState(false)
  const [activeTab, setActiveTab] = useState("events")
  const lastEventCountRef = useRef(0)
  // Defer Radix Tabs to client-only to avoid hydration mismatch (Radix useId differs on server vs client)
  const [tabsMounted, setTabsMounted] = useState(false)
  useEffect(() => setTabsMounted(true), [])

  // Build slice name map
  const sliceMap = useMemo(() => {
    const map = new Map<string, Slice>()
    for (const s of slices) map.set(s.id, s)
    return map
  }, [slices])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length, autoScroll])

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    setAutoScroll(atBottom)
  }, [])

  // Glitch on test failure
  useEffect(() => {
    if (events.length <= lastEventCountRef.current) {
      lastEventCountRef.current = events.length
      return
    }

    const newEvents = events.slice(lastEventCountRef.current)
    lastEventCountRef.current = events.length

    const hasFail = newEvents.some((e) => isTestFail(e))
    if (hasFail) {
      setGlitch(true)
      setTimeout(() => setGlitch(false), 400)
    }
  }, [events])

  // Auto-switch tab on browser events
  useEffect(() => {
    const lastEvent = events[events.length - 1]
    if (!lastEvent) return
    if (lastEvent.event_type === "app_start" || lastEvent.event_type === "browser_action") {
      setActiveTab("browser")
    } else if (lastEvent.event_type === "screenshot") {
      setActiveTab("screenshots")
    }
  }, [events])

  const jumpToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setAutoScroll(true)
    }
  }, [])

  // Prepare rendered items: events + slice context headers + timestamps
  const renderedItems = useMemo(() => {
    const items: Array<
      | { type: "event"; event: AgentEvent; showTimestamp: boolean; isLatest: boolean }
      | { type: "slice_header"; sliceName: string; status: string; key: string }
      | { type: "test_card"; event: AgentEvent }
    > = []

    let prevSliceId: string | null = null
    let prevTimestamp = 0

    for (let i = 0; i < events.length; i++) {
      const event = events[i]
      if (!event) continue

      // Slice context header when slice changes
      if (event.slice_id && event.slice_id !== prevSliceId) {
        const slice = sliceMap.get(event.slice_id)
        items.push({
          type: "slice_header",
          sliceName: slice?.name ?? "Unknown Slice",
          status: slice?.status ?? "pending",
          key: `sh-${event.id}`,
        })
        prevSliceId = event.slice_id
      }

      // Test result as special card
      if (event.event_type === "test_result") {
        items.push({ type: "test_card", event })
        continue
      }

      // Show timestamp every 5th event or when > 30s elapsed
      const ts = new Date(event.created_at).getTime()
      const elapsed = ts - prevTimestamp
      const showTs = i % 5 === 0 || elapsed > 30000
      if (showTs) prevTimestamp = ts

      items.push({
        type: "event",
        event,
        showTimestamp: showTs,
        isLatest: i === events.length - 1 && event.event_type === "code_write",
      })
    }

    return items
  }, [events, sliceMap])

  return (
    <div
      className={cn(
        "glass-panel relative flex flex-col overflow-hidden rounded-lg border border-border",
        glitch && "animate-glitch"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-grotesk text-sm font-semibold text-foreground">
          The Work
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {events.length} events
        </span>
      </div>

      {/* Self-Heal Arc overlay */}
      <AnimatePresence>
        {activeSelfHealCycle?.isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-rail-purple/20 bg-rail-purple/5 p-3"
          >
            <SelfHealArc cycle={activeSelfHealCycle} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glitch overlay */}
      {glitch && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-0 bg-error/5" />
          <motion.div
            className="absolute left-0 right-0 h-0.5 bg-error/60"
            initial={{ top: "0%" }}
            animate={{ top: "100%" }}
            transition={{ duration: 0.3, ease: "linear" }}
          />
        </div>
      )}

      {/* Tabbed content: render Tabs only after mount to avoid Radix useId hydration mismatch */}
      {!tabsMounted ? (
        <div className="flex flex-1 flex-col min-h-0">
          <div className="mx-3 mt-2 h-8 shrink-0 rounded-md bg-background/50 border border-border" aria-hidden />
          <div className="relative flex-1 min-h-0 mt-0">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="absolute inset-0 overflow-y-auto bg-background/30 font-mono"
            >
              {events.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
                  Waiting for agent events...
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {renderedItems.map((item) => {
                    if (item.type === "slice_header") {
                      return (
                        <SliceContextHeader
                          key={item.key}
                          sliceName={item.sliceName}
                          status={item.status}
                        />
                      )
                    }
                    if (item.type === "test_card") {
                      return <TestResultCard key={item.event.id} event={item.event} />
                    }
                    return (
                      <EventRow
                        key={item.event.id}
                        event={item.event}
                        isLatest={item.isLatest}
                        showTimestamp={item.showTimestamp}
                      />
                    )
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col min-h-0">
          <TabsList className="mx-3 mt-2 h-8 bg-background/50 border border-border">
            <TabsTrigger value="events" className="text-xs gap-1">
              <List className="h-3 w-3" /> Events
            </TabsTrigger>
            <TabsTrigger value="browser" className="text-xs gap-1">
              <Globe className="h-3 w-3" /> Browser
            </TabsTrigger>
            {(screenshots?.length ?? 0) > 0 && (
              <TabsTrigger value="screenshots" className="text-xs gap-1">
                <Camera className="h-3 w-3" /> Screenshots ({screenshots?.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="events" className="relative flex-1 min-h-0 mt-0">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="absolute inset-0 overflow-y-auto bg-background/30 font-mono"
            >
              {events.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
                  Waiting for agent events...
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {renderedItems.map((item) => {
                    if (item.type === "slice_header") {
                      return (
                        <SliceContextHeader
                          key={item.key}
                          sliceName={item.sliceName}
                          status={item.status}
                        />
                      )
                    }
                    if (item.type === "test_card") {
                      return <TestResultCard key={item.event.id} event={item.event} />
                    }
                    return (
                      <EventRow
                        key={item.event.id}
                        event={item.event}
                        isLatest={item.isLatest}
                        showTimestamp={item.showTimestamp}
                      />
                    )
                  })}
                </AnimatePresence>
              )}
            </div>
            {!autoScroll && (
              <button
                type="button"
                onClick={jumpToBottom}
                aria-label="Jump to latest event"
                className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full bg-slate-grey/80 px-2.5 py-1 text-xs text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-grey focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <ChevronDown className="h-3 w-3" />
                Latest
              </button>
            )}
          </TabsContent>

          <TabsContent value="browser" className="flex-1 min-h-0 mt-0">
            <BrowserStreamPanel novncUrl={novncUrl ?? null} isActive={events.length > 0} />
          </TabsContent>

          <TabsContent value="screenshots" className="flex-1 min-h-0 mt-0 overflow-y-auto p-3">
            <ScreenshotGallery screenshots={screenshots ?? []} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
