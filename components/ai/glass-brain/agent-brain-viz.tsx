"use client"

import { motion } from "framer-motion"
import { Brain, Cpu, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActiveBrain } from "./derive-build-phase"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AgentBrainVizProps {
  activeBrain: ActiveBrain
}

const NODES: {
  key: ActiveBrain
  icon: React.ElementType
  label: string
  description: string
}[] = [
  {
    key: "left",
    icon: Brain,
    label: "Code-Synapse",
    description: "Code Analysis: Code generation, refactoring, and implementation via MCP tools",
  },
  {
    key: "agent",
    icon: Cpu,
    label: "Agent",
    description: "Agent Core: Orchestrates the build pipeline, test-first development loop",
  },
  {
    key: "right",
    icon: Eye,
    label: "Knowledge",
    description: "App Behaviour: Context retrieval, documentation search, pattern matching",
  },
]

function ConnectionLine({
  active,
  direction,
}: {
  active: boolean
  direction: "left" | "right"
}) {
  return (
    <div className="relative flex w-6 items-center">
      {/* Dashed baseline */}
      <div
        className={cn(
          "h-px w-full border-t border-dashed transition-colors duration-300",
          active ? "border-electric-cyan/50" : "border-electric-cyan/15"
        )}
      />
      {/* Animated particle dot */}
      {active && (
        <motion.div
          className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-electric-cyan"
          animate={{
            x: direction === "right" ? [0, 24] : [24, 0],
            opacity: [0, 1, 1, 0],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  )
}

export function AgentBrainViz({ activeBrain }: AgentBrainVizProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-0">
        {NODES.map((node, i) => {
          const Icon = node.icon
          const isActive = activeBrain === node.key
          const isIdle = activeBrain === "idle"

          return (
            <div key={node.key} className="flex items-center">
              {/* Connection line before (except first) */}
              {i > 0 && (
                <ConnectionLine
                  active={
                    (activeBrain === node.key) ||
                    (activeBrain === NODES[i - 1]?.key)
                  }
                  direction={i === 1 ? "right" : "right"}
                />
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-full border glass-panel",
                      isActive
                        ? "border-electric-cyan/40 glow-cyan"
                        : "border-border"
                    )}
                    animate={{
                      opacity: isActive ? 1 : isIdle ? 0.3 : 0.3,
                      scale: isActive ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        isActive ? "text-electric-cyan" : "text-muted-foreground/50"
                      )}
                    />
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="max-w-48 text-xs"
                >
                  <p className="font-semibold">{node.label}</p>
                  <p className="text-muted-foreground">{node.description}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )
        })}

        {/* Mini labels */}
        <div className="ml-2 flex flex-col">
          <span className="text-[9px] font-grotesk uppercase tracking-wider text-muted-foreground/40">
            {activeBrain === "idle"
              ? "Idle"
              : activeBrain === "left"
                ? "Code-Synapse"
                : activeBrain === "right"
                  ? "Knowledge"
                  : "Agent"}
          </span>
        </div>
      </div>
    </TooltipProvider>
  )
}
