import { getUsageStats, trackUsage } from "@/lib/usage/tracker"

// Pricing per 1M tokens (in cents)
const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  openai: {
    "gpt-4-turbo-preview": { input: 10, output: 30 }, // $0.01/$0.03 per 1K tokens
    "gpt-4": { input: 30, output: 60 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  },
  anthropic: {
    "claude-3-opus": { input: 15, output: 75 },
    "claude-3-sonnet": { input: 3, output: 15 },
    "claude-3-haiku": { input: 0.25, output: 1.25 },
  },
}

// Calculate cost
export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[provider]?.[model]
  if (!pricing) return 0

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output

  return Math.round((inputCost + outputCost) * 100) // Convert to cents
}

// Track cost
export async function trackCost(data: {
  userId: string
  organizationId?: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>
}): Promise<void> {
  const totalTokens = data.inputTokens + data.outputTokens
  const cost = calculateCost(
    data.provider,
    data.model,
    data.inputTokens,
    data.outputTokens
  )

  await trackUsage({
    userId: data.userId,
    organizationId: data.organizationId,
    type: "ai_request",
    resource: `${data.provider}.${data.model}`,
    quantity: totalTokens,
    cost,
    metadata: {
      ...data.metadata,
      provider: data.provider,
      model: data.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
    },
  })
}

// Get cost summary
export async function getCostSummary(filters: {
  userId?: string
  organizationId?: string
  provider?: string
  model?: string
  startDate?: Date
  endDate?: Date
}): Promise<{
  totalCost: number // In cents
  totalTokens: number
  breakdown: Array<{
    provider: string
    model: string
    cost: number
    tokens: number
  }>
}> {
  const resource =
    filters.provider && filters.model
      ? `${filters.provider}.${filters.model}`
      : undefined

  const stats = await getUsageStats({
    userId: filters.userId,
    organizationId: filters.organizationId,
    type: "ai_request",
    resource,
    startDate: filters.startDate,
    endDate: filters.endDate,
  })

  // Parse breakdown from resource names
  const breakdown = stats.breakdown.map((item) => {
    const [provider, model] = item.resource.split(".")
    return {
      provider: provider || "unknown",
      model: model || "unknown",
      cost: item.cost,
      tokens: item.quantity,
    }
  })

  // Filter breakdown if provider/model filters were applied but not exact match
  const filteredBreakdown = breakdown.filter((item) => {
    if (filters.provider && item.provider !== filters.provider) return false
    if (filters.model && item.model !== filters.model) return false
    return true
  })

  return {
    totalCost: stats.totalCost,
    totalTokens: stats.totalQuantity,
    breakdown: filteredBreakdown,
  }
}
