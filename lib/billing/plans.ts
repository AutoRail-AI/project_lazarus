/**
 * Plan definitions, capabilities, limits, and runtime gating helpers.
 *
 * Free  (Necroma X-Ray)  — 1 project lifetime, both brains, X-Ray only, solo
 * Pro   (Prepaid Credits) — Unlimited projects, migration plan + building, 10× markup, up to 5 team members
 * Enterprise (Per-Seat)   — Unlimited everything, custom seats, SSO, SLA
 */
import { supabase } from "@/lib/db"
import type { PlanId } from "@/lib/db/types"

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export interface PlanCapabilities {
    /** Left Brain + Right Brain analysis */
    analysis: boolean
    /** X-Ray report (feature map, entity stats, dep graph, workflows) */
    xrayReport: boolean
    /** Gemini planner → vertical slice generation */
    migrationPlan: boolean
    /** Slice builds + self-healing loop */
    building: boolean
    /** Download migration-plan.json */
    exportPlan: boolean
    /** Invite team members (organization) */
    teamMembers: boolean
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export interface PlanLimits {
    /** Max projects (-1 = unlimited) */
    projects: number
    /** Max slice builds per month (-1 = unlimited, 0 = blocked) */
    sliceBuildsPerMonth: number
    /** Max AI tokens per month (-1 = unlimited, 0 = blocked) */
    aiTokensPerMonth: number
    /** Max team members (0 = solo only, -1 = unlimited) */
    maxTeamMembers: number
}

// ---------------------------------------------------------------------------
// Combined config
// ---------------------------------------------------------------------------

export interface PlanConfig {
    name: string
    tagline: string
    priceLabel: string
    priceSuffix: string
    capabilities: PlanCapabilities
    limits: PlanLimits
    features: string[]
}

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
    free: {
        name: "Necroma X-Ray",
        tagline: "See what's buried in your code",
        priceLabel: "$0",
        priceSuffix: "",
        capabilities: {
            analysis: true,
            xrayReport: true,
            migrationPlan: false,
            building: false,
            exportPlan: false,
            teamMembers: false,
        },
        limits: {
            projects: 1,
            sliceBuildsPerMonth: 0,
            aiTokensPerMonth: 0,
            maxTeamMembers: 0,
        },
        features: [
            "Full codebase X-Ray audit",
            "Left Brain (Code-Synapse) analysis",
            "Right Brain (Behavioral) analysis",
            "Feature domain inventory",
            "Dependency graph visualization",
            "1 project (lifetime)",
        ],
    },

    pro: {
        name: "Pro",
        tagline: "Build the future",
        priceLabel: "Credits",
        priceSuffix: "prepaid",
        capabilities: {
            analysis: true,
            xrayReport: true,
            migrationPlan: true,
            building: true,
            exportPlan: true,
            teamMembers: true,
        },
        limits: {
            projects: -1,
            sliceBuildsPerMonth: -1,
            aiTokensPerMonth: -1,
            maxTeamMembers: 5,
        },
        features: [
            "Everything in Necroma X-Ray",
            "AI Migration Plan generation",
            "Automated slice building",
            "Self-healing loop",
            "Export migration-plan.json",
            "Up to 5 team members",
            "Unlimited projects",
            "Pay-per-use (10× token cost)",
        ],
    },

    enterprise: {
        name: "Enterprise",
        tagline: "Platform access for your organization",
        priceLabel: "Custom",
        priceSuffix: "per seat / year",
        capabilities: {
            analysis: true,
            xrayReport: true,
            migrationPlan: true,
            building: true,
            exportPlan: true,
            teamMembers: true,
        },
        limits: {
            projects: -1,
            sliceBuildsPerMonth: -1,
            aiTokensPerMonth: -1,
            maxTeamMembers: -1,
        },
        features: [
            "Everything in Pro",
            "Unlimited seats",
            "SSO / SAML integration",
            "SLA guarantee",
            "Dedicated support",
            "Custom integrations",
        ],
    },
}

// ---------------------------------------------------------------------------
// Runtime helpers
// ---------------------------------------------------------------------------

/** Resolve the active plan for a user. Defaults to `free`. */
export async function getUserPlan(userId: string): Promise<PlanId> {
    const { data } = await (supabase as any)
        .from("subscriptions")
        .select("plan_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

    if (data?.plan_id && data.plan_id in PLAN_CONFIG) {
        return data.plan_id as PlanId
    }
    return "free"
}

/** Get the full config object for a plan. */
export function getPlanConfig(planId: PlanId): PlanConfig {
    return PLAN_CONFIG[planId]
}

// ---------------------------------------------------------------------------
// Gating
// ---------------------------------------------------------------------------

export class PlanGateError extends Error {
    public readonly planId: PlanId
    public readonly capability: string

    constructor(planId: PlanId, capability: string, message?: string) {
        super(
            message ??
            `Your current plan (${PLAN_CONFIG[planId].name}) does not include "${capability}". Please upgrade.`
        )
        this.name = "PlanGateError"
        this.planId = planId
        this.capability = capability
    }
}

/**
 * Throws `PlanGateError` if the user's plan does not have the requested
 * capability.
 */
export async function assertCapability(
    userId: string,
    cap: keyof PlanCapabilities
): Promise<PlanId> {
    const planId = await getUserPlan(userId)
    const config = getPlanConfig(planId)
    if (!config.capabilities[cap]) {
        throw new PlanGateError(planId, cap)
    }
    return planId
}

/**
 * Check whether the user can create another project.
 * Free plan = 1 project lifetime.
 */
export async function checkProjectQuota(
    userId: string
): Promise<{ allowed: boolean; current: number; limit: number; planId: PlanId }> {
    const planId = await getUserPlan(userId)
    const limit = getPlanConfig(planId).limits.projects

    // Unlimited
    if (limit === -1) {
        return { allowed: true, current: 0, limit: -1, planId }
    }

    const { count } = await (supabase as any)
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)

    const current = (count as number) ?? 0
    return { allowed: current < limit, current, limit, planId }
}
