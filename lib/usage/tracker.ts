import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

export type UsageType =
  | "api_call"
  | "ai_request"
  | "storage"
  | "bandwidth"
  | "feature_usage"
  | "analysis"
  | "slice_build"
  | "ai_token"
  | "migration_plan"
  | "credits"

export type Usage = Database["public"]["Tables"]["usage"]["Row"]

// Track usage
export async function trackUsage(data: {
  userId: string
  organizationId?: string
  apiKeyId?: string
  type: UsageType
  resource: string
  quantity: number
  cost?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>
}): Promise<void> {
  const { error } = await (supabase as any).from("usage").insert({
    user_id: data.userId,
    organization_id: data.organizationId,
    api_key_id: data.apiKeyId,
    type: data.type,
    resource: data.resource,
    quantity: data.quantity,
    cost: data.cost,
    metadata: data.metadata,
    timestamp: new Date().toISOString(),
  })

  if (error) {
    console.error("Failed to track usage:", error)
  }
}

// Get usage stats
export async function getUsageStats(filters: {
  userId?: string
  organizationId?: string
  type?: UsageType
  resource?: string
  startDate?: Date
  endDate?: Date
}): Promise<{
  totalQuantity: number
  totalCost: number
  count: number
  breakdown: Array<{ resource: string; quantity: number; cost: number }>
}> {
  let query = (supabase as any).from("usage").select("*")

  if (filters.userId) {
    query = query.eq("user_id", filters.userId)
  }
  if (filters.organizationId) {
    query = query.eq("organization_id", filters.organizationId)
  }
  if (filters.type) {
    query = query.eq("type", filters.type)
  }
  if (filters.resource) {
    query = query.eq("resource", filters.resource)
  }
  if (filters.startDate) {
    query = query.gte("timestamp", filters.startDate.toISOString())
  }
  if (filters.endDate) {
    query = query.lte("timestamp", filters.endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to get usage stats:", error)
    return { totalQuantity: 0, totalCost: 0, count: 0, breakdown: [] }
  }

  const totalQuantity = data.reduce(
    (sum: number, u: Usage) => sum + u.quantity,
    0
  )
  const totalCost = data.reduce(
    (sum: number, u: Usage) => sum + (u.cost || 0),
    0
  )

  // Breakdown by resource
  const breakdownMap = new Map<string, { quantity: number; cost: number }>()
  for (const u of data) {
    const existing = breakdownMap.get(u.resource) || { quantity: 0, cost: 0 }
    breakdownMap.set(u.resource, {
      quantity: existing.quantity + u.quantity,
      cost: existing.cost + (u.cost || 0),
    })
  }

  const breakdown = Array.from(breakdownMap.entries()).map(
    ([resource, data]) => ({
      resource,
      ...data,
    })
  )

  return {
    totalQuantity,
    totalCost,
    count: data.length,
    breakdown,
  }
}

// Check quota
export interface Quota {
  limit: number
  windowMs: number
  type: UsageType
  resource?: string
}

export async function checkQuota(
  userId: string,
  organizationId: string | undefined,
  quota: Quota
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - quota.windowMs)

  // Check organization-level quota if provided
  if (organizationId) {
    let orgQuery = (supabase as any)
      .from("usage")
      .select("quantity")
      .eq("organization_id", organizationId)
      .eq("type", quota.type)
      .gte("timestamp", windowStart.toISOString())

    if (quota.resource) {
      orgQuery = orgQuery.eq("resource", quota.resource)
    }

    const { data: orgData, error: orgError } = await orgQuery

    if (!orgError && orgData) {
      const orgTotal = orgData.reduce(
        (sum: number, u: Usage) => sum + u.quantity,
        0
      )
      if (orgTotal >= quota.limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(now.getTime() + quota.windowMs),
        }
      }
    }
  }

  // Check user-level quota
  let userQuery = (supabase as any)
    .from("usage")
    .select("quantity")
    .eq("user_id", userId)
    .eq("type", quota.type)
    .gte("timestamp", windowStart.toISOString())

  if (quota.resource) {
    userQuery = userQuery.eq("resource", quota.resource)
  }

  const { data: userData, error: userError } = await userQuery

  if (userError) {
    console.error("Failed to check quota:", userError)
    // Fail open if error, or closed? Let's fail open for now but log it.
    return {
      allowed: true,
      remaining: quota.limit,
      resetAt: new Date(now.getTime() + quota.windowMs),
    }
  }

  const userTotal = userData.reduce(
    (sum: number, u: Usage) => sum + u.quantity,
    0
  )
  const remaining = Math.max(0, quota.limit - userTotal)

  return {
    allowed: userTotal < quota.limit,
    remaining,
    resetAt: new Date(now.getTime() + quota.windowMs),
  }
}
