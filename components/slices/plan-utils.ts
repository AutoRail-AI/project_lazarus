import type { SliceStatus } from "@/lib/db/types"
import type { PlanFilters, Slice } from "./plan-types"

/**
 * Filter slices by search term and status filters.
 */
export function getFilteredSlices(slices: Slice[], filters: PlanFilters): Slice[] {
  let result = slices

  if (filters.search.trim()) {
    const term = filters.search.toLowerCase()
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.description?.toLowerCase().includes(term) ?? false)
    )
  }

  if (filters.statuses.length > 0) {
    result = result.filter((s) => filters.statuses.includes(s.status))
  }

  return result
}

/**
 * Check if a slice can be built: must be pending or selected,
 * and all its dependencies must be complete.
 */
export function isBuildable(slice: Slice, allSlices: Slice[]): boolean {
  if (slice.status !== "pending" && slice.status !== "selected") return false

  const deps = slice.dependencies ?? []
  if (deps.length === 0) return true

  const sliceMap = new Map<string, Slice>()
  for (const s of allSlices) sliceMap.set(s.id, s)

  return deps.every((depId) => {
    const dep = sliceMap.get(depId)
    return dep?.status === "complete"
  })
}

/**
 * Get the first buildable slice by priority (lowest priority number first).
 */
export function getNextBuildable(slices: Slice[]): Slice | null {
  const sorted = [...slices].sort((a, b) => a.priority - b.priority)
  return sorted.find((s) => isBuildable(s, slices)) ?? null
}

/**
 * Count slices by status.
 */
export function getStatusCounts(slices: Slice[]): Record<SliceStatus, number> {
  const counts: Record<SliceStatus, number> = {
    pending: 0,
    selected: 0,
    building: 0,
    testing: 0,
    self_healing: 0,
    complete: 0,
    failed: 0,
  }

  for (const s of slices) {
    counts[s.status]++
  }

  return counts
}

/**
 * Get the full dependency chain (upstream + downstream) for a slice.
 */
export function getDependencyChain(sliceId: string, slices: Slice[]): Set<string> {
  const chain = new Set<string>()
  chain.add(sliceId)

  const sliceMap = new Map<string, Slice>()
  for (const s of slices) sliceMap.set(s.id, s)

  // Walk upstream (this slice's dependencies, recursively)
  function walkUpstream(id: string) {
    const slice = sliceMap.get(id)
    if (!slice) return
    const deps = slice.dependencies ?? []
    for (const depId of deps) {
      if (!chain.has(depId)) {
        chain.add(depId)
        walkUpstream(depId)
      }
    }
  }

  // Walk downstream (slices that depend on this, recursively)
  function walkDownstream(id: string) {
    for (const s of slices) {
      const deps = s.dependencies ?? []
      if (deps.includes(id) && !chain.has(s.id)) {
        chain.add(s.id)
        walkDownstream(s.id)
      }
    }
  }

  walkUpstream(sliceId)
  walkDownstream(sliceId)

  return chain
}

/**
 * Compute a topological layered layout for the dependency graph.
 * Uses Kahn's algorithm, assigns layers by longest path from roots.
 * Returns a map from slice ID to { x, y } positions.
 */
export function computeGraphLayout(
  slices: Slice[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  if (slices.length === 0) return positions

  const sliceMap = new Map<string, Slice>()
  for (const s of slices) sliceMap.set(s.id, s)

  // Build adjacency: source → targets (source must complete before targets)
  const adj = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const s of slices) {
    adj.set(s.id, [])
    inDegree.set(s.id, 0)
  }

  for (const s of slices) {
    const deps = s.dependencies ?? []
    for (const depId of deps) {
      if (sliceMap.has(depId)) {
        const existing = adj.get(depId)
        if (existing) existing.push(s.id)
        inDegree.set(s.id, (inDegree.get(s.id) ?? 0) + 1)
      }
    }
  }

  // Compute longest path from roots (layer assignment)
  const layer = new Map<string, number>()
  const queue: string[] = []

  for (const s of slices) {
    if ((inDegree.get(s.id) ?? 0) === 0) {
      queue.push(s.id)
      layer.set(s.id, 0)
    }
  }

  // Handle cycles: any unvisited node gets layer 0
  if (queue.length === 0) {
    for (const s of slices) {
      queue.push(s.id)
      layer.set(s.id, 0)
    }
  }

  let head = 0
  while (head < queue.length) {
    const current = queue[head]!
    head++
    const currentLayer = layer.get(current) ?? 0
    const targets = adj.get(current) ?? []

    for (const target of targets) {
      const existingLayer = layer.get(target)
      const newLayer = currentLayer + 1

      if (existingLayer === undefined || newLayer > existingLayer) {
        layer.set(target, newLayer)
      }

      const deg = (inDegree.get(target) ?? 1) - 1
      inDegree.set(target, deg)
      if (deg <= 0 && !queue.includes(target)) {
        queue.push(target)
      }
    }
  }

  // Assign remaining unvisited nodes (cycles)
  for (const s of slices) {
    if (!layer.has(s.id)) {
      layer.set(s.id, 0)
    }
  }

  // Group by layer
  const layers = new Map<number, Slice[]>()
  for (const s of slices) {
    const l = layer.get(s.id) ?? 0
    if (!layers.has(l)) layers.set(l, [])
    layers.get(l)!.push(s)
  }

  // Sort within each layer by priority
  const layerEntries = Array.from(layers.entries())
  for (const [, group] of layerEntries) {
    group.sort((a, b) => a.priority - b.priority)
  }

  // Compute positions: left-to-right flow
  const HORIZONTAL_GAP = 300
  const VERTICAL_GAP = 160

  for (const [l, group] of layerEntries) {
    const layerHeight = group.length * VERTICAL_GAP
    for (let i = 0; i < group.length; i++) {
      const s = group[i]!
      positions.set(s.id, {
        x: l * HORIZONTAL_GAP,
        y: i * VERTICAL_GAP - layerHeight / 2 + VERTICAL_GAP / 2,
      })
    }
  }

  return positions
}
