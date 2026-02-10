"use client"

import { ProjectLogs } from "@/components/projects/project-logs"
import { ProjectDetailActions } from "@/components/projects/project-detail-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Database } from "@/lib/db/types"
import type { PipelineCheckpoint } from "@/lib/pipeline/types"
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Pause,
  Terminal,
} from "lucide-react"
import Link from "next/link"

type Project = Database["public"]["Tables"]["projects"]["Row"]
type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

interface ErrorContextData {
  step: string
  message: string
  timestamp: string
  retryable: boolean
}

interface OverviewViewProps {
  project: Project
  slices: Slice[]
  projectId: string
  onAction?: () => void
  /** When set, shows a "View Build Log" button to switch back to Glass Brain */
  onShowBuildLog?: () => void
}

const statusConfig = {
  pending: { label: "Pending", className: "bg-slate-grey/10 text-muted-foreground border-border", Icon: Clock },
  processing: { label: "Processing", className: "bg-electric-cyan/10 text-electric-cyan border-electric-cyan/20", Icon: Activity },
  analyzed: { label: "Analyzed", className: "bg-electric-cyan/10 text-electric-cyan border-electric-cyan/20", Icon: CheckCircle2 },
  ready: { label: "Ready", className: "bg-rail-purple/10 text-quantum-violet border-rail-purple/20", Icon: CheckCircle2 },
  building: { label: "Building", className: "bg-warning/10 text-warning border-warning/20", Icon: Activity },
  complete: { label: "Complete", className: "bg-success/10 text-success border-success/20", Icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/20", Icon: AlertCircle },
  paused: { label: "Paused", className: "bg-warning/10 text-warning border-warning/20", Icon: Pause },
}

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

export function OverviewView({ project, slices, projectId, onAction, onShowBuildLog }: OverviewViewProps) {
  const checkpoint = project.pipeline_checkpoint as PipelineCheckpoint | null
  const hasCheckpoint = !!(
    checkpoint &&
    Array.isArray(checkpoint.completed_steps) &&
    checkpoint.completed_steps.length > 0
  )
  // In demo mode we never show pipeline errors — keep the magic
  const errorContext = isDemoMode ? null : (project.error_context as ErrorContextData | null)

  // In demo mode treat "failed" as a soft state — show Ready so we don't break the magic
  const effectiveStatus = isDemoMode && project.status === "failed" ? "ready" : project.status
  const config = statusConfig[effectiveStatus as keyof typeof statusConfig] ?? statusConfig.pending
  const StatusIcon = config.Icon

  const pipelineStepLabel = project.pipeline_step
    ? project.pipeline_step.startsWith("slice:")
      ? "Building slice"
      : project.pipeline_step.replace(/_/g, " ")
    : null

  return (
    <div className="space-y-6 py-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-grotesk text-2xl font-bold text-foreground">
            {project.name}
          </h1>
          {project.description && (
            <p className="text-sm text-muted-foreground max-w-2xl">
              {project.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Badge variant="outline" className={config.className}>
              <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
              {config.label}
            </Badge>
            {pipelineStepLabel && (project.status === "processing" || project.status === "building") && (
              <span className="text-xs text-muted-foreground">
                &mdash; {pipelineStepLabel}
              </span>
            )}
            {project.confidence_score > 0 && (
              <span className="text-sm text-muted-foreground">
                Confidence: {Math.round(project.confidence_score * 100)}%
              </span>
            )}
            {slices.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {slices.filter((s) => s.status === "complete").length}/{slices.length} slices complete
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onShowBuildLog && (
            <Button size="sm" variant="outline" onClick={onShowBuildLog} className="gap-2">
              <Terminal className="h-4 w-4" />
              View Build Log
            </Button>
          )}
          {(project.status === "ready" || project.status === "complete") && (
            <Button size="sm" asChild className="bg-rail-fade hover:opacity-90 shadow-glow-purple">
              <Link href={`/projects/${projectId}/plan`} className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                View Plan
              </Link>
            </Button>
          )}
          <ProjectDetailActions
            projectId={projectId}
            projectName={project.name}
            status={effectiveStatus}
            pipelineStep={project.pipeline_step}
            hasCheckpoint={hasCheckpoint}
            errorContext={errorContext}
          />
        </div>
      </div>

      {errorContext && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-destructive text-sm">
                    Pipeline Error at &ldquo;{errorContext.step.replace(/_/g, " ")}&rdquo;
                  </h3>
                  {errorContext.retryable && (
                    <Badge variant="outline" className="text-xs border-warning/30 text-warning">
                      Retryable
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground break-words">
                  {errorContext.message}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {new Date(errorContext.timestamp).toLocaleString("en-US", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ProjectLogs projectId={projectId} status={project.status} />

      <Card className="glass-card">
        <CardContent className="pt-6">
          <h2 className="font-grotesk text-lg font-semibold text-foreground mb-4">
            Vertical Slices
          </h2>
          {slices.length > 0 ? (
            <ul className="space-y-2">
              {slices.map((slice) => (
                <li
                  key={slice.id}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-foreground">{slice.name}</span>
                  <Badge variant="outline" className="capitalize text-muted-foreground">
                    {slice.status}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {project.status === "processing" ? (
                <>
                  <Activity className="h-10 w-10 text-electric-cyan animate-pulse mb-4" />
                  <h3 className="text-lg font-medium text-foreground">Analysis in Progress</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    We&apos;re analyzing your codebase and generating vertical slices. This may take a few minutes.
                  </p>
                </>
              ) : project.status === "failed" ? (
                <>
                  {isDemoMode ? (
                    <>
                      <LayoutGrid className="h-10 w-10 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium text-foreground">Ready to continue</h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                        Review the plan and start building slices when you&apos;re ready.
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-10 w-10 text-destructive mb-4" />
                      <h3 className="text-lg font-medium text-foreground">Processing Failed</h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                        Something went wrong during analysis. Please check the logs above for details and try again.
                      </p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <LayoutGrid className="h-10 w-10 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-foreground">No Slices Yet</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    Vertical slices will appear here once processing is complete.
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
