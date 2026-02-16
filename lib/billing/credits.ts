/**
 * Credit management for the Pro plan.
 *
 * Pro users purchase prepaid credits. Each metered action (planning, building,
 * AI tokens) deducts credits at a 10× markup over raw token cost.
 */
import { supabase } from "@/lib/db"
import { trackUsage } from "@/lib/usage/tracker"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Markup multiplier applied to raw token costs. */
export const CREDIT_MARKUP = 10

/** Cost in credits per action (these are the *marked-up* values). */
export const CREDIT_COSTS = {
    /** Gemini planner → generateSlices */
    migration_plan: 500,
    /** Single slice build */
    slice_build: 200,
    /** Per 1K AI tokens consumed */
    ai_tokens_1k: 10,
} as const

export type CreditAction = keyof typeof CREDIT_COSTS

// ---------------------------------------------------------------------------
// Balance helpers
// ---------------------------------------------------------------------------

/**
 * Get the current credit balance for a user.
 * Credits are stored as usage records: positive = purchased, negative = consumed.
 */
export async function getCreditBalance(userId: string): Promise<number> {
    const { data, error } = await (supabase as any)
        .from("usage")
        .select("quantity, metadata")
        .eq("user_id", userId)
        .eq("type", "credits")

    if (error || !data) return 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.reduce((sum: number, row: any) => sum + row.quantity, 0)
}

/**
 * Add credits after a Stripe payment.
 */
export async function addCredits(
    userId: string,
    amount: number,
    metadata?: Record<string, unknown>
): Promise<void> {
    await trackUsage({
        userId,
        type: "credits" as any,
        resource: "credit_purchase",
        quantity: amount,
        metadata: { action: "purchase", ...metadata },
    })
}

/**
 * Deduct credits for a metered action.
 * Returns `true` if the deduction was successful, `false` if insufficient balance.
 */
export async function deductCredits(
    userId: string,
    action: CreditAction,
    metadata?: Record<string, unknown>
): Promise<{ success: boolean; remaining: number; cost: number }> {
    const cost = CREDIT_COSTS[action]
    const balance = await getCreditBalance(userId)

    if (balance < cost) {
        return { success: false, remaining: balance, cost }
    }

    // Store as negative quantity
    await trackUsage({
        userId,
        type: "credits" as any,
        resource: action,
        quantity: -cost,
        cost,
        metadata: { action: "deduction", creditAction: action, ...metadata },
    })

    return { success: true, remaining: balance - cost, cost }
}

/**
 * Check if the user has enough credits for an action without deducting.
 */
export async function hasCredits(
    userId: string,
    action: CreditAction
): Promise<{ sufficient: boolean; balance: number; cost: number }> {
    const cost = CREDIT_COSTS[action]
    const balance = await getCreditBalance(userId)
    return { sufficient: balance >= cost, balance, cost }
}
