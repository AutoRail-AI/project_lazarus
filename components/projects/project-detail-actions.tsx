"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { MoreVertical, Pause, Play, RefreshCw, Trash2, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface ProjectDetailActionsProps {
  projectId: string
  projectName: string
  status: string
  pipelineStep?: string | null
  hasCheckpoint?: boolean
  errorContext?: {
    step: string
    message: string
    timestamp: string
    retryable: boolean
  } | null
}

const PROCESSING_STATUSES = ["processing", "building"]

export function ProjectDetailActions({
  projectId,
  projectName,
  status,
  pipelineStep,
  hasCheckpoint,
  errorContext,
}: ProjectDetailActionsProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isResuming, setIsResuming] = useState(false)
  const [isBuildingAll, setIsBuildingAll] = useState(false)

  const canStop = PROCESSING_STATUSES.includes(status)
  const canRetry = status === "failed"
  const canStart = status === "pending"
  const canResumeFromCheckpoint = (status === "paused" || status === "failed") && hasCheckpoint
  const canBuildAll = status === "ready"

  const handleStop = async () => {
    if (isStopping) return
    setIsStopping(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || "Failed to stop processing")
      }
      toast.success("Processing paused")
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
    } finally {
      setIsStopping(false)
    }
  }

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/retry`, {
        method: "POST",
      })
      if (!res.ok) {
        throw new Error("Failed to retry processing")
      }
      const data = (await res.json()) as { mode?: string }
      toast.success(`Processing ${data.mode === "resumed" ? "resumed from checkpoint" : "restarted"}`)
      router.refresh()
    } catch (error: unknown) {
      toast.error("Something went wrong")
    } finally {
      setIsRetrying(false)
    }
  }

  const handleResume = async () => {
    if (isResuming) return
    setIsResuming(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/resume`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || "Failed to resume processing")
      }
      toast.success("Processing resumed from checkpoint")
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
    } finally {
      setIsResuming(false)
    }
  }

  const handleBuildAll = async () => {
    if (isBuildingAll) return
    setIsBuildingAll(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/build`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || "Failed to start build pipeline")
      }
      toast.success("Build pipeline started for all slices")
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
    } finally {
      setIsBuildingAll(false)
    }
  }

  const handleStart = async () => {
    if (isStarting) return
    setIsStarting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/process`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? "Failed to start processing")
      }
      toast.success("Processing started")
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
    } finally {
      setIsStarting(false)
    }
  }

  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || "Failed to delete project")
      }
      toast.success("Project deleted")
      router.push("/projects")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
    } finally {
      setIsDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {canResumeFromCheckpoint && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResume}
            disabled={isResuming}
            className="border-primary/20 hover:bg-primary/10 text-primary"
          >
            <Play className={cn("mr-1.5 h-3.5 w-3.5", isResuming && "animate-pulse")} />
            {isResuming ? "Resuming..." : "Resume"}
          </Button>
        )}
        {canRetry && !canResumeFromCheckpoint && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="border-primary/20 hover:bg-primary/10 text-primary"
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isRetrying && "animate-spin")} />
            {isRetrying ? "Retrying..." : "Retry Processing"}
          </Button>
        )}
        {canBuildAll && (
          <Button
            size="sm"
            onClick={handleBuildAll}
            disabled={isBuildingAll}
            className="bg-rail-fade text-white hover:opacity-90 shadow-glow-purple"
          >
            <Zap className={cn("mr-1.5 h-3.5 w-3.5", isBuildingAll && "animate-pulse")} />
            {isBuildingAll ? "Starting..." : "Build All Slices"}
          </Button>
        )}
        {canStart && (
          <Button
            variant="default"
            size="sm"
            onClick={handleStart}
            disabled={isStarting}
            className="bg-electric-cyan text-primary-foreground hover:bg-electric-cyan/90"
          >
            <Play className={cn("mr-1.5 h-3.5 w-3.5", isStarting && "animate-pulse")} />
            {isStarting ? "Starting..." : "Start processing"}
          </Button>
        )}
        {canStop && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleStop}
            disabled={isStopping}
          >
            <Pause className="mr-1.5 h-3.5 w-3.5" />
            {isStopping ? "Pausing..." : "Pause"}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault()
                setDeleteOpen(true)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{projectName}&rdquo;? This will permanently
              remove the project and all its slices, assets, and events. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
