"use client"

import { useEffect, useRef, useState } from "react"
import { Terminal } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface LogEntry {
  id: string
  content: string
  created_at: string
}

interface ProjectLogsProps {
  projectId: string
  status: string
}

export function ProjectLogs({ projectId, status }: ProjectLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPolling, setIsPolling] = useState(false)

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/logs`)
      if (res.ok) {
        const data = (await res.json()) as LogEntry[]
        setLogs(data)
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error)
    }
  }

  useEffect(() => {
    fetchLogs()

    // Poll logs if processing
    if (status === "processing" || status === "building") {
      setIsPolling(true)
      const interval = setInterval(fetchLogs, 2000)
      return () => clearInterval(interval)
    } else {
      setIsPolling(false)
    }
  }, [projectId, status])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [logs])

  if (logs.length === 0 && status !== "processing" && status !== "failed") return null

  return (
    <Card className="glass-card border-border/50 bg-black/40">
      <CardHeader className="pb-3 border-b border-white/5">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          Processing Logs
          {isPolling && (
            <span className="flex h-2 w-2 rounded-full bg-electric-cyan animate-pulse ml-auto" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] w-full p-4 font-mono text-xs" ref={scrollRef}>
          <div className="space-y-1.5">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-muted-foreground/80 hover:text-foreground/90 transition-colors">
                <span className="shrink-0 opacity-50 select-none">
                  {new Date(log.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={cn(
                  "break-all",
                  log.content.toLowerCase().includes("fail") || log.content.toLowerCase().includes("error")
                    ? "text-destructive"
                    : log.content.toLowerCase().includes("complete") || log.content.toLowerCase().includes("success")
                    ? "text-success"
                    : ""
                )}>
                  {log.content}
                </span>
              </div>
            ))}
            {isPolling && (
              <div className="flex gap-3 text-muted-foreground/50 animate-pulse">
                <span className="shrink-0 opacity-50">
                  {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span>_</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
