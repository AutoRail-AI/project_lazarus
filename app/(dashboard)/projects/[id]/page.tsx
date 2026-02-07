import { Activity, ArrowLeft, CheckCircle2, Clock, LayoutGrid } from "lucide-react"
import { headers } from "next/headers"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  const { id } = await params

  const { data: project, error } = await (supabase as any)
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single()

  if (error || !project) notFound()

  const { data: slices } = await (supabase as any)
    .from("vertical_slices")
    .select("*")
    .eq("project_id", id)
    .order("priority", { ascending: true })

  const statusConfig = {
    pending: { label: "Pending", className: "bg-slate-grey/10 text-muted-foreground border-border", Icon: Clock },
    processing: { label: "Processing", className: "bg-electric-cyan/10 text-electric-cyan border-electric-cyan/20", Icon: Activity },
    ready: { label: "Ready", className: "bg-rail-purple/10 text-quantum-violet border-rail-purple/20", Icon: CheckCircle2 },
    building: { label: "Building", className: "bg-warning/10 text-warning border-warning/20", Icon: Activity },
    complete: { label: "Complete", className: "bg-success/10 text-success border-success/20", Icon: CheckCircle2 },
  }
  const config = statusConfig[project.status as keyof typeof statusConfig] ?? statusConfig.pending
  const StatusIcon = config.Icon

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
            {project.confidence_score > 0 && (
              <span className="text-sm text-muted-foreground">
                Confidence: {Math.round(project.confidence_score * 100)}%
              </span>
            )}
            {Array.isArray(slices) && slices.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {(slices as { status: string }[]).filter((s) => s.status === "complete").length}/{slices.length} slices complete
              </span>
            )}
          </div>
        </div>
        {project.status === "ready" && (
          <Button size="sm" asChild className="bg-rail-fade hover:opacity-90 shadow-glow-purple">
            <Link href={`/projects/${id}/plan`} className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              View Plan
            </Link>
          </Button>
        )}
      </div>

      <Card className="glass-card">
        <CardContent className="pt-6">
          <h2 className="font-grotesk text-lg font-semibold text-foreground mb-4">
            Vertical Slices
          </h2>
          {Array.isArray(slices) && slices.length > 0 ? (
            <ul className="space-y-2">
              {(slices as Array<{ id: string; name: string; status: string; priority: number }>).map((slice) => (
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
            <p className="text-sm text-muted-foreground">
              {project.status === "processing"
                ? "Analysis in progress. Slices will appear when ready."
                : "No slices generated yet."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
