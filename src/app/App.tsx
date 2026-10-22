import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Box, Boxes, ChartNoAxesCombined, Clock3, ClipboardList, Home, LayoutGrid, MapPin, Maximize, Pause, Play, RotateCcw, Route, Search, Settings, ShieldCheck, SkipForward, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ErrorBoundary } from './ErrorBoundary'
import { LayoutLab } from '../components/layout/LayoutLab'
import { AnalyticsView } from '../components/analytics/AnalyticsView'
import { DistanceChart, RackHeatmap } from '../components/analytics/Charts'
import { swapProductIntoSlot } from '../engine/layout'
import { createOriginalLayout, getSlot, validateLayout, type ProductLayout } from '../engine/warehouse'
import { calculateReductionPercent, createFastMoverLayout, simulateOrders, type LayoutComparison } from '../engine/simulation'
import { eventSeconds, playbackAt } from '../engine/playback'
import { categoryOf, validateDataset, type RetailDataset } from '../data/dataset'

type Mode = 'twin' | 'layout' | 'analytics'
type Scenario = 'original' | 'automatic' | 'player'
type Layer = 'all' | 1 | 2 | 3
const DigitalTwin = lazy(() => import('../components/warehouse/DigitalTwin').then(module => ({ default: module.DigitalTwin })))
const names = { original: 'Original', automatic: 'Automatic baseline', player: 'Player layout' }
const meters = (n: number) => `${Math.round(n).toLocaleString()} m`
const minutes = (n: number) => `${(n / 60).toFixed(1)} min`
const percent = (n: number | null | undefined) => n == null ? '—' : `${n.toFixed(1)}%`
function Kpi({ label, value, detail, icon: Icon, tone = '' }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: string }) {
  return <article className={`kpi-card ${tone}`}><Icon size={30} /><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>
}

