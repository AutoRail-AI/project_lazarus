"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  ChevronRight,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentEvent } from "@/hooks/use-agent-events"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children: FileNode[]
  linesAdded: number
  isRecent: boolean
  healFix: boolean
}

/** Shape returned from the /api/projects/[id]/workspace endpoint */
interface APIFileEntry {
  name: string
  path: string
  type: "file" | "directory"
  children: APIFileEntry[]
}

/* -------------------------------------------------------------------------- */
/*  Convert API tree → FileNode tree (no event data yet)                       */
/* -------------------------------------------------------------------------- */

function apiToFileNodes(entries: APIFileEntry[]): FileNode[] {
  return entries.map((e) => ({
    name: e.name,
    path: e.path,
    type: e.type,
    children: e.type === "directory" ? apiToFileNodes(e.children) : [],
    linesAdded: 0,
    isRecent: false,
    healFix: false,
  }))
}

/* -------------------------------------------------------------------------- */
/*  Merge code_write event data onto the file tree                             */
/* -------------------------------------------------------------------------- */

function mergeEventData(
  tree: FileNode[],
  eventMap: Map<string, { linesAdded: number; lastWriteMs: number; healFix: boolean }>,
  now: number,
  recentMs: number
): void {
  for (const node of tree) {
    if (node.type === "file") {
      const info = eventMap.get(node.path)
      if (info) {
        node.linesAdded = info.linesAdded
        node.isRecent = now - info.lastWriteMs < recentMs
        node.healFix = info.healFix
      }
    }
    if (node.children.length > 0) {
      mergeEventData(node.children, eventMap, now, recentMs)
    }
  }
}

/**
 * Build event-only nodes for files in code_write events that don't exist
 * in the API tree (e.g. newly created files that haven't been fetched yet).
 */
function buildEventOnlyTree(
  eventMap: Map<string, { linesAdded: number; lastWriteMs: number; healFix: boolean }>,
  existingPaths: Set<string>,
  now: number,
  recentMs: number
): FileNode[] {
  const root: FileNode[] = []

  for (const [filePath, info] of Array.from(eventMap.entries())) {
    if (existingPaths.has(filePath)) continue

    const parts = filePath.split("/").filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!
      const isFile = i === parts.length - 1
      const pathSoFar = parts.slice(0, i + 1).join("/")

      let existing = current.find((n) => n.name === part)
      if (!existing) {
        existing = {
          name: part,
          path: pathSoFar,
          type: isFile ? "file" : "directory",
          children: [],
          linesAdded: isFile ? info.linesAdded : 0,
          isRecent: isFile ? now - info.lastWriteMs < recentMs : false,
          healFix: isFile ? info.healFix : false,
        }
        current.push(existing)
      }
      current = existing.children
    }
  }

  return root
}

function mergeTrees(base: FileNode[], overlay: FileNode[]): FileNode[] {
  for (const oNode of overlay) {
    const existing = base.find((n) => n.name === oNode.name && n.type === oNode.type)
    if (existing) {
      if (existing.type === "directory") {
        existing.children = mergeTrees(existing.children, oNode.children)
      }
    } else {
      base.push(oNode)
    }
  }
  return sortTree(base)
}

function sortTree(nodes: FileNode[]): FileNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const node of nodes) {
    if (node.children.length > 0) sortTree(node.children)
  }
  return nodes
}

/* -------------------------------------------------------------------------- */
/*  Collect all file paths from tree                                           */
/* -------------------------------------------------------------------------- */

function collectPaths(nodes: FileNode[]): Set<string> {
  const paths = new Set<string>()
  function walk(n: FileNode[]): void {
    for (const node of n) {
      if (node.type === "file") paths.add(node.path)
      walk(node.children)
    }
  }
  walk(nodes)
  return paths
}

function countFiles(nodes: FileNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === "file") count++
    else count += countFiles(node.children)
  }
  return count
}

function getRecentPaths(nodes: FileNode[]): Set<string> {
  const paths = new Set<string>()
  function walk(n: FileNode[]): void {
    for (const node of n) {
      if (node.isRecent) {
        const parts = node.path.split("/")
        for (let i = 1; i < parts.length; i++) {
          paths.add(parts.slice(0, i).join("/"))
        }
      }
      walk(node.children)
    }
  }
  walk(nodes)
  return paths
}

/* -------------------------------------------------------------------------- */
/*  Build event map from code_write events                                     */
/* -------------------------------------------------------------------------- */

function buildEventMap(events: AgentEvent[]) {
  const map = new Map<
    string,
    { linesAdded: number; lastWriteMs: number; healFix: boolean }
  >()

  for (const event of events) {
    if (event.event_type !== "code_write") continue
    const meta = event.metadata as Record<string, unknown> | null
    const filePath = (meta?.file as string) ?? null
    if (!filePath) continue

    const existing = map.get(filePath)
    const lines = (meta?.lines_added as number) ?? 0
    const isHeal = (meta?.heal_fix as boolean) ?? false
    const eventTime = new Date(event.created_at).getTime()

    if (existing) {
      existing.linesAdded += lines
      existing.lastWriteMs = Math.max(existing.lastWriteMs, eventTime)
      if (isHeal) existing.healFix = true
    } else {
      map.set(filePath, { linesAdded: lines, lastWriteMs: eventTime, healFix: isHeal })
    }
  }

  return map
}

/* -------------------------------------------------------------------------- */
/*  File icon helper                                                           */
/* -------------------------------------------------------------------------- */

