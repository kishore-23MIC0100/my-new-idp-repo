import { Grid, Line, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Color, Matrix4, MOUSE, type InstancedMesh } from 'three'
import { CELL_SIZE_METERS, PACKING_DOCK, RACK_BLOCKS, WAREHOUSE_SIZE, getSlot, type GridPoint, type ProductLayout } from '../../engine/warehouse'
import type { PickEvent, Product } from '../../engine/simulation'
import type { PickerState } from '../../engine/team'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { HumanPicker } from './HumanPicker'

type DigitalTwinProps = {
  products: readonly Product[]
  layout: ProductLayout
  activeEvent?: PickEvent
  workers: readonly PickerState[]
  selectedPicker: number
  followPicker: boolean
  onSelectPicker: (index: number) => void
  cameraMode: 'orbit' | 'pan' | 'zoom'
  visibleLayer: 'all' | 1 | 2 | 3
  onSelectProduct: (productId: string) => void
  selectedProductId?: string
}

const toWorld = ({ x, y }: GridPoint): [number, number, number] => [
  (x - WAREHOUSE_SIZE.width / 2) * CELL_SIZE_METERS,
  0,
  (y - WAREHOUSE_SIZE.height / 2) * CELL_SIZE_METERS,
]

function Label({ text, position, width = 2.5, flat = false }: { text: string; position: [number, number, number]; width?: number; flat?: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0a233e'; ctx.fillRect(0, 0, 256, 96)
    ctx.strokeStyle = '#66b4da'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 252, 92)
    ctx.fillStyle = '#dff7ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 48px Arial'; ctx.fillText(text, 128, 50)
    return new CanvasTexture(canvas)
  }, [text])
  useEffect(() => () => texture.dispose(), [texture])
  if (flat) return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[width, width * 0.375]} /><meshBasicMaterial map={texture} /></mesh>
  return <sprite position={position} scale={[width, width * 0.375, 1]}><spriteMaterial map={texture} depthTest={false} /></sprite>
}

