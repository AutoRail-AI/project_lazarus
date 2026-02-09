import { supabase } from "@/lib/db"
import { logger } from "@/lib/utils/logger"

export const TEST_USER = {
  email: "test@lazarus.dev",
  password: "TestPass123!",
  name: "Lazarus Test User",
} as const

export async function seedTestUser(): Promise<{ success: boolean; userId?: string }> {
  try {
    // Check if test user already exists
    const { data: existing } = (await (supabase as any)
      .from("user")
      .select("id")
      .eq("email", TEST_USER.email)
      .single()) as { data: { id: string } | null }

    if (existing) {
      logger.info("[Seed] Test user already exists", { userId: existing.id })
      return { success: true, userId: existing.id }
    }

    // Test user must be created via the app's signup flow or Better Auth API
    logger.info("[Seed] Test user does not exist — must be created via signup flow or Better Auth API")
    return { success: false }
  } catch (error: unknown) {
    logger.error("[Seed] Failed to check test user", error)
    return { success: false }
  }
}
