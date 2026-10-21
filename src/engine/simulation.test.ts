import { describe, expect, it } from 'vitest'
import { createOriginalLayout } from './warehouse'
import { calculateReductionPercent, compareLayouts, createFastMoverLayout, simulateOrders, type Product, type WarehouseOrder } from './simulation'

const products: Product[] = [
  { id: 'FAST', pickFrequency: 100 },
  { id: 'SLOW', pickFrequency: 1 },
]
const orders: WarehouseOrder[] = [
  { id: 'ONE', timestamp: '2011-11-01T08:00:00', items: [{ productId: 'FAST', quantity: 2 }, { productId: 'SLOW', quantity: 1 }] },
  { id: 'TWO', timestamp: '2011-11-01T08:05:00', items: [{ productId: 'FAST', quantity: 1 }] },
]

describe('simulation engine', () => {
  it('rejects non-finite and negative configuration and quantities', () => {
    const layout = createOriginalLayout(['FAST', 'SLOW'])
    for (const speed of [NaN, Infinity, 0, -1]) expect(() => simulateOrders(orders, ['FAST', 'SLOW'], layout, { walkingSpeedMetersPerSecond: speed, handlingSecondsPerLine: 5, handlingSecondsPerUnit: 1 })).toThrow()
    expect(() => simulateOrders([{ ...orders[0], items: [{ productId: 'FAST', quantity: NaN }] }], ['FAST', 'SLOW'], layout)).toThrow()
    expect(() => simulateOrders([{ ...orders[0], items: [{ productId: 'FAST', quantity: 1 }, { productId: 'FAST', quantity: 1 }] }], ['FAST', 'SLOW'], layout)).toThrow()
  })
  it('handles no orders and rejects an empty order explicitly', () => {
    const layout = createOriginalLayout(['FAST', 'SLOW'])
    expect(simulateOrders([], ['FAST', 'SLOW'], layout).metrics.totalWalkingDistanceMeters).toBe(0)
    expect(() => simulateOrders([{ ...orders[0], items: [] }], ['FAST', 'SLOW'], layout)).toThrow('no items')
  })
  it('records return events and reconciles per-order times', () => {
    const result = simulateOrders(orders, ['FAST', 'SLOW'], createOriginalLayout(['FAST', 'SLOW']))
    expect(result.timeline.filter(e => e.kind === 'return')).toHaveLength(2)
    expect(result.perOrder.reduce((sum, order) => sum + order.estimatedSeconds, 0)).toBeCloseTo(result.metrics.totalEstimatedSeconds)
  })
  it('is deterministic when inputs, layout, and configuration are unchanged', () => {
    const layout = createOriginalLayout(products.map((product) => product.id))
    expect(simulateOrders(orders, products.map((product) => product.id), layout)).toEqual(simulateOrders(orders, products.map((product) => product.id), layout))
  })

  it('keeps travel and handling time separate', () => {
    const result = simulateOrders(orders, products.map((product) => product.id), createOriginalLayout(products.map((product) => product.id)))
    expect(result.metrics.totalItemPicks).toBe(3)
    expect(result.metrics.totalUnitsHandled).toBe(4)
    expect(result.metrics.totalHandlingSeconds).toBe(19)
    expect(result.metrics.totalEstimatedSeconds).toBe(result.metrics.totalTravelSeconds + result.metrics.totalHandlingSeconds)
  })

  it('puts the fastest product in the lowest-cost slot', () => {
    const layout = createFastMoverLayout(products)
    expect(layout.FAST).toBe('R1-07-L1')
    expect(new Set(Object.values(layout)).size).toBe(2)
  })

  it('uses the same orders for all fair comparison layouts', () => {
    const comparison = compareLayouts(products, orders)
    expect(comparison.original.metrics.completedOrders).toBe(orders.length)
    expect(comparison.automatic.metrics.completedOrders).toBe(orders.length)
    expect(comparison.player.metrics.completedOrders).toBe(orders.length)
  })

  it('shows negative reductions and has an explicit zero-baseline result', () => {
    expect(calculateReductionPercent(100, 120)).toBe(-20)
    expect(calculateReductionPercent(0, 0)).toBeNull()
  })
})
