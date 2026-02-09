"use client"

import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle, ChevronDown, ChevronRight, XCircle } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { MCPToolCall } from "./derive-build-phase"

interface MCPToolInspectorProps {
  toolCalls: MCPToolCall[]
  isOpen: boolean
  onClose: () => void
}

function ToolCallCard({
  call,
  isExpanded,
  onToggle,
}: {
  call: MCPToolCall
  isExpanded: boolean
  onToggle: () => void
}) {
  const meta = call.event.metadata as Record<string, unknown> | null
  const borderColor =
    call.source === "left_brain"
      ? "border-l-electric-cyan"
      : call.source === "right_brain"
        ? "border-l-rail-purple"
        : "border-l-muted-foreground/30"

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "rounded border border-border border-l-2 bg-background/30 p-2.5",
        borderColor
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}

        {/* Tool name */}
        <span className="flex-1 truncate font-mono text-xs font-semibold text-foreground">
          {call.toolName}
        </span>

        {/* Source badge */}
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] px-1.5 py-0",
            call.source === "left_brain" && "border-electric-cyan/30 text-electric-cyan",
            call.source === "right_brain" && "border-rail-purple/30 text-quantum-violet",
            call.source === "builtin" && "border-border text-muted-foreground"
          )}
        >
          {call.source === "left_brain"
            ? "Code Analysis"
            : call.source === "right_brain"
              ? "App Behaviour"
              : "Built-in"}
        </Badge>

        {/* Duration */}
        {call.durationMs != null && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {call.durationMs}ms
          </span>
        )}

        {/* Status icon */}
        {call.status === "success" ? (
          <CheckCircle className="h-3 w-3 shrink-0 text-success" />
        ) : call.status === "error" ? (
          <XCircle className="h-3 w-3 shrink-0 text-error" />
        ) : (
          <div className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-electric-cyan/30" />
        )}
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {meta?.input != null && (
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
                Input
              </span>
              <pre className="mt-0.5 max-h-32 overflow-auto rounded bg-background/60 p-1.5 font-mono text-[10px] text-foreground/70">
                {typeof meta.input === "string"
                  ? meta.input
                  : JSON.stringify(meta.input, null, 2)}
              </pre>
            </div>
          )}
          {meta?.output != null && (
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
                Output
              </span>
              <pre className="mt-0.5 max-h-32 overflow-auto rounded bg-background/60 p-1.5 font-mono text-[10px] text-foreground/70">
                {typeof meta.output === "string"
                  ? meta.output
                  : JSON.stringify(meta.output, null, 2)}
              </pre>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            {call.event.content}
          </p>
        </div>
      )}
    </motion.div>
  )
}

export function MCPToolInspector({ toolCalls, isOpen, onClose }: MCPToolInspectorProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])

  const successCount = toolCalls.filter((c) => c.status === "success").length
  const successRate = toolCalls.length > 0
    ? Math.round((successCount / toolCalls.length) * 100)
    : 0

  const reversed = [...toolCalls].reverse()

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-96 border-border bg-background/95 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center justify-between font-grotesk text-sm text-foreground">
            <span>MCP Tool Inspector</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {toolCalls.length} calls
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  successRate >= 90
                    ? "border-success/30 text-success"
                    : successRate >= 70
                      ? "border-warning/30 text-warning"
                      : "border-error/30 text-error"
                )}
              >
                {successRate}% success
              </Badge>
            </div>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-60px)]">
          <div className="space-y-2 p-3">
            {reversed.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-muted-foreground/50">
                No MCP tool calls yet
              </div>
            ) : (
              reversed.map((call) => (
                <ToolCallCard
                  key={call.event.id}
                  call={call}
                  isExpanded={expandedIds.includes(call.event.id)}
                  onToggle={() => toggleExpand(call.event.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
