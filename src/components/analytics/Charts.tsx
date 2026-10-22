import { memo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LayoutComparison, SimulationResult } from '../../engine/simulation'
import { getSlot, RACK_BLOCKS } from '../../engine/warehouse'

export const DistanceChart = memo(function DistanceChart({ comparison }: { comparison: LayoutComparison }) {
  const data = comparison.original.perOrder.map((order, i) => ({ order: i + 1, invoice: order.orderId, Original: order.distanceMeters, Baseline: comparison.automatic.perOrder[i].distanceMeters, Player: comparison.player.perOrder[i].distanceMeters }))
  return <div className="distance-chart" aria-label="Distance per order in meters, including the return to dock"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}><CartesianGrid stroke="#22334e" strokeDasharray="3 3" /><XAxis dataKey="order" tick={{ fill: '#a8b3c7', fontSize: 13 }} minTickGap={35} /><YAxis unit="m" tick={{ fill: '#a8b3c7', fontSize: 13 }} /><Tooltip contentStyle={{ background: '#101b30', border: '1px solid #334155', fontSize: 14 }} /><Legend wrapperStyle={{ fontSize: 13 }} />{(['Original', 'Baseline', 'Player'] as const).map((name, i) => <Line key={name} dataKey={name} stroke={['#168dff', '#39ff14', '#ff007a'][i]} strokeWidth={1.3} dot={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div>
})

export const RackHeatmap = memo(function RackHeatmap({ result, layer }: { result: SimulationResult; layer: 'all' | 1 | 2 | 3 }) {
  const counts: Record<string, number> = {}
  for (const event of result.events) {
    const slot = getSlot(event.slotId)!
    if (layer === 'all' || slot.level === layer) counts[slot.rackId] = (counts[slot.rackId] ?? 0) + 1
  }
  const max = Math.max(1, ...Object.values(counts))
  return <div className="heatmap-wrap"><div className="spatial-heatmap">{RACK_BLOCKS.map((rack) => <div className="heatmap-rack" key={rack.id}><small>{rack.id.replace('R', 'A')}</small>{Array.from({ length: 7 }, (_, row) => {
    const id = `${rack.id}-${String(row + 1).padStart(2, '0')}`
    const count = counts[id] ?? 0
    return <div tabIndex={0} key={id} title={`${id}: ${count} picks`} aria-label={`${id}: ${count} picks`} style={{ background: count ? `hsl(${220 - count / max * 220} 95% 50%)` : '#142440' }}><span>{count}</span></div>
  })}</div>)}</div><div className="heat-scale"><span>High</span><i /><span>Low</span></div></div>
})
