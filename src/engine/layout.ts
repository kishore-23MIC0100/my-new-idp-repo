import { getSlot, validateLayout, type ProductLayout } from './warehouse'

export function productAtSlot(layout: ProductLayout, slotId: string): string | undefined {
  return Object.entries(layout).find(([, assignedSlot]) => assignedSlot === slotId)?.[0]
}

/** Swaps two occupied locations without dropping or duplicating a product. */
export function swapProductIntoSlot(layout: ProductLayout, productId: string, destinationSlotId: string): ProductLayout {
  const sourceSlotId = layout[productId]
  if (!sourceSlotId) throw new Error(`Product ${productId} is not assigned`)
  if (sourceSlotId === destinationSlotId) return layout
  if (!getSlot(destinationSlotId)) throw new Error('Invalid destination slot')
  validateLayout(layout, Object.keys(layout))
  const destinationProductId = productAtSlot(layout, destinationSlotId)
  const next = { ...layout, [productId]: destinationSlotId }
  if (destinationProductId) next[destinationProductId] = sourceSlotId
  validateLayout(next, Object.keys(layout))
  return next
}
