"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowRight,
  Bug,
  CheckCircle2,
  ChevronRight,
  Code2,
  Eye,
  FileCode,
  FunctionSquare,
  GitBranch,
  Globe,
  Layers,
  Link as LinkIcon,
  Monitor,
  Route,
  ShieldAlert,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BreathingGlow } from "@/components/ai/glass-brain/ambient-effects"
import { ProjectImmersiveActions } from "./project-immersive-actions"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/db/types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

interface AnalysisConfigViewProps {
  projectId: string
  project: Project
  onConfigure: () => void
}

/* -------------------------------------------------------------------------- */
/*  Data extraction helpers                                                    */
/* -------------------------------------------------------------------------- */

interface CodeAnalysisData {
  stats?: {
    totalFiles?: number
    totalFunctions?: number
    totalClasses?: number
    totalInterfaces?: number
    totalRelationships?: number
    languages?: string[]
    justificationCoverage?: number
  }
  featureMap?: {
    totalFeatures?: number
    totalEntities?: number
    features?: Array<{
      name: string
      entityCount: number
      fileCount: number
      entities?: Array<{
        id: string
        name: string
        kind: string
        filePath: string
        justification?: string
      }>
    }>
  }
  functions?: {
    total?: number
    byComplexity?: Array<{
      name?: string
      complexity?: number
      filePath?: string
      signature?: string
    }>
    byCalls?: Array<{
      name?: string
      callCount?: number
      filePath?: string
    }>
  }
}

interface BehavioralAnalysisData {
  knowledge?: {
    statistics?: {
      total_screens?: number
      total_tasks?: number
      total_actions?: number
      total_transitions?: number
    }
  }
  businessFunctions?: Array<{
    name?: string
    description?: string
    route?: string | null
    issues?: number
    features?: number
    bugs?: number
    type?: string
  }>
  contracts?: unknown[]
  bugSummary?: {
    total?: number
    critical?: number
    high?: number
    medium?: number
    low?: number
  }
}

interface AnalysisJsonScreen {
  id: string
  name: string
  type: string
  frames: string[]
  primary_frame: string
  issues?: Array<{
    severity: string
    category: string
    description: string
  }>
  nextjs_proposal?: {
    route?: string
    layout?: string
    features?: string[]
  }
}

interface AnalysisJsonBug {
  id: string
  screen: string
  severity: string
  title: string
  description?: string
  evidence_frames?: string[]
}

interface AnalysisJson {
  meta?: {
    title?: string
    source_application?: string
    source_technology?: string
    target_technology?: string
    analysis_date?: string
    key_frames_selected?: number
    source_video_duration_seconds?: number
  }
  frames_manifest?: Array<{
    id: string
    file: string
    screen: string
    description: string
    timestamp_seconds: number
  }>
  screens?: AnalysisJsonScreen[]
  bugs?: AnalysisJsonBug[]
  nextjs_architecture?: {
    route_map?: Array<{
      route: string
      auth: string
      roles: string
      layout: string
      origin_screen: string
    }>
    tech_stack?: Array<{ layer: string; technology: string }>
  }
}

function extractAnalysisData(project: Project) {
  const metadata = project.metadata as Record<string, unknown> | null
  const codeAnalysis = (metadata?.code_analysis ?? undefined) as CodeAnalysisData | undefined
  const behavioralAnalysis = (metadata?.behavioral_analysis ?? undefined) as BehavioralAnalysisData | undefined
  return { codeAnalysis, behavioralAnalysis }
}

/* -------------------------------------------------------------------------- */
/*  Animated Stat Counter                                                      */
/* -------------------------------------------------------------------------- */