function getFileIcon(name: string) {
  if (name.endsWith(".tsx") || name.endsWith(".ts") || name.endsWith(".jsx") || name.endsWith(".js")) {
    return <FileCode className="h-3.5 w-3.5 text-electric-cyan" />
  }
  if (name.includes(".test.") || name.includes(".spec.")) {
    return <FileCode className="h-3.5 w-3.5 text-warning" />
  }
  return <FileText className="h-3.5 w-3.5 text-muted-foreground" />
}

function getFileColor(name: string, healFix: boolean): string {
  if (healFix) return "text-quantum-violet"
  if (name.includes(".test.") || name.includes(".spec.")) return "text-warning"
  if (name.endsWith(".tsx") || name.endsWith(".ts")) return "text-electric-cyan"
  return "text-foreground/80"
}

/* -------------------------------------------------------------------------- */
/*  TreeNode                                                                   */
/* -------------------------------------------------------------------------- */

function TreeNode({
  node,
  expanded,
  toggleExpand,
  depth,
  onFileSelect,
  selectedPath,
}: {
  node: FileNode
  expanded: Set<string>
  toggleExpand: (path: string) => void
  depth: number
  onFileSelect?: (path: string) => void
  selectedPath?: string
}) {
  const isOpen = expanded.has(node.path)

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => toggleExpand(node.path)}
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-foreground/5 transition-colors"
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform",
              isOpen && "rotate-90"
            )}
          />
          {isOpen ? (
            <FolderOpen className="h-3.5 w-3.5 text-electric-cyan/70" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-electric-cyan/70" />
          )}
          <span className="truncate text-xs text-foreground/70">{node.name}</span>
        </button>
        {isOpen && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                expanded={expanded}
                toggleExpand={toggleExpand}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isSelected = selectedPath === node.path

  return (
    <button
      type="button"
      onClick={() => onFileSelect?.(node.path)}
      className={cn(
        "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left transition-colors",
        node.isRecent && !isSelected && "border-l-2 border-electric-cyan/50 bg-electric-cyan/5",
        isSelected && "border-l-2 border-electric-cyan bg-electric-cyan/10",
        !isSelected && "hover:bg-foreground/5"
      )}
      style={{ paddingLeft: depth * 12 + 20 }}
    >
      {getFileIcon(node.name)}
      <span className={cn("truncate text-xs", getFileColor(node.name, node.healFix))}>
        {node.name}
      </span>
      {node.linesAdded > 0 && (
        <span className="ml-auto shrink-0 rounded bg-foreground/10 px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
          +{node.linesAdded}
        </span>
      )}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  WorkspaceExplorer                                                          */
/* -------------------------------------------------------------------------- */

interface WorkspaceExplorerProps {
  projectId: string
  events: AgentEvent[]
  onFileSelect?: (path: string) => void
  selectedPath?: string
}

export function WorkspaceExplorer({ projectId, events, onFileSelect, selectedPath }: WorkspaceExplorerProps) {
  const [apiTree, setApiTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  // Fetch the real workspace file tree from the API
  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/workspace`)
      if (!res.ok) return
      const data = (await res.json()) as { tree: APIFileEntry[]; exists: boolean }
      if (data.exists) {
        setApiTree(apiToFileNodes(data.tree))
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Fetch on mount, then re-fetch every 30s
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchTree()
    }
    const interval = setInterval(fetchTree, 30_000)
    return () => clearInterval(interval)
  }, [fetchTree])

  // Also re-fetch when new code_write events arrive
  const codeWriteCount = useMemo(
    () => events.filter((e) => e.event_type === "code_write").length,
    [events]
  )
  const prevCodeWriteRef = useRef(0)
  useEffect(() => {
    if (codeWriteCount > prevCodeWriteRef.current && fetchedRef.current) {
      prevCodeWriteRef.current = codeWriteCount
      // Small delay to let the file be written to disk
      const timer = setTimeout(fetchTree, 2000)
      return () => clearTimeout(timer)
    }
  }, [codeWriteCount, fetchTree])

  // Build event data map
  const eventMap = useMemo(() => buildEventMap(events), [events])

  // Merge API tree + event data + event-only files
  const tree = useMemo(() => {
    const now = Date.now()
    const RECENT_MS = 10_000

    // Deep clone the API tree so we don't mutate state
    const cloned = JSON.parse(JSON.stringify(apiTree)) as FileNode[]

    // Apply event data (lines, recent, heal) to existing files
    mergeEventData(cloned, eventMap, now, RECENT_MS)

    // Add files from events that don't exist in the API tree
    const existingPaths = collectPaths(cloned)
    const eventOnly = buildEventOnlyTree(eventMap, existingPaths, now, RECENT_MS)

    return mergeTrees(cloned, eventOnly)
  }, [apiTree, eventMap])

  const fileCount = useMemo(() => countFiles(tree), [tree])
  const recentPaths = useMemo(() => getRecentPaths(tree), [tree])

  const [expanded, setExpanded] = useState<Set<string>>(new Set<string>())

  // Auto-expand newly modified paths
  useEffect(() => {
    if (recentPaths.size > 0) {
      setExpanded((prev) => {
        const next = new Set(prev)
        for (const p of Array.from(recentPaths)) {
          next.add(p)
        }
        return next
      })
    }
  }, [recentPaths])

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
        <span className="font-grotesk text-sm font-semibold text-foreground">
          Workspace
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {fileCount} files
          </span>
          <button
            onClick={fetchTree}
            className="text-muted-foreground/50 hover:text-electric-cyan transition-colors"
            title="Refresh file tree"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {loading && tree.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50">
            Loading workspace...
          </div>
        ) : tree.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50">
            No workspace found. Start a build first.
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {tree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                expanded={expanded}
                toggleExpand={toggleExpand}
                depth={0}
                onFileSelect={onFileSelect}
                selectedPath={selectedPath}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
