import type { PickerState } from '../../engine/team'

const skinTones = ['#b97950', '#e0ad86', '#89583f', '#d09a70']
type XYZ = [number, number, number]

function BoxPart({ position, size, color }: { position: XYZ; size: XYZ; color: string }) {
  return <mesh position={position} castShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>
}
function Limb({ length, radius, color }: { length: number; radius: number; color: string }) {
  return <mesh position={[0, -length / 2, 0]} castShadow><capsuleGeometry args={[radius, length - radius * 2, 4, 8]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>
}

/** Articulated 1.85 m worker. Pose is derived from scored playback, so pause freezes every joint. */
export function HumanPicker({ worker }: { worker: PickerState }) {
  const walking = !worker.waiting && !worker.complete && !worker.handling && worker.localElapsed > 0
  const phase = worker.distance / 0.72 * Math.PI
  const stride = walking ? Math.sin(phase) * 0.48 : 0
  const picking = !worker.waiting && worker.handling && !worker.accessing && worker.event?.kind === 'pick'
  const reach = picking ? (0.5 - Math.cos(worker.handlingElapsed * 2.4) * 0.5) : 0
  const skin = skinTones[worker.id - 1]
  const vest = worker.id % 2 ? '#d8ec37' : '#ff982d'
  const heading = worker.waiting || worker.complete || worker.localElapsed === 0 ? 0 : worker.heading
  return <group rotation={[0, heading, 0]} position={[0, walking ? Math.abs(Math.sin(phase)) * 0.025 : 0, 0]}>
    <BoxPart position={[0, 0.88, 0]} size={[0.35, 0.2, 0.25]} color="#1c344b" />
    {([-1, 1] as const).map(side => <group key={side} position={[side * 0.105, 0.87, 0]} rotation={[side * stride, 0, 0]}>
      <Limb length={0.37} radius={0.095} color="#25465e" />
      <group position={[0, -0.37, 0]} rotation={[walking ? Math.max(0, -side * Math.sin(phase)) * 0.55 : 0.035, 0, 0]}>
        <Limb length={0.34} radius={0.08} color="#25465e" />
        <BoxPart position={[0, -0.31, 0.065]} size={[0.19, 0.15, 0.31]} color="#182127" />
        <BoxPart position={[0, -0.385, 0.065]} size={[0.2, 0.04, 0.32]} color="#090f14" />
      </group>
    </group>)}
    <group position={[0, 0.98, 0]} rotation={[picking ? 0.08 * reach : 0, 0, 0]}>
      <mesh position={[0, 0.21, 0]} castShadow><capsuleGeometry args={[0.22, 0.19, 4, 12]} /><meshStandardMaterial color={vest} roughness={0.78} /></mesh>
      <BoxPart position={[0, 0.03, 0.195]} size={[0.38, 0.045, 0.025]} color="#e7eeec" />
      <BoxPart position={[0, 0.03, -0.195]} size={[0.38, 0.045, 0.025]} color="#e7eeec" />
      {[-1, 1].map(side => <group key={side}>
        <BoxPart position={[side * 0.125, 0.24, 0.195]} size={[0.04, 0.34, 0.035]} color="#e7eeec" />
        <BoxPart position={[side * 0.125, 0.24, -0.195]} size={[0.04, 0.34, 0.035]} color="#e7eeec" />
      </group>)}
      <BoxPart position={[0, 0.2, 0.224]} size={[0.015, 0.39, 0.015]} color="#34434a" />
      <BoxPart position={[-0.09, 0.27, 0.23]} size={[0.065, 0.08, 0.02]} color={worker.color} />
      {([-1, 1] as const).map(side => <group key={side} position={[side * 0.245, 0.34, 0]} rotation={[picking ? -0.85 - reach * 0.45 : -side * stride * 0.8, 0, side * 0.1]}>
        <Limb length={0.29} radius={0.075} color="#25465e" />
        <group position={[0, -0.29, 0]} rotation={[picking ? -0.65 : -0.12, 0, 0]}>
          <Limb length={0.25} radius={0.06} color={skin} />
          <mesh position={[0, -0.27, 0]} castShadow><sphereGeometry args={[0.075, 8, 8]} /><meshStandardMaterial color="#364952" /></mesh>
        </group>
      </group>)}
      {picking && <BoxPart position={[0, 0.12 + reach * 0.06, 0.48]} size={[0.32, 0.22, 0.24]} color="#c99858" />}
      <mesh position={[0, 0.48, 0]}><cylinderGeometry args={[0.075, 0.08, 0.12, 10]} /><meshStandardMaterial color={skin} /></mesh>
      <group position={[0, 0.63, 0]}>
        <mesh scale={[0.85, 1, 0.88]} castShadow><sphereGeometry args={[0.17, 16, 12]} /><meshStandardMaterial color={skin} roughness={0.85} /></mesh>
        {[-1, 1].map(side => <group key={side}>
          <mesh position={[side * 0.145, 0, 0]} scale={[0.65, 1, 0.6]}><sphereGeometry args={[0.043, 8, 8]} /><meshStandardMaterial color={skin} /></mesh>
          <mesh position={[side * 0.057, 0.025, 0.138]}><sphereGeometry args={[0.018, 8, 8]} /><meshStandardMaterial color="#202727" /></mesh>
          <BoxPart position={[side * 0.057, 0.06, 0.137]} size={[0.046, 0.012, 0.014]} color="#463326" />
        </group>)}
        <mesh position={[0, -0.012, 0.15]} scale={[0.65, 0.9, 1]}><sphereGeometry args={[0.034, 8, 8]} /><meshStandardMaterial color={skin} /></mesh>
        <BoxPart position={[0, -0.075, 0.137]} size={[0.054, 0.012, 0.01]} color="#744738" />
        <mesh position={[0, 0.105, 0]} castShadow><sphereGeometry args={[0.19, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#f8c52e" roughness={0.45} /></mesh>
        <mesh position={[0, 0.105, 0.025]} scale={[1, 1, 1.15]}><cylinderGeometry args={[0.205, 0.205, 0.025, 16]} /><meshStandardMaterial color="#f8c52e" /></mesh>
        <BoxPart position={[0, 0.23, 0.015]} size={[0.028, 0.06, 0.23]} color="#ffdc59" />
      </group>
    </group>
  </group>
}

export function PickerPortrait({ id, color }: { id: number; color: string }) {
  return <svg viewBox="0 0 64 90" role="img" aria-label={`Human warehouse picker ${id}`}>
    <rect width="64" height="90" rx="9" fill="#102b42" />
    <path d="M10 90V65Q11 51 27 51H37Q53 51 54 65V90" fill="#294d67" />
    <path d="M23 52L32 61L41 52L46 90H18Z" fill={id % 2 ? '#d8ec37' : '#ff982d'} />
    <path d="M24 56L26 90M40 56L38 90M20 78H44" stroke="#edf3ed" strokeWidth="4" />
    <path d="M27 44V55Q32 61 37 55V44" fill={skinTones[id - 1]} />
    <ellipse cx="32" cy="34" rx="13" ry="17" fill={skinTones[id - 1]} />
    <path d="M17 28Q17 10 32 10Q47 10 47 28Z" fill="#f8c52e" />
    <path d="M14 28H50M32 11V24" stroke="#ffdc59" strokeWidth="4" strokeLinecap="round" />
    <circle cx="27" cy="35" r="1.6" fill="#17242c" /><circle cx="37" cy="35" r="1.6" fill="#17242c" />
    <path d="M28 44Q32 46 36 44" stroke="#734737" strokeWidth="1.5" fill="none" />
    <rect x="28" y="66" width="8" height="9" rx="1" fill={color} />
  </svg>
}
