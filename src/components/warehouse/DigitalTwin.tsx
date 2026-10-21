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
  onSelectProduct: (productId: string) => void
  selectedProductId?: string
}

const toWorld = ({ x, y }: GridPoint): [number, number, number] => [
  (x - WAREHOUSE_SIZE.width / 2) * CELL_SIZE_METERS,
  0,
  (y - WAREHOUSE_SIZE.height / 2) * CELL_SIZE_METERS,
]

function Rack({ x, yStart, yEnd, id }: { x: number; yStart: number; yEnd: number; id: string }) {
  const length = (yEnd - yStart + 1) * CELL_SIZE_METERS
  const [worldX, , worldZ] = toWorld({ x: x + 0.5, y: yStart + (yEnd - yStart) / 2 })
  return <group position={[worldX, 2.15, worldZ]}>
    <mesh castShadow receiveShadow><boxGeometry args={[2 * CELL_SIZE_METERS, 4.2, length]} /><meshStandardMaterial color="#263b59" metalness={0.66} roughness={0.42} /></mesh>
    {[-1.3, 0, 1.3].map((height) => <mesh key={height} position={[0, height, 0]}><boxGeometry args={[2 * CELL_SIZE_METERS + 0.08, 0.12, length + 0.08]} /><meshStandardMaterial color="#5a7698" metalness={0.7} roughness={0.3} /></mesh>)}
    <Text position={[0, 2.25, -length / 2 - 0.35]} color="#a8b3c7" fontSize={0.35} anchorX="center">{id}</Text>
  </group>
}

function ProductBins({ products, layout, selectedProductId, onSelectProduct }: Pick<DigitalTwinProps, 'products' | 'layout' | 'selectedProductId' | 'onSelectProduct'>) {
  const maxFrequency = Math.max(...products.map((product) => product.pickFrequency), 1)
  return <>
    {products.map((product) => {
      const slot = getSlot(layout[product.id])
      if (!slot) return null
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

function Picker({ event, playing }: { event?: PickEvent; playing: boolean }) {
  const picker = useRef<Group>(null)
  const route = useMemo(() => event?.route.map(toWorld) ?? [toWorld(PACKING_DOCK)], [event])
  useFrame(({ clock }) => {
    if (!picker.current || !route.length) return
    const pathIndex = playing && route.length > 1 ? Math.min(route.length - 1, Math.floor((clock.getElapsedTime() * 2) % route.length)) : route.length - 1
    const point = route[pathIndex]
    picker.current.position.set(point[0], 0.55, point[2])
  })
  return <group ref={picker} position={toWorld(PACKING_DOCK)}>
    <mesh castShadow><capsuleGeometry args={[0.28, 0.75, 6, 10]} /><meshStandardMaterial color="#ff007a" emissive="#3a001c" emissiveIntensity={0.8} /></mesh>
    <mesh position={[0, 0.68, 0]} castShadow><sphereGeometry args={[0.25, 16, 16]} /><meshStandardMaterial color="#f2c3a0" /></mesh>
    <pointLight color="#ff007a" intensity={2.5} distance={3} />
  </group>
}

function WarehouseScene({ products, layout, activeEvent, playing, selectedProductId, onSelectProduct }: DigitalTwinProps) {
  const routePoints = useMemo(() => activeEvent?.route.map((point) => {
    const [x, y, z] = toWorld(point)
    return [x, y + 0.13, z] as [number, number, number]
  }) ?? [], [activeEvent])
  const [dockX, , dockZ] = toWorld(PACKING_DOCK)
  return <>
    <color attach="background" args={['#0b1427']} />
    <fog attach="fog" args={['#0b1427', 26, 74]} />
    <ambientLight intensity={0.55} />
    <directionalLight position={[18, 28, 14]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
    <pointLight position={[dockX, 4, dockZ]} color="#00e5ff" intensity={4.5} distance={15} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[WAREHOUSE_SIZE.width * CELL_SIZE_METERS, WAREHOUSE_SIZE.height * CELL_SIZE_METERS]} /><meshStandardMaterial color="#101f37" roughness={0.82} metalness={0.22} /></mesh>
    <Grid args={[WAREHOUSE_SIZE.width * CELL_SIZE_METERS, WAREHOUSE_SIZE.height * CELL_SIZE_METERS]} cellSize={CELL_SIZE_METERS} cellThickness={0.55} cellColor="#334155" sectionSize={CELL_SIZE_METERS * 5} sectionColor="#00e5ff" fadeDistance={66} fadeStrength={1.1} position={[0, 0.01, 0]} />
    {RACK_BLOCKS.map((rack) => <Rack key={rack.id} {...rack} />)}
    <group position={[dockX, 0.15, dockZ]}><mesh><boxGeometry args={[3.2, 0.22, 3.2]} /><meshStandardMaterial color="#003a4c" emissive="#00647c" emissiveIntensity={1.2} /></mesh><Text position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]} color="#b5faff" fontSize={0.35}>PACK / DISPATCH</Text></group>
    <ProductBins products={products} layout={layout} selectedProductId={selectedProductId} onSelectProduct={onSelectProduct} />
    {routePoints.length > 1 && <Line points={routePoints} color="#00e5ff" lineWidth={3.5} transparent opacity={0.9} />}
    <Picker event={activeEvent} playing={playing} />
    <OrbitControls makeDefault minDistance={18} maxDistance={70} maxPolarAngle={Math.PI / 2.1} target={[0, 0, 0]} />
  </>
}

export function DigitalTwin(props: DigitalTwinProps) {
  return <Canvas shadows camera={{ position: [30, 30, 31], fov: 43 }} dpr={[1, 1.5]}>
    <WarehouseScene {...props} />
  </Canvas>
}
