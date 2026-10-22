import { Grid, Line, OrbitControls, Text } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { CELL_SIZE_METERS, PACKING_DOCK, RACK_BLOCKS, WAREHOUSE_SIZE, getSlot, type GridPoint, type ProductLayout } from '../../engine/warehouse'
import { productsForLayer } from '../../engine/layers'
import { DEFAULT_SIMULATION_CONFIG, type PickEvent, type Product } from '../../engine/simulation'

type DigitalTwinProps = {
  products: readonly Product[]
  layout: ProductLayout
  activeEvent?: PickEvent
  returnRoute?: readonly GridPoint[]
  returning?: boolean
  playing: boolean
  playbackSpeed: number
  visibleLayer: 'all' | 1 | 2 | 3
  photorealPlate?: boolean
  cameraSeed?: number
  cameraMode?: 'orbit' | 'pan' | 'zoom'
  onSelectProduct: (productId: string) => void
  selectedProductId?: string
}

const toWorld = ({ x, y }: GridPoint): [number, number, number] => [
  (x - WAREHOUSE_SIZE.width / 2) * CELL_SIZE_METERS,
  0,
  (y - WAREHOUSE_SIZE.height / 2) * CELL_SIZE_METERS,
]

// Routing coordinates identify walkable grid cells; the picker and route must
// travel through each cell's centre so they stay in the physical aisles.
const toCellCenter = ({ x, y }: GridPoint): [number, number, number] =>
  toWorld({ x: x + 0.5, y: y + 0.5 })
const RACK_CENTER_HEIGHT = 2.15
const RACK_LEVELS = [-1.55, -0.2, 1.15] as const
const productHeightForLevel = (level: 1 | 2 | 3) =>
  RACK_CENTER_HEIGHT + RACK_LEVELS[level - 1] + 0.31

function Rack({ x, yStart, yEnd, id, visibleLayer, onSelect }: { x: number; yStart: number; yEnd: number; id: string; visibleLayer: DigitalTwinProps['visibleLayer']; onSelect?: () => void }) {
  const length = (yEnd - yStart + 1) * CELL_SIZE_METERS
  const [worldX, , worldZ] = toWorld({ x: x + 1, y: (yStart + yEnd + 1) / 2 })
  return <group position={[worldX, RACK_CENTER_HEIGHT, worldZ]} onClick={(event) => { event.stopPropagation(); onSelect?.() }}>
    {[-1.38, 1.38].flatMap((beamX) => [-length / 2 + 0.2, length / 2 - 0.2].map((beamZ) => <mesh key={`${beamX}-${beamZ}`} position={[beamX, 0, beamZ]} castShadow><boxGeometry args={[0.16, 4.5, 0.16]} /><meshStandardMaterial color="#17649a" emissive="#06315f" emissiveIntensity={0.45} metalness={0.72} roughness={0.25} /></mesh>))}
    {RACK_LEVELS.map((height, levelIndex) => (visibleLayer !== 'all' && visibleLayer !== levelIndex + 1) ? null : <group key={height}><mesh position={[0, height, 0]}><boxGeometry args={[2.92, 0.13, length]} /><meshStandardMaterial color="#227cb7" emissive="#07558e" emissiveIntensity={0.36} metalness={0.7} roughness={0.26} /></mesh>{Array.from({ length: 10 }, (_, index) => <mesh key={index} position={[index % 2 ? -0.6 : 0.6, height + 0.31, -length / 2 + 0.85 + Math.floor(index / 2) * 2.7]} castShadow><boxGeometry args={[0.86, 0.5, 1.36]} /><meshStandardMaterial color={(index + Math.round(height * 2)) % 4 === 0 ? '#f18c51' : '#d9a05a'} emissive="#4a2106" emissiveIntensity={0.22} roughness={0.6} /></mesh>)}</group>)}
    <Text position={[0, 2.38, -length / 2 - 0.55]} color="#d6efff" fontSize={0.42} anchorX="center">{id.replace('R', 'A')}</Text>
  </group>
}