const Cartons = memo(function Cartons({ length, visibleLayer }: { length: number; visibleLayer: DigitalTwinProps['visibleLayer'] }) {
  const mesh = useRef<InstancedMesh>(null)
  const placements = useMemo(() => [-1.55, -0.2, 1.15].flatMap((height, level) => visibleLayer !== 'all' && visibleLayer !== level + 1 ? [] : Array.from({ length: 28 }, (_, i) => ({ x: i % 2 ? -0.65 : 0.65, y: height + 0.46, z: -length / 2 + 0.85 + Math.floor(i / 2) * 1.45, tone: (i + level) % 5 }))), [length, visibleLayer])
  useLayoutEffect(() => {
    if (!mesh.current) return
    placements.forEach((p, i) => {
      mesh.current!.setMatrixAt(i, new Matrix4().makeTranslation(p.x, p.y, p.z))
      mesh.current!.setColorAt(i, new Color(['#cf9a57', '#d6b179', '#ba8550', '#dfc89b', '#cdad7d'][p.tone]))
    })
    mesh.current.count = placements.length
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [placements])
  return <instancedMesh ref={mesh} args={[undefined, undefined, 84]} castShadow receiveShadow><boxGeometry args={[1.05, 0.8, 1.22]} /><meshStandardMaterial roughness={0.88} /></instancedMesh>
})

const Rack = memo(function Rack({ x, yStart, yEnd, id, visibleLayer }: { x: number; yStart: number; yEnd: number; id: string; visibleLayer: DigitalTwinProps['visibleLayer'] }) {
  const length = (yEnd - yStart + 1) * CELL_SIZE_METERS
  const [worldX, , worldZ] = toWorld({ x: x + 0.5, y: yStart + (yEnd - yStart) / 2 })
  return <group position={[worldX, 2.15, worldZ]}>
    {[-1.38, 1.38].flatMap((beamX) => [-length / 2 + 0.2, -6, -2, 2, 6, length / 2 - 0.2].map((beamZ) => <mesh key={`${beamX}-${beamZ}`} position={[beamX, 0, beamZ]} castShadow><boxGeometry args={[0.16, 4.5, 0.16]} /><meshStandardMaterial color="#17649a" emissive="#06315f" emissiveIntensity={0.45} metalness={0.72} roughness={0.25} /></mesh>))}
    {[-1.55, -0.2, 1.15].map((height, levelIndex) => (visibleLayer !== 'all' && visibleLayer !== levelIndex + 1) ? null : <group key={height}><mesh position={[0, height, 0]}><boxGeometry args={[2.92, 0.13, length]} /><meshStandardMaterial color="#227cb7" emissive="#07558e" emissiveIntensity={0.36} metalness={0.7} roughness={0.26} /></mesh></group>)}
    <Cartons length={length} visibleLayer={visibleLayer} />
    <Label position={[0, 2.9, -length / 2 - 0.55]} text={id.replace('R', 'A')} />
  </group>
})

function Truck({ position }: { position: [number, number, number] }) {
  return <group position={position}><mesh castShadow><boxGeometry args={[2.5, 1.4, 4.5]} /><meshStandardMaterial color="#d8e1e8" metalness={0.35} roughness={0.5} /></mesh><mesh position={[0, -0.25, -2.75]} castShadow><boxGeometry args={[2.5, 0.9, 1]} /><meshStandardMaterial color="#2368a5" metalness={0.45} /></mesh>{[-0.92, 0.92].flatMap((x) => [-1.5, 1.5].map((z) => <mesh key={`${x}-${z}`} position={[x, -0.8, z]} rotation={[0, Math.PI / 2, 0]}><cylinderGeometry args={[0.35, 0.35, 0.22, 12]} /><meshStandardMaterial color="#111827" /></mesh>))}</group>
}

function Forklift({ position }: { position: [number, number, number] }) {
  return <group position={position}><mesh castShadow><boxGeometry args={[1.05, 0.7, 1.55]} /><meshStandardMaterial color="#f2b52b" metalness={0.25} roughness={0.5} /></mesh><mesh position={[0, 0.9, 0.55]}><boxGeometry args={[0.08, 1.7, 0.08]} /><meshStandardMaterial color="#26384f" /></mesh><mesh position={[0, 0.35, 1.13]}><boxGeometry args={[0.78, 0.08, 0.08]} /><meshStandardMaterial color="#26384f" /></mesh></group>
}

const ProductBins = memo(function ProductBins({ products, layout, selectedProductId, activeEvent, onSelectProduct, visibleLayer }: Pick<DigitalTwinProps, 'products' | 'layout' | 'selectedProductId' | 'activeEvent' | 'onSelectProduct' | 'visibleLayer'>) {
  const maxFrequency = Math.max(...products.map((product) => product.pickFrequency), 1)
  return <>
    {products.map((product) => {
      const slot = getSlot(layout[product.id])
      if (!slot || (visibleLayer !== 'all' && slot.level !== visibleLayer)) return null
      const [x, , z] = toWorld(slot.position)
      const intensity = product.pickFrequency / maxFrequency
      const color = product.id === selectedProductId ? '#ff007a' : product.id === activeEvent?.productId ? '#ff007a' : intensity > 0.15 ? '#d5a85f' : '#b4834b'
      return <mesh key={product.id} position={[x, 0.45 + slot.level * 0.95, z]} onClick={(event) => { event.stopPropagation(); onSelectProduct(product.id) }} castShadow>
        <boxGeometry args={[1.1, 0.8, 1.2]} />
        <meshStandardMaterial color={color} emissive={product.id === selectedProductId ? '#8a005d' : product.id === activeEvent?.productId ? '#00683c' : '#00111b'} emissiveIntensity={product.id === selectedProductId ? 1.5 : 0.25} metalness={0.2} roughness={0.38} />
      </mesh>
    })}
  </>
})

function PickerCamera({ worker, follow, cameraMode }: { worker?: PickerState; follow: boolean; cameraMode: DigitalTwinProps['cameraMode'] }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, invalidate } = useThree()
  const [worldX, , z] = toWorld(worker?.position ?? PACKING_DOCK)
  const parked = worker && (worker.waiting || worker.complete || worker.localElapsed === 0)
  const x = worldX + (parked ? (worker.id - 1) * 0.7 : 0)
  useEffect(() => {
    if (follow || !controls.current) return
    camera.position.set(26, 29, 32)
    controls.current.target.set(0, 0, 0)
    controls.current.update()
    invalidate()
  }, [follow, camera, invalidate])
  useEffect(() => {
    if (!controls.current) return
    if (follow) {
      camera.position.set(x + 3.2, 3.2, z + 4.5)
      controls.current.target.set(x, 1.05, z)
      controls.current.update()
      invalidate()
    }
  }, [follow, x, z, camera, invalidate])
  return <OrbitControls ref={controls} enabled={!follow} mouseButtons={{ LEFT: cameraMode === 'pan' ? MOUSE.PAN : cameraMode === 'zoom' ? MOUSE.DOLLY : MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }} makeDefault minDistance={3} maxDistance={70} maxPolarAngle={Math.PI / 2.1} />
}

