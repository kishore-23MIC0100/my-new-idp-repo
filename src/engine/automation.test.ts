import { describe, expect, it } from 'vitest'
import { rankObservedActivity } from './automation'
import { validateLayout } from './warehouse'
import type { WarehouseOrder } from './simulation'

const orders: WarehouseOrder[] = [
  { id: '1', timestamp: '2011-11-01T10:00:00', items: [{ productId: 'bulk', quantity: 100 }] },
  { id: '2', timestamp: '2011-11-17T10:00:00', items: [{ productId: 'often', quantity: 1 }] },
  { id: '3', timestamp: '2011-11-23T10:00:00', items: [{ productId: 'often', quantity: 1 }] },
  { id: '4', timestamp: '2011-11-24T00:00:00', items: [{ productId: 'often', quantity: 1 }] },
  { id: '5', timestamp: '2011-11-30T23:59:59', items: [{ productId: 'often', quantity: 1 }] },
]
describe('observed activity automation', () => {
  it('distinguishes bulk units from distinct-order occurrence frequency', () => {
    const byUnits = rankObservedActivity(['bulk', 'often'], orders, 'units', 'all')
    const byOrders = rankObservedActivity(['bulk', 'often'], orders, 'orders', 'all')
    expect(byUnits.ranking[0].id).toBe('bulk')
    expect(byOrders.ranking[0].id).toBe('often')
    expect(byOrders.ranking[0].score).toBe(4)
    expect(byUnits.ranking[0].score).toBe(100)
    expect(byOrders.layout.often).toBe('R1-07-L1')
  })
  it('anchors an inclusive seven-day window to dataset history, with separate preceding week', () => {
    const activity = rankObservedActivity(['bulk', 'often'], orders, 'orders', '7')
    expect(activity.startDate).toBe('2011-11-24')
    expect(activity.endDate).toBe('2011-11-30')
    expect(activity.ranking[0]).toMatchObject({ id: 'often', score: 2, recent: 2, prior: 2, changePercent: 0 })
    expect(activity.ranking[1]).toMatchObject({ id: 'bulk', score: 0, changePercent: null })
    expect(() => validateLayout(activity.layout, ['bulk', 'often'])).not.toThrow()
  })
  it('reports missing comparison history and deterministic zero-activity ties without dropping SKUs', () => {
    const input = [orders[4]]
    const result = rankObservedActivity(['zeroB', 'often', 'zeroA'], input, 'orders', '7')
    expect(result.hasPriorWeek).toBe(false)
    expect(result.ranking.map(row => row.id)).toEqual(['often', 'zeroA', 'zeroB'])
    expect(result).toEqual(rankObservedActivity(['zeroB', 'often', 'zeroA'], input, 'orders', '7'))
    expect(new Set(Object.values(result.layout)).size).toBe(3)
  })
})
