import { describe, expect, it } from 'vitest'
import retailData from '../../public/data/retail-2011-11.json'
import { compareLayouts, type Product, type WarehouseOrder } from './simulation'

describe('real November 2011 dataset simulation', () => {
  it('scores every exported order consistently across original, automatic, and player layouts', () => {
    const products: Product[] = retailData.products.map((product) => ({ id: product.id, pickFrequency: product.pickFrequency }))
    const orders: WarehouseOrder[] = retailData.orders
    const comparison = compareLayouts(products, orders)

    expect(products).toHaveLength(100)
    expect(comparison.original.metrics.completedOrders).toBe(2341)
    expect(comparison.automatic.metrics.completedOrders).toBe(2341)
    expect(comparison.player.metrics.completedOrders).toBe(2341)
    expect(comparison.original.metrics.totalItemPicks).toBe(14043)
    expect(comparison.original.metrics.totalWalkingDistanceMeters).toBeGreaterThan(0)
    expect(comparison.automatic.metrics.totalWalkingDistanceMeters).toBeGreaterThan(0)
  }, 30_000)
})
