"use client"

import { getCalApi } from "@calcom/embed-react"
import {
  Check,
  Zap,
  Building2,
  Scan,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ContentBlock } from "@/components/ui/content-block"
import { Spinner } from "@/components/ui/spinner"
import { PLAN_CONFIG } from "@/lib/billing/plans"
import type { PlanId } from "@/lib/db/types"
import { trackEvent } from "@/lib/analytics/client"

// ---------------------------------------------------------------------------
// Plan display config
// ---------------------------------------------------------------------------

interface PlanCard {
  id: PlanId
  icon: React.ReactNode
  popular?: boolean
  cta: string
  /** If set, this plan uses Cal.com scheduling instead of Stripe checkout. */
  calcom?: boolean
}

const planCards: PlanCard[] = [
  {
    id: "free",
    icon: <Scan className="h-5 w-5" />,
    cta: "Get Started Free",
  },
  {
    id: "pro",
    icon: <Zap className="h-5 w-5" />,
    popular: true,
    cta: "Buy Credits",
  },
  {
    id: "enterprise",
    icon: <Building2 className="h-5 w-5" />,
    cta: "Schedule a Call",
    calcom: true,
  },
]

// ---------------------------------------------------------------------------
// Capability comparison
// ---------------------------------------------------------------------------

interface CapRow {
  label: string
  free: boolean | string
  pro: boolean | string
  enterprise: boolean | string
}

const capabilities: CapRow[] = [
  { label: "Codebase X-Ray audit", free: true, pro: true, enterprise: true },
  { label: "Left Brain (Code-Synapse)", free: true, pro: true, enterprise: true },
  { label: "Right Brain (Behavioral)", free: true, pro: true, enterprise: true },
  { label: "Migration plan generation", free: false, pro: true, enterprise: true },
  { label: "Slice building", free: false, pro: true, enterprise: true },
  { label: "Self-healing loop", free: false, pro: true, enterprise: true },
  { label: "Export migration plan", free: false, pro: true, enterprise: true },
  { label: "Team members", free: false, pro: "Up to 5", enterprise: "Unlimited" },
  { label: "Projects", free: "1", pro: "Unlimited", enterprise: "Unlimited" },
  { label: "SSO / SAML", free: false, pro: false, enterprise: true },
  { label: "SLA guarantee", free: false, pro: false, enterprise: true },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubscriptionCard({ currentPlan }: { currentPlan?: string }) {
  const [loading, setLoading] = useState<string | null>(null)

  // Initialize Cal.com embed
  useEffect(() => {
    ; (async function () {
      const cal = await getCalApi({ namespace: "autorail.dev" })
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" })
    })()
  }, [])

  const handleSubscribe = async (planId: string) => {
    setLoading(planId)
    trackEvent("subscription_checkout_started", { planId })

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })

      const data = (await response.json()) as { url?: string }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error: unknown) {
      console.error("Checkout error:", error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Plan cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {planCards.map((card) => {
          const config = PLAN_CONFIG[card.id]
          const isCurrent = currentPlan === card.id

          return (
            <ContentBlock
              key={card.id}
              className={
                card.popular
                  ? "border-primary ring-1 ring-primary/20 relative"
                  : "relative"
              }
            >
              {card.popular && (
                <Badge className="absolute -top-2.5 right-4 text-xs">
                  Popular
                </Badge>
              )}

              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                    {card.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{config.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {config.tagline}
                    </p>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold">
                    {config.priceLabel}
                  </span>
                  {config.priceSuffix && (
                    <span className="text-sm text-muted-foreground">
                      {config.priceSuffix}
                    </span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-1.5">
                  {config.features.map((feature: string) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-sm text-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {card.calcom ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={isCurrent}
                    data-cal-namespace="autorail.dev"
                    data-cal-link="jaswanthr/autorail.dev"
                    data-cal-config='{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}'
                  >
                    {isCurrent ? "Current Plan" : card.cta}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    variant={card.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(card.id)}
                    disabled={loading === card.id || isCurrent}
                  >
                    {loading === card.id ? (
                      <>
                        <Spinner className="mr-2 h-3.5 w-3.5" />
                        Loading...
                      </>
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : (
                      card.cta
                    )}
                  </Button>
                )}
              </div>
            </ContentBlock>
          )
        })}
      </div>

      {/* Capability comparison */}
      <ContentBlock>
        <h3 className="mb-3 text-sm font-semibold">Plan Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 font-medium text-muted-foreground">
                  Feature
                </th>
                <th className="pb-2 px-4 text-center font-medium text-muted-foreground">
                  X-Ray
                </th>
                <th className="pb-2 px-4 text-center font-medium text-muted-foreground">
                  Pro
                </th>
                <th className="pb-2 pl-4 text-center font-medium text-muted-foreground">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map((row) => (
                <tr key={row.label} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-foreground">{row.label}</td>
                  {(["free", "pro", "enterprise"] as const).map((tier) => (
                    <td key={tier} className="py-2 px-4 text-center">
                      {typeof row[tier] === "boolean" ? (
                        row[tier] ? (
                          <Check className="mx-auto h-4 w-4 text-primary" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                        )
                      ) : (
                        <span className="text-xs font-medium text-foreground">
                          {row[tier]}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentBlock>
    </div>
  )
}
