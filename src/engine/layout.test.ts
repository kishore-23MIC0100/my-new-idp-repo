import { describe, expect, it } from 'vitest'
import { VALID_SLOTS, validateLayout } from './warehouse'
import { productAtSlot, swapProductIntoSlot } from './layout'

describe('layout swapping', () => {
  it('swaps product locations without loss or duplication', () => {
    const products = ['A', 'B']
    const initial = { A: VALID_SLOTS[0].id, B: VALID_SLOTS[1].id }
    const swapped = swapProductIntoSlot(initial, 'A', VALID_SLOTS[1].id)
    expect(swapped).toEqual({ A: VALID_SLOTS[1].id, B: VALID_SLOTS[0].id })
    expect(productAtSlot(swapped, VALID_SLOTS[0].id)).toBe('B')
    expect(() => validateLayout(swapped, products)).not.toThrow()
  })

  it('rejects placement into an empty/non-editable slot', () => {
    expect(() => swapProductIntoSlot({ A: VALID_SLOTS[0].id }, 'A', VALID_SLOTS[2].id)).toThrow('not occupied')
  })
})
