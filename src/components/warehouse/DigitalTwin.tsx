import { Grid, Line, OrbitControls, Text } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { CELL_SIZE_METERS, PACKING_DOCK, RACK_BLOCKS, WAREHOUSE_SIZE, getSlot, type GridPoint, type ProductLayout } from '../../engine/warehouse'
import type { PickEvent, Product } from '../../engine/simulation'

type DigitalTwinProps = {
  products: readonly Product[]
  layout: ProductLayout
  activeEvent?: PickEvent
  playing: boolean
  playbackSpeed: number
  visibleLayer: 'all' | 1 | 2 | 3
  onSelectProduct: (productId: string) => void
  selectedProductId?: string
}

const toWorld = ({ x, y }: GridPoint): [number, number, number] => [
  (x - WAREHOUSE_SIZE.width / 2) * CELL_SIZE_METERS,
  0,
  (y - WAREHOUSE_SIZE.height / 2) * CELL_SIZE_METERS,
]

function Rack({ x, yStart, yEnd, id, visibleLayer, onSelect }: { x: number; yStart: number; yEnd: number; id: string; visibleLayer: DigitalTwinProps['visibleLayer']; onSelect?: () => void }) {
  const length = (yEnd - yStart + 1) * CELL_SIZE_METERS
  const [worldX, , worldZ] = toWorld({ x: x + 0.5, y: yStart + (yEnd - yStart) / 2 })
  return <group position={[worldX, 2.15, worldZ]} onClick={(event) => { event.stopPropagation(); onSelect?.() }}>
    {[-1.38, 1.38].flatMap((beamX) => [-length / 2 + 0.2, length / 2 - 0.2].map((beamZ) => <mesh key={`${beamX}-${beamZ}`} position={[beamX, 0, beamZ]} castShadow><boxGeometry args={[0.16, 4.5, 0.16]} /><meshStandardMaterial color="#17649a" emissive="#06315f" emissiveIntensity={0.45} metalness={0.72} roughness={0.25} /></mesh>))}
    {[-1.55, -0.2, 1.15].map((height, levelIndex) => (visibleLayer !== 'all' && visibleLayer !== levelIndex + 1) ? null : <group key={height}><mesh position={[0, height, 0]}><boxGeometry args={[2.92, 0.13, length]} /><meshStandardMaterial color="#227cb7" emissive="#07558e" emissiveIntensity={0.36} metalness={0.7} roughness={0.26} /></mesh>{Array.from({ length: 10 }, (_, index) => <mesh key={index} position={[index % 2 ? -0.6 : 0.6, height + 0.31, -length / 2 + 0.85 + Math.floor(index / 2) * 2.7]} castShadow><boxGeometry args={[0.86, 0.5, 1.36]} /><meshStandardMaterial color={(index + Math.round(height * 2)) % 4 === 0 ? '#f18c51' : '#d9a05a'} emissive="#4a2106" emissiveIntensity={0.22} roughness={0.6} /></mesh>)}</group>)}
    <Text position={[0, 2.38, -length / 2 - 0.55]} color="#d6efff" fontSize={0.42} anchorX="center">{id.replace('R', 'A')}</Text>
  </group>
}

function Truck({ position }: { position: [number, number, number] }) {
  return <group position={position}><mesh castShadow><boxGeometry args={[2.5, 1.4, 4.5]} /><meshStandardMaterial color="#d8e1e8" metalness={0.35} roughness={0.5} /></mesh><mesh position={[0, -0.25, -2.75]} castShadow><boxGeometry args={[2.5, 0.9, 1]} /><meshStandardMaterial color="#2368a5" metalness={0.45} /></mesh>{[-0.92, 0.92].flatMap((x) => [-1.5, 1.5].map((z) => <mesh key={`${x}-${z}`} position={[x, -0.8, z]} rotation={[0, Math.PI / 2, 0]}><cylinderGeometry args={[0.35, 0.35, 0.22, 12]} /><meshStandardMaterial color="#111827" /></mesh>))}</group>
}

