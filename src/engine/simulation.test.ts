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
