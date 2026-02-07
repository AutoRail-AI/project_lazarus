import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

export type AuditAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "invite"
  | "subscribe"
  | "cancel"
  | "admin_action"

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"]

// Log an action
export async function logAction(
  action: AuditAction,
  resource: string,
  options: {
    userId?: string
    organizationId?: string
    resourceId?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }
): Promise<void> {
  // Fire and forget - don't await, don't throw
  ;(supabase as any)
    .from("audit_logs")
    .insert({
      action,
      resource,
      user_id: options.userId,
      organization_id: options.organizationId,
      resource_id: options.resourceId,
      metadata: options.metadata,
      ip_address: options.ipAddress,
      user_agent: options.userAgent,
    })
    .then((res: { error?: unknown }) => {
      if (res.error) {
        console.error("Failed to log audit action:", res.error)
      }
    })
    .catch((err: unknown) => {
      console.error("Unexpected error logging audit action:", err)
    })
}

// Get audit logs
export async function getAuditLogs(filters: {
  userId?: string
  organizationId?: string
  action?: AuditAction
  resource?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}): Promise<AuditLog[]> {
  let query = (supabase as any)
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit || 100)

  if (filters.userId) {
    query = query.eq("user_id", filters.userId)
  }
  if (filters.organizationId) {
    query = query.eq("organization_id", filters.organizationId)
  }
  if (filters.action) {
    query = query.eq("action", filters.action)
  }
  if (filters.resource) {
    query = query.eq("resource", filters.resource)
  }
  if (filters.startDate) {
    query = query.gte("created_at", filters.startDate.toISOString())
  }
  if (filters.endDate) {
    query = query.lte("created_at", filters.endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to fetch audit logs:", error)
    return []
  }

  return data
}
