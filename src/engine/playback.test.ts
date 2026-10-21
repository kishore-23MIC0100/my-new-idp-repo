import { describe, expect, it } from 'vitest'
import { playbackAt, eventSeconds } from './playback'
import { createOriginalLayout, PACKING_DOCK } from './warehouse'
import { simulateOrders, DEFAULT_SIMULATION_CONFIG } from './simulation'
const result = simulateOrders([{ id: 'test', timestamp: '2011-11-01T10:00:00', items: [{ productId: 'a', quantity: 3 }] }], ['a'], createOriginalLayout(['a']))
describe('shared playback clock', () => {
  it('covers every scored meter including return to dock', () => {
    const end = playbackAt(result.timeline, result.metrics.totalEstimatedSeconds + 1e-8)
    expect(end.complete).toBe(true)
    expect(end.position).toEqual(PACKING_DOCK)
    expect(end.completedPicks).toBe(1)
    expect(end.distance).toBe(result.metrics.totalWalkingDistanceMeters)
    expect(result.timeline.reduce((n, e) => n + eventSeconds(e), 0)).toBeCloseTo(result.metrics.totalEstimatedSeconds)
  })
  it('interpolates walking by scored distance and waits through handling', () => {
    const first = result.events[0]
    const travel = first.travelDistanceMeters / DEFAULT_SIMULATION_CONFIG.walkingSpeedMetersPerSecond
    const walking = playbackAt(result.timeline, 0.5)
    expect(walking.distance).toBeCloseTo(0.6)
    const handling = playbackAt(result.timeline, travel + 1)
    expect(handling.handling).toBe(true)
    expect(handling.completedPicks).toBe(0)
    expect(handling.position).toEqual(first.route.at(-1))
    expect(playbackAt(result.timeline, eventSeconds(first)).event?.kind).toBe('return')
  })
  it('keeps a paused position and progress stable without a new elapsed time', () => {
    expect(playbackAt(result.timeline, 12)).toEqual(playbackAt(result.timeline, 12))
    expect(playbackAt([], 0).complete).toBe(true)
  })
})
