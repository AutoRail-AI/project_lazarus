import { headers } from "next/headers"
import { ProjectsView } from "@/components/projects/projects-view"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"

export default async function ProjectsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  // We know session exists because of layout check, but TS doesn't
  if (!session) return null

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="h-[calc(100vh-3rem)]">
      <ProjectsView projects={projects || []} />
    </div>
  )
}