function Forklift({ position }: { position: [number, number, number] }) {
  return <group position={position}><mesh castShadow><boxGeometry args={[1.05, 0.7, 1.55]} /><meshStandardMaterial color="#f2b52b" metalness={0.25} roughness={0.5} /></mesh><mesh position={[0, 0.9, 0.55]}><boxGeometry args={[0.08, 1.7, 0.08]} /><meshStandardMaterial color="#26384f" /></mesh><mesh position={[0, 0.35, 1.13]}><boxGeometry args={[0.78, 0.08, 0.08]} /><meshStandardMaterial color="#26384f" /></mesh></group>
}

function ProductBins({ products, layout, selectedProductId, onSelectProduct, visibleLayer }: Pick<DigitalTwinProps, 'products' | 'layout' | 'selectedProductId' | 'onSelectProduct' | 'visibleLayer'>) {
  const maxFrequency = Math.max(...products.map((product) => product.pickFrequency), 1)
  return <>
    {products.map((product) => {
      const slot = getSlot(layout[product.id])
      if (!slot || (visibleLayer !== 'all' && slot.level !== visibleLayer)) return null
      const [x, , z] = toWorld(slot.position)
      const intensity = product.pickFrequency / maxFrequency
      const color = product.id === selectedProductId ? '#ff007a' : intensity > 0.15 ? '#00b8d4' : '#45688f'
      return <mesh key={product.id} position={[x, 0.45 + slot.level * 0.95, z]} onClick={(event) => { event.stopPropagation(); onSelectProduct(product.id) }} castShadow>
        <boxGeometry args={[0.6, 0.45, 0.72]} />
        <meshStandardMaterial color={color} emissive={product.id === selectedProductId ? '#5c002c' : '#00111b'} emissiveIntensity={product.id === selectedProductId ? 1.8 : 0.25} metalness={0.2} roughness={0.55} />
      </mesh>
    })}
  </>
}

function Picker({ activeEvent: event, playing, playbackSpeed }: Pick<DigitalTwinProps, 'activeEvent' | 'playing' | 'playbackSpeed'>) {
  const picker = useRef<Group>(null)
  const route = useMemo(() => event?.route.map(toWorld) ?? [toWorld(PACKING_DOCK)], [event?.orderId, event?.productId, event?.slotId, event?.route])
  const animation = useRef({ eventKey: '', startedAt: 0 })
  useFrame(({ clock }) => {
    if (!picker.current || !route.length) return
    const eventKey = event ? `${event.orderId}-${event.productId}-${event.slotId}` : 'dock'
    if (animation.current.eventKey !== eventKey) animation.current = { eventKey, startedAt: clock.getElapsedTime() }
    const duration = Math.max(0.45, route.length * 0.11) / playbackSpeed
    const progress = playing && route.length > 1 ? Math.min(1, (clock.getElapsedTime() - animation.current.startedAt) / duration) : 0
    const pathPosition = progress * (route.length - 1)
    const segment = Math.min(Math.floor(pathPosition), route.length - 1)
    const nextSegment = Math.min(segment + 1, route.length - 1)
    const amount = pathPosition - segment
    const point = route[segment]
    const nextPoint = route[nextSegment]
    picker.current.position.set(point[0] + (nextPoint[0] - point[0]) * amount, 0.55, point[2] + (nextPoint[2] - point[2]) * amount)
    if (nextSegment !== segment) picker.current.rotation.y = Math.atan2(nextPoint[0] - point[0], nextPoint[2] - point[2])
  })
  return <group ref={picker} position={toWorld(PACKING_DOCK)}>
    <mesh castShadow><capsuleGeometry args={[0.28, 0.75, 6, 10]} /><meshStandardMaterial color="#ff007a" emissive="#3a001c" emissiveIntensity={0.8} /></mesh>
    <mesh position={[0, 0.68, 0]} castShadow><sphereGeometry args={[0.25, 16, 16]} /><meshStandardMaterial color="#f2c3a0" /></mesh>
    <pointLight color="#ff007a" intensity={2.5} distance={3} />
  </group>
}

