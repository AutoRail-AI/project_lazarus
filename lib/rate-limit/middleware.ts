import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

export type RateLimit = Database["public"]["Tables"]["rate_limits"]["Row"]

export interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyGenerator?: (req: NextRequest) => Promise<string> // Custom key generator
}

// Rate limit middleware
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<{ success: boolean; remaining: number; resetAt: Date }> {
  // Generate rate limit key
  let key: string
  if (options.keyGenerator) {
    key = await options.keyGenerator(req)
  } else {
    // Default: use user ID or IP address
    const session = await auth.api.getSession({ headers: await headers() })
    // Get IP from headers (NextRequest doesn't have .ip property)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "anonymous"
    key = session?.user?.id || ip
  }

  const now = new Date()
  const resetAt = new Date(now.getTime() + options.windowMs)

  // Get or create rate limit record
  const { data: existing, error } = await (supabase as any)
    .from("rate_limits")
    .select("*")
    .eq("key", key)
    .single()

  if (error && error.code !== "PGRST116") {
    // Error other than not found
    console.error("Rate limit check failed:", error)
    // Fail open
    return { success: true, remaining: options.maxRequests, resetAt }
  }

  let count = 1
  let currentResetAt = resetAt

  if (!existing) {
    // Create new record
    await (supabase as any).from("rate_limits").insert({
      key,
      count: 1,
      reset_at: resetAt.toISOString(),
    })
  } else if (new Date(existing.reset_at) < now) {
    // Reset window
    await (supabase as any)
      .from("rate_limits")
      .update({ count: 1, reset_at: resetAt.toISOString() })
      .eq("key", key)
  } else {
    // Increment count
    count = existing.count + 1
    currentResetAt = new Date(existing.reset_at)
    await (supabase as any)
      .from("rate_limits")
      .update({ count })
      .eq("key", key)
  }

  const remaining = Math.max(0, options.maxRequests - count)

  return {
    success: count <= options.maxRequests,
    remaining,
    resetAt: currentResetAt,
  }
}

// API route wrapper
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: RateLimitOptions
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const result = await rateLimit(req, options)

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          resetAt: result.resetAt.toISOString(),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": options.maxRequests.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.resetAt.toISOString(),
          },
        }
      )
    }

    const response = await handler(req)

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", options.maxRequests.toString())
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString())
    response.headers.set("X-RateLimit-Reset", result.resetAt.toISOString())

    return response
  }
}
