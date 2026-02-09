"use client"

import { useCallback, useMemo, useState } from "react"
import {
  ArrowRight,
  Calendar,
  Flag,
  GitBranch,
  RefreshCw,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Json } from "@/lib/db/types"
import type { Slice } from "./plan-types"
import { SliceStatusBadge } from "./slice-status-badge"
import { ConfidenceRing } from "./confidence-ring"
import { isBuildable } from "./plan-utils"

interface SliceDetailSheetProps {
  slice: Slice | null
  allSlices: Slice[]
  projectId: string
  open: boolean
  onClose: () => void
  onSliceSelect: (slice: Slice) => void
  onSliceUpdate: (slice: Slice) => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/* -------------------------------------------------------------------------- */
/*  JSON syntax-highlighted renderer                                           */
/* -------------------------------------------------------------------------- */

function JsonBlock({ data }: { data: Json }) {
  if (data == null) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No contract generated
      </p>
    )
  }

  const json = JSON.stringify(data, null, 2)

  // Simple syntax coloring via regex
  const highlighted = json
    .replace(
      /"([^"]+)"(?=\s*:)/g,
      '<span class="text-quantum-violet">"$1"</span>'
    )
    .replace(
      /:\s*"([^"]*)"/g,
      ': <span class="text-electric-cyan">"$1"</span>'
    )
    .replace(
      /:\s*(\d+\.?\d*)/g,
      ': <span class="text-success">$1</span>'
    )
    .replace(
      /:\s*(true|false|null)/g,
      ': <span class="text-warning">$1</span>'
    )

  return (
    <pre
      className="overflow-auto rounded-lg bg-background/50 p-4 font-mono text-xs leading-relaxed text-cloud-white"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  Dependency mini-card                                                       */
/* -------------------------------------------------------------------------- */

function DepMiniCard({
  slice,
  onClick,
}: {
  slice: Slice
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg border border-border bg-card/30 p-2 text-left transition-colors hover:bg-card/60"
    >
      <SliceStatusBadge status={slice.status} />
      <span className="flex-1 truncate text-sm font-medium">{slice.name}</span>
      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

export function SliceDetailSheet({
  slice,
  allSlices,
  projectId,
  open,
  onClose,
  onSliceSelect,
  onSliceUpdate,
}: SliceDetailSheetProps) {
  const [building, setBuilding] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const sliceMap = useMemo(() => {
    const map = new Map<string, Slice>()
    for (const s of allSlices) map.set(s.id, s)
    return map
  }, [allSlices])

  const canBuild = slice ? isBuildable(slice, allSlices) : false

  const upstreamSlices = useMemo(() => {
    if (!slice) return []
    return (slice.dependencies ?? [])
      .map((id) => sliceMap.get(id))
      .filter((s): s is Slice => s != null)
  }, [slice, sliceMap])

  const downstreamSlices = useMemo(() => {
    if (!slice) return []
    return allSlices.filter((s) =>
      (s.dependencies ?? []).includes(slice.id)
    )
  }, [slice, allSlices])

  const incompleteDeps = useMemo(
    () => upstreamSlices.filter((s) => s.status !== "complete").length,
    [upstreamSlices]
  )

  const modernizationFlags = useMemo(() => {
    if (!slice?.modernization_flags) return []
    const flags = slice.modernization_flags as Record<string, unknown>
    return Object.entries(flags)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
  }, [slice])

  const handleBuild = useCallback(async () => {
    if (!slice || building) return
    setBuilding(true)

    // Optimistic update
    const updated = { ...slice, status: "building" as const }
    onSliceUpdate(updated)

    try {
      const res = await fetch(
        `/api/projects/${projectId}/slices/${slice.id}/build`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("Build request failed")
      toast.success(`Building "${slice.name}"`)
    } catch (err: unknown) {
      // Revert
      onSliceUpdate(slice)
      const message = err instanceof Error ? err.message : "Build failed"
      toast.error(message)
    } finally {
      setBuilding(false)
    }
  }, [slice, building, projectId, onSliceUpdate])

  const handleRetrySlice = useCallback(async () => {
    if (!slice || retrying) return
    setRetrying(true)

    // Optimistic update
    const updated = { ...slice, status: "pending" as const }
    onSliceUpdate(updated)

    try {
      const res = await fetch(
        `/api/projects/${projectId}/slices/${slice.id}/retry`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("Retry request failed")
      toast.success(`Retrying "${slice.name}"`)
    } catch (err: unknown) {
      // Revert
      onSliceUpdate(slice)
      const message = err instanceof Error ? err.message : "Retry failed"
      toast.error(message)
    } finally {
      setRetrying(false)
    }
  }, [slice, retrying, projectId, onSliceUpdate])

  if (!slice) return null

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="glass-panel flex w-full flex-col overflow-hidden border-l border-border sm:max-w-lg"
      >
        <SheetHeader className="space-y-3">
          {/* Confidence ring + title */}
          <div className="flex items-center gap-3">
            <ConfidenceRing value={slice.confidence_score} size={64} animated />
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-grotesk text-xl">
                {slice.name}
              </SheetTitle>
              <div className="mt-1 flex items-center gap-2">
                <SliceStatusBadge status={slice.status} size="md" />
                <span className="rounded bg-slate-grey/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  P{slice.priority}
                </span>
              </div>
            </div>
          </div>

          {slice.description && (
            <SheetDescription className="text-sm text-muted-foreground">
              {slice.description}
            </SheetDescription>
          )}
        </SheetHeader>

        <Separator className="my-3" />

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex-1">
              Contracts
            </TabsTrigger>
            <TabsTrigger value="dependencies" className="flex-1">
              Dependencies
            </TabsTrigger>
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview" className="flex-1 overflow-auto">
            <div className="space-y-4 py-3">
              {/* Modernization flags */}
              {modernizationFlags.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Modernization Flags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {modernizationFlags.map((flag) => (
                      <span
                        key={flag}
                        className="inline-flex items-center gap-1 rounded-full border border-quantum-violet/20 bg-quantum-violet/10 px-2.5 py-0.5 text-xs text-quantum-violet"
                      >
                        <Flag className="h-3 w-3" />
                        {flag.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dependency summary */}
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5" />
                  Depends on {upstreamSlices.length} slice
                  {upstreamSlices.length !== 1 ? "s" : ""}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ArrowRight className="h-3.5 w-3.5" />
                  {downstreamSlices.length} slice
                  {downstreamSlices.length !== 1 ? "s" : ""} depend on this
                </div>
              </div>

              {/* Retry count */}
              {slice.retry_count > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-warning">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {slice.retry_count} {slice.retry_count === 1 ? "retry" : "retries"}
                </div>
              )}

              {/* Timestamps */}
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Created: {formatDate(slice.created_at)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Updated: {formatDate(slice.updated_at)}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Contracts tab */}
          <TabsContent value="contracts" className="flex-1 overflow-auto">
            <div className="space-y-4 py-3">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Behavioral Contract
                </h4>
                <JsonBlock data={slice.behavioral_contract} />
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Code Contract
                </h4>
                <JsonBlock data={slice.code_contract} />
              </div>
            </div>
          </TabsContent>

          {/* Dependencies tab */}
          <TabsContent value="dependencies" className="flex-1 overflow-auto">
            <div className="space-y-4 py-3">
              {/* Upstream */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  This slice depends on
                </h4>
                {upstreamSlices.length === 0 ? (
                  <p className="text-sm text-muted-foreground/60">
                    No dependencies — this is a root slice
                  </p>
                ) : (
                  <div className="space-y-2 border-l-2 border-border pl-3">
                    {upstreamSlices.map((dep) => (
                      <DepMiniCard
                        key={dep.id}
                        slice={dep}
                        onClick={() => onSliceSelect(dep)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Downstream */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  These slices depend on this
                </h4>
                {downstreamSlices.length === 0 ? (
                  <p className="text-sm text-muted-foreground/60">
                    No downstream dependents — this is a leaf slice
                  </p>
                ) : (
                  <div className="space-y-2 border-l-2 border-border pl-3">
                    {downstreamSlices.map((dep) => (
                      <DepMiniCard
                        key={dep.id}
                        slice={dep}
                        onClick={() => onSliceSelect(dep)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer: Build action */}
        <Separator className="my-3" />
        <div className="space-y-2 pb-2">
          <p
            className={cn(
              "text-center text-xs",
              incompleteDeps === 0
                ? "text-success"
                : "text-muted-foreground"
            )}
          >
            {incompleteDeps === 0
              ? `All ${upstreamSlices.length} dependencies complete`
              : `Waiting on ${incompleteDeps} ${incompleteDeps === 1 ? "dependency" : "dependencies"}`}
          </p>

          {canBuild ? (
            <Button
              className="w-full gap-2 bg-rail-fade text-white hover:opacity-90"
              onClick={handleBuild}
              disabled={building}
            >
              <Zap className="h-4 w-4" />
              {building ? "Starting Build..." : "Build This Slice"}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button className="w-full gap-2" disabled>
                    <Zap className="h-4 w-4" />
                    Build This Slice
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {slice.status === "complete"
                  ? "This slice is already complete"
                  : slice.status === "building" ||
                      slice.status === "testing" ||
                      slice.status === "self_healing"
                    ? "This slice is already in progress"
                    : "Dependencies must be complete before building"}
              </TooltipContent>
            </Tooltip>
          )}

          {slice.status === "failed" && (
            <Button
              variant="outline"
              className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={handleRetrySlice}
              disabled={retrying}
            >
              <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} />
              {retrying ? "Retrying..." : "Retry This Slice"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
