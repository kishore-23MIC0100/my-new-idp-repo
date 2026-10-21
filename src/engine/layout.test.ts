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

  it('moves into a valid empty slot and rejects an invalid slot without mutation', () => {
    const initial = { A: VALID_SLOTS[0].id }
    expect(swapProductIntoSlot(initial, 'A', VALID_SLOTS[2].id)).toEqual({ A: VALID_SLOTS[2].id })
    expect(() => swapProductIntoSlot(initial, 'A', 'missing')).toThrow('Invalid')
    expect(initial.A).toBe(VALID_SLOTS[0].id)
  })
})
