import {
  PACKING_DOCK,
  VALID_SLOTS,
  createOriginalLayout,
  findShortestRoute,
  getSlot,
  routeToSlot,
  type GridPoint,
  type ProductLayout,
  validateLayout,
} from './warehouse'

export type Product = Readonly<{ id: string; pickFrequency: number }>
export type OrderItem = Readonly<{ productId: string; quantity: number }>
export type WarehouseOrder = Readonly<{ id: string; timestamp: string; items: readonly OrderItem[] }>

export type SimulationConfig = Readonly<{
  walkingSpeedMetersPerSecond: number
  handlingSecondsPerLine: number
  handlingSecondsPerUnit: number
}>

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  walkingSpeedMetersPerSecond: 1.2,
  handlingSecondsPerLine: 5,
  handlingSecondsPerUnit: 1,
}

export type PickEvent = Readonly<{
  orderId: string
  productId: string
  slotId: string
  route: readonly GridPoint[]
  travelDistanceMeters: number
  handlingSeconds: number
}>

export type SimulationMetrics = Readonly<{
  totalWalkingDistanceMeters: number
  averageWalkingDistanceMeters: number
  totalTravelSeconds: number
  totalHandlingSeconds: number
  totalEstimatedSeconds: number
  averageEstimatedSeconds: number
  completedOrders: number
  totalItemPicks: number
  totalUnitsHandled: number
}>

export type SimulationResult = Readonly<{
  metrics: SimulationMetrics
  events: readonly PickEvent[]
  rackVisits: Readonly<Record<string, number>>
}>

export type LayoutComparison = Readonly<{
  original: SimulationResult
  automatic: SimulationResult
  player: SimulationResult
  automaticDistanceReductionPercent: number | null
  playerDistanceReductionPercent: number | null
  automaticTimeReductionPercent: number | null
  playerTimeReductionPercent: number | null
}>

function routeOrThrow(start: GridPoint, slotId: string) {
  const route = routeToSlot(start, slotId)
  if (!route) throw new Error(`No route exists to slot ${slotId}`)
  return route
}

function chooseNextItem(current: GridPoint, remaining: readonly OrderItem[], layout: ProductLayout): OrderItem {
  return [...remaining].sort((a, b) => {
    const aSlot = layout[a.productId]
    const bSlot = layout[b.productId]
    const aDistance = routeOrThrow(current, aSlot).distanceMeters
    const bDistance = routeOrThrow(current, bSlot).distanceMeters
    return aDistance - bDistance || a.productId.localeCompare(b.productId)
  })[0]
}

/**
 * Scores an order sequence using nearest reachable next pick with stable SKU tie-breaking,
 * then returns to the dock. All layouts call this exact function.
 */
export function simulateOrders(
  orders: readonly WarehouseOrder[],
  productIds: readonly string[],
  layout: ProductLayout,
  config: SimulationConfig = DEFAULT_SIMULATION_CONFIG,
): SimulationResult {
  validateLayout(layout, productIds)
  if (config.walkingSpeedMetersPerSecond <= 0) throw new Error('Walking speed must be positive')
  const events: PickEvent[] = []
  const rackVisits: Record<string, number> = {}
  let totalDistance = 0
  let totalHandlingSeconds = 0
  let totalUnits = 0

  for (const order of orders) {
    if (!order.items.length) throw new Error(`Order ${order.id} contains no items`)
    const seen = new Set<string>()
    for (const item of order.items) {
      if (!layout[item.productId] || item.quantity <= 0 || seen.has(item.productId)) throw new Error(`Order ${order.id} is invalid for this layout`)
      seen.add(item.productId)
    }
    const remaining = [...order.items]
    let current = PACKING_DOCK
    while (remaining.length) {
      const next = chooseNextItem(current, remaining, layout)
      const slotId = layout[next.productId]
      const route = routeOrThrow(current, slotId)
      const slot = getSlot(slotId)
      if (!slot) throw new Error(`Layout references missing slot ${slotId}`)
      const handlingSeconds = config.handlingSecondsPerLine + next.quantity * config.handlingSecondsPerUnit
      events.push({
        orderId: order.id,
        productId: next.productId,
        slotId,
        route: route.points,
        travelDistanceMeters: route.distanceMeters,
        handlingSeconds,
      })
      totalDistance += route.distanceMeters
      totalHandlingSeconds += handlingSeconds
      totalUnits += next.quantity
      rackVisits[slot.rackId] = (rackVisits[slot.rackId] ?? 0) + 1
      current = slot.access
      remaining.splice(remaining.findIndex((item) => item.productId === next.productId), 1)
    }
    const returnRoute = findShortestRoute(current, PACKING_DOCK)
    if (!returnRoute) throw new Error(`No return route exists for order ${order.id}`)
    totalDistance += returnRoute.distanceMeters
  }

  const totalTravelSeconds = totalDistance / config.walkingSpeedMetersPerSecond
  const totalEstimatedSeconds = totalTravelSeconds + totalHandlingSeconds
  const completedOrders = orders.length
  return {
    events,
    rackVisits,
    metrics: {
      totalWalkingDistanceMeters: totalDistance,
      averageWalkingDistanceMeters: completedOrders ? totalDistance / completedOrders : 0,
      totalTravelSeconds,
      totalHandlingSeconds,
      totalEstimatedSeconds,
      averageEstimatedSeconds: completedOrders ? totalEstimatedSeconds / completedOrders : 0,
      completedOrders,
      totalItemPicks: events.length,
      totalUnitsHandled: totalUnits,
    },
  }
}

