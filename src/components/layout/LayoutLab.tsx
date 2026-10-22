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
  const [draggedProductId, setDraggedProductId] = useState<string>()
  const [dropTargetSlotId, setDropTargetSlotId] = useState<string>()
  const selected = products.find((product) => product.id === selectedProductId)
  const sorted = useMemo(() => products.filter((product) => `${product.code} ${product.description}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.pickFrequency - a.pickFrequency || a.code.localeCompare(b.code)), [products, query])
  const slotted = useMemo(() => [...products].sort((a, b) => layout[a.id].localeCompare(layout[b.id])), [products, layout])

  return <aside className="layout-lab" aria-label="Slotting game">
    <div className="panel-title"><span>LAB</span><h2>Product re-slotting</h2></div>
    <p className="lab-copy">Select a product and an occupied slot, or drag a product onto a slot. Each move recalculates the scores.</p>
    <input className="lab-search" aria-label="Search SKU or description" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU or description" />
    <div className="lab-selected"><span>SELECTED PRODUCT</span><strong>{selected ? selected.code : 'Choose a SKU'}</strong><small>{selected ? `${selected.pickFrequency.toLocaleString()} eligible units` : 'Sorted by actual pick frequency'}</small></div>
    <div className="product-list" aria-label="Products available for re-slotting">{sorted.map((product) => <button draggable key={product.id} className={`${product.id === selectedProductId ? 'selected' : ''}${product.id === draggedProductId ? ' dragging' : ''}`} title="Drag this product to an occupied slot, or select it to use the slot list" onClick={() => onSelectProduct(product.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', product.id); setDraggedProductId(product.id) }} onDragEnd={() => { setDraggedProductId(undefined); setDropTargetSlotId(undefined) }}><b>{product.code}</b><span>{product.description}</span><em>{product.pickFrequency.toLocaleString()}</em></button>)}</div>
    <div className="slot-heading"><span>OCCUPIED SLOTS</span><small>{products.length} mapped products</small></div>
    <div className="slot-list" aria-label="Occupied destinations">{slotted.map((product) => {
      const slotId = layout[product.id]
      const slot = getSlot(slotId)
      const isSource = product.id === selectedProductId
      const isDropTarget = slotId === dropTargetSlotId
      return <button className={`${isSource ? 'source-slot' : ''}${isDropTarget ? ' drop-target' : ''}`} key={product.id} aria-label={`Slot ${slotId}, product ${product.code}. ${draggedProductId ? 'Drop dragged product here to swap.' : selectedProductId ? 'Select to swap the selected product here.' : 'Select this product first.'}`} onClick={() => selectedProductId ? onSwap(selectedProductId, slotId) : onSelectProduct(product.id)} onDragOver={(event) => { if (draggedProductId) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetSlotId(slotId) } }} onDragLeave={() => { if (dropTargetSlotId === slotId) setDropTargetSlotId(undefined) }} onDrop={(event) => { event.preventDefault(); const productId = event.dataTransfer.getData('text/plain') || draggedProductId; if (productId) { onSelectProduct(productId); onSwap(productId, slotId) } setDraggedProductId(undefined); setDropTargetSlotId(undefined) }}><span>{slotId}</span><b>{product.code}</b><em>{slot?.rackId}</em></button>
    })}</div>
    <div className="lab-actions"><button disabled={!canUndo} onClick={onUndo}>Undo</button><button onClick={onReset}>Reset</button><button className="auto" onClick={onAutomatic}>Apply fast-mover baseline</button></div>
  </aside>
}
