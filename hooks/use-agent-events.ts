"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Database, AgentEventType } from "@/lib/db/types"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useSoundEffects } from "./use-sound-effects"

export type AgentEvent = Database["public"]["Tables"]["agent_events"]["Row"]

interface UseAgentEventsOptions {
  /** Initial confidence score (0-1) from the project/slice */
  initialConfidence?: number
  /** Enable sound effects for events */
  soundEnabled?: boolean
}

interface UseAgentEventsReturn {
  events: AgentEvent[]
  latestThought: AgentEvent | null
  confidence: number
  muted: boolean
  toggleMute: () => void
  /** The currently building slice ID (from the most recent building-related event) */
  activeSliceId: string | null
}

export function useAgentEvents(
  projectId: string,
  options: UseAgentEventsOptions = {}
): UseAgentEventsReturn {
  const { initialConfidence = 0, soundEnabled: initialSoundEnabled = true } = options

  const [events, setEvents] = useState<AgentEvent[]>([])
  const [latestThought, setLatestThought] = useState<AgentEvent | null>(null)
  const [confidence, setConfidence] = useState(initialConfidence)
  const [activeSliceId, setActiveSliceId] = useState<string | null>(null)
  const [muted, setMuted] = useState(!initialSoundEnabled)

  const supabase = useSupabase()
  const sounds = useSoundEffects({ soundEnabled: !muted })
  const lastTimestampRef = useRef<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const isRealtimeRef = useRef(false)

  const processEvent = useCallback(
    (event: AgentEvent) => {
      setEvents((prev) => {
        // Deduplicate by ID
        if (prev.some((e) => e.id === event.id)) return prev
        return [...prev, event]
      })

      // Track latest timestamp for polling
      lastTimestampRef.current = event.created_at

      // Track latest thought
      if (event.event_type === "thought") {
        setLatestThought(event)
      }

      // Track active slice
      if (event.slice_id) {
        setActiveSliceId(event.slice_id)
      }

      // Accumulate confidence
      if (event.confidence_delta != null) {
        setConfidence((prev) => Math.max(0, Math.min(1, prev + event.confidence_delta!)))
      }

      // Sound effects
      playSoundForEvent(event.event_type, event.metadata, sounds)
    },
    [sounds]
  )

  // Try Supabase Realtime; fall back to polling
  useEffect(() => {
    if (!supabase) {
      startPolling()
      return () => stopPolling()
    }

    try {
      const channel = supabase
        .channel(`agent-events-${projectId}`)
        .on(
          "postgres_changes" as any,
          {
            event: "INSERT",
            schema: "public",
            table: "agent_events",
            filter: `project_id=eq.${projectId}`,
          },
          (payload: { new: AgentEvent }) => {
            processEvent(payload.new)
          }
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            isRealtimeRef.current = true
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            isRealtimeRef.current = false
            startPolling()
          }
        })

      // Also do initial fetch to get existing events
      fetchExistingEvents()

      return () => {
        supabase.removeChannel(channel)
        stopPolling()
      }
    } catch {
      // Realtime failed, fall back to polling
      startPolling()
      return () => stopPolling()
    }

    function startPolling() {
      if (pollingRef.current) return
      // Initial fetch
      fetchExistingEvents()
      pollingRef.current = setInterval(() => {
        pollEvents()
      }, 1000)
    }

    function stopPolling() {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = undefined
      }
    }

    async function fetchExistingEvents() {
      try {
        const res = await fetch(`/api/projects/${projectId}/events`)
        if (!res.ok) return
        const data = (await res.json()) as AgentEvent[]
        if (Array.isArray(data)) {
          for (const event of data) {
            processEvent(event)
          }
        }
      } catch {
        // Silently fail
      }
    }

    async function pollEvents() {
      try {
        const after = lastTimestampRef.current
        const url = after
          ? `/api/projects/${projectId}/events?after=${encodeURIComponent(after)}`
          : `/api/projects/${projectId}/events`
        const res = await fetch(url)
        if (!res.ok) return
        const data = (await res.json()) as AgentEvent[]
        if (Array.isArray(data)) {
          for (const event of data) {
            processEvent(event)
          }
        }
      } catch {
        // Silently fail
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, supabase])

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev)
  }, [])

  return {
    events,
    latestThought,
    confidence,
    muted,
    toggleMute,
    activeSliceId,
  }
}

function playSoundForEvent(
  eventType: AgentEventType,
  metadata: AgentEvent["metadata"],
  sounds: ReturnType<typeof useSoundEffects>
) {
  switch (eventType) {
    case "code_write":
      sounds.playKeystroke()
      break
    case "test_result": {
      const meta = metadata as Record<string, unknown> | null
      if (meta?.passed === true || meta?.result === "pass") {
        sounds.playSuccess()
      } else {
        sounds.playError()
      }
      break
    }
    case "self_heal":
      sounds.playHeal()
      break
    case "confidence_update":
      sounds.playConfidenceTick()
      break
    case "browser_action":
      sounds.playKeystroke()
      break
    case "screenshot":
      sounds.playSuccess()
      break
    case "app_start":
      sounds.playConfidenceTick()
      break
    default:
      break
  }
}
