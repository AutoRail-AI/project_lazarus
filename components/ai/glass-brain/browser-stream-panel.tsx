"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Maximize2, Monitor, Wifi, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface BrowserStreamPanelProps {
  novncUrl: string | null
  isActive: boolean
}

type ConnectionStatus = "disconnected" | "connecting" | "connected"

export function BrowserStreamPanel({ novncUrl, isActive }: BrowserStreamPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")

  // Update connection status based on activity
  useEffect(() => {
    if (!novncUrl) {
      setConnectionStatus("disconnected")
      return
    }
    if (!isActive) {
      setConnectionStatus("disconnected")
      return
    }
    setConnectionStatus("connecting")
  }, [novncUrl, isActive])

  const handleIframeLoad = useCallback(() => {
    setLoading(false)
    setConnectionStatus("connected")
  }, [])

  const handleFullscreen = useCallback(() => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen()
    }
  }, [])

  // Placeholder: no URL configured
  if (!novncUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Monitor className="h-10 w-10 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium text-muted-foreground/60">
            Browser stream not configured
          </p>
          <p className="mt-1 text-xs text-muted-foreground/40">
            Set NEXT_PUBLIC_NOVNC_URL to enable live browser view
          </p>
        </div>
      </div>
    )
  }

  // Placeholder: waiting for session
  if (!isActive) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <motion.div
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Monitor className="h-10 w-10 text-electric-cyan/40" />
        </motion.div>
        <p className="text-sm text-muted-foreground/60">
          Waiting for browser session...
        </p>
      </div>
    )
  }

  const streamUrl = `${novncUrl}/vnc.html?autoconnect=true&resize=scale`

  return (
    <div ref={containerRef} className="relative flex h-full flex-col">
      {/* Connection status bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              connectionStatus === "connected" && "bg-success",
              connectionStatus === "connecting" && "animate-pulse bg-warning",
              connectionStatus === "disconnected" && "bg-error"
            )}
          />
          <span className="text-[10px] text-muted-foreground">
            {connectionStatus === "connected" && "Connected"}
            {connectionStatus === "connecting" && "Connecting..."}
            {connectionStatus === "disconnected" && "Disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {connectionStatus === "connected" ? (
            <Wifi className="h-3 w-3 text-success/60" />
          ) : (
            <WifiOff className="h-3 w-3 text-muted-foreground/40" />
          )}
          <button
            type="button"
            onClick={handleFullscreen}
            aria-label="Toggle fullscreen browser view"
            className="rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* iframe container */}
      <div className="relative flex-1 min-h-0">
        {/* Loading overlay */}
        {loading && (
          <motion.div
            className="absolute inset-0 z-10 flex items-center justify-center bg-background/80"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="h-6 w-6 rounded-full border-2 border-electric-cyan border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        )}

        <iframe
          ref={iframeRef}
          src={streamUrl}
          onLoad={handleIframeLoad}
          className="h-full w-full rounded-b border-0"
          allow="autoplay"
          title="Browser Live Stream"
        />
      </div>
    </div>
  )
}
