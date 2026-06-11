"use client";

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import type { SimulationState } from '@/types';
import { TIER_ORDER, type QualityMode, type QualityTier } from './scene/scene-config';
import { SceneSkeleton } from './scene/SceneSkeleton';
import { HudOverlay } from './scene/hud-overlay';
import { MiniMap } from './scene/MiniMap';
import { WebGLFallback, usePrefersReducedMotion, useWebGLAvailable } from './scene/webgl-fallback';

// Code-split the 3D engine: three.js stays out of the initial bundle and SSR,
// streaming in behind the skeleton (R3F can't server-render).
const SceneCanvas = dynamic(() => import('./scene/SceneCanvas'), {
  ssr: false,
  loading: () => <SceneSkeleton />,
});

interface Props {
  state: SimulationState;
}

/**
 * Cinematic 3D Scene View. Drive mode shows the live highway simulation;
 * Inspect mode lets you orbit and explode the ego vehicle's ADAS sensor suite.
 * Falls back to the 2D top-down map when WebGL is unavailable.
 */
export function SceneView({ state }: Props) {
  const [mode, setMode] = useState<'drive' | 'inspect'>('drive');
  const [exploded, setExploded] = useState(false);
  const [quality, setQuality] = useState<QualityMode>('auto');
  const [autoTier, setAutoTier] = useState<QualityTier>('balanced');
  const [resetNonce, setResetNonce] = useState(0);

  const webglOk = useWebGLAvailable();
  const reducedMotion = usePrefersReducedMotion();

  const activeTier: QualityTier = quality === 'auto' ? autoTier : quality;
  // Exploded only applies while inspecting.
  const effectiveExploded = exploded && mode === 'inspect';

  const handleModeChange = useCallback((m: 'drive' | 'inspect') => {
    setMode(m);
    if (m === 'drive') setExploded(false);
  }, []);

  const stepTier = useCallback((dir: 1 | -1) => {
    setAutoTier((cur) => {
      const i = TIER_ORDER.indexOf(cur);
      return TIER_ORDER[Math.min(TIER_ORDER.length - 1, Math.max(0, i + dir))];
    });
  }, []);

  const handleDecline = useCallback(() => {
    if (quality === 'auto') stepTier(-1);
  }, [quality, stepTier]);
  const handleIncline = useCallback(() => {
    if (quality === 'auto') stepTier(1);
  }, [quality, stepTier]);

  return (
    <div
      className="relative flex h-full min-h-[480px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--glass-border)/0.45)] bg-[hsl(var(--surface-1))]"
      style={{ boxShadow: "var(--shadow-card), inset 0 1px 0 hsl(var(--glass-highlight) / 0.04)" }}
    >
      {!webglOk ? (
        <WebGLFallback state={state} />
      ) : (
        <>
          <SceneCanvas
            state={state}
            mode={mode}
            exploded={effectiveExploded}
            tier={activeTier}
            reducedMotion={reducedMotion}
            resetNonce={resetNonce}
            onDecline={handleDecline}
            onIncline={handleIncline}
          />

          <MiniMap
            state={state}
            variant="inset"
            className="absolute bottom-3 left-1/2 w-[92px] -translate-x-1/2"
          />

          <HudOverlay
            state={state}
            mode={mode}
            onModeChange={handleModeChange}
            exploded={exploded}
            onExplodedChange={setExploded}
            quality={quality}
            onQualityChange={setQuality}
            activeTier={activeTier}
            onResetCamera={() => setResetNonce((n) => n + 1)}
          />
        </>
      )}
    </div>
  );
}

export default SceneView;
