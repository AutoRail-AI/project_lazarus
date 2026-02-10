"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Edit3, Save, X, Loader2, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Simple syntax coloring via regex                                           */
/* -------------------------------------------------------------------------- */

const KEYWORD_RE =
  /\b(import|export|from|const|let|var|function|return|if|else|for|while|switch|case|default|break|continue|class|extends|new|this|typeof|instanceof|async|await|try|catch|finally|throw|interface|type|enum|implements|abstract|public|private|protected|static|readonly|override|declare|as|in|of|is|keyof|infer|never|void|null|undefined|true|false)\b/g
const STRING_RE = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g
const COMMENT_LINE_RE = /(\/\/.*$)/gm
const COMMENT_BLOCK_RE = /(\/\*[\s\S]*?\*\/)/g
const NUMBER_RE = /\b(\d+\.?\d*)\b/g
const JSX_TAG_RE = /(<\/?[A-Z]\w*)/g

interface TokenSpan {
  start: number
  end: number
  className: string
}

function tokenize(line: string): TokenSpan[] {
  const spans: TokenSpan[] = []

  function collect(re: RegExp, cls: string) {
    let m: RegExpExecArray | null = null
    re.lastIndex = 0
    while ((m = re.exec(line)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, className: cls })
    }
  }

  // Order matters: later spans override earlier ones at same position
  collect(NUMBER_RE, "text-warning/80")
  collect(KEYWORD_RE, "text-quantum-violet")
  collect(STRING_RE, "text-success")
  collect(COMMENT_LINE_RE, "text-muted-foreground/50 italic")
  collect(JSX_TAG_RE, "text-electric-cyan")

  // Sort by start, then by length desc (longer spans win)
  spans.sort((a, b) => a.start - b.start || b.end - a.end)
  return spans
}

function renderColoredLine(line: string): React.ReactNode {
  const spans = tokenize(line)
  if (spans.length === 0) return line

  // Remove overlapping spans (first one wins after sort)
  const used = new Set<number>()
  const filtered = spans.filter((s) => {
    for (let i = s.start; i < s.end; i++) {
      if (used.has(i)) return false
    }
    for (let i = s.start; i < s.end; i++) used.add(i)
    return true
  })

  filtered.sort((a, b) => a.start - b.start)

  const parts: React.ReactNode[] = []
  let pos = 0

  for (const span of filtered) {
    if (span.start > pos) {
      parts.push(line.slice(pos, span.start))
    }
    parts.push(
      <span key={span.start} className={span.className}>
        {line.slice(span.start, span.end)}
      </span>
    )
    pos = span.end
  }

  if (pos < line.length) {
    parts.push(line.slice(pos))
  }

  return parts
}

/* -------------------------------------------------------------------------- */
/*  FileViewer                                                                 */
/* -------------------------------------------------------------------------- */

interface FileViewerProps {
  projectId: string
  filePath: string
  onClose: () => void
  onDirtyChange?: (path: string, dirty: boolean) => void
}

export function FileViewer({
  projectId,
  filePath,
  onClose,
  onDirtyChange,
}: FileViewerProps) {
  const [content, setContent] = useState("")
  const [originalContent, setOriginalContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDirty = content !== originalContent

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(filePath, isDirty)
  }, [isDirty, filePath, onDirtyChange])

  // Fetch file content
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/projects/${projectId}/workspace/file?path=${encodeURIComponent(filePath)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load file")
        return res.json() as Promise<{ content: string; language: string }>
      })
      .then((data) => {
        if (cancelled) return
        setContent(data.content)
        setOriginalContent(data.content)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load file")
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [projectId, filePath])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/workspace/file`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content }),
      })
      if (!res.ok) throw new Error("Save failed")
      setOriginalContent(content)
      setEditing(false)
    } catch {
      setError("Failed to save file")
    } finally {
      setSaving(false)
    }
  }, [projectId, filePath, content])

  const handleCancel = useCallback(() => {
    setContent(originalContent)
    setEditing(false)
  }, [originalContent])

  const handleEdit = useCallback(() => {
    setEditing(true)
    // Focus textarea after render
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [])

  const lines = content.split("\n")
  const fileName = filePath.split("/").pop() ?? filePath

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border glass-panel">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
          <span className="font-mono text-xs text-foreground/80">{fileName}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-electric-cyan/50" />
        </div>
      </div>
    )
  }

  if (error && !content) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border glass-panel">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
          <span className="font-mono text-xs text-foreground/80">{fileName}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center text-xs text-error">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border glass-panel">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 shrink-0">
        <span className="font-mono text-xs text-foreground/80 truncate">{filePath}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {error && <span className="text-[10px] text-error">{error}</span>}
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-foreground/5 transition-colors"
              >
                <Undo2 className="h-3 w-3" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-colors",
                  isDirty
                    ? "bg-electric-cyan/20 text-electric-cyan hover:bg-electric-cyan/30"
                    : "text-muted-foreground/50"
                )}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-electric-cyan hover:bg-foreground/5 transition-colors"
            >
              <Edit3 className="h-3 w-3" />
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto bg-card/50">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="h-full w-full resize-none bg-transparent p-3 font-mono text-[11px] leading-5 text-foreground outline-none"
          />
        ) : (
          <motion.pre
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="p-0 font-mono text-[11px] leading-5"
          >
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-foreground/[0.02]">
                <span className="inline-block w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/30">
                  {i + 1}
                </span>
                <span className="text-foreground/90 break-all pr-3">
                  {renderColoredLine(line)}
                </span>
              </div>
            ))}
          </motion.pre>
        )}
      </div>
    </div>
  )
}
