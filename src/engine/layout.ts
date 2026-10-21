import type { ProductLayout } from './warehouse'

export function productAtSlot(layout: ProductLayout, slotId: string): string | undefined {
  return Object.entries(layout).find(([, assignedSlot]) => assignedSlot === slotId)?.[0]
}

/** Swaps two occupied locations without dropping or duplicating a product. */
export function swapProductIntoSlot(layout: ProductLayout, productId: string, destinationSlotId: string): ProductLayout {
  const sourceSlotId = layout[productId]
  if (!sourceSlotId) throw new Error(`Product ${productId} is not assigned`)
  if (sourceSlotId === destinationSlotId) return layout
  const destinationProductId = productAtSlot(layout, destinationSlotId)
  if (!destinationProductId) throw new Error(`Slot ${destinationSlotId} is not occupied by an editable product`)
  return { ...layout, [productId]: destinationSlotId, [destinationProductId]: sourceSlotId }
}
