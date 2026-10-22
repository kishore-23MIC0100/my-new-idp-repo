import { describe, expect, it } from 'vitest'
import {
  CELL_SIZE_METERS,
  PACKING_DOCK,
  VALID_SLOTS,
  createOriginalLayout,
  findShortestRoute,
  getSlot,
  isTraversable,
  routeToSlot,
  validateLayout,
} from './warehouse'

describe('warehouse route engine', () => {
  it('uses only traversable orthogonal cells and measures waypoint distance', () => {
    const route = findShortestRoute({ x: 2, y: 4 }, { x: 8, y: 4 })
    expect(route).not.toBeNull()
    expect(route?.points.every(isTraversable)).toBe(true)
    expect(route?.points.every((point, index, points) => index === 0 || Math.abs(point.x - points[index - 1].x) + Math.abs(point.y - points[index - 1].y) === 1)).toBe(true)
    expect(route?.distanceMeters).toBe((route!.points.length - 1) * CELL_SIZE_METERS)
  })

  it('routes to a reachable rack-face access point rather than through a rack', () => {
    const slot = VALID_SLOTS.find((candidate) => candidate.id === 'R2-04-L1')
    expect(slot).toBeDefined()
    const route = routeToSlot(PACKING_DOCK, slot!.id)
    expect(route?.points.at(-1)).toEqual(slot!.access)
    expect(route?.points.some((point) => point.x === slot!.position.x && point.y === slot!.position.y)).toBe(false)
  })

  it('returns null for invalid or obstructed route endpoints', () => {
    expect(findShortestRoute(PACKING_DOCK, { x: 5, y: 4 })).toBeNull()
    expect(routeToSlot(PACKING_DOCK, 'missing-slot')).toBeNull()
  })

  it('creates a complete unique original layout and rejects duplicate slots', () => {
    const products = ['A', 'B', 'C']
    const layout = createOriginalLayout(products)
    expect(Object.keys(layout)).toEqual(products)
    validateLayout(layout, products)
    expect(() => validateLayout({ A: VALID_SLOTS[0].id, B: VALID_SLOTS[0].id, C: VALID_SLOTS[2].id }, products)).toThrow('duplicate')
    expect(() => createOriginalLayout(['A', 'A'])).toThrow('unique')
    expect(getSlot(layout.A)).toBeDefined()
  })
})
