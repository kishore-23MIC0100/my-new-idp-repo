import { describe, expect, it } from 'vitest'
import retailData from '../../public/data/retail-2011-11.json'
import { parseRetailDataset } from './retailDataset'

describe('processed Retail II dataset boundary', () => {
  it('accepts the complete exported dataset with consistent product frequencies', () => {
    const parsed = parseRetailDataset(retailData)
    expect(parsed.products).toHaveLength(100)
    expect(parsed.orders).toHaveLength(2341)
    expect(new Set(parsed.orders.map((order) => order.id)).size).toBe(parsed.orders.length)
    expect(parsed.orders.some((order) => order.sourceInvoiceId !== undefined)).toBe(true)
  })

  it('rejects quantities that no longer reconcile to the listed pick frequency', () => {
    const invalid = structuredClone(retailData)
    invalid.orders[0].items[0].quantity += 1
    expect(() => parseRetailDataset(invalid)).toThrow(/does not match exported order quantities/)
  })

  it('rejects a malformed or dangling order line', () => {
    const invalid = structuredClone(retailData)
    invalid.orders[0].items[0].productId = 'UNKNOWN-SKU'
    expect(() => parseRetailDataset(invalid)).toThrow(/unknown product/)
  })
})
