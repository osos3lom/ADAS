import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Smoothly damps a scalar toward `target` every frame and returns a ref to the
 * current value. Used for the exploded-view factor (0 → 1) and any other
 * value that must animate without triggering React re-renders.
 *
 * When `reducedMotion` is set, the value snaps instantly (accessibility).
 */
export function useDampedFactor(
  target: number,
  speed = 6,
  reducedMotion = false,
): React.MutableRefObject<number> {
  const ref = useRef(target);
  useFrame((_, dt) => {
    if (reducedMotion) {
      ref.current = target;
      return;
    }
    // Clamp dt so a stalled tab doesn't jump the animation on resume.
    ref.current = THREE.MathUtils.damp(ref.current, target, speed, Math.min(dt, 0.05));
  });
  return ref;
}
