import { describe, expect, it } from 'vitest'
import { productsForLayer } from './layers'
import { createOriginalLayout } from './warehouse'

describe('warehouse layer filtering', () => {
  const products = [
    { id: 'SKU-1', pickFrequency: 10 },
    { id: 'SKU-2', pickFrequency: 5 },
    { id: 'SKU-3', pickFrequency: 2 },
    { id: 'SKU-4', pickFrequency: 1 },
  ]
  const layout = {
    ...createOriginalLayout(products.map((product) => product.id)),
    'SKU-1': 'R1-01-L1',
    'SKU-2': 'R1-01-L2',
    'SKU-3': 'R1-01-L3',
    'SKU-4': 'R1-02-L1',
  }

  it('shows only products assigned to the selected level', () => {
    expect(productsForLayer(products, layout, 1).map(({ id }) => id)).toEqual(['SKU-1', 'SKU-4'])
    expect(productsForLayer(products, layout, 2).map(({ id }) => id)).toEqual(['SKU-2'])
    expect(productsForLayer(products, layout, 3).map(({ id }) => id)).toEqual(['SKU-3'])
  })

  it('shows every mapped product when All is selected', () => {
    expect(productsForLayer(products, layout, 'all')).toEqual(products)
  })
})
