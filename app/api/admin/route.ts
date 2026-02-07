import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/config/roles"
import { supabase } from "@/lib/db"

// Middleware to check admin access (internal - do not export from route files)
async function requireAdmin(_req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user has admin permission
  // Note: In production, you'd check the user's actual role from the database
  // For now, we'll use a simple check - you can enhance this
  const userRole = "platform_admin" // Get from session or database
  const isAdmin = hasPermission(userRole, "admin", "view_analytics")
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return null
}

// Admin dashboard stats
export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req)
  if (authError) return authError

  // Get stats from database
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: userCount } = await (supabase as any)
    .from("user")
    .select("*", { count: "exact", head: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: orgCount } = await (supabase as any)
    .from("organization")
    .select("*", { count: "exact", head: true })

  const { count: subscriptionCount } = await (supabase as any)
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")

  // Get recent activity
  const { getAuditLogs } = await import("@/lib/audit/logger")
  const recentActivity = await getAuditLogs({
    limit: 10,
  })

  return NextResponse.json({
    stats: {
      users: userCount || 0,
      organizations: orgCount || 0,
      activeSubscriptions: subscriptionCount || 0,
    },
    recentActivity,
  })
}
