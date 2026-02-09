import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { PlanCommandCenter } from "@/components/slices/plan-command-center"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

type Project = Database["public"]["Tables"]["projects"]["Row"]
type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session) redirect("/login")

  // Fetch project
  const { data: project } = (await (supabase as any)
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single()) as { data: Project | null }

  if (!project) redirect("/projects")

  // Fetch slices
  const { data: slices } = (await (supabase as any)
    .from("vertical_slices")
    .select("*")
    .eq("project_id", id)
    .order("priority", { ascending: true })) as { data: Slice[] | null }

  return (
    <div className="h-[calc(100vh-3rem)]">
      <PlanCommandCenter project={project} initialSlices={slices ?? []} />
    </div>
  )
}
