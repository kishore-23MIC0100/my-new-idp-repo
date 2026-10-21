import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
type ProductCategory = 'Electronics' | 'Home & Kitchen' | 'Fashion' | 'Sports' | 'Toys' | 'Others'

const categoryDefinitions: { name: ProductCategory; color: string; match: RegExp }[] = [
  { name: 'Electronics', color: 'category-blue', match: /light|lamp|battery|clock|wire|radio|electronic|adapter|led|electric|bulb/i },
  { name: 'Home & Kitchen', color: 'category-yellow', match: /mug|cup|plate|bowl|kitchen|table|candle|napkin|jar|dish|tea|tray|storage|container|bottle|glass|tin|cutlery|doormat|cushion|vase/i },
  { name: 'Fashion', color: 'category-sky', match: /scarf|hat|glove|sock|bag|shirt|apron|umbrella|purse|wallet|dress|coat|jewellery|jewelry|sequin|fabric/i },
  { name: 'Sports', color: 'category-red', match: /sport|golf|football|basketball|tennis|bike|yoga|gym|cricket|camping|fitness/i },
  { name: 'Toys', color: 'category-pink', match: /toy|doll|bear|game|puzzle|child|children|baby|jigsaw|play|wooden rocking horse/i },
  { name: 'Others', color: 'category-slate', match: /.*/ },
]

function categorizeProduct(description: string): ProductCategory {
  return categoryDefinitions.find((category) => category.name !== 'Others' && category.match.test(description))?.name ?? 'Others'
}

const DigitalTwin = lazy(async () => {
  const module = await import('../components/warehouse/DigitalTwin')
  return { default: module.DigitalTwin }
})

const navItems: { id: Mode; label: string; index: string }[] = [
  { id: 'twin', label: 'Digital Twin', index: '01' },
  { id: 'layout', label: 'Layout Lab', index: '02' },
  { id: 'analytics', label: 'Analytics', index: '03' },
]

function Kpi({ label, value, detail, tone = 'cyan', glyph, explanation, delta, ringValue }: { label: string; value: string; detail: string; tone?: 'cyan' | 'lime'; glyph: string; explanation: string; delta?: number | null; ringValue?: number }) {
  const deltaValue = typeof delta === 'number' && Number.isFinite(delta) ? delta : undefined
  const ring = ringValue === undefined ? undefined : { background: `conic-gradient(#45f59a ${Math.max(0, Math.min(100, ringValue))}%, #15375e 0)` }
  return <article className={`kpi-card ${tone}`} title={explanation}><i aria-hidden="true" className={ring ? 'kpi-ring' : undefined} style={ring}>{ring && ringValue !== undefined ? `${Math.round(ringValue)}%` : glyph}</i><span>{label}</span><strong>{value}</strong><small>{deltaValue !== undefined ? <><b className={deltaValue >= 0 ? 'metric-delta positive-delta' : 'metric-delta negative-delta'}>{deltaValue >= 0 ? '↓' : '↑'} {Math.abs(deltaValue).toFixed(1)}%</b> vs. original</> : detail}</small></article>
}

function formatMeters(value: number) { return Math.round(value).toLocaleString() }
function formatMinutes(value: number) { return (value / 60).toFixed(1) }
function scenarioName(scenario: Scenario) { return scenario === 'original' ? 'Original layout' : scenario === 'automatic' ? 'Automatic baseline' : 'Player layout' }
function reductionPercent(baseline: number, current: number) { return baseline > 0 ? (baseline - current) / baseline * 100 : null }

