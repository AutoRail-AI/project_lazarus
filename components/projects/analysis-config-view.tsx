"use client"

import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import {
  CheckCircle2,
  Code2,
  Eye,
  FileCode,
  FunctionSquare,
  GitBranch,
  Globe,
  Layers,
  Link as LinkIcon,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  }
  featureMap?: {
    totalFeatures?: number
    totalEntities?: number
    features?: Array<{ name: string; entityCount: number; fileCount: number }>
  }
  functions?: {
    total?: number
    mostComplex?: Array<{ name?: string; complexity?: number }>
    mostCalled?: Array<{ name?: string; callCount?: number }>
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
  }
}

function extractAnalysisData(project: Project) {
  const metadata = project.metadata as Record<string, unknown> | null
  const codeAnalysis = (metadata?.code_analysis ?? undefined) as CodeAnalysisData | undefined
  const behavioralAnalysis = (metadata?.behavioral_analysis ?? undefined) as BehavioralAnalysisData | undefined
  return { codeAnalysis, behavioralAnalysis }
}

/* -------------------------------------------------------------------------- */
/*  Stat Counter (animated)                                                    */
/* -------------------------------------------------------------------------- */

function StatCounter({
  value,
  label,
  icon: Icon,
}: {
  value: number | undefined
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <motion.div
      className="glass-panel flex flex-col items-center gap-1.5 rounded-lg border border-white/5 p-3 min-w-[80px]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Icon className="h-4 w-4 text-electric-cyan/60" />
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
/*  Code Intelligence Card                                                     */
/* -------------------------------------------------------------------------- */

function CodeIntelligenceCard({ data }: { data: CodeAnalysisData | undefined }) {
  const stats = data?.stats
  const features = data?.featureMap?.features ?? []

  return (
    <motion.div
      className="glass-panel flex flex-col gap-4 rounded-lg border border-electric-cyan/10 p-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-electric-cyan" />
        <h3 className="font-grotesk text-sm font-semibold text-foreground">
          Code Intelligence
        </h3>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-2">
        <StatCounter value={stats?.totalFiles} label="Files" icon={FileCode} />
        <StatCounter value={stats?.totalFunctions} label="Functions" icon={FunctionSquare} />
        <StatCounter value={stats?.totalClasses} label="Classes" icon={Layers} />
        <StatCounter value={stats?.totalInterfaces} label="Interfaces" icon={GitBranch} />
      </div>

      {/* Feature domains */}
      {features.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Feature Domains ({features.length})
          </p>
          <div className="space-y-1">
            {features.slice(0, 8).map((feat) => (
              <div
                key={feat.name}
                className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-white/5 transition-colors"
              >
                <span className="text-foreground/80 truncate mr-2">{feat.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {feat.entityCount} entities
                </span>
              </div>
            ))}
            {features.length > 8 && (
              <p className="px-2 text-[10px] text-muted-foreground/60">
                ...and {features.length - 8} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* No data fallback */}
      {!stats && features.length === 0 && (
        <p className="text-xs text-muted-foreground/60 italic">
          No code analysis data available.
        </p>
      )}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Behavioral Intelligence Card                                               */
/* -------------------------------------------------------------------------- */

function BehavioralIntelligenceCard({ data }: { data: BehavioralAnalysisData | undefined }) {
  const kStats = data?.knowledge?.statistics
  const bizFunctions = data?.businessFunctions ?? []
  const contractCount = Array.isArray(data?.contracts) ? data.contracts.length : 0
  const bugSummary = data?.bugSummary
  const hasData = !!(kStats || bizFunctions.length > 0)

  return (
    <motion.div
      className="glass-panel flex flex-col gap-4 rounded-lg border border-rail-purple/10 p-4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-quantum-violet" />
        <h3 className="font-grotesk text-sm font-semibold text-foreground">
          Behavioral Intelligence
        </h3>
      </div>

      {hasData ? (
        <>
          {kStats && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-white/5 p-2 text-center">
                <div className="font-mono text-lg font-bold text-foreground">
                  {kStats.total_screens ?? 0}
                </div>
                <div className="text-muted-foreground">Screens</div>
              </div>
              <div className="rounded bg-white/5 p-2 text-center">
                <div className="font-mono text-lg font-bold text-foreground">
                  {kStats.total_transitions ?? 0}
                </div>
                <div className="text-muted-foreground">Flows</div>
              </div>
              <div className="rounded bg-white/5 p-2 text-center">
                <div className="font-mono text-lg font-bold text-foreground">
                  {contractCount}
                </div>
                <div className="text-muted-foreground">Contracts</div>
              </div>
              <div className="rounded bg-white/5 p-2 text-center">
                <div className="font-mono text-lg font-bold text-foreground">
                  {kStats.total_actions ?? 0}
                </div>
                <div className="text-muted-foreground">Actions</div>
              </div>
            </div>
          )}

          {/* Bug severity breakdown */}
          {bugSummary && (bugSummary.total ?? 0) > 0 && (
            <div className="flex items-center gap-2 rounded bg-white/5 px-3 py-1.5 text-[11px]">
              <span className="text-muted-foreground">Bugs:</span>
              {(bugSummary.critical ?? 0) > 0 && (
                <span className="rounded bg-destructive/20 px-1.5 py-0.5 font-mono text-destructive">
                  {bugSummary.critical} critical
                </span>
              )}
              {(bugSummary.high ?? 0) > 0 && (
                <span className="rounded bg-warning/20 px-1.5 py-0.5 font-mono text-warning">
                  {bugSummary.high} high
                </span>
              )}
              {(bugSummary.medium ?? 0) > 0 && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                  {bugSummary.medium} medium
                </span>
              )}
            </div>
          )}

          {bizFunctions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Vertical Slices ({bizFunctions.length})
              </p>
              <div className="space-y-0.5">
                {bizFunctions.map((biz, i) => (
                  <div
                    key={biz.name ?? i}
                    className="rounded px-2 py-1.5 text-xs hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground/90 font-medium truncate">{biz.name ?? "Unknown"}</span>
                      {biz.route && (
                        <span className="shrink-0 font-mono text-[10px] text-electric-cyan/60">
                          {biz.route}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(biz.features ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {biz.features} features
                        </span>
                      )}
                      {(biz.issues ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground/60">
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
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Eye className="h-6 w-6 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground/60">
            No behavioral data available. Upload videos or documents to enable App Behaviour Analysis.
          </p>
        </div>
      )}
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

  const { codeAnalysis, behavioralAnalysis } = extractAnalysisData(project)

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

  return (
    <BreathingGlow confidence={0.6} className="relative flex h-full flex-col gap-4 p-4 overflow-auto">
      {/* Header */}
      <motion.div
        className="glass-panel flex items-center justify-between rounded-lg border border-border px-4 py-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-electric-cyan/10">
            <CheckCircle2 className="h-4 w-4 text-electric-cyan" />
          </div>
          <div>
            <p className="text-xs font-medium text-electric-cyan">Analysis Complete</p>
            <h2 className="font-grotesk text-sm font-semibold text-foreground">
              {project.name}
            </h2>
          </div>
        </div>
        <ProjectImmersiveActions projectId={projectId} projectName={project.name} />
      </motion.div>

      {/* Analysis cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <CodeIntelligenceCard data={codeAnalysis} />
        <BehavioralIntelligenceCard data={behavioralAnalysis} />
      </div>

      {/* Configuration panel */}
      <motion.div
        className="glass-panel rounded-lg border border-border p-4 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-grotesk text-sm font-semibold text-foreground">
            Configuration
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Optional
          </span>
        </div>

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
              onChange={(e) => setBoilerplateUrl(e.target.value)}
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
            onChange={(e) => setTechPreferences(e.target.value)}
            rows={3}
            className="bg-background/50 resize-none"
            disabled={submitting}
          />
          <p className="text-[10px] text-muted-foreground/60">
            Specify frameworks, libraries, or architectural preferences for the implementation plan.
          </p>
        </div>
      </motion.div>

      {/* Generate button */}
      <motion.div
        className="flex justify-center pb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            "gap-2 px-8 font-grotesk",
            "bg-electric-cyan text-void-black hover:bg-electric-cyan/90",
            "shadow-glow-cyan transition-all duration-300",
          )}
        >
          {submitting ? (
            <>
              <motion.div
                className="h-4 w-4 rounded-full border-2 border-void-black/30 border-t-void-black"
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
      </motion.div>
    </BreathingGlow>
  )
}
