import { useMemo } from 'react'
import { Activity, CheckCheck, Clock3 } from 'lucide-react'
import { eventSeconds } from '../../engine/playback'
import { PICKER_COLORS, type PickerAssignment } from '../../engine/team'

const timestamp = (seconds: number) => {
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`
}

export function TeamActivity({ wave, elapsed, onSelect }: {
  wave: readonly PickerAssignment[]
  elapsed: number
  onSelect: (pickerIndex: number, productId?: string) => void
}) {
  const events = useMemo(() => wave.flatMap(worker => {
    let time = worker.startSeconds
    return worker.timeline.map((event, index) => {
      time += eventSeconds(event)
      return { event, time, workerId: worker.id, key: `${worker.id}-${index}` }
    })
  }).sort((a, b) => a.time - b.time || a.workerId - b.workerId), [wave])
  const completed = events.filter(item => item.time <= elapsed)
  const upcoming = events.filter(item => item.time > elapsed)
  const rows = completed.length ? completed.slice(-4).reverse() : upcoming.slice(0, 3)
  const allDone = events.length > 0 && completed.length === events.length

  return <section className="panel team-activity" aria-labelledby="team-activity-title">
    <h2 id="team-activity-title"><Activity size={19} />Team activity<small>Current wave · simulated time</small></h2>
    <p className="activity-caption">{allDone ? 'Wave finished. All dock returns are recorded.' : completed.length ? 'Latest completed events across your team.' : 'Next scheduled completions. Start the replay to record activity.'}</p>
    <ol aria-label={completed.length ? 'Completed team events' : 'Upcoming team events'}>
      {rows.map(item => <li key={item.key}>
        <button onClick={() => onSelect(item.workerId - 1, item.event.kind === 'pick' ? item.event.productId : undefined)}>
          <time>{timestamp(item.time)}</time>
          <i style={{ background: PICKER_COLORS[item.workerId - 1] }} />
          <span><strong>Picker {item.workerId} · {item.event.kind === 'pick' ? `${completed.length ? 'Picked' : 'Pick'} ${item.event.productId}` : completed.length ? 'Returned to dock' : 'Return to dock'}</strong><small>{item.event.kind === 'pick' ? `${item.event.slotId} · Order #${item.event.orderId}` : `Order #${item.event.orderId}`}</small></span>
          <span className={completed.length ? 'activity-done' : 'activity-upcoming'}>{completed.length ? <CheckCheck size={16} /> : <Clock3 size={16} />}{completed.length ? 'Done' : 'Planned'}</span>
        </button>
      </li>)}
    </ol>
    {!events.length && <p className="activity-caption">Activity will appear when the order data is ready.</p>}
    {completed.length > 0 && upcoming[0] && <p className="activity-next">Next completion at {timestamp(upcoming[0].time)} · Picker {upcoming[0].workerId} · {upcoming[0].event.kind === 'pick' ? `SKU ${upcoming[0].event.productId}` : 'Dock return'}</p>}
  </section>
}