function WarehouseScene({ products, layout, activeEvent, workers, selectedPicker, followPicker, onSelectPicker, cameraMode, visibleLayer, selectedProductId, onSelectProduct }: DigitalTwinProps) {
  const routePoints = useMemo(() => activeEvent?.route.map((point) => {
    const [x, y, z] = toWorld(point)
    return [x, y + 0.36, z] as [number, number, number]
  }) ?? [], [activeEvent])
  const [dockX, , dockZ] = toWorld(PACKING_DOCK)
  return <>
    {<><color attach="background" args={['#07162d']} /><fog attach="fog" args={['#07162d', 42, 94]} /></>}
    <ambientLight intensity={1.4} />
    <hemisphereLight color="#90d8ff" groundColor="#0b1630" intensity={1.45} />
    <directionalLight position={[18, 34, 14]} intensity={4.4} castShadow shadow-mapSize={[2048, 2048]} />
    <pointLight position={[dockX, 8, dockZ]} color="#20dfff" intensity={10} distance={28} />
    {<><pointLight position={[10, 10, 4]} color="#2c8fff" intensity={7} distance={24} /><mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[WAREHOUSE_SIZE.width * CELL_SIZE_METERS, WAREHOUSE_SIZE.height * CELL_SIZE_METERS]} /><meshStandardMaterial color="#1a2940" roughness={0.68} metalness={0.28} /></mesh><Grid args={[WAREHOUSE_SIZE.width * CELL_SIZE_METERS, WAREHOUSE_SIZE.height * CELL_SIZE_METERS]} cellSize={CELL_SIZE_METERS} cellThickness={0.75} cellColor="#446a85" sectionSize={CELL_SIZE_METERS * 5} sectionColor="#e6c44c" fadeDistance={90} fadeStrength={0.45} position={[0, 0.01, 0]} />{RACK_BLOCKS.map((rack) => <Rack key={rack.id} {...rack} visibleLayer={visibleLayer} />)}{[0, 1, 2].map((index) => <Truck key={index} position={[dockX - 6, 0.85, dockZ - 8 + index * 5.2]} />)}<Forklift position={[19.5, 0.45, -11]} /><group position={[dockX, 0.15, dockZ]}><mesh><boxGeometry args={[4.2, 0.25, 4.2]} /><meshStandardMaterial color="#07576a" emissive="#0087a4" emissiveIntensity={1.2} /></mesh><Label position={[0, 0.14, 1.45]} text="DOCK" width={1.8} flat /></group><group position={[20, 0.15, 10]}><mesh><boxGeometry args={[3.6, 0.25, 3.6]} /><meshStandardMaterial color="#0b7f55" emissive="#00a86b" emissiveIntensity={0.8} /></mesh><Label position={[0, 0.4, 0]} text="STAGING" width={3} /></group></>}
    <ProductBins products={products} layout={layout} selectedProductId={selectedProductId} activeEvent={activeEvent} onSelectProduct={onSelectProduct} visibleLayer={visibleLayer} />
    {routePoints.length > 1 && <Line points={routePoints} color={workers[selectedPicker]?.color ?? '#00e5ff'} lineWidth={3.5} transparent opacity={0.9} />}
    {activeEvent?.kind === 'pick' && (() => {
      const slot = getSlot(activeEvent.slotId)!
      const [x, , z] = toWorld(slot.access)
      return <group position={[x, 0, z]}><Line points={[[0, 0.2, 0], [0, 6, 0]]} color="#ff007a" lineWidth={2} /><mesh position={[0, 6, 0]}><octahedronGeometry args={[0.5]} /><meshBasicMaterial color="#ff007a" /></mesh></group>
    })()}
    {workers.map((worker, index) => {
      const [x, , z] = toWorld(worker.position)
      const parked = worker.waiting || worker.complete || worker.localElapsed === 0
      const onDock = Math.abs(worker.position.x - PACKING_DOCK.x) < 1.3 && Math.abs(worker.position.y - PACKING_DOCK.y) < 1.3
      return <group key={worker.id} position={[x + (parked ? (worker.id - 1) * 0.7 : 0), onDock ? 0.29 : 0.03, z]} onClick={event => { event.stopPropagation(); onSelectPicker(index) }}>
        <HumanPicker worker={worker} />
        <Label text={`P${worker.id}`} position={[0, 2.35, 0]} width={0.85} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}><ringGeometry args={[0.36, index === selectedPicker ? 0.47 : 0.40, 24]} /><meshBasicMaterial color={worker.color} /></mesh>
      </group>
    })}
    <PickerCamera worker={workers[selectedPicker]} follow={followPicker} cameraMode={cameraMode} />
  </>
}

export function DigitalTwin(props: DigitalTwinProps) {
  return <Canvas frameloop="demand" shadows camera={{ position: [26, 29, 32], fov: 40 }} dpr={[1, 1.25]} gl={{ alpha: true, toneMappingExposure: 1.15 }}>
    <WarehouseScene {...props} />
  </Canvas>
}
