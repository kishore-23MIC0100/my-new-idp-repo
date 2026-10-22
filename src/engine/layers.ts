import { getSlot, type ProductLayout } from './warehouse'
import type { Product } from './simulation'

export type WarehouseLayer = 'all' | 1 | 2 | 3

export function productsForLayer<T extends Product>(
  products: readonly T[],
  layout: ProductLayout,
  layer: WarehouseLayer,
): T[] {
  if (layer === 'all') return [...products]
  return products.filter((product) => getSlot(layout[product.id])?.level === layer)
}