/** Assign fastest-moving products to the lowest round-trip dock cost slots, deterministically. */
export function createFastMoverLayout(products: readonly Product[]): ProductLayout {
  const productIds = products.map((product) => product.id)
  if (new Set(productIds).size !== productIds.length) throw new Error('Products must have unique IDs')
  if (products.length > VALID_SLOTS.length) throw new Error('Warehouse does not have enough valid slots')
  const rankedProducts = [...products].sort((a, b) => b.pickFrequency - a.pickFrequency || a.id.localeCompare(b.id))
  const rankedSlots = [...VALID_SLOTS]
    .map((slot) => {
      const out = routeToSlot(PACKING_DOCK, slot.id)
      const back = findShortestRoute(slot.access, PACKING_DOCK)
      if (!out || !back) throw new Error(`Slot ${slot.id} is not reachable from the dock`)
      return { slot, roundTripMeters: out.distanceMeters + back.distanceMeters }
    })
    .sort((a, b) => a.roundTripMeters - b.roundTripMeters || a.slot.id.localeCompare(b.slot.id))
  return Object.fromEntries(rankedProducts.map((product, index) => [product.id, rankedSlots[index].slot.id]))
}

export function calculateReductionPercent(original: number, candidate: number): number | null {
  if (original === 0) return null
  return ((original - candidate) / original) * 100
}

export function compareLayouts(
  products: readonly Product[],
  orders: readonly WarehouseOrder[],
  playerLayout?: ProductLayout,
  config: SimulationConfig = DEFAULT_SIMULATION_CONFIG,
): LayoutComparison {
  const productIds = products.map((product) => product.id)
  // The source dataset has no warehouse position field, so this is a neutral synthetic
  // starting layout: product codes in lexical order, never the frequency-ranked input order.
  const originalLayout = createOriginalLayout([...productIds].sort())
  const original = simulateOrders(orders, productIds, originalLayout, config)
  const automatic = simulateOrders(orders, productIds, createFastMoverLayout(products), config)
  const player = simulateOrders(orders, productIds, playerLayout ?? originalLayout, config)
  return {
    original,
    automatic,
    player,
    automaticDistanceReductionPercent: calculateReductionPercent(original.metrics.totalWalkingDistanceMeters, automatic.metrics.totalWalkingDistanceMeters),
    playerDistanceReductionPercent: calculateReductionPercent(original.metrics.totalWalkingDistanceMeters, player.metrics.totalWalkingDistanceMeters),
    automaticTimeReductionPercent: calculateReductionPercent(original.metrics.totalEstimatedSeconds, automatic.metrics.totalEstimatedSeconds),
    playerTimeReductionPercent: calculateReductionPercent(original.metrics.totalEstimatedSeconds, player.metrics.totalEstimatedSeconds),
  }
}
