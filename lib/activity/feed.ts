import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

export type ActivityType =
  | "user.created"
  | "user.updated"
  | "organization.created"
  | "organization.updated"
  | "member.invited"
  | "member.joined"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "ai_agent.run"
  | "document.created"
  | "document.updated"
  | "comment.created"
  | "subscription.created"
  | "subscription.updated"

export type Activity = Database["public"]["Tables"]["activities"]["Row"]

// Create activity
export async function createActivity(data: {
  userId?: string
  organizationId: string
  type: ActivityType
  action: string
  resource: string
  resourceId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>
}): Promise<Activity | null> {
  const { data: activity, error } = await (supabase as any)
    .from("activities")
    .insert({
      user_id: data.userId,
      organization_id: data.organizationId,
      type: data.type,
      action: data.action,
      resource: data.resource,
      resource_id: data.resourceId,
      metadata: data.metadata,
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to create activity:", error)
    return null
  }

  return activity
}

// Get activity feed
export async function getActivityFeed(
  organizationId: string,
  options: {
    userId?: string
    resource?: string
    resourceId?: string
    limit?: number
    before?: Date
  } = {}
): Promise<Activity[]> {
  let query = supabase
    .from("activities")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(options.limit || 50)

  if (options.userId) {
    query = query.eq("user_id", options.userId)
  }
  if (options.resource) {
    query = query.eq("resource", options.resource)
  }
  if (options.resourceId) {
    query = query.eq("resource_id", options.resourceId)
  }
  if (options.before) {
    query = query.lt("created_at", options.before.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to fetch activity feed:", error)
    return []
  }

  return data
}

// Get user activity
export async function getUserActivity(
  userId: string,
  options: {
    organizationId?: string
    limit?: number
  } = {}
): Promise<Activity[]> {
  let query = supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(options.limit || 50)

  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to fetch user activity:", error)
    return []
  }

  return data
}
