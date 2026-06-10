"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { Boxes, Eye, Gauge, RotateCcw } from 'lucide-react';
import type { SimulationState } from '@/types';
import { cn } from '@/lib/utils';
import { scenarioLabel, scenarioTextClass } from './scenario-meta';
import type { QualityMode, QualityTier } from './scene-config';

export interface HudProps {
  state: SimulationState;
  mode: 'drive' | 'inspect';
  onModeChange: (m: 'drive' | 'inspect') => void;
  exploded: boolean;
  onExplodedChange: (v: boolean) => void;
  quality: QualityMode;
  onQualityChange: (q: QualityMode) => void;
  /** Resolved tier when quality === 'auto' (shown as a hint). */
  activeTier: QualityTier;
  onResetCamera: () => void;
}

const QUALITY_OPTIONS: { value: QualityMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'balanced', label: 'Bal' },
  { value: 'high', label: 'High' },
];

/** Glassmorphic controls + telemetry layered over the 3D canvas. */
export function HudOverlay({
  state,
  mode,
  onModeChange,
  exploded,
  onExplodedChange,
  quality,
  onQualityChange,
  activeTier,
  onResetCamera,
}: HudProps) {
  const v = state.vehicle;
  const a = state.adas;
  const ttcText = a.ttc < 99 ? `${a.ttc.toFixed(1)}s` : '—';
  const ttcColor = a.ttc < 2 ? 'text-red-400' : a.ttc < 4 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="pointer-events-none absolute inset-0 select-none p-3">
      {/* Top-left: scenario + progress */}
      <div className="pointer-events-auto absolute left-3 top-3 w-48 rounded-xl border border-white/10 bg-white/5 p-2.5 ring-1 ring-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400">Scene</span>
          <span className={cn('font-mono text-[10px] font-bold', scenarioTextClass(state.scenario))}>
            ● {scenarioLabel(state.scenario)}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-400 transition-all duration-500"
            style={{ width: `${state.scenarioProgress}%` }}
          />
        </div>
      </div>

      {/* Top-right: mode toggle + quality */}
      <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-2">
        <Segmented
          options={[
            { value: 'drive', label: 'Drive' },
            { value: 'inspect', label: 'Inspect' },
          ]}
          value={mode}
          onChange={(val) => onModeChange(val as 'drive' | 'inspect')}
        />
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1 ring-1 ring-white/10 backdrop-blur-md">
          <Gauge className="h-3 w-3 text-gray-400" />
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onQualityChange(opt.value)}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[9px] transition',
                quality === opt.value ? 'bg-cyan-500/30 text-cyan-200' : 'text-gray-400 hover:text-white',
              )}
            >
              {opt.label}
            </button>
          ))}
          {quality === 'auto' && (
            <span className="font-mono text-[8px] uppercase text-gray-500">{activeTier}</span>
          )}
        </div>
      </div>

      {/* Bottom-left: telemetry chips */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex gap-2">
        <Chip label="SPEED" value={`${v.speed.toFixed(0)}`} unit="km/h" color="text-cyan-300" />
        <Chip label="TTC" value={ttcText} color={ttcColor} />
        <Chip
          label="LANE Δ"
          value={`${v.laneOffset.toFixed(2)}`}
          unit="m"
          color={Math.abs(v.laneOffset) > 0.6 ? 'text-amber-400' : 'text-cyan-300'}
        />
      </div>

      {/* Bottom-right: inspect controls */}
      <div className="pointer-events-auto absolute bottom-3 right-3 flex items-center gap-2">
        <AnimatePresence>
          {mode === 'inspect' && (
            <motion.button
              key="explode"
              type="button"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              onClick={() => onExplodedChange(!exploded)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] backdrop-blur-md transition',
                exploded
                  ? 'border-cyan-400/40 bg-cyan-500/20 text-cyan-200'
                  : 'border-white/10 bg-white/5 text-gray-300 hover:text-white',
              )}
              aria-pressed={exploded}
            >
              <Boxes className="h-3.5 w-3.5" />
              {exploded ? 'Collapse' : 'Explode'}
            </motion.button>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={onResetCamera}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[10px] text-gray-300 backdrop-blur-md transition hover:text-white"
          aria-label="Reset camera"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 ring-1 ring-white/10 backdrop-blur-md">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold transition',
            value === opt.value ? 'bg-cyan-500/30 text-cyan-100' : 'text-gray-400 hover:text-white',
          )}
        >
          {opt.value === 'inspect' ? <Eye className="h-3 w-3" /> : null}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 backdrop-blur-md ring-1 ring-white/10">
      <div className="font-mono text-[8px] uppercase tracking-widest text-gray-500">{label}</div>
      <div className={cn('font-mono text-sm font-bold tabular-nums', color)}>
        {value}
        {unit && <span className="ml-0.5 text-[9px] text-gray-500">{unit}</span>}
      </div>
    </div>
  );
}

export default HudOverlay;
