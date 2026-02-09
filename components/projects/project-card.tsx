import { formatDistanceToNow } from "date-fns"
import { Activity, AlertCircle, ArrowRight, CheckCircle2, Clock, Pause } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import type { Database } from "@/lib/db/types"
import { cn } from "@/lib/utils"

type Project = Database["public"]["Tables"]["projects"]["Row"]

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const statusColors = {
    pending: "bg-slate-grey text-muted-foreground border-border",
    processing: "bg-electric-cyan/10 text-electric-cyan border-electric-cyan/20",
    analyzed: "bg-electric-cyan/10 text-electric-cyan border-electric-cyan/20",
    ready: "bg-rail-purple/10 text-quantum-violet border-rail-purple/20",
    building: "bg-warning/10 text-warning border-warning/20",
    complete: "bg-success/10 text-success border-success/20",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
    paused: "bg-warning/10 text-warning border-warning/20",
  }

  const isLoading = project.status === "processing" || project.status === "building"
  const statusIcons = {
    pending: Clock,
    processing: Activity,
    analyzed: CheckCircle2,
    ready: CheckCircle2,
    building: Activity,
    complete: CheckCircle2,
    failed: AlertCircle,
    paused: Pause,
  }
  const StatusIcon = statusIcons[project.status] ?? AlertCircle

  return (
    <Link href={`/projects/${project.id}`} className="group block h-full" aria-label={`Open project ${project.name}`}>
      <Card className="glass-card h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-purple motion-reduce:transition-none motion-reduce:hover:translate-y-0">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between space-y-0 pb-2">
            <h3 className="font-grotesk text-sm font-medium text-foreground line-clamp-1 flex-1 min-w-0">
              {project.name}
            </h3>
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-1.5 capitalize transition-colors shrink-0",
                statusColors[project.status]
              )}
            >
              {isLoading ? (
                <Spinner className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <StatusIcon className="h-3.5 w-3.5" aria-hidden />
              )}
              {project.status}
            </Badge>
          </div>
          <p className={cn(
            "line-clamp-2 min-h-[2.5rem] text-sm mt-1",
            project.description ? "text-foreground" : "text-muted-foreground"
          )}>
            {project.description || "No description provided."}
          </p>
          
          <div className="mt-6 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <div className="flex items-end gap-1">
                <span className={cn(
                  "text-xl font-bold font-mono",
                  project.confidence_score >= 0.85 ? "text-success" : 
                  project.confidence_score >= 0.5 ? "text-warning" : "text-muted-foreground"
                )}>
                  {Math.round(project.confidence_score * 100)}%
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">Updated</span>
              <span className="text-xs font-medium">
                {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="flex items-center text-xs font-medium text-electric-cyan">
              Open Project <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
