import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { SubscriptionCard } from "@/components/billing/subscription-card"
import { Button } from "@/components/ui/button"
import { ContentBlock, ContentBlockHeader, ContentBlockTitle } from "@/components/ui/content-block"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

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

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 animate-fade-in">
      <div className="space-y-1">
        <h1 className="font-grotesk text-lg font-semibold text-foreground">
          Billing & Subscription
        </h1>
        <p className="text-sm text-foreground mt-0.5">
          Manage your subscription and billing
        </p>
      </div>

      <SubscriptionCard currentPlan={subscription?.plan_id} />

      {subscription && (
        <ContentBlock>
          <ContentBlockHeader>
            <ContentBlockTitle>Current Subscription</ContentBlockTitle>
          </ContentBlockHeader>
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              <strong>Plan:</strong> {subscription.plan_id}
            </p>
            <p className="text-sm text-foreground">
              <strong>Status:</strong> {subscription.status}
            </p>
            <p className="text-sm text-foreground">
              <strong>Renews:</strong>{" "}
              {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          </div>
          <form action="/api/billing/portal" method="POST" className="pt-4">
            <Button type="submit" size="sm">
              Manage Subscription
            </Button>
          </form>
        </ContentBlock>
      )}
    </div>
  )
}
