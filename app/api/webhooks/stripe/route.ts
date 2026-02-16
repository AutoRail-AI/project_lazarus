import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/billing/stripe"
import { addCredits } from "@/lib/billing/credits"
import { supabase } from "@/lib/db"
import type { Database, PlanId } from "@/lib/db/types"
import { triggerWebhook } from "@/lib/webhooks/manager"

type SubscriptionInsert = Database["public"]["Tables"]["subscriptions"]["Insert"]

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get("stripe-signature")

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any

        const payload: SubscriptionInsert = {
          user_id: subscription.metadata?.userId || "",
          org_id: subscription.metadata?.organizationId || null,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          stripe_price_id: subscription.items.data[0]?.price.id as string,
          status: mapStripeStatus(subscription.status),
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end as boolean,
          plan_id: getPlanIdFromPriceId(subscription.items.data[0]?.price.id as string),
          updated_at: new Date().toISOString(),
        }

        await (supabase as any).from("subscriptions").upsert(payload, {
          onConflict: "stripe_subscription_id",
        })

        await triggerWebhook(
          "subscription.updated",
          { subscriptionId: subscription.id },
          subscription.metadata?.organizationId
        )
        break
      }

      case "customer.subscription.deleted": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any

        await (supabase as any)
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id)

        await triggerWebhook(
          "subscription.cancelled",
          { subscriptionId: subscription.id },
          subscription.metadata?.organizationId
        )
        break
      }

      case "invoice.payment_succeeded": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any

        // Provision credits for Pro plan users when payment completes.
        // Credit amount can be set explicitly in invoice metadata (e.g. from
        // a credit pack purchase), or defaults to amount_paid in cents.
        const userId = invoice.subscription_details?.metadata?.userId ?? invoice.metadata?.userId
        if (userId) {
          const creditAmount =
            invoice.metadata?.credit_amount != null
              ? Number(invoice.metadata.credit_amount)
              : (invoice.amount_paid as number) // 1 cent = 1 credit

          if (creditAmount > 0) {
            await addCredits(userId as string, creditAmount, {
              invoiceId: invoice.id as string,
              stripeCustomerId: invoice.customer as string,
              amountPaid: invoice.amount_paid as number,
            })
          }
        }

        await triggerWebhook(
          "payment.succeeded",
          { invoiceId: invoice.id, amount: invoice.amount_paid },
          invoice.metadata?.organizationId
        )
        break
      }

      case "invoice.payment_failed": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any

        await triggerWebhook(
          "payment.failed",
          { invoiceId: invoice.id, amount: invoice.amount_due },
          invoice.metadata?.organizationId
        )
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook error:", error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 400 }
    )
  }
}

function mapStripeStatus(
  status: string
): "active" | "canceled" | "past_due" | "trialing" | "incomplete" {
  const valid: Array<"active" | "canceled" | "past_due" | "trialing" | "incomplete"> = [
    "active",
    "canceled",
    "past_due",
    "trialing",
    "incomplete",
  ]
  return valid.includes(status as (typeof valid)[number])
    ? (status as (typeof valid)[number])
    : "incomplete"
}

function getPlanIdFromPriceId(priceId: string): PlanId {
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro"
  if (priceId === process.env.STRIPE_PRICE_ID_ENTERPRISE) return "enterprise"
  return "free"
}
