import { createRef, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { SimulationState } from '@/types';
import { DAMP, PALETTE, VEHICLE, type QualityTier } from './scene-config';
import { EGO_PARTS } from './ego-parts';
import { wheelAngularVelocity } from './state-adapter';
import type { SceneTargets } from './state-adapter';
import { Hotspots } from './Hotspots';

/**
 * Procedural premium EV, assembled from primitives so the exploded view has
 * cleanly-named parts. To swap in a real model later:
 *
 *   const { nodes } = useGLTF('/models/ego.glb');
 *   // render <primitive object={nodes.Body} /> etc., keep the same part ids.
 *
 * Live ego state (lateral, roll, steer, wheel spin, lights) and the explode
 * factor are read from refs inside useFrame — zero React re-renders per frame.
 */
interface Props {
  targets: React.MutableRefObject<SceneTargets>;
  explode: React.MutableRefObject<number>;
  tier: QualityTier;
  showHotspots: boolean;
  state: SimulationState;
}

const damp = THREE.MathUtils.damp;

export function EgoVehicle({ targets, explode, tier, showHotspots, state }: Props) {
  const root = useRef<THREE.Group>(null);
  const bodyG = useRef<THREE.Group>(null);
  const chassisG = useRef<THREE.Group>(null);

  const partRefs = useMemo(() => EGO_PARTS.map(() => createRef<THREE.Group>()), []);

  // wheels
  const flSteer = useRef<THREE.Group>(null);
  const frSteer = useRef<THREE.Group>(null);
  const flSpin = useRef<THREE.Group>(null);
  const frSpin = useRef<THREE.Group>(null);
  const rlSpin = useRef<THREE.Group>(null);
  const rrSpin = useRef<THREE.Group>(null);
  const wheelRot = useRef(0);

  // light materials
  const headMat = useRef<THREE.MeshStandardMaterial>(null);
  const brakeMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = targets.current;
    const f = explode.current;

    if (root.current) {
      root.current.position.x = damp(root.current.position.x, t.egoX, DAMP.lateral, dt);
      root.current.rotation.z = damp(root.current.rotation.z, t.roll, DAMP.steer, dt);
    }
    if (bodyG.current) bodyG.current.position.y = f * 1.3;
    if (chassisG.current) chassisG.current.position.y = -f * 0.85;

    for (let i = 0; i < partRefs.length; i++) {
      const g = partRefs[i].current;
      if (!g) continue;
      const p = EGO_PARTS[i];
      g.position.set(
        p.base[0] + p.explodeDir[0] * p.dist * f,
        p.base[1] + p.explodeDir[1] * p.dist * f,
        p.base[2] + p.explodeDir[2] * p.dist * f,
      );
    }

    // wheels: spin by speed, front pair steers
    wheelRot.current += wheelAngularVelocity(t.speed) * dt;
    [flSpin, frSpin, rlSpin, rrSpin].forEach((s) => {
      if (s.current) s.current.rotation.x = wheelRot.current;
    });
    [flSteer, frSteer].forEach((s) => {
      if (s.current) s.current.rotation.y = damp(s.current.rotation.y, t.steer, DAMP.steer, dt);
    });

    if (headMat.current)
      headMat.current.emissiveIntensity = damp(headMat.current.emissiveIntensity, t.headlight, DAMP.emissive, dt);
    if (brakeMat.current)
      brakeMat.current.emissiveIntensity = damp(brakeMat.current.emissiveIntensity, 0.25 + t.brake * 3.2, DAMP.emissive, dt);
  });

  const wheelY = VEHICLE.wheelRadius;

  return (
    <group ref={root}>
      {/* ---- Painted body shell (lifts on explode) ---- */}
      <group ref={bodyG}>
        {/* lower body */}
        <RoundedBox args={[VEHICLE.width, 0.95, VEHICLE.length]} radius={0.22} smoothness={3} position={[0, 0.62, 0]} castShadow receiveShadow>
          <BodyMaterial tier={tier} />
        </RoundedBox>
        {/* greenhouse / cabin */}
        <RoundedBox args={[VEHICLE.width - 0.34, 0.62, 2.3]} radius={0.22} smoothness={3} position={[0, 1.18, 0.1]} castShadow>
          <BodyMaterial tier={tier} />
        </RoundedBox>
        {/* glass canopy (cheap reflective glass — no transmission) */}
        <mesh position={[0, 1.2, 0.12]}>
          <boxGeometry args={[VEHICLE.width - 0.46, 0.5, 2.0]} />
          <meshStandardMaterial color={PALETTE.glass} roughness={0.08} metalness={0.9} transparent opacity={0.45} envMapIntensity={1.5} />
        </mesh>
        {/* front splitter accent */}
        <mesh position={[0, 0.26, -VEHICLE.length / 2 + 0.1]}>
          <boxGeometry args={[VEHICLE.width - 0.1, 0.16, 0.2]} />
          <meshStandardMaterial color={PALETTE.bodyAccent} roughness={0.5} metalness={0.4} />
        </mesh>

        {/* headlight bar (front, -Z) */}
        <mesh position={[0, 0.72, -VEHICLE.length / 2 + 0.05]}>
          <boxGeometry args={[VEHICLE.width - 0.5, 0.1, 0.05]} />
          <meshStandardMaterial ref={headMat} color={PALETTE.headlight} emissive={PALETTE.headlight} emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
        {/* taillight bar (rear, +Z) */}
        <mesh position={[0, 0.78, VEHICLE.length / 2 - 0.04]}>
          <boxGeometry args={[VEHICLE.width - 0.4, 0.12, 0.05]} />
          <meshStandardMaterial ref={brakeMat} color={PALETTE.brake} emissive={PALETTE.brake} emissiveIntensity={0.4} toneMapped={false} />
        </mesh>
      </group>

      {/* ---- Chassis / battery skateboard + wheels (drops on explode) ---- */}
      <group ref={chassisG}>
        <RoundedBox args={[VEHICLE.width - 0.1, 0.22, VEHICLE.length - 0.5]} radius={0.08} smoothness={2} position={[0, 0.28, 0]} castShadow>
          <meshStandardMaterial color="#161b24" roughness={0.6} metalness={0.5} />
        </RoundedBox>
        <Wheel position={[-VEHICLE.track, wheelY, VEHICLE.axleFront]} steerRef={flSteer} spinRef={flSpin} />
        <Wheel position={[VEHICLE.track, wheelY, VEHICLE.axleFront]} steerRef={frSteer} spinRef={frSpin} />
        <Wheel position={[-VEHICLE.track, wheelY, VEHICLE.axleRear]} spinRef={rlSpin} />
        <Wheel position={[VEHICLE.track, wheelY, VEHICLE.axleRear]} spinRef={rrSpin} />
      </group>

      {/* ---- ADAS sensor parts (fan out on explode) ---- */}
      {EGO_PARTS.map((p, i) => (
        <group key={p.id} ref={partRefs[i]} position={p.base}>
          <mesh castShadow>
            <boxGeometry args={p.size} />
            <meshStandardMaterial color="#0d1219" roughness={0.45} metalness={0.55} emissive={p.accent} emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}

      {showHotspots && <Hotspots explode={explode} state={state} />}
    </group>
  );
}

function BodyMaterial({ tier }: { tier: QualityTier }) {
  if (tier === 'high') {
    return (
      <meshPhysicalMaterial
        color={PALETTE.bodyPaint}
        metalness={0.7}
        roughness={0.28}
        clearcoat={1}
        clearcoatRoughness={0.18}
        envMapIntensity={1.2}
      />
    );
  }
  return <meshStandardMaterial color={PALETTE.bodyPaint} metalness={0.68} roughness={0.36} envMapIntensity={1.05} />;
}

interface WheelProps {
  position: [number, number, number];
  spinRef: React.RefObject<THREE.Group | null>;
  steerRef?: React.RefObject<THREE.Group | null>;
}

function Wheel({ position, spinRef, steerRef }: WheelProps) {
  const tire = (
    <group ref={spinRef}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[VEHICLE.wheelRadius, VEHICLE.wheelRadius, VEHICLE.wheelWidth, 22]} />
        <meshStandardMaterial color={PALETTE.tire} roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[VEHICLE.wheelRadius * 0.55, VEHICLE.wheelRadius * 0.55, VEHICLE.wheelWidth + 0.02, 14]} />
        <meshStandardMaterial color={PALETTE.rim} metalness={0.9} roughness={0.25} envMapIntensity={1.2} />
      </mesh>
    </group>
  );

  return steerRef ? (
    <group position={position} ref={steerRef}>
      {tire}
    </group>
  ) : (
    <group position={position}>{tire}</group>
  );
}

export default EgoVehicle;
