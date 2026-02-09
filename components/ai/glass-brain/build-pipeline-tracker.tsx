"use client"

import { motion } from "framer-motion"
import {
  CheckCircle,
  Code,
  Eye,
  FileText,
  FlaskConical,
  MonitorPlay,
  Rocket,
  TestTube2,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BuildPipelineStep, StepStatus } from "./derive-build-phase"
import { PIPELINE_STEPS } from "./derive-build-phase"

interface BuildPipelineTrackerProps {
  stepStatuses: Record<BuildPipelineStep, StepStatus>
  currentStep: BuildPipelineStep
}

const STEP_CONFIG: Record<
  BuildPipelineStep,
  { icon: React.ElementType; label: string }
> = {
  contracts: { icon: FileText, label: "Contracts" },
  test_gen: { icon: TestTube2, label: "Test Gen" },
  implement: { icon: Code, label: "Implement" },
  unit_test: { icon: FlaskConical, label: "Unit Test" },
  e2e_test: { icon: MonitorPlay, label: "E2E Test" },
  visual_check: { icon: Eye, label: "Visual" },
  ship_ready: { icon: Rocket, label: "Ship Ready" },
}

function StepNode({
  step,
  status,
  isCurrent,
}: {
  step: BuildPipelineStep
  status: StepStatus
  isCurrent: boolean
}) {
  const config = STEP_CONFIG[step]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <motion.div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
            status === "active" &&
              "border-electric-cyan/40 bg-electric-cyan/10 text-electric-cyan",
            status === "complete" &&
              "border-success/40 bg-success/10 text-success",
            status === "failed" &&
              "border-error/40 bg-error/10 text-error",
            status === "pending" &&
              "border-border bg-transparent text-muted-foreground/40"
          )}
          animate={
            status === "active"
              ? {
                  boxShadow: [
                    "0 0 0 0 rgba(0,229,255,0)",
                    "0 0 0 6px rgba(0,229,255,0.15)",
                    "0 0 0 0 rgba(0,229,255,0)",
                  ],
                }
              : {}
          }
          transition={status === "active" ? { duration: 2, repeat: Infinity } : undefined}
        >
          <Icon className="h-3.5 w-3.5" />
        </motion.div>

        {/* Overlay icons for complete/failed */}
        {status === "complete" && (
          <CheckCircle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-background text-success" />
        )}
        {status === "failed" && (
          <XCircle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-background text-error" />
        )}
      </div>

      <span
        className={cn(
          "text-[9px] font-grotesk uppercase tracking-wider",
          status === "active" && "text-electric-cyan",
          status === "complete" && "text-success/80",
          status === "failed" && "text-error/80",
          status === "pending" && "text-muted-foreground/40",
          isCurrent && status === "active" && "font-semibold"
        )}
      >
        {config.label}
      </span>
    </div>
  )
}

function StepConnector({ fromStatus, toStatus }: { fromStatus: StepStatus; toStatus: StepStatus }) {
  const isComplete = fromStatus === "complete"
  const isActive = fromStatus === "active" || (fromStatus === "complete" && toStatus === "active")
  const isFailed = fromStatus === "failed"

  return (
    <div className="relative flex flex-1 items-center self-start" style={{ marginTop: 16, height: 1 }}>
      <div
        className={cn(
          "h-px w-full",
          isComplete ? "bg-success/60" : isFailed ? "bg-error/30" : "bg-muted-foreground/20 border-t border-dashed border-muted-foreground/20"
        )}
        style={!isComplete && !isFailed ? { background: "none" } : undefined}
      />
      {isActive && (
        <motion.div
          className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-electric-cyan"
          animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  )
}

export function BuildPipelineTracker({
  stepStatuses,
  currentStep,
}: BuildPipelineTrackerProps) {
  return (
    <div className="glass-panel rounded-lg border border-border px-4 py-3">
      <div className="flex items-start gap-1">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 items-start">
            <StepNode
              step={step}
              status={stepStatuses[step]}
              isCurrent={step === currentStep}
            />
            {i < PIPELINE_STEPS.length - 1 && (
              <StepConnector
                fromStatus={stepStatuses[step]}
                toStatus={stepStatuses[PIPELINE_STEPS[i + 1] ?? "contracts"]}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
