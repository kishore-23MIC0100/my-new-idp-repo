import { describe, expect, it } from 'vitest'
import { DEFAULT_SIMULATION_CONFIG, createFastMoverLayout, simulateOrders } from './simulation'
import { eventSeconds, playbackAt } from './playback'
import { getSlot } from './warehouse'

const orders = [{ id: 'order', timestamp: '2011-11-01T10:00:00', items: [{ productId: 'a', quantity: 2 }] }]
describe('shelf retrieval cost', () => {
  it('charges L1/L2/L3 differently without changing the horizontal route or number of picks', () => {
    const results = [1, 2, 3].map(level => simulateOrders(orders, ['a'], { a: `R1-07-L${level}` }))
    expect(results.map(r => r.metrics.totalShelfAccessSeconds)).toEqual([0, 6, 12])
    expect(results.map(r => r.metrics.totalHandlingSeconds)).toEqual([7, 13, 19])
    expect(new Set(results.map(r => r.metrics.totalWalkingDistanceMeters)).size).toBe(1)
    expect(results[2].metrics.totalEstimatedSeconds - results[0].metrics.totalEstimatedSeconds).toBeCloseTo(12)
    expect(results.every(r => r.metrics.totalItemPicks === 1 && r.metrics.totalUnitsHandled === 2)).toBe(true)
  })
  it('replays access before handling and reconciles custom walking speed with total time', () => {
    const result = simulateOrders(orders, ['a'], { a: 'R1-07-L3' }, { ...DEFAULT_SIMULATION_CONFIG, walkingSpeedMetersPerSecond: 0.6 })
    const event = result.events[0]
    expect(playbackAt(result.timeline, 1).distance).toBeCloseTo(0.6)
    const access = playbackAt(result.timeline, event.travelSeconds + 5)
    expect(access.accessing).toBe(true)
    expect(access.completedPicks).toBe(0)
    expect(access.position).toEqual(event.route.at(-1))
    expect(playbackAt(result.timeline, event.travelSeconds + 12).accessing).toBe(false)
    expect(playbackAt(result.timeline, eventSeconds(event)).completedPicks).toBe(1)
    expect(result.timeline.reduce((sum, e) => sum + eventSeconds(e), 0)).toBeCloseTo(result.metrics.totalEstimatedSeconds)
  })
  it('slotting considers shelf access and validates its cost assumptions', () => {
    const products = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, pickFrequency: 100 - i }))
    const withoutAccess = createFastMoverLayout(products, { ...DEFAULT_SIMULATION_CONFIG, shelfAccessSeconds: [0, 0, 0] })
    const withAccess = createFastMoverLayout(products, { ...DEFAULT_SIMULATION_CONFIG, shelfAccessSeconds: [0, 100, 200] })
    expect(Object.values(withAccess).every(slot => getSlot(slot)?.level === 1)).toBe(true)
    expect(Object.values(withoutAccess).some(slot => getSlot(slot)?.level === 3)).toBe(true)
    for (const costs of [[0, -1, 12], [0, 12, 6], [0, NaN, 12]] as const) {
      expect(() => simulateOrders(orders, ['a'], { a: 'R1-07-L1' }, { ...DEFAULT_SIMULATION_CONFIG, shelfAccessSeconds: costs })).toThrow()
    }
  })
})
