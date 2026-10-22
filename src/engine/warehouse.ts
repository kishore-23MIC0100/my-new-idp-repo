export type GridPoint = Readonly<{ x: number; y: number }>
export type Slot = Readonly<{
  id: string
  rackId: string
  level: 1 | 2 | 3
  access: GridPoint
  position: GridPoint
}>

export type Route = Readonly<{
  points: GridPoint[]
  distanceMeters: number
}>

export type ProductLayout = Readonly<Record<string, string>>

export const CELL_SIZE_METERS = 1.5
export const WAREHOUSE_SIZE = { width: 30, height: 20 } as const
export const PACKING_DOCK: GridPoint = { x: 2, y: 17 }

const RACK_COLUMNS = [5, 9, 13, 17, 21, 25] as const
const RACK_Y_VALUES = [3, 5, 7, 9, 11, 13, 15] as const

export const RACK_BLOCKS = RACK_COLUMNS.map((x, index) => ({ id: `R${index + 1}`, x, yStart: 3, yEnd: 16 }))

const pointKey = ({ x, y }: GridPoint) => `${x},${y}`
const slotsById = new Map<string, Slot>()
const blockedCellKeys = new Set<string>()
const routeCache = new Map<string, Route | null>()

for (const rackX of RACK_COLUMNS) {
  for (let y = 3; y <= 16; y += 1) {
    blockedCellKeys.add(pointKey({ x: rackX, y }))
    blockedCellKeys.add(pointKey({ x: rackX + 1, y }))
  }
}

export const VALID_SLOTS: readonly Slot[] = RACK_COLUMNS.flatMap((rackX, rackIndex) =>
  RACK_Y_VALUES.flatMap((y, rowIndex) => {
    const rackId = `R${rackIndex + 1}-${String(rowIndex + 1).padStart(2, '0')}`
    return ([1, 2, 3] as const).flatMap((level) => {
      const left: Slot = { id: `${rackId}-L${level}`, rackId, level, access: { x: rackX - 1, y }, position: { x: rackX, y } }
      const right: Slot = { id: `${rackId}-R${level}`, rackId, level, access: { x: rackX + 2, y }, position: { x: rackX + 1, y } }
      return [left, right]
    })
  }),
)

for (const slot of VALID_SLOTS) slotsById.set(slot.id, slot)

export function isInsideWarehouse(point: GridPoint): boolean {
  return point.x >= 0 && point.x < WAREHOUSE_SIZE.width && point.y >= 0 && point.y < WAREHOUSE_SIZE.height
}

export function isTraversable(point: GridPoint): boolean {
  return isInsideWarehouse(point) && !blockedCellKeys.has(pointKey(point))
}

export function getSlot(slotId: string): Slot | undefined {
  return slotsById.get(slotId)
}

export function getNeighbors(point: GridPoint): GridPoint[] {
  return [
    { x: point.x, y: point.y - 1 },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x - 1, y: point.y },
  ].filter(isTraversable)
}

function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function reconstruct(cameFrom: Map<string, GridPoint>, start: GridPoint, goal: GridPoint): GridPoint[] {
  const path = [goal]
  let current = goal
  while (pointKey(current) !== pointKey(start)) {
    const previous = cameFrom.get(pointKey(current))
    if (!previous) throw new Error('Route reconstruction failed')
    path.push(previous)
    current = previous
  }
  return path.reverse()
}

/** A* over only physical aisle cells. Tie-breaks always by x then y for reproducibility. */
export function findShortestRoute(start: GridPoint, goal: GridPoint): Route | null {
  if (!isTraversable(start) || !isTraversable(goal)) return null
  const cacheKey = `${pointKey(start)}>${pointKey(goal)}`
  const cached = routeCache.get(cacheKey)
  if (cached !== undefined) return cached

  const open: GridPoint[] = [start]
  const cameFrom = new Map<string, GridPoint>()
  const gScore = new Map<string, number>([[pointKey(start), 0]])

  while (open.length) {
    open.sort((a, b) => {
      const score = (gScore.get(pointKey(a)) ?? Infinity) + manhattan(a, goal) - (gScore.get(pointKey(b)) ?? Infinity) - manhattan(b, goal)
      return score || a.x - b.x || a.y - b.y
    })
    const current = open.shift()
    if (!current) break
    if (pointKey(current) === pointKey(goal)) {
      const points = reconstruct(cameFrom, start, goal)
      const result = { points, distanceMeters: (points.length - 1) * CELL_SIZE_METERS }
      routeCache.set(cacheKey, result)
      return result
    }
    for (const neighbor of getNeighbors(current)) {
      const tentative = (gScore.get(pointKey(current)) ?? Infinity) + 1
      if (tentative < (gScore.get(pointKey(neighbor)) ?? Infinity)) {
        cameFrom.set(pointKey(neighbor), current)
        gScore.set(pointKey(neighbor), tentative)
        if (!open.some((candidate) => pointKey(candidate) === pointKey(neighbor))) open.push(neighbor)
      }
    }
  }
  routeCache.set(cacheKey, null)
  return null
}

export function routeToSlot(start: GridPoint, slotId: string): Route | null {
  const slot = getSlot(slotId)
  return slot ? findShortestRoute(start, slot.access) : null
}

export function createOriginalLayout(productIds: readonly string[]): ProductLayout {
  if (new Set(productIds).size !== productIds.length) throw new Error('Product IDs must be unique')
  if (productIds.length > VALID_SLOTS.length) throw new Error('Warehouse does not have enough valid slots for these products')
  return Object.fromEntries(productIds.map((productId, index) => [productId, VALID_SLOTS[index].id]))
}

export function validateLayout(layout: ProductLayout, productIds: readonly string[]): void {
  const expected = new Set(productIds)
  const assigned = Object.keys(layout)
  if (assigned.length !== expected.size || assigned.some((productId) => !expected.has(productId))) throw new Error('Layout must assign every expected product exactly once')
  const slots = Object.values(layout)
  if (slots.some((slotId) => !getSlot(slotId))) throw new Error('Layout contains an invalid slot')
  if (new Set(slots).size !== slots.length) throw new Error('Layout contains duplicate occupied slots')
}

export function clearRouteCache(): void {
  routeCache.clear()
}
