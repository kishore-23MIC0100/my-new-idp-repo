import { eventSeconds, playbackAt } from './playback'
import type { PickEvent } from './simulation'

export const PICKER_COLORS = ['#00e5ff', '#ffb83d', '#ba8cff', '#69ef9e'] as const
export type PickerAssignment = { id: number; orderId: string; timeline: readonly PickEvent[]; startSeconds: number; duration: number }

/** One distinct order per worker in a wave. The final wave never wraps or duplicates orders. */
export function createPickerWave(timeline: readonly PickEvent[], orderIds: readonly string[], startIndex: number, count: number): PickerAssignment[] {
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error('Choose between one and four pickers')
  if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= orderIds.length) return []
  return orderIds.slice(startIndex, startIndex + count).map((orderId, index) => {
    const events = timeline.filter(event => event.orderId === orderId)
    return { id: index + 1, orderId, timeline: events, startSeconds: index * 3, duration: events.reduce((sum, event) => sum + eventSeconds(event), 0) }
  })
}

export function pickerAt(assignment: PickerAssignment, elapsed: number) {
  const localElapsed = Math.max(0, elapsed - assignment.startSeconds)
  return { ...assignment, ...playbackAt(assignment.timeline, localElapsed), localElapsed, waiting: elapsed < assignment.startSeconds, color: PICKER_COLORS[assignment.id - 1] }
}
export type PickerState = ReturnType<typeof pickerAt>
export const waveDuration = (wave: readonly PickerAssignment[]) => Math.max(0, ...wave.map(worker => worker.startSeconds + worker.duration))

/** Step to the next departure, completed pick, or dock return anywhere in the team. */
export function nextWaveEvent(wave: readonly PickerAssignment[], elapsed: number): number {
  const boundaries = wave.flatMap(worker => {
    let time = worker.startSeconds
    return [time, ...worker.timeline.map(event => { time += eventSeconds(event); return time })]
  }).filter(time => time > elapsed + 0.000001)
  return boundaries.length ? Math.min(...boundaries) : waveDuration(wave)
}
