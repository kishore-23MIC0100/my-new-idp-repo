import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { LayoutLab } from '../components/layout/LayoutLab'
import { AnalyticsView } from '../components/analytics/AnalyticsView'
import { swapProductIntoSlot } from '../engine/layout'
import { createOriginalLayout, validateLayout } from '../engine/warehouse'
import { compareLayouts, createFastMoverLayout, simulateOrders, type Product, type WarehouseOrder } from '../engine/simulation'

type Mode = 'twin' | 'layout' | 'analytics'
type RetailProduct = Product & { code: string; description: string }
type RetailDataset = { metadata: { selectedPeriod: string }; products: RetailProduct[]; orders: WarehouseOrder[] }

const DigitalTwin = lazy(async () => {
  const module = await import('../components/warehouse/DigitalTwin')
  return { default: module.DigitalTwin }
})

const navItems: { id: Mode; label: string; index: string }[] = [
  { id: 'twin', label: 'Digital Twin', index: '01' },
  { id: 'layout', label: 'Layout Lab', index: '02' },
  { id: 'analytics', label: 'Analytics', index: '03' },
]

function Metric({ label, value, suffix = '' }: { label: string; value: string; suffix?: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}<small>{suffix}</small></strong><em>Calculated from selected layout</em></div>
}

function formatMeters(value: number) { return Math.round(value).toLocaleString() }
function formatMinutes(value: number) { return (value / 60).toFixed(1) }

