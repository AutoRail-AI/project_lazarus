import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import { ProjectDetailOrchestrator } from "@/components/projects/project-detail-orchestrator"

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

  return (
    <ProjectDetailOrchestrator
      projectId={id}
      initialProject={project}
      initialSlices={slices ?? []}
    />
  )
}
