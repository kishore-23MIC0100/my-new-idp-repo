import { createFastMoverLayout, type WarehouseOrder } from './simulation'

export type ActivityMetric = 'orders' | 'units'
export type ActivityWindow = 'all' | '7'
const DAY = 86400000
const dayOf = (timestamp: string) => Date.parse(`${timestamp.slice(0, 10)}T00:00:00Z`)
function dayLabel(day: number) {
  const date = new Date(day)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/** Descriptive activity ranking only. No future observations or fitted forecast are invented. */
export function rankObservedActivity(productIds: readonly string[], orders: readonly WarehouseOrder[], metric: ActivityMetric, window: ActivityWindow) {
  if (!orders.length) throw new Error('Activity ranking needs order history')
  const lastDay = Math.max(...orders.map(order => dayOf(order.timestamp)))
  const firstDay = Math.min(...orders.map(order => dayOf(order.timestamp)))
  const cutoff = window === '7' ? lastDay - 6 * DAY : firstDay
  const rows = new Map(productIds.map(id => [id, { id, units: 0, orders: 0, recentUnits: 0, recentOrders: 0, priorUnits: 0, priorOrders: 0 }]))
  for (const order of orders) {
    const day = dayOf(order.timestamp)
    const seen = new Set<string>()
    for (const item of order.items) {
      const row = rows.get(item.productId)
      if (!row) throw new Error(`Unknown product ${item.productId}`)
      const occurrence = seen.has(item.productId) ? 0 : 1
      seen.add(item.productId)
      if (day >= cutoff) { row.units += item.quantity; row.orders += occurrence }
      if (day >= lastDay - 6 * DAY) { row.recentUnits += item.quantity; row.recentOrders += occurrence }
      else if (day >= lastDay - 13 * DAY) { row.priorUnits += item.quantity; row.priorOrders += occurrence }
    }
  }
  const ranking = [...rows.values()].map(row => {
    const recent = metric === 'units' ? row.recentUnits : row.recentOrders
    const prior = metric === 'units' ? row.priorUnits : row.priorOrders
    return { ...row, score: row[metric], recent, prior, changePercent: prior ? (recent - prior) / prior * 100 : null }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const layout = createFastMoverLayout(ranking.map(row => ({ id: row.id, pickFrequency: row.score })))
  return { ranking, layout, startDate: dayLabel(Math.max(cutoff, firstDay)), endDate: dayLabel(lastDay), hasPriorWeek: firstDay <= lastDay - 13 * DAY }
}
