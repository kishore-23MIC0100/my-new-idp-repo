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
  shelfAccessSeconds: readonly [number, number, number]
}>

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  walkingSpeedMetersPerSecond: 1.2,
  handlingSecondsPerLine: 5,
  handlingSecondsPerUnit: 1,
  shelfAccessSeconds: [0, 6, 12],
}

export type PickEvent = Readonly<{
  kind: 'pick' | 'return'
  orderId: string
  productId: string
  slotId: string
  route: readonly GridPoint[]
  travelDistanceMeters: number
  travelSeconds: number
  accessSeconds: number
  handlingSeconds: number
}>

export type SimulationMetrics = Readonly<{
  totalWalkingDistanceMeters: number
  averageWalkingDistanceMeters: number
  totalTravelSeconds: number
  totalHandlingSeconds: number
  totalShelfAccessSeconds: number
  totalEstimatedSeconds: number
  averageEstimatedSeconds: number
  completedOrders: number
  totalItemPicks: number
  totalUnitsHandled: number
}>

export type SimulationResult = Readonly<{
  metrics: SimulationMetrics
  events: readonly PickEvent[]
  timeline: readonly PickEvent[]
  perOrder: readonly { orderId: string; distanceMeters: number; estimatedSeconds: number }[]
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
  if (!Number.isFinite(config.walkingSpeedMetersPerSecond) || config.walkingSpeedMetersPerSecond <= 0) throw new Error('Walking speed must be positive and finite')
  if (![config.handlingSecondsPerLine, config.handlingSecondsPerUnit].every((value) => Number.isFinite(value) && value >= 0)) throw new Error('Handling times must be finite and nonnegative')
  if (config.shelfAccessSeconds?.length !== 3 || !config.shelfAccessSeconds.every((value, index, all) => Number.isFinite(value) && value >= 0 && (index === 0 || value >= all[index - 1]))) throw new Error('Shelf access times must be three finite, nonnegative, nondecreasing values')
  const events: PickEvent[] = []
  const timeline: PickEvent[] = []
  const perOrder: { orderId: string; distanceMeters: number; estimatedSeconds: number }[] = []
  const rackVisits: Record<string, number> = {}
  let totalDistance = 0
  let totalHandlingSeconds = 0
  let totalShelfAccessSeconds = 0
  let totalUnits = 0

  for (const order of orders) {
    const distanceBefore = totalDistance
    const handlingBefore = totalHandlingSeconds
    if (!order.items.length) throw new Error(`Order ${order.id} contains no items`)
    const seen = new Set<string>()
    for (const item of order.items) {
      if (!layout[item.productId] || !Number.isFinite(item.quantity) || item.quantity <= 0 || seen.has(item.productId)) throw new Error(`Order ${order.id} is invalid for this layout`)
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
      const accessSeconds = config.shelfAccessSeconds[slot.level - 1]
      const handlingSeconds = config.handlingSecondsPerLine + next.quantity * config.handlingSecondsPerUnit + accessSeconds
      events.push({
        kind: 'pick',
        orderId: order.id,
        productId: next.productId,
        slotId,
        route: route.points,
        travelDistanceMeters: route.distanceMeters,
        travelSeconds: route.distanceMeters / config.walkingSpeedMetersPerSecond,
        accessSeconds,
        handlingSeconds,
      })
      timeline.push(events[events.length - 1])
      totalDistance += route.distanceMeters
      totalHandlingSeconds += handlingSeconds
      totalShelfAccessSeconds += accessSeconds
      totalUnits += next.quantity
      rackVisits[slot.rackId] = (rackVisits[slot.rackId] ?? 0) + 1
      current = slot.access
      remaining.splice(remaining.findIndex((item) => item.productId === next.productId), 1)
    }
    const returnRoute = findShortestRoute(current, PACKING_DOCK)
    if (!returnRoute) throw new Error(`No return route exists for order ${order.id}`)
    totalDistance += returnRoute.distanceMeters
    timeline.push({ kind: 'return', orderId: order.id, productId: '', slotId: 'DOCK', route: returnRoute.points, travelDistanceMeters: returnRoute.distanceMeters, travelSeconds: returnRoute.distanceMeters / config.walkingSpeedMetersPerSecond, handlingSeconds: 0, accessSeconds: 0 })
    const distanceMeters = totalDistance - distanceBefore
    perOrder.push({ orderId: order.id, distanceMeters, estimatedSeconds: distanceMeters / config.walkingSpeedMetersPerSecond + totalHandlingSeconds - handlingBefore })
  }

  const totalTravelSeconds = totalDistance / config.walkingSpeedMetersPerSecond
  const totalEstimatedSeconds = totalTravelSeconds + totalHandlingSeconds
  const completedOrders = orders.length
  return {
    events,
    timeline,
    perOrder,
    rackVisits,
    metrics: {
      totalWalkingDistanceMeters: totalDistance,
      averageWalkingDistanceMeters: completedOrders ? totalDistance / completedOrders : 0,
      totalTravelSeconds,
      totalHandlingSeconds,
      totalShelfAccessSeconds,
      totalEstimatedSeconds,
      averageEstimatedSeconds: completedOrders ? totalEstimatedSeconds / completedOrders : 0,
      completedOrders,
      totalItemPicks: events.length,
      totalUnitsHandled: totalUnits,
    },
  }
}

/** Assign observed activity ranks to slots ordered by walk time plus shelf access time. */
export function createFastMoverLayout(products: readonly Product[], config: SimulationConfig = DEFAULT_SIMULATION_CONFIG): ProductLayout {
  const productIds = products.map((product) => product.id)
  if (new Set(productIds).size !== productIds.length) throw new Error('Products must have unique IDs')
  if (products.length > VALID_SLOTS.length) throw new Error('Warehouse does not have enough valid slots')
  if (products.some(p => !Number.isFinite(p.pickFrequency) || p.pickFrequency < 0)) throw new Error('Activity scores must be finite and nonnegative')
  if (!Number.isFinite(config.walkingSpeedMetersPerSecond) || config.walkingSpeedMetersPerSecond <= 0 || config.shelfAccessSeconds?.length !== 3 || !config.shelfAccessSeconds.every((value, i, all) => Number.isFinite(value) && value >= 0 && (i === 0 || value >= all[i - 1]))) throw new Error('Invalid slot cost configuration')
  const rankedProducts = [...products].sort((a, b) => b.pickFrequency - a.pickFrequency || a.id.localeCompare(b.id))
  const rankedSlots = [...VALID_SLOTS]
    .map((slot) => {
      const out = routeToSlot(PACKING_DOCK, slot.id)
      const back = findShortestRoute(slot.access, PACKING_DOCK)
      if (!out || !back) throw new Error(`Slot ${slot.id} is not reachable from the dock`)
      return { slot, costSeconds: (out.distanceMeters + back.distanceMeters) / config.walkingSpeedMetersPerSecond + config.shelfAccessSeconds[slot.level - 1] }
    })
    .sort((a, b) => a.costSeconds - b.costSeconds || a.slot.id.localeCompare(b.slot.id))
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
  const automatic = simulateOrders(orders, productIds, createFastMoverLayout(products, config), config)
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
