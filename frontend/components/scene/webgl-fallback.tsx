"use client";

import { useEffect, useState } from 'react';
import type { SimulationState } from '@/types';
import { MiniMap } from './MiniMap';

/** One-time check for WebGL availability (runs client-side after mount). */
export function useWebGLAvailable(): boolean {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setOk(Boolean(gl));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

/** Tracks the user's reduced-motion preference, live. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Full-panel 2D fallback shown when WebGL is unavailable. */
export function WebGLFallback({ state }: { state: SimulationState }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <MiniMap state={state} variant="full" className="h-full w-full" />
    </div>
  );
}
