import { useMemo, useState } from 'react'
import { getSlot, VALID_SLOTS, type ProductLayout } from '../../engine/warehouse'
import { productAtSlot } from '../../engine/layout'
import type { RetailProduct } from '../../data/dataset'

type Props = {
  products: readonly RetailProduct[]; layout: ProductLayout; selectedProductId?: string
  onSelectProduct: (id: string) => void; onSwap: (id: string, destination: string) => void
  onUndo: () => void; onReset: () => void; onAutomatic: () => void; canUndo: boolean; dirty: boolean
  onExport: () => void; onImport: (value: unknown) => void
}
export function LayoutLab(props: Props) {
  const [query, setQuery] = useState('')
  const [destination, setDestination] = useState(VALID_SLOTS[0].id)
  const [error, setError] = useState('')
  const selected = props.products.find(p => p.id === props.selectedProductId)
  const products = useMemo(() => props.products.filter(p => `${p.id} ${p.description}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.pickFrequency - a.pickFrequency || a.id.localeCompare(b.id)), [props.products, query])
  const occupant = productAtSlot(props.layout, destination)
  return <section className="layout-lab panel" aria-label="Slotting game"><h2>Layout Lab <small>{props.dirty ? 'Modified layout · autosaved when storage is available' : 'Original arrangement'}</small></h2><div className="lab-grid"><div><label htmlFor="lab-search">1. Choose a product · sorted by monthly units</label><input id="lab-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search SKU or description" /><div className="product-list">{products.map(p => <button className={p.id === selected?.id ? 'selected' : ''} key={p.id} onClick={() => props.onSelectProduct(p.id)}><b>{p.id}</b><span>{p.description}</span><em>{p.pickFrequency.toLocaleString()}</em></button>)}</div></div><div><label htmlFor="destination">2. Choose any valid destination</label><select id="destination" value={destination} onChange={e => setDestination(e.target.value)}>{VALID_SLOTS.map(slot => <option key={slot.id} value={slot.id}>{slot.id} · {productAtSlot(props.layout, slot.id) ?? 'Empty'}</option>)}</select><dl><dt>Selected product</dt><dd>{selected?.id ?? 'Choose a product'}</dd><dt>Current slot</dt><dd>{selected ? props.layout[selected.id] : '—'}</dd><dt>Destination</dt><dd>{destination}</dd><dt>Action</dt><dd>{occupant ? `Swap with ${occupant}` : 'Move to empty slot'}</dd><dt>Layer</dt><dd>{getSlot(destination)?.level}</dd></dl><button className="primary-action" disabled={!selected || props.layout[selected.id] === destination} onClick={() => selected && props.onSwap(selected.id, destination)}>Apply move & recalculate</button><p>Every move is validated and immediately rescored against the same orders. No product is lost when swapping.</p></div><div className="lab-actions"><button disabled={!props.canUndo} onClick={props.onUndo}>Undo last change</button><button onClick={props.onReset}>Reset to original</button><button className="auto" onClick={props.onAutomatic}>Apply automatic baseline</button><button onClick={props.onExport}>Export player layout</button><label className="import-label">Import layout JSON<input type="file" accept=".json,application/json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 100000) throw new Error('Layout file is too large'); props.onImport(JSON.parse(await file.text())); setError('') } catch { setError('Unable to read layout JSON.') } e.target.value = '' }} /></label>{error && <p role="alert">{error}</p>}</div></div></section>
}