function Truck({ position }: { position: [number, number, number] }) {
  return <group position={position}><mesh castShadow><boxGeometry args={[2.5, 1.4, 4.5]} /><meshStandardMaterial color="#d8e1e8" metalness={0.35} roughness={0.5} /></mesh><mesh position={[0, -0.25, -2.75]} castShadow><boxGeometry args={[2.5, 0.9, 1]} /><meshStandardMaterial color="#2368a5" metalness={0.45} /></mesh>{[-0.92, 0.92].flatMap((x) => [-1.5, 1.5].map((z) => <mesh key={`${x}-${z}`} position={[x, -0.8, z]} rotation={[0, Math.PI / 2, 0]}><cylinderGeometry args={[0.35, 0.35, 0.22, 12]} /><meshStandardMaterial color="#111827" /></mesh>))}</group>
}

function Forklift({ position }: { position: [number, number, number] }) {
  return <group position={position}><mesh castShadow><boxGeometry args={[1.05, 0.7, 1.55]} /><meshStandardMaterial color="#f2b52b" metalness={0.25} roughness={0.5} /></mesh><mesh position={[0, 0.9, 0.55]}><boxGeometry args={[0.08, 1.7, 0.08]} /><meshStandardMaterial color="#26384f" /></mesh><mesh position={[0, 0.35, 1.13]}><boxGeometry args={[0.78, 0.08, 0.08]} /><meshStandardMaterial color="#26384f" /></mesh></group>
}


function ProductBins({
  products,
  layout,
  selectedProductId,
  activeEvent,
  onSelectProduct,
  visibleLayer,
  photorealPlate,
}: Pick<
  DigitalTwinProps,
  | 'products'
  | 'layout'
  | 'selectedProductId'
  | 'activeEvent'
  | 'onSelectProduct'
  | 'visibleLayer'
  | 'photorealPlate'
>) {
  const maxFrequency = Math.max(
    ...products.map((product) => product.pickFrequency),
    1,
  )

  return (
    <>
      {productsForLayer(products, layout, visibleLayer).map((product) => {
        const slot = getSlot(layout[product.id])

        if (!slot) return null

        const isSelected = product.id === selectedProductId
        const isActive = product.id === activeEvent?.productId

        const [x, , z] = toCellCenter(slot.position)
        const intensity = product.pickFrequency / maxFrequency

        const color = isSelected
          ? '#ff2cbf'
          : isActive
            ? '#39ff14'
            : intensity > 0.15
              ? '#00e5ff'
              : '#45688f'

        const compactLayerMarker = photorealPlate && !isSelected && !isActive
        const binWidth = compactLayerMarker ? (visibleLayer === 'all' ? 0.2 : 0.38) : photorealPlate ? 0.82 : 0.6
        const binHeight = compactLayerMarker ? 0.18 : photorealPlate ? 0.62 : 0.45
        const binDepth = compactLayerMarker ? (visibleLayer === 'all' ? 0.2 : 0.38) : photorealPlate ? 0.82 : 0.72
        const binY = productHeightForLevel(slot.level)

        return (
          <group key={product.id} position={[x, binY, z]}>
            {/* Clickable product bin */}
            <mesh
              position={[0, 0, 0]}
              castShadow={!compactLayerMarker}
              onClick={(event) => {
                event.stopPropagation()
                onSelectProduct(product.id)
              }}
              onPointerOver={() => {
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto'
              }}
            >
              <boxGeometry args={[binWidth, binHeight, binDepth]} />
              <meshStandardMaterial
                color={color}
                emissive={isSelected ? '#8a005d' : isActive ? '#145500' : '#00111b'}
                emissiveIntensity={isSelected ? 1.8 : isActive ? 1.2 : 0.25}
                metalness={0.2}
                roughness={0.38}
                transparent={compactLayerMarker}
                opacity={compactLayerMarker ? (visibleLayer === 'all' ? 0.28 : 0.82) : 1}
                depthWrite={!compactLayerMarker}
              />
            </mesh>

            {/* Bright outline around the selected bin */}
            {isSelected && (
              <lineSegments
                position={[0, 0, 0]}
                renderOrder={2}
              >
                <edgesGeometry
                  args={[
                    new BoxGeometry(
                    binWidth + 0.08,
                    binHeight + 0.08,
                    binDepth + 0.08,
                    )
                  ]}
                />
                <lineBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.95}
                  depthTest={false}
                />
              </lineSegments>
            )}
          </group>
        )
      })}
    </>
  )
}

