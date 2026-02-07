import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { successResponse } from "@/lib/utils/api-response"

export async function GET() {
  try {
    // Check database connection via Supabase
    const { error } = await (supabase as any).from("projects").select("id").limit(1)
    
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`)
    }

    // Check Redis (if available)
    let redisStatus = "unknown"
    try {
      const { getRedis } = await import("@/lib/queue/redis")
      const redis = getRedis()
      await redis.ping()
      redisStatus = "connected"
    } catch {
      redisStatus = "disconnected"
    }

    return successResponse(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          redis: redisStatus,
        },
      },
      "Service is healthy"
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
