"use client"

import {
  Activity,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  Heart,
  Loader2,
  PauseCircle,
  Target,
  XCircle,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectStatus, SliceStatus } from "@/lib/db/types"

type BadgeStatus = SliceStatus | ProjectStatus

const STATUS_CONFIG: Record<
  BadgeStatus,
  {
    label: string
    className: string
    borderClass: string
    icon: React.ElementType
    iconClass?: string
  }
> = {
  pending: {
    label: "Pending",
    className: "bg-slate-grey/50 text-muted-foreground",
    borderClass: "border-muted-foreground/20",
    icon: Clock,
  },
  selected: {
    label: "Selected",
    className: "bg-rail-purple/20 text-quantum-violet",
    borderClass: "border-quantum-violet/20",
    icon: Target,
  },
  building: {
    label: "Building",
    className: "bg-electric-cyan/15 text-electric-cyan animate-pulse-glow",
    borderClass: "border-electric-cyan/20",
    icon: Loader2,
    iconClass: "animate-spin",
  },
  testing: {
    label: "Testing",
    className: "bg-warning/15 text-warning",
    borderClass: "border-warning/20",
    icon: FlaskConical,
  },
  self_healing: {
    label: "Self-Healing",
    className: "bg-rail-purple/15 text-quantum-violet",
    borderClass: "border-rail-purple/20",
    icon: Heart,
    iconClass: "animate-pulse",
  },
  complete: {
    label: "Complete",
    className: "bg-success/15 text-success",
    borderClass: "border-success/20",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "bg-error/15 text-error",
    borderClass: "border-error/20",
    icon: XCircle,
  },
  // Project-specific statuses
  processing: {
    label: "Processing",
    className: "bg-electric-cyan/15 text-electric-cyan animate-pulse-glow",
    borderClass: "border-electric-cyan/20",
    icon: Activity,
    iconClass: "animate-pulse",
  },
  analyzed: {
    label: "Analyzed",
    className: "bg-rail-purple/20 text-quantum-violet",
    borderClass: "border-quantum-violet/20",
    icon: FileText,
  },
  ready: {
    label: "Ready",
    className: "bg-success/15 text-success",
    borderClass: "border-success/20",
    icon: Zap,
  },
  paused: {
    label: "Paused",
    className: "bg-warning/15 text-warning",
    borderClass: "border-warning/20",
    icon: PauseCircle,
  },
}

interface SliceStatusBadgeProps {
  status: BadgeStatus
  size?: "sm" | "md"
  className?: string
}

export function SliceStatusBadge({
  status,
  size = "sm",
  className,
}: SliceStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = config.icon

  const isMd = size === "md"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        isMd ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
        config.className,
        config.borderClass,
        className
      )}
    >
      <Icon
        className={cn(
          isMd ? "h-3.5 w-3.5" : "h-3 w-3",
          config.iconClass
        )}
      />
      {config.label}
    </span>
  )
}
