import { describe, expect, it } from 'vitest'
import retailData from '../../public/data/retail-2011-11.json'
import { compareLayouts, type Product, type WarehouseOrder } from './simulation'
import { parseRetailDataset } from '../data/retailDataset'

describe('real November 2011 dataset simulation', () => {
  it('scores every exported order consistently across original, automatic, and player layouts', () => {
    const parsedDataset = parseRetailDataset(retailData)
    const products: Product[] = parsedDataset.products.map((product) => ({ id: product.id, pickFrequency: product.pickFrequency }))
    const orders: readonly WarehouseOrder[] = parsedDataset.orders
    const comparison = compareLayouts(products, orders)

    expect(products).toHaveLength(100)
    expect(comparison.original.metrics.completedOrders).toBe(2341)
    expect(comparison.automatic.metrics.completedOrders).toBe(2341)
    expect(comparison.player.metrics.completedOrders).toBe(2341)
    expect(comparison.original.metrics.totalItemPicks).toBe(14043)
    expect(comparison.original.metrics.totalWalkingDistanceMeters).toBeGreaterThan(0)
    expect(comparison.automatic.metrics.totalWalkingDistanceMeters).toBeGreaterThan(0)
    expect(Object.values(comparison.player.rackVisits).reduce((total, visits) => total + visits, 0)).toBe(comparison.player.metrics.totalItemPicks)
    const firstOrder = orders[0]
    const firstOrderPickLegs = comparison.original.events.filter((event) => event.orderId === firstOrder.id).reduce((total, event) => total + event.travelDistanceMeters, 0)
    expect(comparison.original.orderDistances[0].distanceMeters).toBeGreaterThan(firstOrderPickLegs)
  }, 30_000)
})
