import { NextResponse } from "next/server"
import { env } from "@/env.mjs"
import { auth } from "@/lib/auth"
import { TEST_USER } from "@/lib/testing/seed-test-user"
import { logger } from "@/lib/utils/logger"

export async function POST() {
  // Guard: only in development or demo mode
  if (process.env.NODE_ENV === "production" && !env.DEMO_MODE) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  try {
    // Try to sign up test user via Better Auth
    const result = await auth.api.signUpEmail({
      body: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        name: TEST_USER.name,
      },
    })

    logger.info("[Seed] Test user created or already exists")
    return NextResponse.json({ ok: true, user: result })
  } catch (error: unknown) {
    // User might already exist — that's fine
    const message = error instanceof Error ? error.message : "Unknown error"
    if (message.includes("already exists") || message.includes("duplicate")) {
      return NextResponse.json({ ok: true, message: "Test user already exists" })
    }
    logger.error("[Seed] Failed to create test user", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
