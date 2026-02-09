"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Brain,
  Camera,
  CheckCircle,
  ChevronDown,
  Code,
  Eye,
  Globe,
  Play,
  RotateCw,
  Wrench,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentEvent } from "@/hooks/use-agent-events"
import type { AgentEventType } from "@/lib/db/types"

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
/*  Ghost Typer — character-by-character reveal for code_write                 */
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
    const speed = 15 // ms per char
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
/*  Simple syntax highlighting for code blocks                                 */
/* -------------------------------------------------------------------------- */

function highlightCode(code: string): string {
  return code
    // Keywords
    .replace(
      /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|new|async|await|try|catch|throw)\b/g,
      '<span class="text-electric-cyan">$1</span>'
    )
    // Strings
    .replace(
      /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
      '<span class="text-success">$1</span>'
    )
    // Comments
    .replace(
      /(\/\/.*$)/gm,
      '<span class="text-muted-foreground/50">$1</span>'
    )
}

/* -------------------------------------------------------------------------- */
/*  Single event row                                                           */
/* -------------------------------------------------------------------------- */

function EventRow({ event, isLatest }: { event: AgentEvent; isLatest: boolean }) {
  const config = EVENT_CONFIG[event.event_type]
  const Icon = isTestFail(event) ? XCircle : config.icon
  const colorClass = isTestFail(event) ? "text-error" : config.colorClass
  const isCode = event.event_type === "code_write"
  const isObservation = event.event_type === "observation"
  const isThought = event.event_type === "thought"

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex gap-2 px-3 py-1.5 text-xs",
        isObservation && "ml-6 opacity-70"
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", colorClass)} />
      <div className="min-w-0 flex-1">
        {isCode ? (
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
        ) : (
          <span className={cn("leading-relaxed", colorClass, isThought && "italic")}>
            {event.content}
          </span>
        )}
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Work Pane                                                                  */
/* -------------------------------------------------------------------------- */

interface WorkPaneProps {
  events: AgentEvent[]
}

export function WorkPane({ events }: WorkPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [glitch, setGlitch] = useState(false)
  const lastEventCountRef = useRef(0)

  // Auto-scroll to bottom
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

  // Glitch effect on test failure
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

  const jumpToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setAutoScroll(true)
    }
  }, [])

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

      {/* Event stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-background/30 font-mono"
      >
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
            Waiting for agent events...
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((event, i) => (
              <EventRow
                key={event.id}
                event={event}
                isLatest={i === events.length - 1 && event.event_type === "code_write"}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Jump to bottom FAB */}
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
    </div>
  )
}