export function App() {
  const [mode, setMode] = useState<Mode>('twin')
  const [dataset, setDataset] = useState<RetailDataset | null>(null)
  const [dataError, setDataError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [notice, setNotice] = useState('Loading Online Retail II…')
  const [playerLayout, setPlayerLayout] = useState<ProductLayout>()
  const [history, setHistory] = useState<ProductLayout[]>([])
  const [scenario, setScenario] = useState<Scenario>('original')
  const [orderIndex, setOrderIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(10)
  const [selectedId, setSelectedId] = useState<string>()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All products')
  const [layer, setLayer] = useState<Layer>('all')
  const [cameraSeed, setCameraSeed] = useState(0)
  const [cameraMode, setCameraMode] = useState<'orbit' | 'pan' | 'zoom'>('orbit')
  const [settings, setSettings] = useState(false)
  const [webgl] = useState(() => { try { return Boolean(document.createElement('canvas').getContext('webgl2')) } catch { return false } })
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/retail-2011-11.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(`Dataset request failed (${response.status})`); return response.json() as Promise<unknown> })
      .then(value => {
        validateDataset(value)
        let initial = createOriginalLayout(value.products.map(p => p.id).sort())
        try { const saved = localStorage.getItem('nexai-layout-v1'); if (saved) { const candidate = JSON.parse(saved) as ProductLayout; validateLayout(candidate, value.products.map(p => p.id)); initial = candidate } } catch { /* Storage is optional. */ }
        setPlayerLayout(initial); setDataset(value); setDataError(''); setNotice('Simulation ready. Choose an order and press Start.')
      }).catch((error: Error) => { if (!controller.signal.aborted) { setDataError(error.message); setNotice('Data could not be validated. Retry loading.') } })
    return () => controller.abort()
  }, [loadAttempt])
  const originalLayout = useMemo(() => dataset ? createOriginalLayout(dataset.products.map(p => p.id).sort()) : undefined, [dataset])
  const automaticLayout = useMemo(() => dataset ? createFastMoverLayout(dataset.products) : undefined, [dataset])
  const original = useMemo(() => dataset && originalLayout ? simulateOrders(dataset.orders, dataset.products.map(p => p.id), originalLayout) : undefined, [dataset, originalLayout])
  const automatic = useMemo(() => dataset && automaticLayout ? simulateOrders(dataset.orders, dataset.products.map(p => p.id), automaticLayout) : undefined, [dataset, automaticLayout])
  const player = useMemo(() => dataset && playerLayout ? simulateOrders(dataset.orders, dataset.products.map(p => p.id), playerLayout) : undefined, [dataset, playerLayout])
  const comparison = useMemo<LayoutComparison | undefined>(() => original && automatic && player ? {
    original, automatic, player,
    automaticDistanceReductionPercent: calculateReductionPercent(original.metrics.totalWalkingDistanceMeters, automatic.metrics.totalWalkingDistanceMeters),
    playerDistanceReductionPercent: calculateReductionPercent(original.metrics.totalWalkingDistanceMeters, player.metrics.totalWalkingDistanceMeters),
    automaticTimeReductionPercent: calculateReductionPercent(original.metrics.totalEstimatedSeconds, automatic.metrics.totalEstimatedSeconds),
    playerTimeReductionPercent: calculateReductionPercent(original.metrics.totalEstimatedSeconds, player.metrics.totalEstimatedSeconds),
  } : undefined, [original, automatic, player])
  const result = scenario === 'original' ? original : scenario === 'automatic' ? automatic : player
  const layout = scenario === 'original' ? originalLayout : scenario === 'automatic' ? automaticLayout : playerLayout
  const activeOrder = dataset?.orders[orderIndex]
  const timeline = useMemo(() => result?.timeline.filter(e => e.orderId === activeOrder?.id) ?? [], [result, activeOrder])
  const picks = useMemo(() => timeline.filter(e => e.kind === 'pick'), [timeline])
  const duration = timeline.reduce((sum, e) => sum + eventSeconds(e), 0)
  const playback = playbackAt(timeline, elapsed)
  const activeEvent = playback.event
  const selected = dataset?.products.find(p => p.id === (selectedId ?? activeEvent?.productId))
  const selectedSlot = selected && layout ? getSlot(layout[selected.id]) : undefined
  const progress = picks.length ? Math.round(playback.completedPicks / picks.length * 100) : 0
  const reduction = original && result ? calculateReductionPercent(original.metrics.totalWalkingDistanceMeters, result.metrics.totalWalkingDistanceMeters) : null
  const dirty = Boolean(playerLayout && originalLayout && Object.keys(playerLayout).some(id => playerLayout[id] !== originalLayout[id]))
  const categories = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of dataset?.products ?? []) counts[categoryOf(p)] = (counts[categoryOf(p)] ?? 0) + 1
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  }, [dataset])
  const visibleProducts = useMemo(() => (dataset?.products ?? []).filter(p => (category === 'All products' || categoryOf(p) === category) && `${p.code} ${p.description}`.toLowerCase().includes(query.toLowerCase())), [dataset, category, query])
  useEffect(() => {
    if (!playing) return
    let previous = performance.now()
    let frame = 0
    const tick = (now: number) => { const delta = Math.min((now - previous) / 1000, 0.25); previous = now; setElapsed(value => Math.min(duration, value + delta * speed)); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, duration])
  useEffect(() => { if (playing && elapsed >= duration && duration > 0) { setPlaying(false); setNotice(`Order ${activeOrder?.id} complete. Picker returned to the dock.`) } }, [elapsed, duration, playing, activeOrder])
  const resetReplay = () => { setElapsed(0); setPlaying(false) }
  const selectScenario = (next: Scenario) => { setScenario(next); resetReplay(); setNotice(`${names[next]} loaded. Results use the same ${dataset?.orders.length.toLocaleString()} orders.`) }
  const changeOrder = (next: number) => { setOrderIndex(next); resetReplay(); setSelectedId(undefined) }
  const saveLayout = (next: ProductLayout, message: string, record = true) => {
    if (!dataset) return
    try {
      validateLayout(next, dataset.products.map(p => p.id))
      if (record && playerLayout) setHistory(h => [...h.slice(-49), playerLayout])
      setPlayerLayout(next); setScenario('player'); resetReplay()
      try { localStorage.setItem('nexai-layout-v1', JSON.stringify(next)); setNotice(message) } catch { setNotice(`${message} Browser storage unavailable; export to keep your layout.`) }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Invalid layout') }
  }
  const undo = () => { const last = history.at(-1); if (last) { setHistory(h => h.slice(0, -1)); saveLayout(last, 'Previous layout restored and rescored.', false) } }
  const step = () => { setPlaying(false); let time = 0; for (const event of timeline) { time += eventSeconds(event); if (time > elapsed + 0.001) { setElapsed(time); return } } }
  const download = (data: unknown, filename: string) => { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  const navigate = (next: Mode) => { setMode(next); setPlaying(false); if (next === 'layout') selectScenario('player') }
  return <main className={`app-shell mode-${mode}`}>
    <header className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('twin') }}><Box size={38} /><span>NEX<span className="cyan-text">AI</span><em>2026</em></span></a><div className="project-label">WAREHOUSE DIGITAL TWIN<small>3D PICKING FLOOR GAME</small></div><nav aria-label="Application sections">{([{ id: 'twin', name: 'Digital Twin', icon: Home }, { id: 'layout', name: 'Layout Lab', icon: LayoutGrid }, { id: 'analytics', name: 'Analytics', icon: ChartNoAxesCombined }] as const).map(item => <button key={item.id} className={mode === item.id ? 'active' : ''} aria-current={mode === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon size={17} />{item.name}</button>)}</nav><div className="header-dataset"><span>Dataset: Online Retail II <b className={dataError ? 'negative' : 'positive'}>● {dataError ? 'Data error' : dataset ? 'Data loaded' : 'Loading'}</b></span><small>Period: {dataset?.metadata.selectedPeriod ?? '…'} · {dataset?.products.length ?? '—'} products · {dataset?.orders.length.toLocaleString() ?? '—'} orders</small></div><button className="icon-button" aria-label="Simulation settings and methodology" onClick={() => setSettings(true)}><Settings size={18} /></button><ShieldCheck size={23} className="profile-icon" /></header>
    <aside className="sidebar panel"><h2>Control Panel <Boxes size={15} /></h2><div className="sidebar-inner"><label htmlFor="scenario">Layout Selection</label><select id="scenario" value={scenario} onChange={e => selectScenario(e.target.value as Scenario)}>{Object.entries(names).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select><label htmlFor="product-search">Products</label><div className="search-input"><Search size={14} /><input id="product-search" placeholder="Search product code or name…" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="categories"><button className={category === 'All products' ? 'chosen' : ''} onClick={() => setCategory('All products')}><i />All products<b>{dataset?.products.length ?? 0}</b></button>{categories.map(([name, count], i) => <button className={category === name ? 'chosen' : ''} key={name} onClick={() => setCategory(name)}><i style={{ background: ['#168dff', '#ffc545', '#39ff14', '#ff007a', '#b664f2', '#8db3d0'][i] }} />{name}<b>{count}</b></button>)}</div>{(query || category !== 'All products') && <div className="search-results">{visibleProducts.length ? visibleProducts.map(p => <button key={p.id} onClick={() => setSelectedId(p.id)}><b>{p.code}</b> {p.description}</button>) : <small>No matching products</small>}</div>}<div className="sidebar-section"><label>Warehouse Layers</label><div className="layer-buttons">{(['all', 1, 2, 3] as const).map(value => <button key={value} className={layer === value ? 'active' : ''} onClick={() => setLayer(value)}>{value === 'all' ? 'All' : `L${value}`}</button>)}</div></div><div className="sidebar-section"><label>Simulation Control</label><div className="simulation-buttons"><button className="run" disabled={!result} onClick={() => { if (playback.complete) setElapsed(0); setPlaying(!playing) }}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Pause' : elapsed ? playback.complete ? 'Restart' : 'Resume' : 'Start'}</button><button onClick={resetReplay} disabled={!result}><RotateCcw size={13} />Reset</button></div><div className="speed-label"><label htmlFor="speed">Playback Speed</label><b>{speed}×</b></div><input id="speed" type="range" min="1" max="60" value={speed} onChange={e => setSpeed(Number(e.target.value))} /><button className="step-button" onClick={step} disabled={!result || playback.complete}><SkipForward size={12} />Next event</button></div><div className="current-order-card"><label htmlFor="order-select">Current Order</label><select id="order-select" value={orderIndex} onChange={e => changeOrder(Number(e.target.value))}>{dataset?.orders.map((order, index) => <option key={order.id} value={index}>#{order.id} · {order.items.length} picks</option>)}</select><small>{result ? meters(result.perOrder[orderIndex].distanceMeters) : '—'} · includes return to dock</small><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small>{playback.completedPicks} / {picks.length} picks</small></div><p className="sidebar-note">Categories are inferred from product descriptions. Scoring uses the full workload.</p></div></aside>
    <div className="workspace">
      <section className="kpi-strip" aria-label="Scored workload metrics"><Kpi icon={ClipboardList} label="Total Orders" value={result?.metrics.completedOrders.toLocaleString() ?? '—'} detail="Full monthly workload" /><Kpi icon={Box} label="Items Picked" value={result?.metrics.totalItemPicks.toLocaleString() ?? '—'} detail={`${result?.metrics.totalUnitsHandled.toLocaleString() ?? '—'} units · scored total`} /><Kpi icon={Route} label="Total Distance" value={result ? `${(result.metrics.totalWalkingDistanceMeters / 1000).toFixed(2)} km` : '—'} detail={`${percent(reduction)} reduction vs. original`} tone="magenta" /><Kpi icon={Clock3} label="Picking Time" value={result ? minutes(result.metrics.totalEstimatedSeconds) : '—'} detail="Estimated travel + handling" /><Kpi icon={MapPin} label="Avg. Distance / Order" value={result ? meters(result.metrics.averageWalkingDistanceMeters) : '—'} detail="Same orders in every layout" /><Kpi icon={ChartNoAxesCombined} label="Distance Reduction" value={percent(reduction)} detail={`${names[scenario]} vs. original`} tone={reduction !== null && reduction < 0 ? 'negative' : 'lime'} /></section>
      {mode === 'analytics' && comparison && dataset ? <><AnalyticsView comparison={comparison} products={dataset.products} /><div className="export-actions"><button onClick={() => download({ metadata: dataset.metadata, original: original?.metrics, baseline: automatic?.metrics, player: player?.metrics, perOrder: { original: original?.perOrder, baseline: automatic?.perOrder, player: player?.perOrder } }, 'nexai-results.json')}>Export simulation results</button></div></> : <>
      {mode === 'layout' && dataset && playerLayout && <LayoutLab products={dataset.products} layout={playerLayout} selectedProductId={selectedId} onSelectProduct={setSelectedId} onSwap={(id, slot) => { try { saveLayout(swapProductIntoSlot(playerLayout, id, slot), `Moved ${id} to ${slot}. All scores updated.`) } catch (e) { setNotice(e instanceof Error ? e.message : 'Invalid move') } }} onUndo={undo} onReset={() => originalLayout && saveLayout(originalLayout, 'Original layout restored.')} onAutomatic={() => automaticLayout && saveLayout(automaticLayout, 'Frequency baseline applied and scored.')} canUndo={history.length > 0} dirty={dirty} onExport={() => download(playerLayout, 'nexai-layout.json')} onImport={value => saveLayout(value as ProductLayout, 'Imported layout validated and scored.')} />}
      <div className="twin-row"><section className="viewport-panel panel" aria-label="Interactive 3D warehouse"><div className="viewport-header"><h2><Box size={17} />3D Warehouse Floor</h2><div>{(['orbit', 'pan', 'zoom'] as const).map(value => <button key={value} className={cameraMode === value ? 'active' : ''} onClick={() => setCameraMode(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}<button title="Reset camera" aria-label="Reset camera" onClick={() => setCameraSeed(value => value + 1)}><RotateCcw size={13} /></button><button aria-label="Fullscreen warehouse" onClick={() => { const element = document.querySelector('.viewport-panel'); if (document.fullscreenElement) void document.exitFullscreen().catch(() => setNotice('Fullscreen unavailable')); else if (element) void element.requestFullscreen().catch(() => setNotice('Fullscreen unavailable')) }}><Maximize size={13} /></button></div></div><div className="scene-container">{dataset && layout && webgl ? <ErrorBoundary fallback={<div className="fallback-view">The 3D renderer stopped. Layout Lab and Analytics remain available. Reload to retry.</div>}><Suspense fallback={<div className="fallback-view">Loading warehouse geometry…</div>}><DigitalTwin key={cameraSeed} products={visibleProducts} layout={layout} activeEvent={activeEvent} pickerPosition={playback.position} visibleLayer={layer} cameraMode={cameraMode} onSelectProduct={setSelectedId} selectedProductId={selected?.id} /></Suspense></ErrorBoundary> : <div className="fallback-view"><Box size={42} /><strong>{dataError || (webgl ? 'Loading validated data…' : 'WebGL is unavailable')}</strong><p>{webgl ? 'The warehouse loads once the dataset passes validation.' : 'Use Layout Lab to edit slots and Analytics to compare routes.'}</p>{dataError && <button onClick={() => setLoadAttempt(n => n + 1)}>Retry data load</button>}{!webgl && <button onClick={() => navigate('layout')}>Open Layout Lab</button>}</div>}<div className="legend"><span><i className="cyan" />Active route</span><span><i className="magenta" />Pick location</span><span><Box size={11} />Storage rack</span><span><i className="amber" />Picker</span><span>◈ Dock</span></div></div></section>
      <aside className="telemetry"><section className="panel picker-panel"><h2>Current Picker <span className="status-tag">{playing ? playback.handling ? 'Picking' : 'Walking' : playback.complete ? 'Complete' : elapsed ? 'Paused' : 'Ready'}</span></h2><div className="picker-profile"><div className="picker-avatar">♟</div><div><b>Picker #1</b><small>Order #{activeOrder?.id ?? '—'}</small></div></div><dl><dt>Current location</dt><dd>({playback.position.x.toFixed(1)}, {playback.position.y.toFixed(1)})</dd><dt>Next product</dt><dd>{activeEvent?.kind === 'return' ? 'Return to dock' : activeEvent?.productId || '—'}</dd><dt>Remaining distance</dt><dd>{result ? meters(Math.max(0, result.perOrder[orderIndex].distanceMeters - playback.distance)) : '—'}</dd><dt>Estimated time left</dt><dd>{minutes(Math.max(0, duration - elapsed))}</dd><dt>Travelled / elapsed</dt><dd>{meters(playback.distance)} / {minutes(elapsed)}</dd></dl></section><section className="panel selected-panel"><h2>Selected Product <button aria-label="Clear selected product" onClick={() => setSelectedId(undefined)}><X size={12} /></button></h2><div className="product-detail"><div className="product-box"><Box size={40} /></div><div><b>{selected?.code ?? 'Select a carton'}</b><p>{selected?.description ?? 'Click a product in the scene or search.'}</p><span className="target-tag">{selected?.id === activeEvent?.productId ? 'Pick target' : 'Storage location'}</span><small>{selectedSlot?.id ?? '—'}</small></div></div><div className="frequency">Monthly unit frequency <b>{selected?.pickFrequency.toLocaleString() ?? '—'}</b></div></section><section className="panel order-progress"><h2>Active Order Progress</h2><div className="progress-label"><span>{playback.completedPicks} / {picks.length} picks</span><b>{progress}%</b></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><div className="pick-list">{picks.map((event, index) => <button key={event.productId} onClick={() => setSelectedId(event.productId)}><span>{index + 1}. {event.productId}</span><em className={index < playback.completedPicks ? 'positive' : ''}>{index < playback.completedPicks ? '✓ Picked' : activeEvent === event ? '◉ In progress' : '○ Pending'}</em></button>)}</div>{activeEvent?.kind === 'return' && <small className="cyan-text">Returning to packing dock…</small>}</section></aside></div>
      <section className="bottom-zone"><article className="panel comparison-panel"><h2><Boxes size={15} />Layout Comparison<button onClick={() => navigate('analytics')}>Details ↗</button></h2><div className="scenario-grid">{comparison && (['original', 'automatic', 'player'] as const).map(key => { const r = comparison[key]; const gain = calculateReductionPercent(comparison.original.metrics.totalWalkingDistanceMeters, r.metrics.totalWalkingDistanceMeters); return <button className={`scenario ${scenario === key ? 'active' : ''}`} key={key} onClick={() => selectScenario(key)}><b><i className={key} />{names[key]}</b><dl><dt>Total distance</dt><dd>{(r.metrics.totalWalkingDistanceMeters / 1000).toFixed(2)} km</dd><dt>Avg. / order</dt><dd>{meters(r.metrics.averageWalkingDistanceMeters)}</dd><dt>Est. time</dt><dd>{minutes(r.metrics.totalEstimatedSeconds)}</dd><dt>Reduction</dt><dd className={gain !== null && gain < 0 ? 'negative' : 'positive'}>{percent(gain)}</dd></dl></button> })}</div><small className="panel-note">Reductions compare identical orders against the original layout.</small></article><article className="panel"><h2><Route size={15} />Distance by Order<small>All orders · meters</small></h2>{comparison && <DistanceChart comparison={comparison} />}</article><article className="panel"><h2><LayoutGrid size={15} />Rack Visit Heatmap<small>{layer === 'all' ? 'All layers' : `L${layer}`}</small></h2>{result && <RackHeatmap result={result} layer={layer} />}</article></section></>}
    </div><footer><span>NEXAI 2026 <i /> Warehouse Digital Twin <i /> Track 4</span><span className="notice" role="status">{notice}</span><span>v1.0.0 · React + Three.js</span></footer>
    {settings && <div className="modal-backdrop" onClick={() => setSettings(false)}><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setSettings(false) }}><h2 id="settings-title">Simulation assumptions<button autoFocus aria-label="Close settings" onClick={() => setSettings(false)}><X size={18} /></button></h2><p>Walking: <b>1.2 m/s</b>. Handling: <b>5 seconds per product + 1 second per unit</b>. Every order starts and ends at the dock. Nearest reachable next product uses four-direction A* with stable SKU tie-breaking.</p><p>Playback speed changes the display only. The six cards show the entire scored workload. Right-side panels show the selected order replay.</p><p>Original locations are a disclosed lexical-SKU arrangement: Retail II contains no warehouse geometry. Baseline ranks products by monthly units and slots by round-trip dock distance. Distance reduction is not an optimal-route guarantee.</p><p>One picker, no congestion, no vertical travel penalty. Categories are inferred using description keywords. Player edits are saved in this browser automatically; export for a portable copy.</p><p>Data: Chen, D. (2012), <a href="https://doi.org/10.24432/C5CG6D" target="_blank" rel="noreferrer">UCI Online Retail II</a>, CC BY 4.0. November 2011, 100 selected products. Orders contain only those selected products.</p></section></div>}
  </main>
}
