import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { SubscriptionCard } from "@/components/billing/subscription-card"
import { Button } from "@/components/ui/button"
import {
  ContentBlock,
  ContentBlockHeader,
  ContentBlockTitle,
} from "@/components/ui/content-block"
import { auth } from "@/lib/auth"
import { getUserPlan, getPlanConfig } from "@/lib/billing/plans"
import { getCreditBalance } from "@/lib/billing/credits"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"
import { ManageSubscriptionButton } from "@/components/billing/manage-subscription-button"

type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"]

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    redirect("/login")
  }

  // Get user's subscription
  const { data } = await (supabase as any)
    .from("subscriptions")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("status", "active")
    .single()
  const subscription = data as Subscription | null

  // Resolve plan and config
  const planId = await getUserPlan(session.user.id)
  const planConfig = getPlanConfig(planId)

  // Credit balance (Pro plan)
  const creditBalance = planId === "pro" ? await getCreditBalance(session.user.id) : null

  // Usage stats (analyses + builds this period)
  const periodStart = subscription?.current_period_start ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: usageData } = await (supabase as any)
    .from("usage")
    .select("type, quantity")
    .eq("user_id", session.user.id)
    .gte("timestamp", periodStart)

  const usageRows = (usageData ?? []) as Array<{ type: string; quantity: number }>
  const analysisCount = usageRows
    .filter((u: { type: string }) => u.type === "analysis")
    .reduce((s: number, u: { quantity: number }) => s + u.quantity, 0)
  const buildCount = usageRows
    .filter((u: { type: string }) => u.type === "slice_build")
    .reduce((s: number, u: { quantity: number }) => s + u.quantity, 0)

  // Project count
  const { count: projectCount } = await (supabase as any)
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 animate-fade-in">
      <div className="space-y-1">
        <h1 className="font-grotesk text-lg font-semibold text-foreground">
          Billing & Subscription
        </h1>
        <p className="text-sm text-foreground mt-0.5">
          Manage your plan, credits, and usage
        </p>
      </div>

      {/* Current plan summary */}
      <ContentBlock>
        <ContentBlockHeader>
          <ContentBlockTitle>
            Current Plan — {planConfig.name}
          </ContentBlockTitle>
        </ContentBlockHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Plan */}
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="text-sm font-medium text-foreground">
              {planConfig.name}
            </p>
          </div>

          {/* Status */}
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-medium text-foreground capitalize">
              {subscription?.status ?? "Active (Free)"}
            </p>
          </div>

          {/* Credits (Pro only) */}
          {creditBalance !== null && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Credit Balance</p>
              <p className="text-sm font-medium text-foreground">
                {creditBalance.toLocaleString()} credits
              </p>
            </div>
          )}

          {/* Renewal */}
          {subscription && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Renews</p>
              <p className="text-sm font-medium text-foreground">
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Usage meters */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3 border-t border-border pt-4">
          <UsageMeter
            label="Projects"
            value={projectCount ?? 0}
            limit={planConfig.limits.projects}
          />
          <UsageMeter
            label="Analyses (this period)"
            value={analysisCount}
          />
          <UsageMeter
            label="Slice Builds (this period)"
            value={buildCount}
            limit={planConfig.limits.sliceBuildsPerMonth}
          />
        </div>

        {subscription && (
          <ManageSubscriptionButton />
        )}
      </ContentBlock>

      {/* Plan cards + comparison */}
      <SubscriptionCard currentPlan={planId} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Usage meter sub-component
// ---------------------------------------------------------------------------

function UsageMeter({
  label,
  value,
  limit,
}: {
  label: string
  value: number
  limit?: number
}) {
  const isUnlimited = limit === -1 || limit === undefined
  const isBlocked = limit === 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium text-foreground">
          {value}
          {!isUnlimited && !isBlocked && ` / ${limit}`}
          {isUnlimited && " (unlimited)"}
          {isBlocked && " (locked)"}
        </span>
      </div>
      {!isBlocked && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: isUnlimited
                ? `${Math.min(value * 5, 100)}%`
                : `${Math.min((value / (limit as number)) * 100, 100)}%`,
            }}
          />
        </div>
      )}
    </div>
  )
}
