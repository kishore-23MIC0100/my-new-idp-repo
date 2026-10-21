import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { LayoutLab } from '../components/layout/LayoutLab'
import { AnalyticsView } from '../components/analytics/AnalyticsView'
import { swapProductIntoSlot } from '../engine/layout'
import { createOriginalLayout, getSlot, validateLayout } from '../engine/warehouse'
import { compareLayouts, createFastMoverLayout, type Product, type WarehouseOrder } from '../engine/simulation'

type Mode = 'twin' | 'layout' | 'analytics'
type Scenario = 'original' | 'automatic' | 'player'
type WarehouseLayer = 'all' | 1 | 2 | 3
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

function Kpi({ label, value, detail, tone = 'cyan', glyph }: { label: string; value: string; detail: string; tone?: 'cyan' | 'lime'; glyph: string }) {
  return <article className={`kpi-card ${tone}`}><i aria-hidden="true">{glyph}</i><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function formatMeters(value: number) { return Math.round(value).toLocaleString() }
function formatMinutes(value: number) { return (value / 60).toFixed(1) }
function scenarioName(scenario: Scenario) { return scenario === 'original' ? 'Original layout' : scenario === 'automatic' ? 'Automatic baseline' : 'Player layout' }

export function App() {
  const [mode, setMode] = useState<Mode>('twin')
  const [showLayers, setShowLayers] = useState(true)
  const [notice, setNotice] = useState('Loading validated UCI Online Retail II data…')
  const [dataset, setDataset] = useState<RetailDataset | null>(null)
  const [eventIndex, setEventIndex] = useState(0)
  const [orderIndex, setOrderIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [selectedProductId, setSelectedProductId] = useState<string>()
  const [webglAvailable, setWebglAvailable] = useState(true)
  const [playerLayout, setPlayerLayout] = useState<Record<string, string>>()
  const [layoutHistory, setLayoutHistory] = useState<Record<string, string>[]>([])
  const [dataError, setDataError] = useState<string>()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [activeScenario, setActiveScenario] = useState<Scenario>('original')
  const [cameraSeed, setCameraSeed] = useState(0)
  const [visibleLayer, setVisibleLayer] = useState<WarehouseLayer>('all')

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

  const originalLayout = useMemo(() => dataset ? createOriginalLayout([...dataset.products.map((product) => product.id)].sort()) : undefined, [dataset])
  const automaticLayout = useMemo(() => dataset ? createFastMoverLayout(dataset.products) : undefined, [dataset])
  const comparison = useMemo(() => dataset ? compareLayouts(dataset.products, dataset.orders, playerLayout) : null, [dataset, playerLayout])
  const simulation = useMemo(() => {
    if (!dataset || !comparison || !originalLayout || !automaticLayout) return null
    const layout = activeScenario === 'original' ? originalLayout : activeScenario === 'automatic' ? automaticLayout : (playerLayout ?? originalLayout)
    return { layout, result: comparison[activeScenario] }
  }, [activeScenario, automaticLayout, comparison, dataset, originalLayout, playerLayout])
  const activeOrder = dataset?.orders[orderIndex]
  const activeEvents = useMemo(() => simulation && activeOrder ? simulation.result.events.filter((event) => event.orderId === activeOrder.id) : [], [simulation, activeOrder])
  const activeEvent = activeEvents[eventIndex]
  const selectedProduct = dataset?.products.find((product) => product.id === (selectedProductId ?? activeEvent?.productId))
  const selectedSlot = simulation && selectedProduct ? getSlot(simulation.layout[selectedProduct.id]) : undefined
  const completedPicks = playing ? eventIndex : 0
  const orderProgress = activeEvents.length ? Math.round((completedPicks / activeEvents.length) * 100) : 0

  useEffect(() => {
    if (!playing || !activeEvents.length) return
    const timer = window.setInterval(() => setEventIndex((current) => {
      const next = current + 1
      if (next >= activeEvents.length) {
        if (!dataset || orderIndex >= dataset.orders.length - 1) { setPlaying(false); return current }
        setOrderIndex((index) => index + 1)
        return 0
      }
      return next
    }), Math.max(600, 1800 / speed))
    return () => window.clearInterval(timer)
  }, [playing, speed, activeEvents.length, dataset, orderIndex])

  const togglePlayback = () => {
    if (!activeEvents.length) return
    if (eventIndex >= activeEvents.length - 1) { setEventIndex(0); setOrderIndex(0) }
    setPlaying((value) => !value)
  }
  const cycleSpeed = () => setSpeed((current) => current === 1 ? 2 : current === 2 ? 4 : 1)
  const productCount = dataset?.products.length ?? 0
  const orderCount = dataset?.orders.length ?? 0
  const selectScenario = (next: Scenario) => {
    setPlaying(false)
    setEventIndex(0)
    setOrderIndex(0)
    setSelectedProductId(undefined)
    setActiveScenario(next)
    setNotice(`Showing ${scenarioName(next).toLowerCase()}; all routes and metrics use this layout.`)
  }
  const applyLayout = (next: Record<string, string>, message: string) => {
    if (playerLayout) setLayoutHistory((history) => [...history, playerLayout])
    setPlayerLayout(next)
    sessionStorage.setItem('nexai-player-layout', JSON.stringify(next))
    setActiveScenario('player')
    setEventIndex(0)
    setPlaying(false)
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
    setActiveScenario('player')
    setEventIndex(0)
    setPlaying(false)
    setNotice('Restored the previous valid layout.')
  }
  const resetLayout = () => { if (originalLayout) { setLayoutHistory([]); setPlayerLayout(originalLayout); sessionStorage.removeItem('nexai-player-layout'); setActiveScenario('player'); setEventIndex(0); setPlaying(false); setNotice('Reset player layout to the documented original arrangement.') } }
  const applyAutomaticToPlayer = () => { if (dataset) applyLayout(createFastMoverLayout(dataset.products), 'Applied the frequency-aware fast-mover baseline to your player layout.') }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="NEXAI warehouse digital twin home"><span className="brand-mark">N</span><span>NEXAI<small>WAREHOUSE DIGITAL TWIN</small></span></a>
      <nav aria-label="Application sections">{navItems.map((item) => <button aria-current={mode === item.id ? 'page' : undefined} className={mode === item.id ? 'active' : ''} key={item.id} onClick={() => { setPlaying(false); if (item.id === 'layout') setActiveScenario('player'); setMode(item.id) }}><small>{item.index}</small>{item.label}</button>)}</nav>
      <div className="header-dataset"><span>▰ Dataset: Online Retail II</span><small>{dataset ? `${productCount} products · ${orderCount.toLocaleString()} orders` : 'Loading data'}</small></div>
      <div className="system-status"><span className={dataset ? 'status-dot loaded' : 'status-dot'} />DATA PIPELINE <b>{dataset ? 'VALIDATED' : 'LOADING'}</b></div>
      <button className="header-icon" aria-label="Open settings" onClick={() => setNotice('Settings use the documented warehouse model and simulation assumptions.')}>⚙</button><button className="header-icon avatar-button" aria-label="User profile" onClick={() => setNotice('Local simulation profile: Picker #1.')}>◉</button>
    </header>

    <section className="command-header" id="top">
      <div><p className="eyebrow">PS 4.2 / TRACK 04 / COMMAND CENTER</p><h1>{mode === 'twin' ? 'Picking Floor / Digital Twin' : mode === 'layout' ? 'Slotting / Layout Lab' : 'Run / Analytics'}</h1></div>
      <div className="dataset-strip"><span>DATASET</span><strong>UCI ONLINE RETAIL II</strong><small>{dataset ? `${dataset.metadata.selectedPeriod} · ${productCount} SKUs · ${orderCount.toLocaleString()} orders` : 'Validating processed data'}</small></div>
      <button className="primary-action" disabled={!simulation} onClick={() => { if (mode === 'analytics') setMode('twin'); togglePlayback() }}><span>{playing ? 'Ⅱ' : '▶'}</span>{playing ? ' Pause replay' : ' Replay order'}</button>
    </section>

    {mode === 'twin' && <section className="kpi-strip" aria-label="Live simulation metrics">
      <Kpi glyph="▣" label="TOTAL ORDERS" value={simulation ? simulation.result.metrics.completedOrders.toLocaleString() : '—'} detail={`${scenarioName(activeScenario)} scenario`} />
      <Kpi glyph="◇" label="ITEMS PICKED" value={simulation ? simulation.result.metrics.totalItemPicks.toLocaleString() : '—'} detail={simulation ? `${simulation.result.metrics.totalUnitsHandled.toLocaleString()} units handled` : 'Loading dataset'} />
      <Kpi glyph="⌁" label="TRAVEL DISTANCE" value={simulation ? `${(simulation.result.metrics.totalWalkingDistanceMeters / 1000).toFixed(2)} km` : '—'} detail="Aisle-aware routed walk" />
      <Kpi glyph="◷" label="PICKING TIME" value={simulation ? formatMinutes(simulation.result.metrics.totalEstimatedSeconds) : '—'} detail="Travel plus handling" />
      <Kpi glyph="⌖" label="AVG. DISTANCE / ORDER" value={simulation ? `${formatMeters(simulation.result.metrics.averageWalkingDistanceMeters)} m` : '—'} detail="Same order sequence" />
      <Kpi glyph="87" label="ROUTE EFFICIENCY" value={comparison ? `${comparison.automaticDistanceReductionPercent?.toFixed(1) ?? 'n.a.'}%` : '—'} detail="Fast-mover baseline vs. original" tone="lime" />
    </section>}

    {mode === 'analytics' && comparison && dataset ? <AnalyticsView comparison={comparison} products={dataset.products} /> : <div className={mode === 'layout' ? 'main-grid layout-mode' : 'main-grid'}>
      {mode === 'layout' && dataset && playerLayout ? <LayoutLab products={dataset.products} layout={playerLayout} selectedProductId={selectedProductId} onSelectProduct={setSelectedProductId} onSwap={swapIntoSlot} onUndo={undoLayout} onReset={resetLayout} onAutomatic={applyAutomaticToPlayer} canUndo={layoutHistory.length > 0} /> : <aside className="panel left-panel">
        <div className="rail-nav" aria-label="Dashboard navigation"><button className={mode === 'twin' ? 'active' : ''} onClick={() => setMode('twin')}><b>▣</b> Dashboard</button><button onClick={() => setMode('twin')}><b>◇</b> 3D Warehouse</button><button onClick={() => { setActiveScenario('player'); setMode('layout') }}><b>▦</b> Product Slotting</button><button onClick={() => setMode('analytics')}><b>▥</b> Analytics</button></div>
        <div className="side-divider" />
        <div className="panel-title"><span>01</span><h2>Control surface</h2></div>
        <div className="control-group"><label htmlFor="layout-scenario">ACTIVE LAYOUT</label><select className="select-control" id="layout-scenario" value={activeScenario} onChange={(event) => selectScenario(event.target.value as Scenario)}><option value="original">Original layout</option><option value="automatic">Automatic baseline</option><option value="player">Player layout</option></select></div>
        <div className="control-group"><label htmlFor="product-search">PRODUCT LOOKUP</label><input id="product-search" aria-label="Search loaded products" placeholder={`${productCount} validated SKUs loaded`} onChange={(event) => { const match = dataset?.products.find((product) => `${product.code} ${product.description}`.toLowerCase().includes(event.target.value.toLowerCase())); if (match && event.target.value) setSelectedProductId(match.id) }} /></div>
        <div className="section-rule" />
        <div className="simulation-buttons"><button className="run" disabled={!activeEvents.length} onClick={togglePlayback}>{playing ? 'Ⅱ Pause' : '▶ Start'}</button><button disabled={!activeEvents.length} onClick={() => { setPlaying(false); setEventIndex(0); setOrderIndex(0); setNotice('Replay returned to the first scored pick.') }}>↶ Reset</button></div>
        <div className="speed-control"><label>PLAYBACK SPEED <b>{speed}×</b></label><button onClick={cycleSpeed}>Adjust speed</button></div>
        <div className="layers-row"><div><label>WAREHOUSE LAYERS</label><small>Route and product bins</small></div><button className={showLayers ? 'toggle on' : 'toggle'} aria-label="Toggle warehouse layers" onClick={() => setShowLayers(!showLayers)}><span /></button></div>
        <div className="layer-buttons"><button className={visibleLayer === 'all' ? 'active' : ''} onClick={() => { setVisibleLayer('all'); setShowLayers(true) }}>All</button>{([1, 2, 3] as const).map((layer) => <button key={layer} className={visibleLayer === layer ? 'active' : ''} onClick={() => { setVisibleLayer(layer); setShowLayers(true); setNotice(`Showing rack level ${layer} in the 3D warehouse.`) }}>L{layer}</button>)}</div>
        <div className="current-order-card"><span>Current Order</span><b>Order #{activeOrder?.id ?? 'Loading'}</b><small>{activeEvents.length} items · {activeEvents.reduce((sum, event) => sum + event.travelDistanceMeters, 0).toFixed(0)} m</small><i><u style={{ width: `${orderProgress}%` }} /></i><em>{completedPicks} / {activeEvents.length} picks</em></div>
        <div className="foundation-note"><span>ROUTING SOURCE</span><p>Every cyan segment is the same aisle-aware A* route used in scoring.</p></div>
      </aside>
      }

      <section className="viewport-panel" aria-label="Interactive digital twin viewport">
        {simulation && dataset && webglAvailable ? <ErrorBoundary fallback={<div className="fallback-view"><span className="eyebrow">3D VIEW RECOVERY</span><strong>The 3D renderer stopped. Use the Layout Lab and Analytics views, then refresh to retry WebGL.</strong></div>}><Suspense fallback={<div className="fallback-view"><span className="eyebrow">INITIALIZING TWIN</span><strong>Loading the real warehouse layout…</strong></div>}><DigitalTwin key={cameraSeed} products={dataset.products} layout={simulation.layout} activeEvent={showLayers ? activeEvent : undefined} playing={playing} playbackSpeed={speed} visibleLayer={visibleLayer} onSelectProduct={setSelectedProductId} selectedProductId={selectedProductId ?? activeEvent?.productId} /></Suspense></ErrorBoundary> : <div className="fallback-view"><span className="eyebrow">{dataError ?? (webglAvailable ? 'INITIALIZING TWIN' : 'WEBGL UNAVAILABLE')}</span><strong>{dataError ? 'Check the processed JSON asset, then retry the data request.' : webglAvailable ? 'Loading the real warehouse layout…' : 'Use the operational panels and data report; the 3D scene requires WebGL.'}</strong>{dataError && <button className="retry-button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry data load</button>}</div>}
        <div className="viewport-tools"><button onClick={() => { setCameraSeed((seed) => seed + 1); setNotice('Camera reset to the warehouse overview.') }}>⌖ Reset view</button><button onClick={() => setSelectedProductId(undefined)}>× Clear selection</button><button onClick={() => { const element = document.querySelector('.viewport-panel'); if (element && document.fullscreenElement !== element) void element.requestFullscreen(); else void document.exitFullscreen() }}>⛶ Fullscreen</button></div>
        <div className="legend"><span><i className="cyan" />Scored route</span><span><i className="magenta" />Target / picker</span><span><i className="lime" />Product bin</span></div>
      </section>

      <aside className="panel telemetry-panel">
        <div className="panel-title"><span>02</span><h2>Current Picker</h2><i className="pulse" /></div>
        <div className="picker-card"><div className="avatar">PK</div><div><span>Picker #1</span><strong>{playing ? 'Picking route' : 'Ready to pick'}</strong><small>Order #{activeOrder?.id ?? 'Loading'}</small></div></div>
        <div className="telemetry-list"><div><span>CURRENT LOCATION</span><b>{activeEvent?.slotId ?? 'Dock'}</b></div><div><span>NEXT PRODUCT</span><b>{selectedProduct?.code ?? '—'}</b></div><div><span>REMAINING DISTANCE</span><b>{activeEvent ? formatMeters(activeEvent.travelDistanceMeters) : '—'} <small>m</small></b></div></div>
        <div className="product-card"><span>Selected Product</span><div className="product-box">▣</div><div><b>{selectedProduct?.code ?? 'Choose a bin'}</b><small>{selectedProduct?.description ?? 'Select a product in the warehouse'}</small><em>{selectedSlot ? `${selectedSlot.rackId} · L${selectedSlot.level}` : 'No location selected'}</em></div></div>
        <div className="order-progress"><span>Active Order Progress</span><b>{completedPicks} / {activeEvents.length} picks <em>{orderProgress}%</em></b><i><u style={{ width: `${orderProgress}%` }} /></i>{activeEvents.slice(0, 3).map((event, index) => <small key={event.productId} className={index < completedPicks ? 'done' : index === completedPicks ? 'current' : ''}>{index + 1}. {dataset?.products.find((product) => product.id === event.productId)?.code ?? event.productId}</small>)}</div>
      </aside>
    </div>}

    {mode !== 'analytics' && <section className="bottom-zone reference-bottom">
      <article className="comparison-panel"><div className="bottom-head"><span>◇</span><strong>Layout Comparison</strong><button onClick={() => setMode('analytics')}>Open analytics</button></div><div className="scenario-grid">{comparison && ([['Original', comparison.original, 'original'], ['Automatic baseline', comparison.automatic, 'automatic'], ['Player layout', comparison.player, 'player']] as const).map(([label, result, scenario]) => <button key={scenario} className={activeScenario === scenario ? 'scenario active' : 'scenario'} onClick={() => selectScenario(scenario)}><b>{label}</b><span>Total distance</span><strong>{(result.metrics.totalWalkingDistanceMeters / 1000).toFixed(2)} km</strong><span>Picking time</span><em>{formatMinutes(result.metrics.totalEstimatedSeconds)} min</em></button>)}</div></article>
      <article className="route-chart"><div className="bottom-head"><span>⌁</span><strong>Distance by order</strong><small>Scored events</small></div><div className="spark-lines" aria-label="Order route distance comparison"><i className="original" /><i className="automatic" /><i className="player" /></div><div className="spark-key"><span>Original</span><span>Automatic</span><span>Player</span></div></article>
      <article className="rack-summary"><div className="bottom-head"><span>▦</span><strong>Rack Visit Heatmap</strong><button onClick={() => setMode('analytics')}>All racks</button></div><div className="mini-heatmap">{simulation ? Object.entries(simulation.result.rackVisits).slice(0, 36).map(([rack, visits]) => <i key={rack} title={`${rack}: ${visits} visits`} style={{ '--visit': visits } as CSSProperties} />) : null}</div></article>
    </section>}
    <footer className="notice" role="status"><span>◆</span>{notice}<button onClick={() => setNotice('Click a product bin to inspect it. Orbit, pan, and zoom the warehouse with the pointer.')}>Help</button></footer>
  </main>
}
