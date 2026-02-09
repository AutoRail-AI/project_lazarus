"use client"

import { motion } from "framer-motion"
import { Brain, Eye, CheckCircle, XCircle, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

type AnalysisStepKey = "left_brain" | "right_brain" | "planning"
type AnalysisStepStatus = "pending" | "active" | "complete" | "failed"

const ANALYSIS_STEPS: AnalysisStepKey[] = ["left_brain", "right_brain", "planning"]

const STEP_CONFIG: Record<
  AnalysisStepKey,
  { icon: React.ElementType; label: string; description: string }
> = {
  left_brain: { icon: Brain, label: "Code Analysis", description: "Code structure & pattern recognition" },
  right_brain: { icon: Eye, label: "App Behaviour", description: "Behavioural analysis & knowledge synthesis" },
  planning: { icon: LayoutGrid, label: "Planning", description: "Generating vertical slices & contracts" },
}

interface AnalysisPipelineTrackerProps {
  currentStep: string | null
  completedSteps: string[]
  leftBrainStatus: string | null
  rightBrainStatus: string | null
}

function deriveStepStatus(
  step: AnalysisStepKey,
  currentStep: string | null,
  completedSteps: string[],
  leftBrainStatus: string | null,
  rightBrainStatus: string | null
): AnalysisStepStatus {
  // Check if this step is explicitly completed
  if (completedSteps.includes(step)) return "complete"

  // Check brain-specific status fields
  if (step === "left_brain") {
    if (leftBrainStatus === "complete") return "complete"
    if (leftBrainStatus === "failed") return "failed"
    if (leftBrainStatus === "processing" || currentStep === "left_brain") return "active"
  }

  if (step === "right_brain") {
    if (rightBrainStatus === "complete") return "complete"
    if (rightBrainStatus === "failed") return "failed"
    if (rightBrainStatus === "processing" || currentStep === "right_brain") return "active"
  }

  if (step === "planning") {
    if (currentStep === "planning" || currentStep === "generate_slices") return "active"
  }

  // Check by pipeline_step matching
  if (currentStep === step) return "active"

  return "pending"
}

function StepNode({
  step,
  status,
}: {
  step: AnalysisStepKey
  status: AnalysisStepStatus
}) {
  const config = STEP_CONFIG[step]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <motion.div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors",
            status === "active" &&
              "border-electric-cyan/50 bg-electric-cyan/10 text-electric-cyan",
            status === "complete" &&
              "border-success/50 bg-success/10 text-success",
            status === "failed" &&
              "border-error/50 bg-error/10 text-error",
            status === "pending" &&
              "border-border bg-transparent text-muted-foreground/40"
          )}
          animate={
            status === "active"
              ? {
                  boxShadow: [
                    "0 0 0 0 rgba(0,229,255,0)",
                    "0 0 0 8px rgba(0,229,255,0.15)",
                    "0 0 0 0 rgba(0,229,255,0)",
                  ],
                }
              : {}
          }
          transition={status === "active" ? { duration: 2, repeat: Infinity } : undefined}
        >
          <Icon className="h-5 w-5" />
        </motion.div>

        {status === "complete" && (
          <CheckCircle className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background text-success" />
        )}
        {status === "failed" && (
          <XCircle className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background text-error" />
        )}
      </div>

      <div className="text-center">
        <span
          className={cn(
            "block text-[10px] font-grotesk font-semibold uppercase tracking-wider",
            status === "active" && "text-electric-cyan",
            status === "complete" && "text-success/80",
            status === "failed" && "text-error/80",
            status === "pending" && "text-muted-foreground/40"
          )}
        >
          {config.label}
        </span>
        <span
          className={cn(
            "block text-[9px] mt-0.5",
            status === "active" ? "text-electric-cyan/60" : "text-muted-foreground/30"
          )}
        >
          {config.description}
        </span>
      </div>
    </div>
  )
}

function StepConnector({ fromStatus, toStatus }: { fromStatus: AnalysisStepStatus; toStatus: AnalysisStepStatus }) {
  const isComplete = fromStatus === "complete"
  const isActive = fromStatus === "active" || (fromStatus === "complete" && toStatus === "active")
  const isFailed = fromStatus === "failed"

  return (
    <div className="relative flex flex-1 items-center self-start" style={{ marginTop: 24, height: 1 }}>
      <div
        className={cn(
          "h-px w-full",
          isComplete ? "bg-success/60" : isFailed ? "bg-error/30" : "bg-muted-foreground/20 border-t border-dashed border-muted-foreground/20"
        )}
        style={!isComplete && !isFailed ? { background: "none" } : undefined}
      />
      {isActive && (
        <motion.div
          className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-electric-cyan"
          animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  )
}

export function AnalysisPipelineTracker({
  currentStep,
  completedSteps,
  leftBrainStatus,
  rightBrainStatus,
}: AnalysisPipelineTrackerProps) {
  const stepStatuses: Record<AnalysisStepKey, AnalysisStepStatus> = {
    left_brain: deriveStepStatus("left_brain", currentStep, completedSteps, leftBrainStatus, rightBrainStatus),
    right_brain: deriveStepStatus("right_brain", currentStep, completedSteps, leftBrainStatus, rightBrainStatus),
    planning: deriveStepStatus("planning", currentStep, completedSteps, leftBrainStatus, rightBrainStatus),
  }

  return (
    <div className="glass-panel rounded-lg border border-border px-6 py-4">
      <div className="flex items-start gap-2">
        {ANALYSIS_STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 items-start">
            <StepNode step={step} status={stepStatuses[step]} />
            {i < ANALYSIS_STEPS.length - 1 && (
              <StepConnector
                fromStatus={stepStatuses[ANALYSIS_STEPS[i] ?? "left_brain"]}
                toStatus={stepStatuses[ANALYSIS_STEPS[i + 1] ?? "left_brain"]}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
