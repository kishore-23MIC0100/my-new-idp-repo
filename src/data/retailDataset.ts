import { VALID_SLOTS } from '../engine/warehouse'
import type { Product, WarehouseOrder } from '../engine/simulation'

export type RetailProduct = Product & Readonly<{ code: string; description: string }>
export type RetailDataset = Readonly<{
  schemaVersion: string
  metadata: Readonly<{ selectedPeriod: string; source?: string }>
  products: readonly RetailProduct[]
  orders: readonly WarehouseOrder[]
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(message: string): never {
  throw new Error(`Processed dataset validation failed: ${message}`)
}

/** Validate the JSON at the browser boundary before any dashboard control uses it. */
export function parseRetailDataset(value: unknown): RetailDataset {
  if (!isRecord(value)) return fail('expected a JSON object')
  if (typeof value.schemaVersion !== 'string' || !value.schemaVersion) return fail('schemaVersion is missing')
  if (!isRecord(value.metadata) || typeof value.metadata.selectedPeriod !== 'string') return fail('metadata.selectedPeriod is missing')
  if (!Array.isArray(value.products) || value.products.length === 0) return fail('products must be a non-empty array')
  if (value.products.length > VALID_SLOTS.length) return fail(`product count exceeds warehouse capacity (${VALID_SLOTS.length})`)
  if (!Array.isArray(value.orders) || value.orders.length === 0) return fail('orders must be a non-empty array')

  const productIds = new Set<string>()
  const productUnits = new Map<string, number>()
  const products: RetailProduct[] = value.products.map((candidate, index) => {
    if (!isRecord(candidate)) return fail(`products[${index}] must be an object`)
    const { id, code, description, pickFrequency } = candidate
    if (typeof id !== 'string' || !id || typeof code !== 'string' || code !== id) return fail(`products[${index}] has an invalid id/code pair`)
    if (productIds.has(id)) return fail(`duplicate product id ${id}`)
    if (typeof description !== 'string' || !description.trim()) return fail(`product ${id} has no description`)
    if (typeof pickFrequency !== 'number' || !Number.isFinite(pickFrequency) || pickFrequency <= 0) return fail(`product ${id} has an invalid pick frequency`)
    productIds.add(id)
    productUnits.set(id, 0)
    return { id, code, description, pickFrequency }
  })

  const invoiceCounts = new Map<string, number>()
  for (const candidate of value.orders) {
    if (isRecord(candidate) && typeof candidate.id === 'string') invoiceCounts.set(candidate.id, (invoiceCounts.get(candidate.id) ?? 0) + 1)
  }
  const orderIds = new Set<string>()
  const orders: WarehouseOrder[] = value.orders.map((candidate, orderIndex) => {
    if (!isRecord(candidate)) return fail(`orders[${orderIndex}] must be an object`)
    const { id: sourceInvoiceId, timestamp, items } = candidate
    if (typeof sourceInvoiceId !== 'string' || !sourceInvoiceId.trim()) return fail(`orders[${orderIndex}] has a missing id`)
    if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) return fail(`order ${sourceInvoiceId} has an invalid timestamp`)
    if (!Array.isArray(items) || items.length === 0) return fail(`order ${sourceInvoiceId} has no items`)
    const hasDuplicateInvoice = (invoiceCounts.get(sourceInvoiceId) ?? 0) > 1
    const id = hasDuplicateInvoice ? `${sourceInvoiceId}@${Date.parse(timestamp)}` : sourceInvoiceId
    if (orderIds.has(id)) return fail(`orders[${orderIndex}] has a duplicate invoice and timestamp`)
    const seen = new Set<string>()
    const parsedItems = items.map((candidateItem, itemIndex) => {
      if (!isRecord(candidateItem)) return fail(`order ${sourceInvoiceId} item ${itemIndex} must be an object`)
      const { productId, quantity } = candidateItem
      if (typeof productId !== 'string' || !productIds.has(productId)) return fail(`order ${sourceInvoiceId} references an unknown product`)
      if (seen.has(productId)) return fail(`order ${sourceInvoiceId} contains duplicate lines for product ${productId}`)
      if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) return fail(`order ${sourceInvoiceId} has an invalid quantity`)
      seen.add(productId)
      productUnits.set(productId, (productUnits.get(productId) ?? 0) + quantity)
      return { productId, quantity }
    })
    orderIds.add(id)
    return { id, ...(hasDuplicateInvoice ? { sourceInvoiceId } : {}), timestamp, items: parsedItems }
  })

  for (const product of products) {
    const unitsFromOrders = productUnits.get(product.id) ?? 0
    if (Math.abs(unitsFromOrders - product.pickFrequency) > 1e-6) {
      return fail(`pick frequency for ${product.code} does not match exported order quantities`)
    }
  }

  return {
    schemaVersion: value.schemaVersion,
    metadata: {
      selectedPeriod: value.metadata.selectedPeriod,
      ...(typeof value.metadata.source === 'string' ? { source: value.metadata.source } : {}),
    },
    products,
    orders,
  }
}
