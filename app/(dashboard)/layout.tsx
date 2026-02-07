import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
const ACTIVE_BUILD_STATUSES = ["processing", "building"] as const

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  // Check if any project has an active build (Neural Activity Pulse)
  const { data: activeProjects } = await (supabase as any)
    .from("projects")
    .select("id")
    .eq("user_id", session.user.id)
    .in("status", ACTIVE_BUILD_STATUSES)
    .limit(1)
  const hasActiveBuild = (activeProjects?.length ?? 0) > 0

  return (
    <div className="flex h-screen bg-void-black text-foreground">
      <Sidebar session={session} hasActiveBuild={hasActiveBuild} />
      <main className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {children}
      </main>
    </div>
  )
}