function StatCounter({
  value,
  label,
  icon: Icon,
  accentClass = "text-electric-cyan/60",
}: {
  value: number | string | undefined
  label: string
  icon: React.ComponentType<{ className?: string }>
  accentClass?: string
}) {
  return (
    <motion.div
      className="glass-panel flex flex-col items-center gap-1.5 rounded-lg border border-white/5 p-3 min-w-[80px]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Icon className={cn("h-4 w-4", accentClass)} />
      <span className="font-mono text-xl font-bold text-foreground tabular-nums">
        {value ?? "—"}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Severity Badge                                                             */
/* -------------------------------------------------------------------------- */

function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity === "critical"
      ? "bg-destructive/20 text-destructive border-destructive/30"
      : severity === "high"
        ? "bg-warning/20 text-warning border-warning/30"
        : severity === "medium"
          ? "bg-muted text-muted-foreground border-border"
          : "bg-muted text-muted-foreground/60 border-border"
  return (
    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-mono", cls)}>
      {severity}
    </Badge>
  )
}

/* -------------------------------------------------------------------------- */
/*  Executive Summary                                                          */
/* -------------------------------------------------------------------------- */

function ExecutiveSummary({
  project,
  codeAnalysis,
  behavioralAnalysis,
  analysisJson,
}: {
  project: Project
  codeAnalysis: CodeAnalysisData | undefined
  behavioralAnalysis: BehavioralAnalysisData | undefined
  analysisJson: AnalysisJson | null
}) {
  const stats = codeAnalysis?.stats
  const kStats = behavioralAnalysis?.knowledge?.statistics
  const bugSummary = behavioralAnalysis?.bugSummary
  const meta = analysisJson?.meta

  const totalIssues =
    (bugSummary?.total ?? 0) ||
    (analysisJson?.bugs?.length ?? 0)
  const totalScreens =
    kStats?.total_screens ?? analysisJson?.screens?.length ?? 0
  const totalFeatures = codeAnalysis?.featureMap?.totalFeatures ?? 0

  return (
    <motion.div
      className="glass-panel rounded-lg border border-border p-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Top bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-electric-cyan/10">
            <CheckCircle2 className="h-5 w-5 text-electric-cyan" />
          </div>
          <div>
            <p className="text-xs font-medium text-electric-cyan">Analysis Complete</p>
            <h2 className="font-grotesk text-lg font-semibold text-foreground">
              {project.name}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {meta?.source_technology && (
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="font-mono">{meta.source_technology}</span>
                <ArrowRight className="h-3 w-3 text-electric-cyan" />
                <span className="font-mono text-electric-cyan">{meta.target_technology ?? "Next.js"}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary metrics row */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <StatCounter value={stats?.totalFiles} label="Files" icon={FileCode} />
        <StatCounter value={stats?.totalFunctions} label="Functions" icon={FunctionSquare} />
        <StatCounter value={totalScreens || undefined} label="Screens" icon={Monitor} accentClass="text-quantum-violet/60" />
        <StatCounter value={totalFeatures || undefined} label="Features" icon={Layers} />
        <StatCounter value={totalIssues || undefined} label="Issues Found" icon={AlertTriangle} accentClass="text-warning/60" />
        <StatCounter value={stats?.totalClasses} label="Classes" icon={GitBranch} />
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Code Intelligence Tab                                                      */
/* -------------------------------------------------------------------------- */

function CodeIntelligenceTab({ data }: { data: CodeAnalysisData | undefined }) {
  const features = data?.featureMap?.features ?? []
  const topComplex = data?.functions?.byComplexity?.slice(0, 10) ?? []
  const topCalled = data?.functions?.byCalls?.slice(0, 10) ?? []
  const languages = data?.stats?.languages ?? []

  const hasData = !!(data?.stats || features.length > 0)

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Code2 className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground/60">
          No code analysis data available. Provide a GitHub URL to enable Code Intelligence.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Feature Domains */}
      {features.length > 0 && (
        <div className="glass-panel rounded-lg border border-electric-cyan/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-electric-cyan" />
            <h3 className="font-grotesk text-sm font-semibold text-foreground">
              Feature Domains
            </h3>
            <Badge variant="outline" className="ml-auto text-[9px]">
              {features.length}
            </Badge>
          </div>
          <ScrollArea className="max-h-[260px]">
            <div className="space-y-1">
              {features.map((feat) => (
                <div
                  key={feat.name}
                  className="group flex items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight className="h-3 w-3 shrink-0 text-electric-cyan/40 group-hover:text-electric-cyan transition-colors" />
                    <span className="text-foreground/80 truncate font-medium">{feat.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-muted-foreground tabular-nums">
                    <span>{feat.entityCount} entities</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{feat.fileCount} files</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Language Distribution */}
      {languages.length > 0 && (
        <div className="glass-panel rounded-lg border border-electric-cyan/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-electric-cyan" />
            <h3 className="font-grotesk text-sm font-semibold text-foreground">
              Language Distribution
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {languages.map((lang) => (
              <Badge key={lang} variant="outline" className="font-mono text-[10px] border-electric-cyan/20 text-electric-cyan/80">
                {lang}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Top Functions by Complexity */}
      {topComplex.length > 0 && (
        <div className="glass-panel rounded-lg border border-warning/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-grotesk text-sm font-semibold text-foreground">
              Highest Complexity
            </h3>
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {topComplex.map((fn, i) => (
                <div
                  key={fn.name ?? i}
                  className="flex items-center justify-between rounded px-2.5 py-1.5 text-xs hover:bg-white/5 transition-colors"
                >
                  <span className="font-mono text-foreground/80 truncate mr-2">{fn.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {fn.complexity != null && (
                      <div className="flex items-center gap-1">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(fn.complexity * 4, 60)}px`,
                            background:
                              fn.complexity > 20
                                ? "var(--color-destructive)"
                                : fn.complexity > 10
                                  ? "var(--color-warning)"
                                  : "var(--color-electric-cyan)",
                          }}
                        />
                        <span className="font-mono text-muted-foreground tabular-nums">{fn.complexity}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Top Functions by Call Count */}
      {topCalled.length > 0 && (
        <div className="glass-panel rounded-lg border border-electric-cyan/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FunctionSquare className="h-4 w-4 text-electric-cyan" />
            <h3 className="font-grotesk text-sm font-semibold text-foreground">
              Most Referenced
            </h3>
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {topCalled.map((fn, i) => (
                <div
                  key={fn.name ?? i}
                  className="flex items-center justify-between rounded px-2.5 py-1.5 text-xs hover:bg-white/5 transition-colors"
                >
                  <span className="font-mono text-foreground/80 truncate mr-2">{fn.name}</span>
                  <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
                    {fn.callCount} calls
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  App Behaviour Tab                                                          */
/* -------------------------------------------------------------------------- */

function AppBehaviourTab({
  data,
  analysisJson,
}: {
  data: BehavioralAnalysisData | undefined
  analysisJson: AnalysisJson | null
}) {
  const kStats = data?.knowledge?.statistics
  const bizFunctions = data?.businessFunctions ?? []
  const contractCount = Array.isArray(data?.contracts) ? data.contracts.length : 0
  const screens = analysisJson?.screens ?? []
  const framesManifest = analysisJson?.frames_manifest ?? []

  // Build frame lookup
  const frameLookup = new Map(framesManifest.map((f) => [f.id, f]))

  const hasData = !!(kStats || bizFunctions.length > 0 || screens.length > 0)

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Eye className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground/60">
          No behavioral data available. Upload videos or documents to enable App Behaviour Analysis.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Behavioral stats */}
      {kStats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCounter value={kStats.total_screens} label="Screens" icon={Monitor} accentClass="text-quantum-violet/60" />
          <StatCounter value={kStats.total_transitions} label="Flows" icon={Route} accentClass="text-quantum-violet/60" />
          <StatCounter value={contractCount} label="Contracts" icon={FileCode} accentClass="text-quantum-violet/60" />
          <StatCounter value={kStats.total_actions} label="Actions" icon={Zap} accentClass="text-quantum-violet/60" />
        </div>
      )}

      {/* Screen Gallery */}
      {screens.length > 0 && (
        <div className="glass-panel rounded-lg border border-rail-purple/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-quantum-violet" />
            <h3 className="font-grotesk text-sm font-semibold text-foreground">
              Screens Analyzed
            </h3>
            <Badge variant="outline" className="ml-auto text-[9px]">
              {screens.length}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {screens.map((screen) => {
              const frame = frameLookup.get(screen.primary_frame)
              const issueCount = screen.issues?.length ?? 0
              const criticalCount = screen.issues?.filter((i) => i.severity === "critical").length ?? 0

              return (
                <div
                  key={screen.id}
                  className="group glass-panel overflow-hidden rounded-lg border border-border transition-colors hover:border-quantum-violet/30"
                >
                  {/* Frame thumbnail */}
                  {frame && (
                    <div className="relative aspect-video overflow-hidden bg-muted/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/pos-analysis/${frame.file}`}
                        alt={screen.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {criticalCount > 0 && (
                        <div className="absolute top-1.5 right-1.5">
                          <Badge variant="outline" className="bg-destructive/80 text-white border-0 text-[8px] px-1 py-0">
                            {criticalCount} critical
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs font-medium text-foreground truncate">
                      {screen.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[8px] px-1 py-0 font-mono">
                        {screen.type.replace(/_/g, " ")}
                      </Badge>
                      {issueCount > 0 && (
                        <span className="text-warning">{issueCount} issues</span>
                      )}
                    </div>
                    {screen.nextjs_proposal?.route && (
                      <p className="font-mono text-[9px] text-electric-cyan/60 truncate">
                        → {screen.nextjs_proposal.route}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Business Functions */}
      {bizFunctions.length > 0 && (
        <div className="glass-panel rounded-lg border border-rail-purple/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-quantum-violet" />
            <h3 className="font-grotesk text-sm font-semibold text-foreground">
              Business Functions
            </h3>
          </div>
          <ScrollArea className="max-h-[280px]">
            <div className="space-y-1">
              {bizFunctions.map((biz, i) => (
                <div
                  key={biz.name ?? i}
                  className="rounded px-2.5 py-2 text-xs hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground/90 font-medium truncate">{biz.name ?? "Unknown"}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {biz.route && (
                        <span className="font-mono text-[10px] text-electric-cyan/60">
                          {biz.route}
                        </span>
                      )}
                    </div>
                  </div>
                  {biz.description && (
                    <p className="mt-0.5 text-muted-foreground/60 line-clamp-1">{biz.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {(biz.features ?? 0) > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {biz.features} features
                      </span>
                    )}
                    {(biz.issues ?? 0) > 0 && (
                      <span className="text-[10px] text-warning/60">
                        {biz.issues} issues
                      </span>
                    )}
                    {(biz.bugs ?? 0) > 0 && (
                      <span className="text-[10px] text-destructive/60">
                        {biz.bugs} bugs
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Bug Registry Tab                                                           */
/* -------------------------------------------------------------------------- */

function BugRegistryTab({
  bugSummary,
  analysisJson,
}: {
  bugSummary: BehavioralAnalysisData["bugSummary"]
  analysisJson: AnalysisJson | null
}) {
  const bugs = analysisJson?.bugs ?? []
  const hasBugs = (bugSummary?.total ?? 0) > 0 || bugs.length > 0

  if (!hasBugs) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Bug className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground/60">
          No bugs documented during analysis.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Severity overview */}
      {bugSummary && (
        <div className="flex items-center gap-3 flex-wrap">
          {(bugSummary.critical ?? 0) > 0 && (
            <div className="glass-panel flex items-center gap-2 rounded-lg border border-destructive/20 px-3 py-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <span className="font-mono text-lg font-bold text-destructive">{bugSummary.critical}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Critical</span>
            </div>
          )}
          {(bugSummary.high ?? 0) > 0 && (
            <div className="glass-panel flex items-center gap-2 rounded-lg border border-warning/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-mono text-lg font-bold text-warning">{bugSummary.high}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">High</span>
            </div>
          )}
          {(bugSummary.medium ?? 0) > 0 && (
            <div className="glass-panel flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Bug className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-lg font-bold text-muted-foreground">{bugSummary.medium}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Medium</span>
            </div>
          )}
        </div>
      )}

      {/* Bug list */}
      {bugs.length > 0 && (
        <div className="glass-panel rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Bug className="h-4 w-4 text-destructive/60" />
            <h3 className="font-grotesk text-sm font-semibold text-foreground">
              Bug Registry
            </h3>
            <Badge variant="outline" className="ml-auto text-[9px]">
              {bugs.length} total
            </Badge>
          </div>
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-1.5">
              {bugs.map((bug) => (
                <div
                  key={bug.id}
                  className="flex items-start gap-3 rounded px-2.5 py-2 text-xs hover:bg-white/5 transition-colors"
                >
                  <SeverityBadge severity={bug.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground/50">{bug.id}</span>
                      <span className="text-foreground/90 font-medium">{bug.title}</span>
                    </div>
                    {bug.description && (
                      <p className="mt-0.5 text-muted-foreground/60 line-clamp-1">{bug.description}</p>
                    )}
                    <span className="mt-0.5 inline-block text-[10px] text-muted-foreground/40">
                      {bug.screen.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Route Architecture Tab                                                     */
/* -------------------------------------------------------------------------- */

function RouteArchitectureTab({ analysisJson }: { analysisJson: AnalysisJson | null }) {
  const routeMap = analysisJson?.nextjs_architecture?.route_map ?? []
  const techStack = analysisJson?.nextjs_architecture?.tech_stack ?? []

  if (routeMap.length === 0 && techStack.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Route className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground/60">
          Route architecture will be generated in the implementation plan.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Route Map */}
      {routeMap.length > 0 && (
        <div className="glass-panel rounded-lg border border-electric-cyan/10 p-4 space-y-3 md:col-span-2">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-electric-cyan" />
            <h3 className="font-grotesk text-sm font-semibold text-foreground">
              Proposed Routes
            </h3>
            <Badge variant="outline" className="ml-auto text-[9px]">
              {routeMap.length} routes
            </Badge>
          </div>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-0.5">
              <div className="grid grid-cols-[1fr_80px_1fr_80px] gap-2 px-2.5 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/40 font-semibold border-b border-border/50 mb-1">
                <span>Route</span>
                <span>Auth</span>
                <span>Roles</span>
                <span>Layout</span>
              </div>
              {routeMap.map((route) => (
                <div
                  key={route.route}
                  className="grid grid-cols-[1fr_80px_1fr_80px] gap-2 rounded px-2.5 py-1.5 text-xs hover:bg-white/5 transition-colors"
                >
                  <span className="font-mono text-electric-cyan/80 truncate">{route.route}</span>
                  <span className="text-muted-foreground">{route.auth}</span>
                  <span className="text-muted-foreground/70 truncate">{route.roles}</span>
                  <span className="text-muted-foreground/50">{route.layout}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Tech Stack */}
      {techStack.length > 0 && (
        <div className="glass-panel rounded-lg border border-electric-cyan/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-electric-cyan" />
            <h3 className="font-grotesk text-sm font-semibold text-foreground">
              Target Tech Stack
            </h3>
          </div>
          <div className="space-y-1">
            {techStack.map((ts) => (
              <div
                key={ts.layer}
                className="flex items-center justify-between rounded px-2.5 py-1.5 text-xs hover:bg-white/5 transition-colors"
              >
                <span className="text-muted-foreground">{ts.layer}</span>
                <span className="font-mono text-foreground/80">{ts.technology}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Configuration Panel                                                        */
/* -------------------------------------------------------------------------- */

function ConfigurationPanel({
  projectId,
  submitting,
  boilerplateUrl,
  techPreferences,
  onBoilerplateChange,
  onTechPrefsChange,
  onSubmit,
}: {
  projectId: string
  submitting: boolean
  boilerplateUrl: string
  techPreferences: string
  onBoilerplateChange: (v: string) => void
  onTechPrefsChange: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <motion.div
      className="glass-panel rounded-lg border border-electric-cyan/20 p-4 space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
    >
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-electric-cyan" />
        <h3 className="font-grotesk text-sm font-semibold text-foreground">
          Configuration
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          Optional
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Boilerplate URL */}
        <div className="space-y-1.5">
          <label htmlFor="boilerplate-url" className="text-xs font-medium text-muted-foreground">
            Starter Boilerplate
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <Input
              id="boilerplate-url"
              type="url"
              placeholder="https://github.com/user/boilerplate"
              value={boilerplateUrl}
              onChange={(e) => onBoilerplateChange(e.target.value)}
              className="pl-9 bg-background/50"
              disabled={submitting}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Provide a GitHub repo to use as the starting point for the migration.
          </p>
        </div>

        {/* Tech preferences */}
        <div className="space-y-1.5">
          <label htmlFor="tech-prefs" className="text-xs font-medium text-muted-foreground">
            Technology Preferences
          </label>
          <Textarea
            id="tech-prefs"
            placeholder="e.g. Use Prisma ORM, deploy to Vercel, prefer server components, use Tailwind v4"
            value={techPreferences}
            onChange={(e) => onTechPrefsChange(e.target.value)}
            rows={3}
            className="bg-background/50 resize-none"
            disabled={submitting}
          />
          <p className="text-[10px] text-muted-foreground/60">
            Specify frameworks, libraries, or architectural preferences.
          </p>
        </div>
      </div>

      {/* Generate button */}
      <div className="flex justify-center pt-2">
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={submitting}
          className={cn(
            "gap-2 px-8 font-grotesk",
            "bg-electric-cyan text-background hover:bg-electric-cyan/90",
            "shadow-glow-cyan transition-all duration-300",
          )}
        >
          {submitting ? (
            <>
              <motion.div
                className="h-4 w-4 rounded-full border-2 border-background/30 border-t-background"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              Generating...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Generate Implementation Plan
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main View                                                                  */
/* -------------------------------------------------------------------------- */

export function AnalysisConfigView({ projectId, project, onConfigure }: AnalysisConfigViewProps) {
  const [boilerplateUrl, setBoilerplateUrl] = useState("")
  const [techPreferences, setTechPreferences] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [analysisJson, setAnalysisJson] = useState<AnalysisJson | null>(null)

  const { codeAnalysis, behavioralAnalysis } = extractAnalysisData(project)

  // Load analysis.json if available (demo data)
  useEffect(() => {
    fetch("/pos-analysis/analysis.json")
      .then((res) => {
        if (!res.ok) throw new Error("Not found")
        return res.json() as Promise<AnalysisJson>
      })
      .then(setAnalysisJson)
      .catch(() => {
        // No analysis.json available — that's fine, we use project metadata only
      })
  }, [])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/configure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boilerplate_url: boilerplateUrl.trim() || undefined,
          tech_preferences: techPreferences.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to configure")
      }

      toast.success("Generating implementation plan...")
      onConfigure()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
      setSubmitting(false)
    }
  }, [projectId, boilerplateUrl, techPreferences, onConfigure])

  // Determine which tabs to show
  const hasCodeData = !!(codeAnalysis?.stats || (codeAnalysis?.featureMap?.features ?? []).length > 0)
  const hasBehaviorData = !!(
    behavioralAnalysis?.knowledge?.statistics ||
    (behavioralAnalysis?.businessFunctions ?? []).length > 0 ||
    (analysisJson?.screens ?? []).length > 0
  )
  const hasBugs = (behavioralAnalysis?.bugSummary?.total ?? 0) > 0 || (analysisJson?.bugs ?? []).length > 0
  const hasRoutes = (analysisJson?.nextjs_architecture?.route_map ?? []).length > 0

  return (
    <BreathingGlow confidence={0.6} className="relative flex h-full flex-col gap-4 p-4 overflow-auto">
      {/* Project actions */}
      <div className="absolute top-4 right-4 z-10">
        <ProjectImmersiveActions projectId={projectId} projectName={project.name} />
      </div>

      {/* Executive Summary */}
      <ExecutiveSummary
        project={project}
        codeAnalysis={codeAnalysis}
        behavioralAnalysis={behavioralAnalysis}
        analysisJson={analysisJson}
      />

      {/* Tabbed Analysis Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <Tabs defaultValue={hasBehaviorData ? "behavior" : hasCodeData ? "code" : "behavior"} className="space-y-3">
          <TabsList className="bg-card border border-border">
            {hasBehaviorData && (
              <TabsTrigger value="behavior" className="text-xs gap-1.5">
                <Eye className="h-3 w-3" />
                App Behaviour
              </TabsTrigger>
            )}
            {hasCodeData && (
              <TabsTrigger value="code" className="text-xs gap-1.5">
                <Code2 className="h-3 w-3" />
                Code Intelligence
              </TabsTrigger>
            )}
            {hasBugs && (
              <TabsTrigger value="bugs" className="text-xs gap-1.5">
                <Bug className="h-3 w-3" />
                Bug Registry
                {behavioralAnalysis?.bugSummary?.critical ? (
                  <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 text-destructive border-destructive/30">
                    {behavioralAnalysis.bugSummary.critical}
                  </Badge>
                ) : null}
              </TabsTrigger>
            )}
            {hasRoutes && (
              <TabsTrigger value="routes" className="text-xs gap-1.5">
                <Route className="h-3 w-3" />
                Architecture
              </TabsTrigger>
            )}
          </TabsList>

          <AnimatePresence mode="wait">
            {hasBehaviorData ? (
              <TabsContent key="behavior" value="behavior" className="mt-0">
                <AppBehaviourTab data={behavioralAnalysis} analysisJson={analysisJson} />
              </TabsContent>
            ) : null}
            {hasCodeData ? (
              <TabsContent key="code" value="code" className="mt-0">
                <CodeIntelligenceTab data={codeAnalysis} />
              </TabsContent>
            ) : null}
            {hasBugs ? (
              <TabsContent key="bugs" value="bugs" className="mt-0">
                <BugRegistryTab bugSummary={behavioralAnalysis?.bugSummary} analysisJson={analysisJson} />
              </TabsContent>
            ) : null}
            {hasRoutes ? (
              <TabsContent key="routes" value="routes" className="mt-0">
                <RouteArchitectureTab analysisJson={analysisJson} />
              </TabsContent>
            ) : null}
          </AnimatePresence>
        </Tabs>
      </motion.div>

      {/* Configuration + Generate Plan */}
      <ConfigurationPanel
        projectId={projectId}
        submitting={submitting}
        boilerplateUrl={boilerplateUrl}
        techPreferences={techPreferences}
        onBoilerplateChange={setBoilerplateUrl}
        onTechPrefsChange={setTechPreferences}
        onSubmit={handleSubmit}
      />
    </BreathingGlow>
  )
}
