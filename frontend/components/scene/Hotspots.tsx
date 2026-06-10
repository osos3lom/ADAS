import { createRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SimulationState } from '@/types';
import { EGO_PARTS, type EgoPart } from './ego-parts';
import { hotspotStatus, type HotspotStatus } from './state-adapter';

interface Props {
  explode: React.MutableRefObject<number>;
  state: SimulationState;
}

/**
 * 3D-anchored sensor annotations. Rendered inside the ego group so they inherit
 * its lateral/roll transform; each tag tracks its part's exploded offset.
 * Only the pill captures pointer events, so tags never steal OrbitControls drags.
 */
export function Hotspots({ explode, state }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const groupRefs = useMemo(() => EGO_PARTS.map(() => createRef<THREE.Group>()), []);

  useFrame(() => {
    const f = explode.current;
    for (let i = 0; i < groupRefs.length; i++) {
      const g = groupRefs[i].current;
      if (!g) continue;
      const p = EGO_PARTS[i];
      g.position.set(
        p.base[0] + p.explodeDir[0] * p.dist * f,
        p.base[1] + p.explodeDir[1] * p.dist * f,
        p.base[2] + p.explodeDir[2] * p.dist * f,
      );
    }
  });

  return (
    <>
      {EGO_PARTS.map((p, i) => (
        <group key={p.id} ref={groupRefs[i]} position={p.base}>
          <Html center distanceFactor={9} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
            <HotspotTag
              part={p}
              status={hotspotStatus(p, state)}
              open={open === p.id}
              onToggle={() => setOpen((cur) => (cur === p.id ? null : p.id))}
            />
          </Html>
        </group>
      ))}
    </>
  );
}

function HotspotTag({
  part,
  status,
  open,
  onToggle,
}: {
  part: EgoPart;
  status: HotspotStatus;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="pointer-events-none flex -translate-y-1/2 select-none flex-col items-start">
      <button
        type="button"
        onClick={onToggle}
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2 py-1 backdrop-blur-md transition hover:border-white/40 hover:bg-black/70"
        style={{ boxShadow: `0 0 12px ${part.accent}55` }}
        aria-expanded={open}
        aria-label={`${part.label} — ${part.role}`}
      >
        <span
          className="h-2 w-2 flex-none rounded-full"
          style={{ background: part.accent, boxShadow: `0 0 6px ${part.accent}` }}
        />
        <span className="whitespace-nowrap font-mono text-[10px] font-semibold tracking-wide text-white">
          {part.label}
        </span>
      </button>

      {open && (
        <div className="pointer-events-auto mt-1 w-52 rounded-lg border border-white/15 bg-black/70 p-2.5 backdrop-blur-md shadow-2xl">
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: part.accent }}>
            {part.role}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-gray-300">{part.description}</p>
          <div className="mt-1.5 flex items-center gap-1.5 border-t border-white/10 pt-1.5">
            <span
              className={`h-1.5 w-1.5 flex-none rounded-full ${status.ok ? '' : 'animate-pulse'}`}
              style={{ background: status.color }}
            />
            <span className="font-mono text-[10px]" style={{ color: status.color }}>
              {status.text}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Hotspots;
