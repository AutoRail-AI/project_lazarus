"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  Globe,
  MousePointerClick,
  Eye,
  ExternalLink,
  Navigation,
  Type,
  CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentEvent } from "@/hooks/use-agent-events"
import { ScreenshotGallery } from "./screenshot-gallery"
import { timeAgo } from "./derive-stats"

/* -------------------------------------------------------------------------- */
/*  Browser action icon helper                                                 */
/* -------------------------------------------------------------------------- */

function getActionIcon(action: string) {
  if (action.includes("navigate") || action.includes("goto")) return Navigation
  if (action.includes("click") || action.includes("press")) return MousePointerClick
  if (action.includes("type") || action.includes("fill") || action.includes("input")) return Type
  if (action.includes("assert") || action.includes("expect") || action.includes("verify")) return CheckCircle
  if (action.includes("screenshot") || action.includes("capture")) return Eye
  return Globe
}

/* -------------------------------------------------------------------------- */
/*  BrowserTestPanel                                                           */
/* -------------------------------------------------------------------------- */

interface BrowserTestPanelProps {
  projectId: string
  events: AgentEvent[]
}

export function BrowserTestPanel({ events }: BrowserTestPanelProps) {
  const screenshotEvents = useMemo(
    () => events.filter((e) => e.event_type === "screenshot"),
    [events]
  )

  const browserActions = useMemo(
    () => events.filter((e) => e.event_type === "browser_action"),
    [events]
  )

  const appStartEvent = useMemo(
    () => events.find((e) => e.event_type === "app_start"),
    [events]
  )

  const appUrl = useMemo(() => {
    if (!appStartEvent) return null
    const meta = appStartEvent.metadata as Record<string, unknown> | null
    return (meta?.url as string) ?? (meta?.preview_url as string) ?? null
  }, [appStartEvent])

  const hasContent =
    screenshotEvents.length > 0 || browserActions.length > 0 || appStartEvent

  if (!hasContent) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border glass-panel">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-electric-cyan/70" />
            <span className="font-grotesk text-sm font-semibold text-foreground">
              Browser Testing
            </span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <Globe className="mx-auto h-10 w-10 text-muted-foreground/20" />
            <p className="mt-3 text-sm text-muted-foreground/60">
              Browser testing results will appear here
            </p>
            <p className="mt-1 text-xs text-muted-foreground/40">
              Screenshots and browser actions are captured during E2E tests
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-electric-cyan/70" />
          <span className="font-grotesk text-sm font-semibold text-foreground">
            Browser Testing
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {screenshotEvents.length} screenshots
          </span>
          {appUrl && (
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded bg-electric-cyan/10 px-2 py-0.5 text-[10px] text-electric-cyan hover:bg-electric-cyan/20 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open App
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {/* Screenshots */}
        {screenshotEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <ScreenshotGallery screenshots={screenshotEvents} />
          </motion.div>
        )}

        {/* Browser Actions Log */}
        {browserActions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className={cn(screenshotEvents.length > 0 && "mt-4")}
          >
            <h3 className="mb-2 font-grotesk text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              Browser Actions
            </h3>
            <div className="space-y-0.5">
              {browserActions.map((action) => {
                const meta = action.metadata as Record<string, unknown> | null
                const actionType = (meta?.action as string) ?? action.content
                const Icon = getActionIcon(actionType.toLowerCase())

                return (
                  <div
                    key={action.id}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-foreground/[0.03]"
                  >
                    <Icon className="h-3 w-3 shrink-0 text-electric-cyan/50" />
                    <span className="flex-1 truncate font-mono text-[11px] text-foreground/80">
                      {action.content}
                    </span>
                    <span className="shrink-0 text-[9px] text-muted-foreground/40">
                      {timeAgo(action.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
