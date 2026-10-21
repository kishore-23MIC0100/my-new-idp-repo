import { useMemo, useState } from 'react'
import { getSlot, type ProductLayout } from '../../engine/warehouse'
import type { Product } from '../../engine/simulation'

type LayoutLabProps = {
  products: readonly (Product & { code: string; description: string })[]
  layout: ProductLayout
  selectedProductId?: string
  onSelectProduct: (id: string) => void
  onSwap: (productId: string, destinationSlotId: string) => void
  onUndo: () => void
  onReset: () => void
  onAutomatic: () => void
  canUndo: boolean
}

export function LayoutLab({ products, layout, selectedProductId, onSelectProduct, onSwap, onUndo, onReset, onAutomatic, canUndo }: LayoutLabProps) {
  const [query, setQuery] = useState('')
  const selected = products.find((product) => product.id === selectedProductId)
  const sorted = useMemo(() => products.filter((product) => `${product.code} ${product.description}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.pickFrequency - a.pickFrequency || a.code.localeCompare(b.code)), [products, query])
  const slotted = useMemo(() => [...products].sort((a, b) => layout[a.id].localeCompare(layout[b.id])), [products, layout])

  return <aside className="layout-lab" aria-label="Slotting game">
    <div className="panel-title"><span>LAB</span><h2>Product re-slotting</h2></div>
    <p className="lab-copy">Choose a product, then choose an occupied destination slot to swap locations.</p>
    <input className="lab-search" aria-label="Search SKU or description" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU or description" />
    <div className="lab-selected"><span>SELECTED PRODUCT</span><strong>{selected ? selected.code : 'Choose a SKU'}</strong><small>{selected ? `${selected.pickFrequency.toLocaleString()} eligible units` : 'Sorted by actual pick frequency'}</small></div>
    <div className="product-list">{sorted.slice(0, 12).map((product) => <button className={product.id === selectedProductId ? 'selected' : ''} key={product.id} onClick={() => onSelectProduct(product.id)}><b>{product.code}</b><span>{product.description}</span><em>{product.pickFrequency.toLocaleString()}</em></button>)}</div>
    <div className="slot-heading"><span>OCCUPIED SLOTS</span><small>{products.length} mapped products</small></div>
    <div className="slot-list">{slotted.slice(0, 30).map((product) => {
      const slotId = layout[product.id]
      const slot = getSlot(slotId)
      const isSource = product.id === selectedProductId
      return <button className={isSource ? 'source-slot' : ''} key={product.id} onClick={() => selectedProductId ? onSwap(selectedProductId, slotId) : onSelectProduct(product.id)}><span>{slotId}</span><b>{product.code}</b><em>{slot?.rackId}</em></button>
    })}</div>
    <div className="lab-actions"><button disabled={!canUndo} onClick={onUndo}>Undo</button><button onClick={onReset}>Reset</button><button className="auto" onClick={onAutomatic}>Apply fast-mover baseline</button></div>
  </aside>
}
