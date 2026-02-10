"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { ArrowDown, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { AgentEvent } from "@/hooks/use-agent-events"

/* -------------------------------------------------------------------------- */
/*  Event type → label + color                                                 */
/* -------------------------------------------------------------------------- */

const EVENT_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  thought:           { label: "THINK",   color: "text-muted-foreground" },
  tool_call:         { label: "TOOL",    color: "text-electric-cyan" },
  observation:       { label: "OBS",     color: "text-muted-foreground/60" },
  code_write:        { label: "WRITE",   color: "text-foreground" },
  test_run:          { label: "TEST",    color: "text-warning" },
  test_result:       { label: "PASS",    color: "text-success" },
  self_heal:         { label: "HEAL",    color: "text-quantum-violet" },
  confidence_update: { label: "CONF",    color: "text-electric-cyan" },
  browser_action:    { label: "BROWSER", color: "text-warning" },
  screenshot:        { label: "SNAP",    color: "text-quantum-violet" },
  app_start:         { label: "START",   color: "text-success" },
}

function getEventConfig(event: AgentEvent): { label: string; color: string } {
  const base = EVENT_CONFIG[event.event_type] ?? {
    label: event.event_type.toUpperCase(),
    color: "text-muted-foreground",
  }

  // Override test_result based on pass/fail
  if (event.event_type === "test_result") {
    const meta = event.metadata as Record<string, unknown> | null
    const passed = meta?.passed === true || meta?.result === "pass"
    return passed
      ? { label: "PASS", color: "text-success" }
      : { label: "FAIL", color: "text-error" }
  }

  return base
}

/* -------------------------------------------------------------------------- */
/*  Timestamp formatter                                                        */
/* -------------------------------------------------------------------------- */

function formatTimestamp(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, "0"))
      .join(":")
  } catch {
    return "??:??:??"
  }
}

/* -------------------------------------------------------------------------- */
/*  Format log content                                                         */
/* -------------------------------------------------------------------------- */

function formatContent(event: AgentEvent): string {
  if (event.event_type === "code_write") {
    const meta = event.metadata as Record<string, unknown> | null
    const file = (meta?.file as string) ?? null
    if (file) return `${file} — ${event.content}`
  }
  return event.content
}

/* -------------------------------------------------------------------------- */
/*  Log Line                                                                   */
/* -------------------------------------------------------------------------- */

function LogLine({ event }: { event: AgentEvent }) {
  const { label, color } = getEventConfig(event)
  const ts = formatTimestamp(event.created_at)

  return (
    <div className="flex gap-2 px-3 py-0.5 leading-5 hover:bg-foreground/[0.03]">
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground/40">
        {ts}
      </span>
      <span
        className={cn(
          "shrink-0 w-[52px] text-right font-mono text-[11px] font-semibold",
          color
        )}
      >
        {label}
      </span>
      <span className="font-mono text-[11px] text-foreground/80 break-all">
        {formatContent(event)}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  BuildConsole                                                               */
/* -------------------------------------------------------------------------- */

interface BuildConsoleProps {
  events: AgentEvent[]
}

export function BuildConsole({ events }: BuildConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setIsAtBottom(atBottom)
    setAutoScroll(atBottom)
  }, [])

  // Auto-scroll when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length, autoScroll])

  const jumpToLatest = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setAutoScroll(true)
      setIsAtBottom(true)
    }
  }, [])

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-electric-cyan/70" />
          <span className="font-grotesk text-sm font-semibold text-foreground">
            Build Console
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {events.length} events
        </span>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto bg-card/50 py-1"
      >
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50">
            Build output will appear here...
          </div>
        ) : (
          events.map((event) => <LogLine key={event.id} event={event} />)
        )}
      </div>

      {/* Jump to Latest */}
      {!isAtBottom && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-2 left-1/2 -translate-x-1/2"
        >
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 rounded-full border-electric-cyan/30 bg-card/90 px-3 text-[10px] text-electric-cyan backdrop-blur-sm"
            onClick={jumpToLatest}
          >
            <ArrowDown className="h-3 w-3" />
            Jump to Latest
          </Button>
        </motion.div>
      )}
    </div>
  )
}
