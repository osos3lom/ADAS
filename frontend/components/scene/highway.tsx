import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HIGHWAY, PALETTE, QUALITY, SCALE, type QualityTier } from './scene-config';
import { roadSpeed } from './state-adapter';

interface Props {
  /** Live ego speed in km/h (mutated by the canvas each data tick). */
  speed: React.MutableRefObject<number>;
  mode: 'drive' | 'inspect';
  tier: QualityTier;
}

const W = SCALE.laneWidth;
const HALF_ROAD = 1.5 * W; // outer lane edge
const DECK_LEN = 400;
const SPAN = HIGHWAY.dashCount * (HIGHWAY.dashLength + HIGHWAY.dashGap);

/**
 * Multi-lane highway. The deck + barriers are static; the sense of motion comes
 * from instanced lane dashes / delineators recycling toward the camera at the
 * ego's speed (only while driving). Fog hides the recycle seam at the horizon.
 */
export function Highway({ speed, mode, tier }: Props) {
  const moving = mode === 'drive';
  return (
    <group>
      {/* Ground context beyond the carriageway */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[260, DECK_LEN + 80]} />
        <meshStandardMaterial color="#0e131c" roughness={1} metalness={0} />
      </mesh>

      {/* Asphalt deck (damp sheen via env reflection; drop in a PBR texture set later) */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2 * HALF_ROAD + 4, DECK_LEN]} />
        <meshStandardMaterial color={PALETTE.road} roughness={0.82} metalness={0.18} envMapIntensity={0.7} />
      </mesh>

      {/* Solid outer edge lines */}
      <EdgeLine x={-HALF_ROAD + 0.12} color={PALETTE.laneEdge} />
      <EdgeLine x={HALF_ROAD - 0.12} color={PALETTE.laneMark} />

      {/* Median barrier (left) + guardrail (right) */}
      <mesh position={[-(HALF_ROAD + 0.6), 0.35, 0]} castShadow>
        <boxGeometry args={[0.34, 0.7, DECK_LEN]} />
        <meshStandardMaterial color={PALETTE.barrier} roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[HALF_ROAD + 0.7, 0.5, 0]}>
        <boxGeometry args={[0.12, 0.18, DECK_LEN]} />
        <meshStandardMaterial color={PALETTE.barrier} roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Dashed lane dividers (between the 3 lanes) */}
      <ScrollingInstances
        speed={speed}
        moving={moving}
        x={-W / 2}
        count={HIGHWAY.dashCount}
        spacing={HIGHWAY.dashLength + HIGHWAY.dashGap}
        size={[0.16, 0.02, HIGHWAY.dashLength]}
        y={0.012}
        color={PALETTE.laneMark}
        emissive={PALETTE.laneMark}
        emissiveIntensity={0.18}
      />
      <ScrollingInstances
        speed={speed}
        moving={moving}
        x={W / 2}
        count={HIGHWAY.dashCount}
        spacing={HIGHWAY.dashLength + HIGHWAY.dashGap}
        size={[0.16, 0.02, HIGHWAY.dashLength]}
        y={0.012}
        color={PALETTE.laneMark}
        emissive={PALETTE.laneMark}
        emissiveIntensity={0.18}
      />

      {/* Reflective edge delineators */}
      <ScrollingInstances
        speed={speed}
        moving={moving}
        x={HALF_ROAD + 0.55}
        count={Math.floor(SPAN / HIGHWAY.delineatorSpacing)}
        spacing={HIGHWAY.delineatorSpacing}
        size={[0.08, 0.5, 0.08]}
        y={0.25}
        color={PALETTE.delineator}
        emissive={PALETTE.delineator}
        emissiveIntensity={0.9}
      />

      {tier !== 'low' && <Gantry speed={speed} moving={moving} />}
    </group>
  );
}

function EdgeLine({ x, color }: { x: number; color: string }) {
  return (
    <mesh position={[x, 0.011, 0]}>
      <boxGeometry args={[0.16, 0.02, DECK_LEN]} />
      <meshStandardMaterial color={color} roughness={0.6} emissive={color} emissiveIntensity={0.12} />
    </mesh>
  );
}

interface ScrollProps {
  speed: React.MutableRefObject<number>;
  moving: boolean;
  x: number;
  count: number;
  spacing: number;
  size: [number, number, number];
  y: number;
  color: string;
  emissive: string;
  emissiveIntensity: number;
}

/** An InstancedMesh whose instances recycle along Z to fake endless forward motion. */
function ScrollingInstances({ speed, moving, x, count, spacing, size, y, color, emissive, emissiveIntensity }: ScrollProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offset = useRef(0);
  const span = count * spacing;

  const place = (o: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      let z = -span / 2 + ((i * spacing + o) % span);
      if (z > span / 2) z -= span;
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  // place() runs every frame; in "inspect" mode offset stays fixed so the
  // markings hold still. The first frame lays out the static positions.
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (moving) offset.current += roadSpeed(speed.current) * Math.min(dt, 0.05);
    place(offset.current);
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.5} />
    </instancedMesh>
  );
}

/** A single overhead gantry sign that scrolls past and recycles. */
function Gantry({ speed, moving }: { speed: React.MutableRefObject<number>; moving: boolean }) {
  const group = useRef<THREE.Group>(null);
  const z = useRef(-160);
  const RECYCLE = 200;

  useFrame((_, dt) => {
    if (!group.current) return;
    if (moving) {
      z.current += roadSpeed(speed.current) * Math.min(dt, 0.05);
      if (z.current > 30) z.current -= RECYCLE;
    }
    group.current.position.z = z.current;
  });

  const post = (
    <meshStandardMaterial color={PALETTE.barrier} roughness={0.5} metalness={0.6} />
  );
  return (
    <group ref={group}>
      <mesh position={[-(HALF_ROAD + 0.4), 2.6, 0]} castShadow>
        <boxGeometry args={[0.18, 5.2, 0.18]} />
        {post}
      </mesh>
      <mesh position={[HALF_ROAD + 0.4, 2.6, 0]} castShadow>
        <boxGeometry args={[0.18, 5.2, 0.18]} />
        {post}
      </mesh>
      <mesh position={[0, 5.15, 0]} castShadow>
        <boxGeometry args={[2 * HALF_ROAD + 1.4, 0.22, 0.22]} />
        {post}
      </mesh>
      <mesh position={[0, 4.4, 0.16]}>
        <boxGeometry args={[2 * W, 1.1, 0.08]} />
        <meshStandardMaterial color="#0b1f33" roughness={0.6} emissive="#0a2a44" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

export default Highway;
