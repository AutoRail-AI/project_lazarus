import { Plus } from "lucide-react"
import { headers } from "next/headers"
import Link from "next/link"
import { ProjectList } from "@/components/projects/project-list"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"

export default async function ProjectsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  // We know session exists because of layout check, but TS doesn't
  if (!session) return null

  const { data: projects } = await (supabase as any)
    .from("projects")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-grotesk text-lg font-semibold text-foreground">
            Projects
          </h1>
          <p className="text-sm text-foreground mt-0.5">
            Manage your legacy code migration projects.
          </p>
        </div>
        <Button asChild size="sm" className="bg-rail-fade hover:opacity-90 transition-opacity shadow-glow-purple">
          <Link href="/projects/new">
            <Plus className="mr-2 h-3.5 w-3.5" />
            New Project
          </Link>
        </Button>
      </div>

      <ProjectList projects={projects || []} />
    </div>
  )
}
