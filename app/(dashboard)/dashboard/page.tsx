import { ArrowRight, FolderOpen, LayoutDashboard, Plus } from "lucide-react"
import { headers } from "next/headers"
import Link from "next/link"
import { ProjectCard } from "@/components/projects/project-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

const RECENT_PROJECTS_LIMIT = 6

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session) return null

  const { data: projects } = await (supabase as any)
    .from("projects")
    .select("*")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false })
    .limit(RECENT_PROJECTS_LIMIT)

  const { count: totalProjects } = await (supabase as any)
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id)

  const { count: activeBuilds } = await (supabase as any)
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .in("status", ["processing", "building"])

  const projectList = (projects || []) as Project[]

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-grotesk text-lg font-semibold text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-foreground mt-0.5">
            Overview of your migration projects and activity.
          </p>
        </div>
        <Button asChild size="sm" className="bg-rail-fade hover:opacity-90 transition-opacity shadow-glow-purple">
          <Link href="/projects/new">
            <Plus className="mr-2 h-3.5 w-3.5" />
            New Project
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="glass-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sidebar-accent p-2">
                <FolderOpen className="h-5 w-5 text-electric-cyan" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Projects</p>
                <p className="font-grotesk text-lg font-semibold text-foreground">{totalProjects ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sidebar-accent p-2">
                <LayoutDashboard className="h-5 w-5 text-rail-purple" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Builds</p>
                <p className="font-grotesk text-lg font-semibold text-foreground">{activeBuilds ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-grotesk text-sm font-semibold text-foreground">
            Recent Projects
          </h2>
          {projectList.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects" className="text-muted-foreground hover:text-foreground">
                View all
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
        {projectList.length === 0 ? (
          <Card className="glass-panel border-dashed border-border bg-card/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-foreground mb-4">
                No projects yet. Create your first migration project to get started.
              </p>
              <Button asChild size="sm" className="bg-rail-fade hover:opacity-90 transition-opacity shadow-glow-purple">
                <Link href="/projects/new">
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Create Project
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projectList.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