export function App() {
  const [mode, setMode] = useState<Mode>('twin')
  const [showLayers, setShowLayers] = useState(true)
  const [notice, setNotice] = useState('Loading validated UCI Online Retail II data…')
  const [dataset, setDataset] = useState<RetailDataset | null>(null)
  const [eventIndex, setEventIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [selectedProductId, setSelectedProductId] = useState<string>()
  const [webglAvailable, setWebglAvailable] = useState(true)
  const [playerLayout, setPlayerLayout] = useState<Record<string, string>>()
  const [layoutHistory, setLayoutHistory] = useState<Record<string, string>[]>([])
  const [dataError, setDataError] = useState<string>()
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true
    try {
      const canvas = document.createElement('canvas')
      setWebglAvailable(Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl')))
    } catch { setWebglAvailable(false) }
    fetch('/data/retail-2011-11.json')
      .then((response) => {
        if (!response.ok) throw new Error('Dataset request failed')
        return response.json() as Promise<RetailDataset>
      })
      .then((loaded) => {
        if (!active) return
        setDataset(loaded)
        const original = createOriginalLayout([...loaded.products.map((product) => product.id)].sort())
        const saved = sessionStorage.getItem('nexai-player-layout')
        let restored = original
        try {
          const candidate = saved ? JSON.parse(saved) as Record<string, string> : original
          validateLayout(candidate, loaded.products.map((product) => product.id))
          restored = candidate
        } catch { sessionStorage.removeItem('nexai-player-layout') }
        setPlayerLayout(restored)
        setDataError(undefined)
        setNotice(`Validated UCI Online Retail II data loaded: ${loaded.products.length} SKUs and ${loaded.orders.length.toLocaleString()} orders.`)
      })
      .catch(() => { if (active) { setDataError('The processed dataset could not be loaded.'); setNotice('The processed dataset could not be loaded. Re-run preprocessing or retry.') } })
    return () => { active = false }
  }, [loadAttempt])

  const simulation = useMemo(() => {
    if (!dataset) return null
    const productIds = dataset.products.map((product) => product.id)
    const layout = playerLayout ?? createOriginalLayout([...productIds].sort())
    return { layout, result: simulateOrders(dataset.orders, productIds, layout) }
  }, [dataset, playerLayout])
  const comparison = useMemo(() => dataset ? compareLayouts(dataset.products, dataset.orders, playerLayout) : null, [dataset, playerLayout])
  const activeOrder = dataset?.orders[0]
  const activeEvents = useMemo(() => simulation && activeOrder ? simulation.result.events.filter((event) => event.orderId === activeOrder.id) : [], [simulation, activeOrder])
  const activeEvent = activeEvents[eventIndex]
  const selectedProduct = dataset?.products.find((product) => product.id === (selectedProductId ?? activeEvent?.productId))

  useEffect(() => {
    if (!playing || !activeEvents.length) return
    const timer = window.setInterval(() => setEventIndex((current) => {
      const next = current + 1
      if (next >= activeEvents.length) { setPlaying(false); return current }
      return next
    }), Math.max(600, 1800 / speed))
    return () => window.clearInterval(timer)
  }, [playing, speed, activeEvents.length])

  const togglePlayback = () => {
    if (!activeEvents.length) return
    if (eventIndex >= activeEvents.length - 1) setEventIndex(0)
    setPlaying((value) => !value)
  }
  const step = (direction: -1 | 1) => setEventIndex((current) => Math.min(Math.max(current + direction, 0), Math.max(activeEvents.length - 1, 0)))
  const cycleSpeed = () => setSpeed((current) => current === 1 ? 2 : current === 2 ? 4 : 1)
  const productCount = dataset?.products.length ?? 0
  const orderCount = dataset?.orders.length ?? 0
  const originalLayout = useMemo(() => dataset ? createOriginalLayout([...dataset.products.map((product) => product.id)].sort()) : undefined, [dataset])
  const applyLayout = (next: Record<string, string>, message: string) => {
    if (playerLayout) setLayoutHistory((history) => [...history, playerLayout])
    setPlayerLayout(next)
    sessionStorage.setItem('nexai-player-layout', JSON.stringify(next))
    setNotice(message)
  }
  const swapIntoSlot = (productId: string, slotId: string) => {
    if (!playerLayout) return
    const next = swapProductIntoSlot(playerLayout, productId, slotId)
    if (next === playerLayout) { setNotice('That product already occupies the selected slot.'); return }
    applyLayout(next, `Swapped ${productId} into ${slotId}. Scores are recalculated with the same order stream.`)
  }
  const undoLayout = () => {
    const previous = layoutHistory.at(-1)
    if (!previous) return
    setLayoutHistory((history) => history.slice(0, -1))
    setPlayerLayout(previous)
    sessionStorage.setItem('nexai-player-layout', JSON.stringify(previous))
    setNotice('Restored the previous valid layout.')
  }
  const resetLayout = () => { if (originalLayout) { setLayoutHistory([]); setPlayerLayout(originalLayout); sessionStorage.removeItem('nexai-player-layout'); setNotice('Reset player layout to the documented original arrangement.') } }
  const automaticLayout = () => { if (dataset) applyLayout(createFastMoverLayout(dataset.products), 'Applied the frequency-aware fast-mover baseline to your player layout.') }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="NEXAI warehouse digital twin home"><span className="brand-mark">N</span><span>NEXAI<small>WAREHOUSE DIGITAL TWIN</small></span></a>
      <nav aria-label="Application sections">{navItems.map((item) => <button aria-current={mode === item.id ? 'page' : undefined} className={mode === item.id ? 'active' : ''} key={item.id} onClick={() => { setPlaying(false); setMode(item.id) }}><small>{item.index}</small>{item.label}</button>)}</nav>
      <div className="system-status"><span className={dataset ? 'status-dot loaded' : 'status-dot'} />DATA PIPELINE <b>{dataset ? 'VALIDATED' : 'LOADING'}</b></div>
    </header>

    <section className="command-header" id="top">
      <div><p className="eyebrow">PS 4.2 / TRACK 04 / COMMAND CENTER</p><h1>{mode === 'twin' ? 'Picking Floor / Digital Twin' : mode === 'layout' ? 'Slotting / Layout Lab' : 'Run / Analytics'}</h1></div>
      <div className="dataset-strip"><span>DATASET</span><strong>UCI ONLINE RETAIL II</strong><small>{dataset ? `${dataset.metadata.selectedPeriod} · ${productCount} SKUs · ${orderCount.toLocaleString()} orders` : 'Validating processed data'}</small></div>
      <button className="primary-action" disabled={!simulation} onClick={() => { if (mode === 'analytics') setMode('twin'); togglePlayback() }}><span>{playing ? 'Ⅱ' : '▶'}</span>{playing ? ' Pause replay' : ' Replay order'}</button>
    </section>

    {mode === 'analytics' && comparison ? <AnalyticsView comparison={comparison} /> : <div className={mode === 'layout' ? 'main-grid layout-mode' : 'main-grid'}>
      {mode === 'layout' && dataset && playerLayout ? <LayoutLab products={dataset.products} layout={playerLayout} selectedProductId={selectedProductId} onSelectProduct={setSelectedProductId} onSwap={swapIntoSlot} onUndo={undoLayout} onReset={resetLayout} onAutomatic={automaticLayout} canUndo={layoutHistory.length > 0} /> : <aside className="panel left-panel">
        <div className="panel-title"><span>01</span><h2>Control surface</h2></div>
        <div className="control-group"><label>ACTIVE LAYOUT</label><button className="select-control" onClick={() => setNotice('Original layout is the currently scored, neutral lexical-SKU starting layout.')}>Original layout <span>✓</span></button></div>
        <div className="control-group"><label>PRODUCT LOOKUP</label><input aria-label="Loaded product count" placeholder={`${productCount} validated SKUs loaded`} disabled /></div>
        <div className="section-rule" />
        <div className="layers-row"><div><label>WAREHOUSE LAYERS</label><small>Route and product bins</small></div><button className={showLayers ? 'toggle on' : 'toggle'} aria-label="Toggle warehouse layers" onClick={() => setShowLayers(!showLayers)}><span /></button></div>
        <ul className={showLayers ? 'layer-list' : 'layer-list hidden'}><li><i className="cyan" /> Scored route <b>LIVE</b></li><li><i className="magenta" /> Picker target <b>LIVE</b></li><li><i className="lime" /> Product slots <b>{productCount}</b></li></ul>
        <div className="foundation-note"><span>ROUTING SOURCE</span><p>Every cyan segment is the same aisle-aware A* route used in scoring.</p></div>
      </aside>
      }

      <section className="viewport-panel" aria-label="Interactive digital twin viewport">
        {simulation && dataset && webglAvailable ? <ErrorBoundary fallback={<div className="fallback-view"><span className="eyebrow">3D VIEW RECOVERY</span><strong>The 3D renderer stopped. Use the Layout Lab and Analytics views, then refresh to retry WebGL.</strong></div>}><Suspense fallback={<div className="fallback-view"><span className="eyebrow">INITIALIZING TWIN</span><strong>Loading the real warehouse layout…</strong></div>}><DigitalTwin products={dataset.products} layout={simulation.layout} activeEvent={showLayers ? activeEvent : undefined} playing={playing} onSelectProduct={setSelectedProductId} selectedProductId={selectedProductId ?? activeEvent?.productId} /></Suspense></ErrorBoundary> : <div className="fallback-view"><span className="eyebrow">{dataError ?? (webglAvailable ? 'INITIALIZING TWIN' : 'WEBGL UNAVAILABLE')}</span><strong>{dataError ? 'Check the processed JSON asset, then retry the data request.' : webglAvailable ? 'Loading the real warehouse layout…' : 'Use the operational panels and data report; the 3D scene requires WebGL.'}</strong>{dataError && <button className="retry-button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry data load</button>}</div>}
        <div className="viewport-tools"><button onClick={() => setNotice('Use drag to orbit, right-drag to pan, and the wheel to zoom.')}>⌖ Camera help</button><button onClick={() => setSelectedProductId(undefined)}>× Clear selection</button></div>
        <div className="legend"><span><i className="cyan" />Scored route</span><span><i className="magenta" />Target / picker</span><span><i className="lime" />Product bin</span></div>
      </section>

      <aside className="panel telemetry-panel">
        <div className="panel-title"><span>02</span><h2>Live telemetry</h2><i className="pulse" /></div>
        <div className="picker-card"><div className="avatar">PK</div><div><span>Picker / 01</span><strong>{playing ? 'Walking route' : activeEvent ? 'Awaiting replay' : 'Standing by'}</strong><small>Order route from simulation engine</small></div></div>
        <div className="readout"><span>ACTIVE ORDER</span><strong>{activeOrder?.id ?? '—'}</strong><small>{activeEvents.length ? `Pick ${eventIndex + 1} of ${activeEvents.length}` : 'Loading event stream'}</small></div>
        <div className="telemetry-list"><div><span>TARGET SKU</span><b>{selectedProduct?.code ?? '—'}</b></div><div><span>ROUTE LENGTH</span><b>{activeEvent ? formatMeters(activeEvent.travelDistanceMeters) : '—'} <small>m</small></b></div><div><span>HANDLING TIME</span><b>{activeEvent?.handlingSeconds ?? '—'} <small>s</small></b></div></div>
        <div className="assumption"><span>SCORING ASSUMPTIONS</span><p>1.2 m/s walking; 5 s per line plus 1 s per unit. Travel and handling are separate.</p></div>
      </aside>
    </div>}

    {mode !== 'analytics' && <section className="bottom-zone">
      <div className="playback"><div className="playback-head"><span>ORDER REPLAY</span><em>{activeEvents.length ? `${eventIndex + 1} / ${activeEvents.length} SCORING EVENTS` : 'LOADING'}</em></div><div className="playback-controls"><button aria-label="Previous pick" onClick={() => step(-1)}>↶</button><button className="play" aria-label="Play or pause replay" onClick={togglePlayback}>{playing ? 'Ⅱ' : '▶'}</button><button aria-label="Next pick" onClick={() => step(1)}>↷</button><div className="timeline"><i style={{ width: `${activeEvents.length ? ((eventIndex + 1) / activeEvents.length) * 100 : 0}%` }} /></div><button className="speed" onClick={cycleSpeed}>{speed}×</button></div></div>
      <div className="metrics"><Metric label="TOTAL WALK" value={simulation ? formatMeters(simulation.result.metrics.totalWalkingDistanceMeters) : '—'} suffix="m" /><Metric label="AVG. PICK TIME" value={simulation ? formatMinutes(simulation.result.metrics.averageEstimatedSeconds) : '—'} suffix="min/order" /><Metric label="ORDERS" value={simulation ? simulation.result.metrics.completedOrders.toLocaleString() : '—'} /></div>
    </section>}
    <footer className="notice" role="status"><span>◆</span>{notice}<button onClick={() => setNotice('Click a product bin to inspect it. Orbit, pan, and zoom the warehouse with the pointer.')}>Help</button></footer>
  </main>
}
