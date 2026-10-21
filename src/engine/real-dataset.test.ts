import { describe, expect, it } from 'vitest'
import retailData from '../../public/data/retail-2011-11.json'
import { compareLayouts, type Product, type WarehouseOrder } from './simulation'

describe('real November 2011 dataset simulation', () => {
  it('scores every exported order consistently across original, automatic, and player layouts', () => {
    const products: Product[] = retailData.products.map((product) => ({ id: product.id, pickFrequency: product.pickFrequency }))
    const orders: WarehouseOrder[] = retailData.orders
    const comparison = compareLayouts(products, orders)

    expect(products).toHaveLength(100)
    expect(comparison.original.metrics.completedOrders).toBe(2339)
    expect(comparison.automatic.metrics.completedOrders).toBe(2339)
    expect(comparison.player.metrics.completedOrders).toBe(2339)
    expect(comparison.original.metrics.totalItemPicks).toBe(14042)
    expect(comparison.original.perOrder.reduce((total, order) => total + order.distanceMeters, 0)).toBe(comparison.original.metrics.totalWalkingDistanceMeters)
    expect(comparison.original.timeline.reduce((total, event) => total + event.travelDistanceMeters, 0)).toBe(comparison.original.metrics.totalWalkingDistanceMeters)
    expect(comparison.player.metrics.totalUnitsHandled).toBe(266506)
    expect(comparison.original.metrics.totalWalkingDistanceMeters).toBeGreaterThan(0)
    expect(comparison.automatic.metrics.totalWalkingDistanceMeters).toBeGreaterThan(0)
    expect(Object.values(comparison.player.rackVisits).reduce((total, visits) => total + visits, 0)).toBe(comparison.player.metrics.totalItemPicks)
  }, 30_000)
})
