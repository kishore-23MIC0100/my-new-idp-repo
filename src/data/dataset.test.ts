import { describe, expect, it } from 'vitest'
import { validateDataset } from './dataset'
import dataset from '../../public/data/retail-2011-11.json'
describe('browser dataset contract', () => {
  it('validates the real processed workbook', () => expect(() => validateDataset(dataset)).not.toThrow())
  it('rejects malformed metadata, duplicate orders, and non-finite quantities', () => {
    expect(() => validateDataset({})).toThrow()
    expect(() => validateDataset({ ...dataset, orders: [dataset.orders[0], dataset.orders[0]] })).toThrow()
    expect(() => validateDataset({ ...dataset, orders: [{ ...dataset.orders[0], items: [{ productId: dataset.products[0].id, quantity: Infinity }] }] })).toThrow()
  })
})
