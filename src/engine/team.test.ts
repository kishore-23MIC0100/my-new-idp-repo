import { describe, expect, it } from 'vitest'
import { createPickerWave, nextWaveEvent, pickerAt, waveDuration } from './team'
import { simulateOrders } from './simulation'
import { createOriginalLayout, getSlot, PACKING_DOCK } from './warehouse'
import { playbackAt } from './playback'

const orders = [1, 2, 3, 4].map(n => ({ id: `o${n}`, timestamp: '2011-11-01T10:00:00', items: [{ productId: 'a', quantity: n * 5 }] }))
const result = simulateOrders(orders, ['a'], createOriginalLayout(['a']))
const ids = orders.map(order => order.id)

describe('concurrent picker wave', () => {
  it('assigns unique actual orders and preserves all scored distance and handling', () => {
    const wave = createPickerWave(result.timeline, ids, 0, 4)
    expect(wave.map(w => w.orderId)).toEqual(ids)
    expect(wave.reduce((sum, w) => sum + w.duration, 0)).toBeCloseTo(result.metrics.totalEstimatedSeconds)
    const finished = wave.map(w => pickerAt(w, waveDuration(wave)))
    expect(finished.every(w => w.complete && w.completedPicks === 1 && w.position === PACKING_DOCK)).toBe(true)
    expect(finished.reduce((sum, w) => sum + w.distance, 0)).toBe(result.metrics.totalWalkingDistanceMeters)
  })
  it('staggered departures and a shared frozen clock preserve independent positions', () => {
    const wave = createPickerWave(result.timeline, ids, 0, 3)
    expect(pickerAt(wave[1], 2).waiting).toBe(true)
    expect(pickerAt(wave[1], 2).distance).toBe(0)
    expect(pickerAt(wave[0], 4).distance).toBeCloseTo(4.8)
    expect(pickerAt(wave[1], 4).distance).toBeCloseTo(1.2)
    expect(wave.map(w => pickerAt(w, 8))).toEqual(wave.map(w => pickerAt(w, 8)))
    expect(nextWaveEvent(wave, 0)).toBe(3)
  })
  it('ends with every worker at dock and never reuses orders at the dataset boundary', () => {
    expect(createPickerWave(result.timeline, ids, 3, 4).map(w => w.orderId)).toEqual(['o4'])
    expect(createPickerWave(result.timeline, ids, 4, 4)).toEqual([])
    expect(() => createPickerWave(result.timeline, ids, 0, 0)).toThrow()
    const wave = createPickerWave(result.timeline, ids, 0, 4)
    let elapsed = 0
    let steps = 0
    while (elapsed < waveDuration(wave) && steps++ < 100) elapsed = nextWaveEvent(wave, elapsed)
    expect(steps).toBeLessThan(100)
    expect(wave.every(w => pickerAt(w, elapsed).complete)).toBe(true)
  })
  it('faces the walking direction and then the correct shelf during handling', () => {
    const event = result.events[0]
    const walking = playbackAt([event], 0.25)
    expect(walking.heading).toBe(Math.atan2(event.route[1].x - event.route[0].x, event.route[1].y - event.route[0].y))
    const handling = playbackAt([event], event.travelDistanceMeters / 1.2 + 1)
    const slot = getSlot(event.slotId)!
    expect(handling.heading).toBe(Math.atan2(slot.position.x - slot.access.x, slot.position.y - slot.access.y))
    expect(handling.handlingElapsed).toBeCloseTo(1)
  })
})