export function App() {
  const [mode, setMode] = useState<Mode>('twin')
  const [showLayers, setShowLayers] = useState(true)
  const [showControlPanel, setShowControlPanel] = useState(true)
  const [notice, setNotice] = useState('Loading validated UCI Online Retail II data…')
  const [dataset, setDataset] = useState<RetailDataset | null>(null)
  const [eventIndex, setEventIndex] = useState(0)
  const [orderIndex, setOrderIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [selectedProductId, setSelectedProductId] = useState<string>()
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>()
  const [productQuery, setProductQuery] = useState('')
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
  const activeOrderDistance = simulation?.result.orderDistances.find((order) => order.orderId === activeOrder?.id)?.distanceMeters ?? 0
  const productFrequencyTotal = dataset?.products.reduce((total, product) => total + product.pickFrequency, 0) ?? 0
  const selectedProductShare = selectedProduct && productFrequencyTotal ? selectedProduct.pickFrequency / productFrequencyTotal * 100 : 0
  const completedPicks = eventIndex
  const orderProgress = activeEvents.length ? Math.round((completedPicks / activeEvents.length) * 100) : 0
  const categoryProducts = useMemo(() => {
    const grouped = new Map<ProductCategory, RetailProduct[]>(categoryDefinitions.map((category) => [category.name, []]))
    for (const product of dataset?.products ?? []) grouped.get(categorizeProduct(product.description))?.push(product)
    for (const products of grouped.values()) products.sort((a, b) => b.pickFrequency - a.pickFrequency || a.code.localeCompare(b.code))
    return grouped
  }, [dataset])
  const matchingProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase()
    if (!query) return []
    return (dataset?.products ?? []).filter((product) => `${product.code} ${product.description}`.toLowerCase().includes(query)).slice(0, 12)
  }, [dataset, productQuery])
  const orderDistanceChart = useMemo(() => {
    if (!comparison) return []
    return comparison.original.orderDistances.slice(0, 50).map((order, index) => ({
      order: index + 1,
      original: order.distanceMeters,
      automatic: comparison.automatic.orderDistances[index]?.distanceMeters ?? 0,
      player: comparison.player.orderDistances[index]?.distanceMeters ?? 0,
    }))
  }, [comparison])
  const rackHeatmap = useMemo(() => {
    const visits = simulation?.result.rackVisits ?? {}
    const rows = Array.from({ length: 6 }, (_, aisle) => Array.from({ length: 7 }, (_, rackIndex) => visits[`R${aisle + 1}-${String(rackIndex + 1).padStart(2, '0')}`] ?? 0))
    return { rows, max: Math.max(1, ...rows.flat()) }
  }, [simulation])
  const distanceDelta = simulation && comparison && activeScenario !== 'original' ? reductionPercent(comparison.original.metrics.totalWalkingDistanceMeters, simulation.result.metrics.totalWalkingDistanceMeters) : null
  const timeDelta = simulation && comparison && activeScenario !== 'original' ? reductionPercent(comparison.original.metrics.totalEstimatedSeconds, simulation.result.metrics.totalEstimatedSeconds) : null
  const averageDelta = simulation && comparison && activeScenario !== 'original' ? reductionPercent(comparison.original.metrics.averageWalkingDistanceMeters, simulation.result.metrics.averageWalkingDistanceMeters) : null
  const efficiencyGain = comparison?.automaticDistanceReductionPercent ?? null

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
  const chooseProduct = (product: RetailProduct) => {
    setSelectedProductId(product.id)
    setSelectedCategory(categorizeProduct(product.description))
    setProductQuery(product.code)
  }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="NEXAI 2026 warehouse digital twin home"><span className="brand-mark">N</span><span className="brand-copy"><b>NEXAI<span>2026</span></b><small>WAREHOUSE DIGITAL TWIN<em>3D PICKING FLOOR GAME</em></small></span></a>
      <nav aria-label="Application sections">{navItems.map((item) => <button aria-current={mode === item.id ? 'page' : undefined} className={mode === item.id ? 'active' : ''} key={item.id} onClick={() => { setPlaying(false); if (item.id === 'layout') setActiveScenario('player'); setMode(item.id) }}><small>{item.index}</small>{item.label}</button>)}</nav>
      <div className="header-dataset"><span>▰ Dataset: Online Retail II</span><small>Period: {dataset?.metadata.selectedPeriod ?? 'Loading'}</small><small>{dataset ? `${productCount} products · ${orderCount.toLocaleString()} orders` : 'Loading data'}</small></div>
      <div className="system-status"><span className={dataset ? 'status-dot loaded' : 'status-dot'} />DATA PIPELINE <b>{dataset ? 'VALIDATED' : 'LOADING'}</b></div>
      <button className="header-icon" aria-label="Open settings" onClick={() => setNotice('Settings use the documented warehouse model and simulation assumptions.')}>⚙</button><button className="header-icon avatar-button" aria-label="User profile" onClick={() => setNotice('Local simulation profile: Picker #1.')}>◉</button>
    </header>

    <section className="command-header" id="top">
      <div><p className="eyebrow">PS 4.2 / TRACK 04 / COMMAND CENTER</p><h1>{mode === 'twin' ? 'Picking Floor / Digital Twin' : mode === 'layout' ? 'Slotting / Layout Lab' : 'Run / Analytics'}</h1></div>
      <div className="dataset-strip"><span>DATASET</span><strong>UCI ONLINE RETAIL II</strong><small>{dataset ? `${dataset.metadata.selectedPeriod} · ${productCount} SKUs · ${orderCount.toLocaleString()} orders` : 'Validating processed data'}</small></div>
      <button className="primary-action" disabled={!simulation} onClick={() => { if (mode === 'analytics') setMode('twin'); togglePlayback() }}><span>{playing ? 'Ⅱ' : '▶'}</span>{playing ? ' Pause replay' : ' Replay order'}</button>
    </section>

    {mode === 'twin' && <section className="kpi-strip" aria-label="Live simulation metrics">
      <Kpi glyph="▣" label="TOTAL ORDERS" value={simulation ? simulation.result.metrics.completedOrders.toLocaleString() : '—'} detail={`${scenarioName(activeScenario)} scenario`} explanation="Distinct validated orders in the selected Retail II workload." />
      <Kpi glyph="◇" label="ITEMS PICKED" value={simulation ? simulation.result.metrics.totalItemPicks.toLocaleString() : '—'} detail={simulation ? `${simulation.result.metrics.totalUnitsHandled.toLocaleString()} units handled` : 'Loading dataset'} explanation="Unique SKU pick events from the scored order stream." />
      <Kpi glyph="⌁" label="TRAVEL DISTANCE" value={simulation ? `${(simulation.result.metrics.totalWalkingDistanceMeters / 1000).toFixed(2)} km` : '—'} detail="Aisle-aware routed walk" delta={distanceDelta} explanation="Total A-star travel distance through walkable warehouse cells. Delta compares the active layout with Original." />
      <Kpi glyph="◷" label="PICKING TIME" value={simulation ? `${formatMinutes(simulation.result.metrics.totalEstimatedSeconds)} min` : '—'} detail="Travel plus handling" delta={timeDelta} explanation="Walking time at 1.2 metres per second plus line and unit handling time. Delta compares the active layout with Original." />
      <Kpi glyph="⌖" label="AVG. DISTANCE / ORDER" value={simulation ? `${formatMeters(simulation.result.metrics.averageWalkingDistanceMeters)} m` : '—'} detail="Same order sequence" delta={averageDelta} explanation="Total simulated walking distance divided by completed orders. Delta compares the active layout with Original." />
      <Kpi glyph="87" label="ROUTE EFFICIENCY GAIN" value={efficiencyGain === null ? '—' : `${efficiencyGain.toFixed(1)}%`} detail="Automatic baseline vs. original" tone="lime" ringValue={efficiencyGain ?? undefined} explanation="Walking-distance reduction achieved by the frequency-aware automatic layout compared with the original layout." />
    </section>}

    {mode === 'analytics' && comparison && dataset ? <AnalyticsView comparison={comparison} products={dataset.products} /> : <div className={`${mode === 'layout' ? 'main-grid layout-mode' : 'main-grid'} ${mode === 'twin' && !showControlPanel ? 'controls-collapsed' : ''}`}>
      {mode === 'layout' && dataset && playerLayout ? <LayoutLab products={dataset.products} layout={playerLayout} selectedProductId={selectedProductId} onSelectProduct={setSelectedProductId} onSwap={swapIntoSlot} onUndo={undoLayout} onReset={resetLayout} onAutomatic={applyAutomaticToPlayer} canUndo={layoutHistory.length > 0} /> : showControlPanel ? <aside className="panel left-panel">
        <div className="control-panel-heading"><h2>Control Panel</h2><button aria-label="Collapse control panel" title="Collapse control panel" onClick={() => setShowControlPanel(false)}>×</button></div>
        <div className="control-group"><label htmlFor="layout-scenario">LAYOUT SELECTION</label><select className="select-control" id="layout-scenario" value={activeScenario} onChange={(event) => selectScenario(event.target.value as Scenario)}><option value="original">◇ &nbsp; Original Layout</option><option value="automatic">◇ &nbsp; Automatic Baseline</option><option value="player">◇ &nbsp; Player Layout</option></select></div>
        <div className="control-group product-lookup"><label htmlFor="product-search">PRODUCTS</label><div className="search-input"><span>⌕</span><input id="product-search" value={productQuery} aria-label="Search products by code or name" placeholder="Search product code or name..." onChange={(event) => setProductQuery(event.target.value)} /><button aria-label="Clear product search" onClick={() => { setProductQuery(''); setSelectedProductId(undefined) }}>×</button></div>
          {productQuery && matchingProducts.length > 0 && matchingProducts[0]?.id !== selectedProductId && <div className="product-search-results">{matchingProducts.slice(0, 4).map((product) => <button key={product.id} onClick={() => chooseProduct(product)}><b>{product.code}</b><span>{product.description}</span></button>)}</div>}
        </div>
        <div className="category-list" aria-label="Product categories">{categoryDefinitions.map(({ name, color }) => { const products = categoryProducts.get(name) ?? []; return <button key={name} className={selectedCategory === name ? 'category-row selected' : 'category-row'} aria-pressed={selectedCategory === name} onClick={() => { setSelectedCategory(name); if (products[0]) chooseProduct(products[0]) }}><i className={color} /><span>{name}</span><small>{products.length}</small></button> })}</div>
        <div className="section-rule" />
        <div className="warehouse-levels"><h3>Warehouse Layers</h3><div className="layer-buttons"><button className={visibleLayer === 'all' ? 'active' : ''} onClick={() => { setVisibleLayer('all'); setShowLayers(true) }}>All</button>{([1, 2, 3] as const).map((layer) => <button key={layer} className={visibleLayer === layer ? 'active' : ''} onClick={() => { setVisibleLayer(layer); setShowLayers(true); setNotice(`Showing rack level ${layer} in the 3D warehouse.`) }}>L{layer}</button>)}</div></div>
        <div className="section-rule compact-rule" />
        <div className="simulation-heading"><h3>Simulation Control</h3></div>
        <div className="simulation-buttons"><button className="run" disabled={!activeEvents.length || playing} onClick={() => { if (eventIndex >= activeEvents.length - 1) { setOrderIndex(0); setEventIndex(0) } setPlaying(true) }}>▶ &nbsp; Start</button><button className="pause" disabled={!playing} onClick={() => setPlaying(false)}>Ⅱ &nbsp; Pause</button></div>
        <div className="speed-control"><label htmlFor="playback-speed">PLAYBACK SPEED <b>{speed.toFixed(1)}×</b></label><input id="playback-speed" className="playback-range" type="range" min="0.5" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></div>
        <div className="current-order-card"><span>Current Order</span><b>Order #{activeOrder?.id ?? 'Loading'}</b><small>{activeEvents.length} items · {formatMeters(activeOrderDistance)} m</small><i><u style={{ width: `${orderProgress}%` }} /></i><em>{completedPicks} / {activeEvents.length} picks</em></div>
      </aside> : <button className="control-reopen" onClick={() => setShowControlPanel(true)}>☷<span>Controls</span></button>
      }

      <section className="viewport-panel" aria-label="Interactive digital twin viewport">
        <div className="warehouse-plate" aria-hidden="true" />
        {simulation && dataset && webglAvailable ? <ErrorBoundary fallback={<div className="fallback-view"><span className="eyebrow">3D VIEW RECOVERY</span><strong>The 3D renderer stopped. Use the Layout Lab and Analytics views, then refresh to retry WebGL.</strong></div>}><Suspense fallback={<div className="fallback-view"><span className="eyebrow">INITIALIZING TWIN</span><strong>Loading the real warehouse layout…</strong></div>}><DigitalTwin key={cameraSeed} products={dataset.products} layout={simulation.layout} activeEvent={showLayers ? activeEvent : undefined} playing={playing} playbackSpeed={speed} visibleLayer={visibleLayer} photorealPlate onSelectProduct={setSelectedProductId} selectedProductId={selectedProductId ?? activeEvent?.productId} /></Suspense></ErrorBoundary> : <div className="fallback-view"><span className="eyebrow">{dataError ?? (webglAvailable ? 'INITIALIZING TWIN' : 'WEBGL UNAVAILABLE')}</span><strong>{dataError ? 'Check the processed JSON asset, then retry the data request.' : webglAvailable ? 'Loading the real warehouse layout…' : 'Use the operational panels and data report; the 3D scene requires WebGL.'}</strong>{dataError && <button className="retry-button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry data load</button>}</div>}
        <div className="viewport-tools"><button onClick={() => { setCameraSeed((seed) => seed + 1); setNotice('Camera reset to the warehouse overview.') }}>⌖ Reset view</button><button onClick={() => setSelectedProductId(undefined)}>× Clear selection</button><button onClick={() => { const element = document.querySelector('.viewport-panel'); if (element && document.fullscreenElement !== element) void element.requestFullscreen(); else void document.exitFullscreen() }}>⛶ Fullscreen</button></div>
        <div className="legend"><span><i className="cyan" />Scored route</span><span><i className="magenta" />Target / picker</span><span><i className="lime" />Product bin</span></div>
      </section>

      <aside className="panel telemetry-panel">
        <div className="panel-title"><span className="live-mark" /> <h2>Current Picker</h2><b className={playing ? 'picker-state is-picking' : 'picker-state'}>{playing ? '1 Picking' : 'Ready'}</b></div>
        <div className="picker-card"><div className="picker-figure" aria-hidden="true"><i /><b /><span /></div><div className="picker-copy"><span>Picker #1</span><strong>{playing ? 'Picking route' : 'Ready to pick'}</strong><small>Order #{activeOrder?.id ?? 'Loading'}</small><div><span>Current Location</span><b>{activeEvent?.slotId ?? 'Dock'}</b></div><div><span>Next Product</span><b>{activeEvent?.productId ?? selectedProduct?.code ?? '—'}</b></div><div><span>Remaining Distance</span><b>{activeEvent ? formatMeters(activeEvent.travelDistanceMeters) : '—'} m</b></div><div><span>Estimated Time</span><b>{activeEvent ? `${formatMinutes(activeEvent.travelDistanceMeters / 1.2 + activeEvent.handlingSeconds)} min` : '—'}</b></div></div></div>
        <div className="product-card"><span>Selected Product</span><div className="product-box" aria-hidden="true"><i /><b /><em /></div><div><b>{selectedProduct?.code ?? 'Choose a product'}</b><small>{selectedProduct?.description ?? 'Select a category, search result, or pick location'}</small><em className="pick-location">Pick Location</em><small>{selectedSlot ? `${selectedSlot.rackId} · L${selectedSlot.level}` : 'No location selected'}</small><span className="frequency-row">Pick Frequency <b>{selectedProduct ? `${selectedProductShare.toFixed(1)}%` : '—'}</b></span></div></div>
        <div className="order-progress"><span>Active Order Progress</span><b>{completedPicks} / {activeEvents.length} picks <em>{orderProgress}%</em></b><i><u style={{ width: `${orderProgress}%` }} /></i>{activeEvents.slice(0, 3).map((event, index) => <small key={event.productId} className={index < completedPicks ? 'done' : index === completedPicks ? 'current' : ''}>{index + 1}. {dataset?.products.find((product) => product.id === event.productId)?.code ?? event.productId}</small>)}</div>
      </aside>
    </div>}

    {mode !== 'analytics' && <section className="bottom-zone reference-bottom">
      <article className="comparison-panel"><div className="bottom-head"><span>◇</span><strong>Layout Comparison</strong><button onClick={() => setMode('analytics')}>Open analytics</button></div><div className="scenario-grid">{comparison && ([['Original', comparison.original, 'original'], ['Automatic Baseline', comparison.automatic, 'automatic'], ['Player Layout', comparison.player, 'player']] as const).map(([label, result, scenario]) => { const reduction = scenario === 'original' ? 0 : reductionPercent(comparison.original.metrics.totalWalkingDistanceMeters, result.metrics.totalWalkingDistanceMeters) ?? 0; return <button key={scenario} className={activeScenario === scenario ? 'scenario active' : 'scenario'} onClick={() => selectScenario(scenario)}><b>{label}</b><span>Total Distance</span><strong>{(result.metrics.totalWalkingDistanceMeters / 1000).toFixed(2)} km</strong><span>Avg. Distance / Order</span><strong>{formatMeters(result.metrics.averageWalkingDistanceMeters)} m</strong><span>Picking Time</span><strong>{formatMinutes(result.metrics.totalEstimatedSeconds)} min</strong><span>vs. Original</span><em className={reduction >= 0 ? 'positive-delta' : 'negative-delta'}>{scenario === 'original' ? 'Baseline' : `${reduction >= 0 ? '↓' : '↑'} ${Math.abs(reduction).toFixed(1)}%`}</em></button> })}</div><small className="comparison-note">↓ / ↑ shows change in walking distance versus Original.</small></article>
      <article className="route-chart"><div className="bottom-head"><span>⌁</span><strong>Distance by Order</strong><small>First 50 orders · metres</small></div><div className="distance-chart" aria-label="Route distance for the first 50 orders by layout"><ResponsiveContainer width="100%" height="100%"><LineChart data={orderDistanceChart} margin={{ top: 8, right: 8, bottom: 2, left: 0 }}><CartesianGrid stroke="#17416a" strokeDasharray="2 4" /><XAxis dataKey="order" tick={{ fill: '#9ab8d9', fontSize: 8 }} tickLine={false} axisLine={{ stroke: '#28618c' }} interval={9} /><YAxis width={34} tick={{ fill: '#9ab8d9', fontSize: 8 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${value}`} /><Tooltip contentStyle={{ background: '#071a34', border: '1px solid #1487b7', borderRadius: 5, color: '#eaf8ff', fontSize: 10 }} labelFormatter={(label) => `Order ${label}`} formatter={(value, name) => [`${Number(value).toFixed(0)} m`, name]} /><Line name="Original" dataKey="original" stroke="#168dff" strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} /><Line name="Baseline" dataKey="automatic" stroke="#38efa0" strokeWidth={1.7} dot={false} activeDot={{ r: 3 }} /><Line name="Player" dataKey="player" stroke="#f42dc0" strokeWidth={1.7} dot={false} activeDot={{ r: 3 }} /></LineChart></ResponsiveContainer></div><div className="spark-key"><span>Original</span><span>Baseline</span><span>Player</span></div></article>
      <article className="rack-summary"><div className="bottom-head"><span>▦</span><strong>Rack Visit Heatmap</strong><button onClick={() => setMode('analytics')}>All racks</button></div><div className="rack-heatmap"><div className="heatmap-rows">{rackHeatmap.rows.map((row, aisle) => <div className="heatmap-row" key={aisle}><span>A{aisle + 1}</span>{row.map((visits, rackIndex) => { const intensity = visits / rackHeatmap.max; const hue = 220 - Math.round(intensity * 220); return <i key={rackIndex} title={`Aisle ${aisle + 1}, rack ${rackIndex + 1}: ${visits} visits`} style={{ backgroundColor: `hsl(${hue} 94% ${27 + Math.round(intensity * 30)}%)`, boxShadow: `0 0 ${2 + Math.round(intensity * 7)}px hsl(${hue} 96% 55% / ${0.22 + intensity * 0.55})` }} /> })}</div>)}</div><div className="heatmap-scale"><b>High</b><i /><b>Low</b></div></div><div className="heatmap-docks"><span>Dock</span><span>Dock</span></div></article>
    </section>}
    <footer className="notice" role="status"><span>◆</span>{notice}<button onClick={() => setNotice('Click a product bin to inspect it. Orbit, pan, and zoom the warehouse with the pointer.')}>Help</button></footer>
  </main>
}
