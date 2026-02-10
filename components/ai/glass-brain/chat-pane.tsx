"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { motion } from "framer-motion"
import { Brain, FileCode, SendHorizontal, User } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { AgentEvent } from "@/hooks/use-agent-events"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ChatMessage {
  id: string
  role: "assistant" | "user"
  content: string
  timestamp: string
  filesModified?: string[]
}

/* -------------------------------------------------------------------------- */
/*  Typing indicator                                                           */
/* -------------------------------------------------------------------------- */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <Brain className="h-3 w-3 text-electric-cyan/60" />
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-electric-cyan/50"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  ChatPane                                                                   */
/* -------------------------------------------------------------------------- */

interface ChatPaneProps {
  projectId: string
  events: AgentEvent[]
}

export function ChatPane({ projectId, events }: ChatPaneProps) {
  const [userMessages, setUserMessages] = useState<ChatMessage[]>([])
  const [aiReplies, setAiReplies] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Derive assistant messages from thought/self_heal events
  const eventMessages = useMemo<ChatMessage[]>(
    () =>
      events
        .filter(
          (e) => e.event_type === "thought" || e.event_type === "self_heal"
        )
        .map((e) => ({
          id: e.id,
          role: "assistant" as const,
          content: e.content,
          timestamp: e.created_at,
        })),
    [events]
  )

  // Merge all messages sorted by timestamp
  const allMessages = useMemo(() => {
    const merged = [...eventMessages, ...userMessages, ...aiReplies]
    merged.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    return merged
  }, [eventMessages, userMessages, aiReplies])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [allMessages.length])

  const handleSend = useCallback(async () => {
    const message = input.trim()
    if (!message || isLoading) return

    setInput("")

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    }
    setUserMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || `HTTP ${res.status}`)
      }

      const data = (await res.json()) as {
        reply: string
        filesModified: string[]
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toISOString(),
        filesModified:
          data.filesModified.length > 0 ? data.filesModified : undefined,
      }
      setAiReplies((prev) => [...prev, aiMsg])
    } catch (err: unknown) {
      toast.error(
        `Chat failed: ${err instanceof Error ? err.message : "Unknown error"}`
      )
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, projectId])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  const handleInputChange = (value: string) => {
    setInput(value)
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-electric-cyan/70" />
          <span className="font-grotesk text-sm font-semibold text-foreground">
            Chat
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {allMessages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2"
      >
        {allMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50">
            AI thoughts and chat will appear here...
          </div>
        ) : (
          allMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2 max-w-[95%]",
                msg.role === "user" ? "ml-auto flex-row-reverse" : ""
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "shrink-0 flex h-5 w-5 items-center justify-center rounded-full mt-0.5",
                  msg.role === "assistant"
                    ? "bg-electric-cyan/10"
                    : "bg-foreground/10"
                )}
              >
                {msg.role === "assistant" ? (
                  <Brain className="h-3 w-3 text-electric-cyan/70" />
                ) : (
                  <User className="h-3 w-3 text-foreground/60" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
                  msg.role === "assistant"
                    ? "bg-card/50 text-foreground/80"
                    : "bg-electric-cyan/15 text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Files modified list */}
                {msg.filesModified && msg.filesModified.length > 0 && (
                  <div className="mt-1.5 border-t border-border/30 pt-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Files modified:
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {msg.filesModified.map((f) => (
                        <div
                          key={f}
                          className="flex items-center gap-1 text-[10px] text-electric-cyan/80"
                        >
                          <FileCode className="h-2.5 w-2.5" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && <TypingIndicator />}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask to modify code..."
            rows={1}
            className="flex-1 resize-none rounded-md border border-border bg-card/50 px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-electric-cyan/40 focus:outline-none"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            <SendHorizontal
              className={cn(
                "h-3.5 w-3.5",
                input.trim()
                  ? "text-electric-cyan"
                  : "text-muted-foreground/40"
              )}
            />
          </Button>
        </div>
        <p className="mt-1 text-[9px] text-muted-foreground/40">
          Enter to send, Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}
