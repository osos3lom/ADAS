import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { DAMP, PALETTE, VEHICLE } from './scene-config';
import { aebColor } from './state-adapter';
import type { SceneTargets } from './state-adapter';

interface Props {
  targets: React.MutableRefObject<SceneTargets>;
}

const damp = THREE.MathUtils.damp;

/**
 * The lead / target vehicle, ahead in the ego's lane. Position tracks the
 * radar's `targetDistance`; brake lights and outline react to the AEB state.
 * Fades out when no target is locked.
 */
export function TargetVehicle({ targets }: Props) {
  const root = useRef<THREE.Group>(null);
  const tailMat = useRef<THREE.MeshStandardMaterial>(null);
  const outlineMat = useRef<THREE.MeshBasicMaterial>(null);
  const color = useRef(new THREE.Color(PALETTE.cyan));

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = targets.current;
    if (root.current) {
      root.current.position.z = damp(root.current.position.z, t.targetPresent ? t.targetZ : -60, DAMP.position, dt);
      const s = damp(root.current.scale.x, t.targetPresent ? 1 : 0.001, 6, dt);
      root.current.scale.setScalar(s);
    }
    if (tailMat.current) {
      const target = t.aeb === 'active' ? 4.2 : t.aeb === 'warning' ? 1.8 : 0.5;
      tailMat.current.emissiveIntensity = damp(tailMat.current.emissiveIntensity, target, DAMP.emissive, dt);
    }
    if (outlineMat.current) {
      color.current.set(aebColor(t.aeb));
      outlineMat.current.color.lerp(color.current, 0.15);
      outlineMat.current.opacity = damp(outlineMat.current.opacity, t.aeb === 'standby' ? 0 : 0.55, DAMP.emissive, dt);
    }
  });

  return (
    <group ref={root} position={[0, 0, -40]}>
      <RoundedBox args={[VEHICLE.width, 0.95, VEHICLE.length]} radius={0.2} smoothness={3} position={[0, 0.62, 0]} castShadow>
        <meshStandardMaterial color="#3a4250" metalness={0.55} roughness={0.45} envMapIntensity={0.9} />
      </RoundedBox>
      <RoundedBox args={[VEHICLE.width - 0.34, 0.6, 2.2]} radius={0.2} smoothness={3} position={[0, 1.16, 0.1]} castShadow>
        <meshStandardMaterial color="#2b323d" metalness={0.5} roughness={0.5} />
      </RoundedBox>
      {/* taillights (rear faces the ego at +Z) */}
      <mesh position={[0, 0.74, VEHICLE.length / 2 - 0.03]}>
        <boxGeometry args={[VEHICLE.width - 0.4, 0.14, 0.05]} />
        <meshStandardMaterial ref={tailMat} color={PALETTE.brake} emissive={PALETTE.brake} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      {/* AEB alert outline */}
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[VEHICLE.width + 0.18, 1.7, VEHICLE.length + 0.18]} />
        <meshBasicMaterial ref={outlineMat} color={PALETTE.cyan} wireframe transparent opacity={0} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default TargetVehicle;