function WarehouseScene({ products, layout, activeEvent, playing, playbackSpeed, visibleLayer, selectedProductId, onSelectProduct }: DigitalTwinProps) {
  const routePoints = useMemo(() => activeEvent?.route.map((point) => {
    const [x, y, z] = toWorld(point)
    return [x, y + 0.13, z] as [number, number, number]
  }) ?? [], [activeEvent])
  const [dockX, , dockZ] = toWorld(PACKING_DOCK)
  const rackProducts = useMemo(() => Object.fromEntries(products.flatMap((product) => {
    const slot = getSlot(layout[product.id])
    return slot ? [[slot.rackId.split('-')[0], product.id]] : []
  })), [layout, products])
  return <>
    <color attach="background" args={['#07162d']} />
    <fog attach="fog" args={['#07162d', 42, 94]} />
    <ambientLight intensity={2.1} />
    <hemisphereLight color="#90d8ff" groundColor="#0b1630" intensity={1.45} />
    <directionalLight position={[18, 34, 14]} intensity={4.4} castShadow shadow-mapSize={[2048, 2048]} />
    <pointLight position={[dockX, 8, dockZ]} color="#20dfff" intensity={10} distance={28} />
    <pointLight position={[10, 10, 4]} color="#2c8fff" intensity={7} distance={24} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[WAREHOUSE_SIZE.width * CELL_SIZE_METERS, WAREHOUSE_SIZE.height * CELL_SIZE_METERS]} /><meshStandardMaterial color="#1a2940" roughness={0.68} metalness={0.28} /></mesh>
    <Grid args={[WAREHOUSE_SIZE.width * CELL_SIZE_METERS, WAREHOUSE_SIZE.height * CELL_SIZE_METERS]} cellSize={CELL_SIZE_METERS} cellThickness={0.75} cellColor="#446a85" sectionSize={CELL_SIZE_METERS * 5} sectionColor="#e6c44c" fadeDistance={90} fadeStrength={0.45} position={[0, 0.01, 0]} />
    {RACK_BLOCKS.map((rack) => <Rack key={rack.id} {...rack} visibleLayer={visibleLayer} onSelect={rackProducts[rack.id] ? () => onSelectProduct(rackProducts[rack.id]) : undefined} />)}
    {[0, 1, 2].map((index) => <Truck key={index} position={[dockX - 5.2, 0.85, dockZ - 8 + index * 5.2]} />)}
    <Forklift position={[4, 0.45, 4]} /><Forklift position={[11, 0.45, -6]} />
    <group position={[dockX, 0.15, dockZ]}><mesh><boxGeometry args={[4.2, 0.25, 4.2]} /><meshStandardMaterial color="#07576a" emissive="#0087a4" emissiveIntensity={1.2} /></mesh><Text position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} color="#e5fdff" fontSize={0.42}>DOCK / DISPATCH</Text></group>
    <group position={[20, 0.15, 10]}><mesh><boxGeometry args={[3.6, 0.25, 3.6]} /><meshStandardMaterial color="#0b7f55" emissive="#00a86b" emissiveIntensity={0.8} /></mesh><Text position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} color="#eafff5" fontSize={0.38}>PACKING</Text></group>
    <ProductBins products={products} layout={layout} selectedProductId={selectedProductId} onSelectProduct={onSelectProduct} visibleLayer={visibleLayer} />
    {routePoints.length > 1 && <Line points={routePoints} color="#00e5ff" lineWidth={3.5} transparent opacity={0.9} />}
    <Picker activeEvent={activeEvent} playing={playing} playbackSpeed={playbackSpeed} />
    <OrbitControls makeDefault minDistance={18} maxDistance={70} maxPolarAngle={Math.PI / 2.1} target={[0, 0, 0]} />
  </>
}

export function DigitalTwin(props: DigitalTwinProps) {
  return <Canvas shadows camera={{ position: [26, 34, 27], fov: 38 }} dpr={[1, 1.5]} gl={{ toneMappingExposure: 1.7 }}>
    <WarehouseScene {...props} />
  </Canvas>
}
