import type { CSSProperties } from 'react'
import type { LayoutComparison, SimulationResult } from '../../engine/simulation'

type AnalyticsViewProps = {
  comparison: LayoutComparison
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

export function AnalyticsView({ comparison }: AnalyticsViewProps) {
  const { original, automatic, player } = comparison
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
      <article className="analytics-card"><h3>Why the baseline changes distance</h3><p>The automatic layout ranks products by eligible units ordered and fills the lowest round-trip dock-cost slots first. It is a reproducible frequency-aware heuristic, not a predictive AI model.</p></article>
      <article className="analytics-card"><h3>Interpretation</h3><p>A positive percentage means less walking than the documented original layout. A negative percentage means the candidate layout worsened walking distance. Travel and handling assumptions apply unchanged to every scenario.</p></article>
    </div>
  </section>
}
