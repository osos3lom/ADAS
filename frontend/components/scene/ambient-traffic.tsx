import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SCALE } from './scene-config';
import { roadSpeed } from './state-adapter';

interface Props {
  speed: React.MutableRefObject<number>;
  count: number;
}

const W = SCALE.laneWidth;
const SPAN = 220; // recycle window in Z (well inside the fog wall)
const AMBIENT_COLORS = ['#5b6470', '#33414f', '#6b7480', '#243042', '#7a818b'];

/**
 * Background traffic in the two side lanes, rendered as ONE InstancedMesh.
 * Each car drifts relative to the ego (faster cars pull ahead, slower fall
 * behind) and recycles through the Z window. No per-car React state.
 */
export function AmbientTraffic({ speed, count }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Deterministic per-instance attributes (stable across renders).
  const cars = useMemo(() => {
    return Array.from({ length: Math.max(0, count) }, (_, i) => {
      const r = mulberry32(i * 9301 + 49297);
      return {
        x: (i % 2 === 0 ? -1 : 1) * W,
        z: -SPAN / 2 + r() * SPAN,
        // relative speed factor vs ego: <1 = drifts toward camera, >1 = pulls away
        rel: 0.55 + r() * 0.85,
        color: AMBIENT_COLORS[i % AMBIENT_COLORS.length],
      };
    });
  }, [count]);

  // Apply per-instance colours once.
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    cars.forEach((car, i) => mesh.setColorAt(i, c.set(car.color)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cars]);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const ego = roadSpeed(speed.current);
    const step = Math.min(dt, 0.05);
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      // apparent velocity in +Z = world scroll - this car's own forward motion
      car.z += ego * (1 - car.rel) * step;
      if (car.z > SPAN / 2) car.z -= SPAN;
      else if (car.z < -SPAN / 2) car.z += SPAN;
      dummy.position.set(car.x, 0.65, car.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (cars.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cars.length]} castShadow frustumCulled={false}>
      <boxGeometry args={[1.85, 1.3, 4.4]} />
      <meshStandardMaterial roughness={0.5} metalness={0.4} envMapIntensity={0.8} />
    </instancedMesh>
  );
}

/** Tiny seeded PRNG so traffic layout is stable between renders. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default AmbientTraffic;
