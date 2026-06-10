"use client";

import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  AdaptiveDpr,
  ContactShadows,
  Html,
  OrbitControls,
  PerformanceMonitor,
} from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { SimulationState } from '@/types';
import { CAMERA, DAMP, QUALITY, type QualityTier } from './scene-config';
import { deriveTargets, writeTargets, type SceneTargets } from './state-adapter';
import { useDampedFactor } from './use-explode';
import { LightsEnvironment } from './lights-environment';
import { Highway } from './highway';
import { AmbientTraffic } from './ambient-traffic';
import { EgoVehicle } from './EgoVehicle';
import { TargetVehicle } from './TargetVehicle';
import { AdasOverlays } from './adas-overlays';
import { SceneSkeleton } from './SceneSkeleton';

export interface SceneCanvasProps {
  state: SimulationState;
  mode: 'drive' | 'inspect';
  exploded: boolean;
  /** Resolved quality tier (already de-referenced from auto). */
  tier: QualityTier;
  reducedMotion: boolean;
  /** Bumped to re-frame the camera to the mode default. */
  resetNonce: number;
  /** Called when the GPU can't keep up (only acted on in Auto mode by the parent). */
  onDecline: () => void;
  onIncline: () => void;
}

export default function SceneCanvas({
  state,
  mode,
  exploded,
  tier,
  reducedMotion,
  resetNonce,
  onDecline,
  onIncline,
}: SceneCanvasProps) {
  // Latest data lives in refs; the render loop damps toward it (no per-frame React state).
  const targetsRef = useRef<SceneTargets>(deriveTargets(state));
  writeTargets(targetsRef.current, state);
  const speedRef = useRef<number>(state.vehicle.speed);
  speedRef.current = state.vehicle.speed;

  const q = QUALITY[tier];

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, q.dprMax]}
      frameloop="always"
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      performance={{ min: 0.5 }}
      camera={{ position: CAMERA.drive.position, fov: 38, near: 0.5, far: 800 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      aria-label="Interactive 3D view of the ego vehicle, lead vehicle and ADAS sensors on a highway"
    >
      <PerformanceMonitor onDecline={onDecline} onIncline={onIncline} flipflops={3} />
      <AdaptiveDpr pixelated={false} />
      <Suspense
        fallback={
          <Html center>
            <SceneSkeleton inline />
          </Html>
        }
      >
        <SceneContents
          state={state}
          mode={mode}
          exploded={exploded}
          tier={tier}
          reducedMotion={reducedMotion}
          resetNonce={resetNonce}
          targetsRef={targetsRef}
          speedRef={speedRef}
        />
      </Suspense>
    </Canvas>
  );
}

interface ContentsProps {
  state: SimulationState;
  mode: 'drive' | 'inspect';
  exploded: boolean;
  tier: QualityTier;
  reducedMotion: boolean;
  resetNonce: number;
  targetsRef: React.MutableRefObject<SceneTargets>;
  speedRef: React.MutableRefObject<number>;
}

function SceneContents({
  state,
  mode,
  exploded,
  tier,
  reducedMotion,
  resetNonce,
  targetsRef,
  speedRef,
}: ContentsProps) {
  const explode = useDampedFactor(exploded ? 1 : 0, DAMP.explode, reducedMotion);
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const preset = CAMERA[mode];

  // Re-frame the camera on mode change / reset.
  useEffect(() => {
    camera.position.set(...preset.position);
    if (controls.current) {
      controls.current.target.set(...preset.target);
      controls.current.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resetNonce]);

  const q = QUALITY[tier];
  const showHotspots = mode === 'inspect' || exploded;

  return (
    <>
      <LightsEnvironment tier={tier} mode={mode} />
      <Highway speed={speedRef} mode={mode} tier={tier} />
      {mode === 'drive' && tier !== 'low' && <AmbientTraffic speed={speedRef} count={q.ambientCars} />}

      <EgoVehicle
        targets={targetsRef}
        explode={explode}
        tier={tier}
        showHotspots={showHotspots}
        state={state}
      />
      {mode === 'drive' && <TargetVehicle targets={targetsRef} />}
      <AdasOverlays targets={targetsRef} mode={mode} />

      <ContactShadows
        position={[0, 0.012, 0]}
        opacity={0.55}
        blur={2.6}
        far={6}
        scale={18}
        resolution={q.contactRes}
        color="#05070b"
      />

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        target={preset.target}
        minDistance={preset.minDistance}
        maxDistance={preset.maxDistance}
        minPolarAngle={preset.minPolar}
        maxPolarAngle={preset.maxPolar}
      />
    </>
  );
}
