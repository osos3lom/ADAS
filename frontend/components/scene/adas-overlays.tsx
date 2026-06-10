import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE, SCALE, VEHICLE } from './scene-config';
import { aebColor, aebZoneOpacity, ttcColor } from './state-adapter';
import type { SceneTargets } from './state-adapter';

interface Props {
  targets: React.MutableRefObject<SceneTargets>;
  mode: 'drive' | 'inspect';
}

const damp = THREE.MathUtils.damp;
const EGO_FRONT_Z = -VEHICLE.length / 2;

/**
 * Emissive "what the car perceives" overlays: forward radar cone, AEB risk zone
 * around the target, the closing-distance / TTC beam, and a lane-departure
 * ground glow. All driven by the live ADAS state, hidden in Inspect mode.
 */
export function AdasOverlays({ targets, mode }: Props) {
  const visible = mode === 'drive';

  const coneMat = useRef<THREE.MeshBasicMaterial>(null);
  const zone = useRef<THREE.Mesh>(null);
  const zoneMat = useRef<THREE.MeshBasicMaterial>(null);
  const beam = useRef<THREE.Mesh>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const laneMat = useRef<THREE.MeshBasicMaterial>(null);
  const tmp = useRef(new THREE.Color());

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = targets.current;

    // Radar cone — visible only with a locked target
    if (coneMat.current) {
      coneMat.current.opacity = damp(coneMat.current.opacity, visible && t.targetPresent ? 0.1 : 0, 8, dt);
    }

    // AEB risk zone around the target
    if (zone.current && zoneMat.current) {
      zone.current.position.z = damp(zone.current.position.z, t.targetZ, 5, dt);
      tmp.current.set(aebColor(t.aeb));
      zoneMat.current.color.lerp(tmp.current, 0.15);
      const target = visible && t.targetPresent && t.aeb !== 'standby' ? aebZoneOpacity(t.aeb) : 0;
      zoneMat.current.opacity = damp(zoneMat.current.opacity, target, 8, dt);
    }

    // Closing-distance / TTC beam from ego front to the target
    if (beam.current && beamMat.current) {
      const len = Math.max(0.1, Math.abs(t.targetZ - EGO_FRONT_Z));
      beam.current.scale.z = len;
      beam.current.position.z = (EGO_FRONT_Z + t.targetZ) / 2;
      tmp.current.set(ttcColor(t.ttc));
      beamMat.current.color.lerp(tmp.current, 0.2);
      const show = visible && t.targetPresent && t.ttc > 0 && t.ttc < 6;
      beamMat.current.opacity = damp(beamMat.current.opacity, show ? 0.65 : 0, 8, dt);
    }

    // Lane-departure ground glow
    if (laneMat.current) {
      const target = visible && t.ldw !== 'inactive' ? 0.5 : 0;
      laneMat.current.opacity = damp(laneMat.current.opacity, target, 8, dt);
    }
  });

  return (
    <group>
      {/* Forward radar field of view — apex at the sensor, widening ahead */}
      <mesh position={[0, 0.6, EGO_FRONT_Z - 11]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[4, 22, 24, 1, true]} />
        <meshBasicMaterial
          ref={coneMat}
          color={PALETTE.cyan}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* AEB risk zone */}
      <mesh ref={zone} position={[0, 0.8, -40]} scale={[1.6, 1.4, 1.8]}>
        <sphereGeometry args={[1.6, 20, 16]} />
        <meshBasicMaterial
          ref={zoneMat}
          color={PALETTE.red}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* TTC beam (unit length in Z, scaled each frame) */}
      <mesh ref={beam} position={[0, 0.6, -20]}>
        <boxGeometry args={[0.07, 0.07, 1]} />
        <meshBasicMaterial
          ref={beamMat}
          color={PALETTE.amber}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Lane-departure ground glow under the ego lane */}
      <mesh position={[0, 0.02, -4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SCALE.laneWidth, 26]} />
        <meshBasicMaterial
          ref={laneMat}
          color={PALETTE.amber}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export default AdasOverlays;
