import type { CSSProperties } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LayoutComparison, SimulationResult } from '../../engine/simulation'
import type { Product } from '../../engine/simulation'

type AnalyticsViewProps = {
  comparison: LayoutComparison
  products: readonly Product[]
}

const formatDistance = (value: number) => `${Math.round(value).toLocaleString()} m`
const formatTime = (value: number) => `${(value / 60).toFixed(1)} min`
const formatPercent = (value: number | null) => value === null ? 'n.a.' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

function ScenarioRow({ name, result, reduction }: { name: string; result: SimulationResult; reduction: number | null }) {
  return <tr><th>{name}</th><td>{formatDistance(result.metrics.totalWalkingDistanceMeters)}</td><td>{formatDistance(result.metrics.averageWalkingDistanceMeters)}</td><td>{formatTime(result.metrics.totalEstimatedSeconds)}</td><td>{formatTime(result.metrics.averageEstimatedSeconds)}</td><td className={reduction !== null && reduction < 0 ? 'negative' : 'positive'}>{formatPercent(reduction)}</td></tr>
}

function RackHeatmap({ result }: { result: SimulationResult }) {
  const entries = Object.entries(result.rackVisits).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const max = Math.max(...entries.map(([, count]) => count), 1)
  return <div className="heatmap-grid" aria-label="Rack visits from player-layout simulation">
    {entries.slice(0, 24).map(([rack, count]) => <div className="heat-cell" key={rack} style={{ '--heat': count / max } as CSSProperties}><span>{rack}</span><b>{count}</b></div>)}
  </div>
}

function orderDistances(result: SimulationResult) {
  const totals = new Map<string, number>()
  for (const event of result.events) totals.set(event.orderId, (totals.get(event.orderId) ?? 0) + event.travelDistanceMeters)
  return [...totals.values()]
}

export function AnalyticsView({ comparison, products }: AnalyticsViewProps) {
  const { original, automatic, player } = comparison
  const originalDistances = orderDistances(original)
  const automaticDistances = orderDistances(automatic)
  const playerDistances = orderDistances(player)
  const chartData = originalDistances.map((distance, index) => ({ order: index + 1, original: Math.round(distance), automatic: Math.round(automaticDistances[index] ?? 0), player: Math.round(playerDistances[index] ?? 0) }))
  const rankedProducts = [...products].sort((a, b) => b.pickFrequency - a.pickFrequency).slice(0, 6)
  return <section className="analytics-view" aria-label="Simulation analytics" tabIndex={-1}>
    <div className="analytics-intro"><div><p className="eyebrow">SAME ORDERS · SAME ROUTES · DIFFERENT SLOT ASSIGNMENT</p><h2>Measured layout comparison</h2></div><p>Walking and handling time are calculated separately. Improvement uses the original layout as its denominator.</p></div>
    <div className="analytics-summary">
      <div><span>PLAYER WALK CHANGE</span><strong className={comparison.playerDistanceReductionPercent !== null && comparison.playerDistanceReductionPercent < 0 ? 'negative' : 'positive'}>{formatPercent(comparison.playerDistanceReductionPercent)}</strong><small>vs. original total distance</small></div>
      <div><span>AUTO WALK CHANGE</span><strong className={comparison.automaticDistanceReductionPercent !== null && comparison.automaticDistanceReductionPercent < 0 ? 'negative' : 'positive'}>{formatPercent(comparison.automaticDistanceReductionPercent)}</strong><small>frequency-aware baseline</small></div>
      <div><span>EXPORTED ORDERS</span><strong>{player.metrics.completedOrders.toLocaleString()}</strong><small>{player.metrics.totalItemPicks.toLocaleString()} product picks</small></div>
      <div><span>UNITS HANDLED</span><strong>{player.metrics.totalUnitsHandled.toLocaleString()}</strong><small>same in every scenario</small></div>
    </div>
    <div className="analytics-grid">
      <article className="analytics-card comparison-card"><h3>Scenario metrics</h3><div className="table-scroll"><table><thead><tr><th>Layout</th><th>Total walk</th><th>Avg. walk</th><th>Total est. time</th><th>Avg. est. time</th><th>Distance Δ</th></tr></thead><tbody><ScenarioRow name="Original" result={original} reduction={0} /><ScenarioRow name="Automatic baseline" result={automatic} reduction={comparison.automaticDistanceReductionPercent} /><ScenarioRow name="Player layout" result={player} reduction={comparison.playerDistanceReductionPercent} /></tbody></table></div><p className="method-note">Estimated time = travel time at 1.2 m/s + handling time (5 s per line + 1 s per unit).</p></article>
      <article className="analytics-card"><h3>Player rack-visit heatmap</h3><p className="method-note">Counts come directly from scored pick events for the current player layout. Brighter cells have more visits.</p><RackHeatmap result={player} /></article>
    </div>
    <div className="analytics-grid explanation-grid">
      <article className="analytics-card"><h3>Distance by order</h3><div className="distance-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="#273650" strokeDasharray="3 3" /><XAxis dataKey="order" tick={{ fill: '#8da0b9', fontSize: 9 }} /><YAxis tick={{ fill: '#8da0b9', fontSize: 9 }} /><Tooltip contentStyle={{ background: '#0c1629', border: '1px solid #2d3c56' }} /><Legend wrapperStyle={{ fontSize: 10 }} /><Line type="monotone" dataKey="original" name="Original" stroke="#6b8caf" dot={false} /><Line type="monotone" dataKey="automatic" name="Automatic" stroke="#39e6a5" dot={false} /><Line type="monotone" dataKey="player" name="Player" stroke="#ed4eb7" dot={false} /></LineChart></ResponsiveContainer></div></article>
      <article className="analytics-card"><h3>Fast-moving products</h3><div className="category-breakdown">{rankedProducts.map((product) => <div key={product.id}><span>{product.id}</span><b>{product.pickFrequency.toLocaleString()} units</b></div>)}</div></article>
      <article className="analytics-card"><h3>Interpretation</h3><p>A positive percentage means less walking than the documented original layout. A negative percentage means the candidate layout worsened walking distance. Travel and handling assumptions apply unchanged to every scenario.</p></article>
    </div>
  </section>
}
