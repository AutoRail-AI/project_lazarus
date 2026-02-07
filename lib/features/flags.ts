import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

export type FeatureFlag = Database["public"]["Tables"]["feature_flags"]["Row"]

// Check if feature is enabled
export async function isFeatureEnabled(
  key: string,
  userId?: string,
  organizationId?: string
): Promise<boolean> {
  const { data: flag, error } = await (supabase as any)
    .from("feature_flags")
    .select("*")
    .eq("key", key)
    .single()

  if (error || !flag) {
    return false
  }

  // Check environment
  const env = process.env.NODE_ENV || "development"
  if (!flag.environments.includes(env)) return false

  if (!flag.enabled) return false

  // Check if user is in target list
  if (userId && flag.target_users?.includes(userId)) {
    return true
  }

  // Check if organization is in target list
  if (organizationId && flag.target_organizations?.includes(organizationId)) {
    return true
  }

  // Check rollout percentage
  if (flag.rollout_percentage < 100) {
    // Simple hash-based rollout
    const hash = userId
      ? hashString(userId + key)
      : hashString(organizationId + key || key)
    return hash % 100 < flag.rollout_percentage
  }

  return true
}

// Get all enabled features for user
export async function getEnabledFeatures(
  userId?: string,
  organizationId?: string
): Promise<string[]> {
  const { data: flags, error } = await (supabase as any)
    .from("feature_flags")
    .select("*")
    .eq("enabled", true)

  if (error || !flags) {
    return []
  }

  const enabled: string[] = []

  for (const flag of flags) {
    // We can optimize this by checking flags in parallel or batch, but for now simple loop is fine
    // Actually, we can reuse the logic but we need to pass the flag object, not fetch it again.
    // Let's refactor isFeatureEnabled to accept flag object optionally, or just copy logic.
    // Copying logic for performance to avoid N+1 fetches.

    const env = process.env.NODE_ENV || "development"
    if (!flag.environments.includes(env)) continue

    if (userId && flag.target_users?.includes(userId)) {
      enabled.push(flag.key)
      continue
    }

    if (organizationId && flag.target_organizations?.includes(organizationId)) {
      enabled.push(flag.key)
      continue
    }

    if (flag.rollout_percentage < 100) {
      const hash = userId
        ? hashString(userId + flag.key)
        : hashString(organizationId + flag.key || flag.key)
      if (hash % 100 < flag.rollout_percentage) {
        enabled.push(flag.key)
      }
    } else {
      enabled.push(flag.key)
    }
  }

  return enabled
}

// Helper function to hash string
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}
