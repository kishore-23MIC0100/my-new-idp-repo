import type { Product, WarehouseOrder } from '../engine/simulation'

export type RetailProduct = Product & { code: string; description: string }
export type RetailDataset = { metadata: { selectedPeriod: string; sourceSha256?: string }; products: RetailProduct[]; orders: WarehouseOrder[] }

export function validateDataset(value: unknown): asserts value is RetailDataset {
  if (!value || typeof value !== 'object') throw new Error('Dataset must be an object')
  const data = value as RetailDataset
  if (!data.metadata || typeof data.metadata.selectedPeriod !== 'string' || !Array.isArray(data.products) || !data.products.length || !Array.isArray(data.orders) || !data.orders.length) throw new Error('Dataset metadata, products or orders are missing')
  const ids = new Set<string>()
  for (const p of data.products) {
    if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id) || typeof p.code !== 'string' || typeof p.description !== 'string' || !Number.isFinite(p.pickFrequency) || p.pickFrequency <= 0) throw new Error('Invalid product record')
    ids.add(p.id)
  }
  const orderIds = new Set<string>()
  let previous = ''
  for (const order of data.orders) {
    if (!order || typeof order.id !== 'string' || !order.id || orderIds.has(order.id) || typeof order.timestamp !== 'string' || !Number.isFinite(Date.parse(order.timestamp)) || !Array.isArray(order.items) || !order.items.length) throw new Error('Invalid order record')
    const key = `${order.timestamp}|${order.id}`
    if (key < previous) throw new Error('Orders are not chronological')
    previous = key
    orderIds.add(order.id)
    const seen = new Set<string>()
    for (const item of order.items) {
      if (!item || !ids.has(item.productId) || seen.has(item.productId) || !Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('Invalid order item')
      seen.add(item.productId)
    }
  }
}

/** Retail II has no category field. These disclosed keyword groups are UI filters only. */
export function categoryOf(product: RetailProduct): string {
  const text = product.description.toUpperCase()
  if (/CHRISTMAS|XMAS|SANTA|ADVENT/.test(text)) return 'Seasonal'
  if (/BAG|PURSE|LUNCH|SHOPPER/.test(text)) return 'Bags & storage'
  if (/CAKE|CUP|MUG|PLATE|BOWL|TEA|KITCHEN/.test(text)) return 'Kitchen & dining'
  if (/TOY|GAME|CHILD|DOLLY|BALLOON/.test(text)) return 'Toys & play'
  if (/HEART|CANDLE|HOLDER|LANTERN|LIGHT|DECOR/.test(text)) return 'Home & decor'
  return 'Other gifts'
}
