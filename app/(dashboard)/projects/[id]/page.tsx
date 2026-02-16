import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getUserPlan } from "@/lib/billing/plans"
import { supabase } from "@/lib/db"
import { ProjectDetailOrchestrator } from "@/components/projects/project-detail-orchestrator"

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  const { id } = await params

  const [{ data: project, error }, { data: slices }, planId] = await Promise.all([
    (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single() as Promise<{ data: unknown; error: unknown }>,
    (supabase as any)
      .from("vertical_slices")
      .select("*")
      .eq("project_id", id)
      .order("priority", { ascending: true }) as Promise<{ data: unknown[] | null }>,
    getUserPlan(session.user.id),
  ])

  if (error || !project) notFound()

  return (
    <ProjectDetailOrchestrator
      projectId={id}
      initialProject={project as any}
      initialSlices={(slices ?? []) as any}
      userPlan={planId}
    />
  )
}

