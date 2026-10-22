import { CELL_SIZE_METERS, PACKING_DOCK, getSlot, type GridPoint } from './warehouse'
import { type PickEvent } from './simulation'

export const eventSeconds = (event: PickEvent) => event.travelSeconds + event.handlingSeconds

/** One clock drives both the scene and telemetry. Elapsed time includes handling. */
export function playbackAt(timeline: readonly PickEvent[], elapsed: number) {
  let start = 0
  let completedPicks = 0
  let distance = 0
  for (let index = 0; index < timeline.length; index++) {
    const event = timeline[index]
    const duration = eventSeconds(event)
    if (elapsed < start + duration) {
      const travelled = event.travelSeconds > 0 ? Math.min(event.travelDistanceMeters, Math.max(0, elapsed - start) / event.travelSeconds * event.travelDistanceMeters) : 0
      const pathIndex = travelled / CELL_SIZE_METERS
      const segment = Math.min(Math.floor(pathIndex), event.route.length - 1)
      const a = event.route[segment] ?? PACKING_DOCK
      const b = event.route[Math.min(segment + 1, event.route.length - 1)] ?? a
      const fraction = pathIndex - segment
      const position: GridPoint = { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction }
      const handling = travelled >= event.travelDistanceMeters
      const target = handling && event.kind === 'pick' ? getSlot(event.slotId)?.position : b
      const heading = target ? Math.atan2(target.x - position.x, target.y - position.y) : 0
      const handlingElapsed = Math.max(0, elapsed - start - event.travelSeconds)
      const accessing = handling && handlingElapsed < event.accessSeconds
      return { event, index, completedPicks, position, heading, handlingElapsed, accessing, distance: distance + travelled, handling, complete: false }
    }
    start += duration
    distance += event.travelDistanceMeters
    if (event.kind === 'pick') completedPicks++
  }
  return { event: undefined, index: timeline.length, completedPicks, position: PACKING_DOCK, heading: 0, handlingElapsed: 0, accessing: false, distance, handling: false, complete: true }
}