function Picker({
  activeEvent: event,
  returnRoute,
  returning = false,
  playing,
  playbackSpeed,
}: Pick<DigitalTwinProps, 'activeEvent' | 'returnRoute' | 'returning' | 'playing' | 'playbackSpeed'>) {
  const picker = useRef<Group>(null)
  const torso = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)

  const route = useMemo(
    () => event?.route.map(toCellCenter) ?? (returning && returnRoute?.length ? returnRoute.map(toCellCenter) : [toCellCenter(PACKING_DOCK)]),
    [event?.orderId, event?.productId, event?.slotId, event?.route, returning, returnRoute],
  )

  const animation = useRef({ eventKey: '', elapsed: 0 })

  useFrame((_, delta) => {
    if (!picker.current || !route.length) return

    const eventKey = event ? `${event.orderId}-${event.productId}-${event.slotId}` : returning ? 'return-to-dock' : 'dock'

    if (animation.current.eventKey !== eventKey) {
      animation.current = { eventKey, elapsed: 0 }
    }

    // The scene and event clock both run at 1.2 m/s, scaled by the playback control.
    if (playing) animation.current.elapsed += delta * Math.max(0.1, playbackSpeed)

    const walkSeconds = event
      ? event.travelDistanceMeters / DEFAULT_SIMULATION_CONFIG.walkingSpeedMetersPerSecond
      : returning
        ? ((route.length - 1) * CELL_SIZE_METERS) / DEFAULT_SIMULATION_CONFIG.walkingSpeedMetersPerSecond
        : 0
    const progress = walkSeconds > 0 ? Math.min(1, animation.current.elapsed / walkSeconds) : 1
    const pathPosition = progress * (route.length - 1)
    const segment = Math.min(Math.floor(pathPosition), route.length - 1)
    const nextSegment = Math.min(segment + 1, route.length - 1)
    const amount = pathPosition - segment
    const point = route[segment]
    const nextPoint = route[nextSegment]
    const walking = playing && progress < 1 && route.length > 1
    const picking = Boolean(event && progress >= 1 && animation.current.elapsed < walkSeconds + event.handlingSeconds)
    const stride = walking ? Math.sin(animation.current.elapsed * 8.5) * 0.48 : 0
    const reach = picking ? Math.max(0, Math.sin((animation.current.elapsed - walkSeconds) * 2.1)) : 0

    picker.current.position.set(
      point[0] + (nextPoint[0] - point[0]) * amount,
      walking ? Math.abs(Math.sin(animation.current.elapsed * 8.5)) * 0.045 : 0,
      point[2] + (nextPoint[2] - point[2]) * amount,
    )

    if (walking && nextSegment !== segment) {
      picker.current.rotation.y = Math.atan2(
        nextPoint[0] - point[0],
        nextPoint[2] - point[2],
      )
    } else if (event) {
      const slot = getSlot(event.slotId)
      if (slot) {
        const target = toCellCenter(slot.position)
        picker.current.rotation.y = Math.atan2(target[0] - point[0], target[2] - point[2])
      }
    }

    if (leftLeg.current) leftLeg.current.rotation.x = stride
    if (rightLeg.current) rightLeg.current.rotation.x = -stride
    if (leftArm.current) leftArm.current.rotation.x = -stride * 0.62
    if (rightArm.current) rightArm.current.rotation.x = picking ? 0.25 + reach * 1.05 : stride * 0.62
    if (torso.current) torso.current.rotation.x = picking ? reach * 0.14 : 0
  })

  return (
    <group ref={picker} position={toCellCenter(PACKING_DOCK)}>
      <group ref={torso}>
        <mesh position={[0, 1.04, 0]} castShadow>
          <capsuleGeometry args={[0.22, 0.52, 4, 8]} />
          <meshStandardMaterial color="#142f50" metalness={0.18} roughness={0.72} />
        </mesh>
        <mesh position={[0, 1.08, 0.16]} castShadow>
          <boxGeometry args={[0.42, 0.55, 0.09]} />
          <meshStandardMaterial color="#b8ef24" emissive="#4a6600" emissiveIntensity={0.34} />
        </mesh>
        <mesh position={[0, 1.08, 0.212]}>
          <boxGeometry args={[0.37, 0.07, 0.015]} />
          <meshStandardMaterial color="#f4ff91" emissive="#b9d52e" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.17, 10, 8]} />
          <meshStandardMaterial color="#d9a57f" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.72, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.19, 0.13, 10]} />
          <meshStandardMaterial color="#ffd629" emissive="#735d00" emissiveIntensity={0.28} />
        </mesh>
        <mesh position={[0, 1.78, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.035, 10]} />
          <meshStandardMaterial color="#ffdf32" />
        </mesh>
      </group>

      <group ref={leftArm} position={[-0.29, 1.31, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.075, 0.36, 3, 6]} /><meshStandardMaterial color="#b8ef24" /></mesh>
        <mesh position={[0, -0.51, 0.03]}><sphereGeometry args={[0.075, 8, 6]} /><meshStandardMaterial color="#d9a57f" /></mesh>
      </group>
      <group ref={rightArm} position={[0.29, 1.31, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.075, 0.36, 3, 6]} /><meshStandardMaterial color="#b8ef24" /></mesh>
        <mesh position={[0, -0.51, 0.03]}><sphereGeometry args={[0.075, 8, 6]} /><meshStandardMaterial color="#d9a57f" /></mesh>
      </group>
      <group ref={leftLeg} position={[-0.13, 0.76, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow><capsuleGeometry args={[0.085, 0.45, 3, 6]} /><meshStandardMaterial color="#163b62" /></mesh>
        <mesh position={[0, -0.59, 0.08]}><boxGeometry args={[0.17, 0.12, 0.28]} /><meshStandardMaterial color="#101c2a" /></mesh>
      </group>
      <group ref={rightLeg} position={[0.13, 0.76, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow><capsuleGeometry args={[0.085, 0.45, 3, 6]} /><meshStandardMaterial color="#163b62" /></mesh>
        <mesh position={[0, -0.59, 0.08]}><boxGeometry args={[0.17, 0.12, 0.28]} /><meshStandardMaterial color="#101c2a" /></mesh>
      </group>
      <pointLight color="#00e5ff" position={[0, 1.15, 0]} intensity={1.8} distance={3.2} />
    </group>
  )
}

function PlateZoomSync({ controls }: { controls: { current: OrbitControlsImpl | null } }) {
  const camera = useThree((state) => state.camera)
  const plate = useRef<HTMLElement | null>(null)
  const previousZoom = useRef(1)
  const baseDistance = Math.hypot(26, 34, 27)

  useEffect(() => {
    plate.current = document.querySelector<HTMLElement>('.warehouse-plate')
    return () => {
      plate.current?.style.removeProperty('--camera-plate-zoom')
      plate.current = null
    }
  }, [])

  useFrame(() => {
    if (!controls.current || !plate.current) return
    const distance = camera.position.distanceTo(controls.current.target)
    const zoom = Math.max(0.8, Math.min(2.65, baseDistance / Math.max(1, distance)))
    if (Math.abs(zoom - previousZoom.current) < 0.004) return
    previousZoom.current = zoom
    plate.current.style.setProperty('--camera-plate-zoom', zoom.toFixed(3))
  })

  return null
}


function WarehouseScene({ products, layout, activeEvent, returnRoute, returning, playing, playbackSpeed, visibleLayer, photorealPlate, cameraSeed, cameraMode = 'orbit', selectedProductId, onSelectProduct }: DigitalTwinProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  useEffect(() => { controls.current?.reset() }, [cameraSeed])
  const routePoints = useMemo(() => (activeEvent?.route ?? (returning ? returnRoute : undefined))?.map((point) => {
    const [x, y, z] = toCellCenter(point)
    return [x, y + 0.13, z] as [number, number, number]
  }) ?? [], [activeEvent, returnRoute, returning])
  const [dockX, , dockZ] = toCellCenter(PACKING_DOCK)
  const rackProducts = useMemo(() => Object.fromEntries(products.flatMap((product) => {
    const slot = getSlot(layout[product.id])
    return slot ? [[slot.rackId.split('-')[0], product.id]] : []
  })), [layout, products])
  return <>
    {!photorealPlate && <><color attach="background" args={['#07162d']} /><fog attach="fog" args={['#07162d', 42, 94]} /></>}
    <ambientLight intensity={photorealPlate ? 3 : 2.1} />
    <hemisphereLight color="#90d8ff" groundColor="#0b1630" intensity={1.45} />
    <directionalLight position={[18, 34, 14]} intensity={4.4} castShadow shadow-mapSize={[2048, 2048]} />
    <pointLight position={[dockX, 8, dockZ]} color="#20dfff" intensity={10} distance={28} />
    {!photorealPlate && <><pointLight position={[10, 10, 4]} color="#2c8fff" intensity={7} distance={24} /><mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[WAREHOUSE_SIZE.width * CELL_SIZE_METERS, WAREHOUSE_SIZE.height * CELL_SIZE_METERS]} /><meshStandardMaterial color="#1a2940" roughness={0.68} metalness={0.28} /></mesh><Grid args={[WAREHOUSE_SIZE.width * CELL_SIZE_METERS, WAREHOUSE_SIZE.height * CELL_SIZE_METERS]} cellSize={CELL_SIZE_METERS} cellThickness={0.75} cellColor="#446a85" sectionSize={CELL_SIZE_METERS * 5} sectionColor="#e6c44c" fadeDistance={90} fadeStrength={0.45} position={[0, 0.01, 0]} />{RACK_BLOCKS.map((rack) => <Rack key={rack.id} {...rack} visibleLayer={visibleLayer} onSelect={rackProducts[rack.id] ? () => onSelectProduct(rackProducts[rack.id]) : undefined} />)}{[0, 1, 2].map((index) => <Truck key={index} position={[dockX - 5.2, 0.85, dockZ - 8 + index * 5.2]} />)}<Forklift position={[4, 0.45, 4]} /><Forklift position={[11, 0.45, -6]} /><group position={[dockX, 0.15, dockZ]}><mesh><boxGeometry args={[4.2, 0.25, 4.2]} /><meshStandardMaterial color="#07576a" emissive="#0087a4" emissiveIntensity={1.2} /></mesh><Text position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} color="#e5fdff" fontSize={0.42}>DOCK / DISPATCH</Text></group><group position={[20, 0.15, 10]}><mesh><boxGeometry args={[3.6, 0.25, 3.6]} /><meshStandardMaterial color="#0b7f55" emissive="#00a86b" emissiveIntensity={0.8} /></mesh><Text position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} color="#eafff5" fontSize={0.38}>PACKING</Text></group></>}
    <ProductBins products={products} layout={layout} selectedProductId={selectedProductId} activeEvent={activeEvent} onSelectProduct={onSelectProduct} visibleLayer={visibleLayer} photorealPlate={photorealPlate} />
    {routePoints.length > 1 && <Line points={routePoints} color="#00e5ff" lineWidth={3.5} transparent opacity={0.9} />}
    <Picker activeEvent={activeEvent} returnRoute={returnRoute} returning={returning} playing={playing} playbackSpeed={playbackSpeed} />
    <PlateZoomSync controls={controls} />
    <OrbitControls
  ref={controls}
  makeDefault
  enableDamping
  dampingFactor={0.08}
  enableRotate={cameraMode === 'orbit'}
  enablePan={cameraMode === 'pan'}
  enableZoom={cameraMode === 'orbit' || cameraMode === 'zoom'}
  minDistance={10}
  maxDistance={65}
  minPolarAngle={0.2}
  maxPolarAngle={Math.PI / 2.05}
/>
  </>
}

export function DigitalTwin(props: DigitalTwinProps) {
  return <Canvas shadows camera={{ position: [26, 34, 27], fov: 38 }} dpr={[1, 1.5]} gl={{ alpha: true, toneMappingExposure: 1.7 }}>
    <WarehouseScene {...props} />
  </Canvas>
}
