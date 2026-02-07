import crypto from "crypto"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

export type ApiKey = Database["public"]["Tables"]["api_keys"]["Row"]

// Generate API key
export function generateApiKey(prefix: string = "sk_live"): string {
  const randomBytes = crypto.randomBytes(32)
  const key = randomBytes.toString("base64url")
  return `${prefix}_${key}`
}

// Hash API key for storage
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

// Verify API key
export async function verifyApiKey(key: string): Promise<ApiKey | null> {
  const hashedKey = hashApiKey(key)

  const { data: apiKey, error } = await (supabase as any)
    .from("api_keys")
    .select("*")
    .eq("key", hashedKey)
    .eq("enabled", true)
    .single()

  if (error || !apiKey) {
    return null
  }

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return null
  }

  // Update last used
  // Fire and forget update
  ;(supabase as any)
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then()

  return apiKey
}

// Create API key
export async function createApiKey(
  userId: string,
  name: string,
  options: {
    organizationId?: string
    scopes?: string[]
    expiresAt?: Date
    rateLimit?: { requests: number; windowMs: number }
  }
): Promise<{ apiKey: ApiKey; plainKey: string }> {
  const plainKey = generateApiKey()
  const hashedKey = hashApiKey(plainKey)
  const keyPrefix = plainKey.substring(0, 12) // "sk_live_ab"

  const { data: apiKey, error } = await (supabase as any)
    .from("api_keys")
    .insert({
      user_id: userId,
      organization_id: options.organizationId,
      name,
      key: hashedKey,
      key_prefix: keyPrefix,
      scopes: options.scopes || ["read", "write"],
      expires_at: options.expiresAt?.toISOString(),
      rate_limit: options.rateLimit,
      enabled: true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`)
  }

  return { apiKey, plainKey }
}

// List API keys
export async function listApiKeys(
  userId: string,
  organizationId?: string
): Promise<ApiKey[]> {
  let query = (supabase as any)
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to list API keys:", error)
    return []
  }

  return data
}

// Revoke API key
export async function revokeApiKey(
  keyId: string,
  userId: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from("api_keys")
    .update({ enabled: false })
    .eq("id", keyId)
    .eq("user_id", userId)

  if (error) {
    console.error("Failed to revoke API key:", error)
    throw new Error(`Failed to revoke API key: ${error.message}`)
  }
}
