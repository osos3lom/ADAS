"use client";

import type { SimulationState } from '@/types';
import { cn } from '@/lib/utils';
import { scenarioLabel, scenarioTextClass } from './scenario-meta';

interface Props {
  state: SimulationState;
  /** "inset" = small glass overlay corner map; "full" = WebGL fallback view. */
  variant?: 'inset' | 'full';
  className?: string;
}

/**
 * 2D top-down SVG map — the original Scene View drawing, preserved.
 * Used as a glass minimap inset over the 3D canvas AND as the no-WebGL fallback.
 */
export function MiniMap({ state, variant = 'inset', className }: Props) {
  const v = state.vehicle;
  const a = state.adas;

  const W = 280;
  const H = 420;
  const roadLeft = 65;
  const roadRight = 215;
  const roadW = 150;
  const laneCenter = 152;
  const egoY = 340;
  const egoW = 28;
  const egoH = 50;

  const egoX = laneCenter - egoW / 2 + clampX(v.laneOffset * 18, -60, 60);
  const maxVisualDist = 280;
  const targetY = egoY - Math.min(a.targetDistance * 2.0, maxVisualDist);
  const targetX = laneCenter - egoW / 2;

  const aebColors: Record<string, string> = {
    standby: 'transparent',
    warning: '#f59e0b44',
    active: '#ef444455',
    fault: '#f9731644',
  };
  const aebZoneColor = aebColors[a.aebStatus] ?? 'transparent';
  const aebStroke =
    a.aebStatus === 'warning'
      ? '#f59e0b'
      : a.aebStatus === 'active'
        ? '#ef4444'
        : a.aebStatus === 'fault'
          ? '#f97316'
          : 'transparent';

  const laneLeftColor = a.ldwStatus === 'left' ? '#f59e0b' : '#facc1566';
  const laneRightColor = a.ldwStatus === 'right' ? '#f59e0b' : '#facc1566';

  const isFull = variant === 'full';

  return (
    <div
      className={cn(
        'rounded-lg border border-white/10 bg-black/40 backdrop-blur-md shadow-xl ring-1 ring-white/10',
        isFull && 'flex h-full w-full flex-col items-center justify-center gap-3 p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between px-2 pt-1.5">
        <span className="font-mono text-[8px] uppercase tracking-widest text-gray-400">Top-down</span>
        <span className={cn('font-mono text-[8px] font-bold', scenarioTextClass(state.scenario))}>
          ● {scenarioLabel(state.scenario)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={cn('overflow-hidden rounded-md', isFull ? 'h-full max-h-[70vh]' : 'w-full')}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Top-down view of the ego and target vehicles on the road"
      >
        <rect width={W} height={H} fill="#0a0a12" />
        <rect x={roadLeft} y={0} width={roadW} height={H} fill="#1a1a2e" />
        <rect x={roadLeft - 12} y={0} width={12} height={H} fill="#111118" />
        <rect x={roadRight} y={0} width={12} height={H} fill="#111118" />
        <line x1={roadLeft} y1={0} x2={roadLeft} y2={H} stroke={laneLeftColor} strokeWidth={3} />
        <line x1={roadRight} y1={0} x2={roadRight} y2={H} stroke={laneRightColor} strokeWidth={3} />
        {Array.from({ length: 14 }, (_, i) => (
          <line
            key={i}
            x1={(roadLeft + roadRight) / 2}
            y1={i * 32}
            x2={(roadLeft + roadRight) / 2}
            y2={i * 32 + 18}
            stroke="#334155"
            strokeWidth={2}
          />
        ))}

        {a.targetPresent && a.aebStatus !== 'standby' && (
          <ellipse
            cx={laneCenter}
            cy={targetY + egoH / 2}
            rx={24}
            ry={35}
            fill={aebZoneColor}
            stroke={aebStroke}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}

        {a.targetPresent && (
          <g>
            <rect
              x={targetX}
              y={targetY}
              width={egoW}
              height={egoH}
              rx={3}
              fill={a.aebStatus === 'fault' ? '#374151' : '#334155'}
              stroke={
                a.aebStatus === 'warning' ? '#f59e0b' : a.aebStatus === 'active' ? '#ef4444' : '#475569'
              }
              strokeWidth={1.5}
            />
            <rect
              x={targetX + 3}
              y={targetY + egoH - 8}
              width={8}
              height={4}
              rx={1}
              fill={a.aebStatus === 'active' ? '#ef4444' : '#7f1d1d'}
            />
            <rect
              x={targetX + egoW - 11}
              y={targetY + egoH - 8}
              width={8}
              height={4}
              rx={1}
              fill={a.aebStatus === 'active' ? '#ef4444' : '#7f1d1d'}
            />
          </g>
        )}

        {a.targetPresent && a.ttc < 6 && a.ttc > 0 && (
          <line
            x1={laneCenter}
            y1={targetY + egoH}
            x2={laneCenter}
            y2={egoY}
            stroke={a.ttc < 2 ? '#ef4444' : '#f59e0b'}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.7}
          />
        )}

        <g>
          <ellipse cx={egoX + egoW / 2} cy={egoY + egoH + 4} rx={egoW / 2} ry={5} fill="#000000" opacity={0.4} />
          <rect x={egoX} y={egoY} width={egoW} height={egoH} rx={4} fill="#164e63" stroke="#06b6d4" strokeWidth={1.5} />
          <rect x={egoX + 4} y={egoY + 6} width={egoW - 8} height={14} rx={2} fill="#0e7490" opacity={0.6} />
          <rect x={egoX + 2} y={egoY + 2} width={8} height={4} rx={1} fill="#fde68a" opacity={0.9} />
          <rect x={egoX + egoW - 10} y={egoY + 2} width={8} height={4} rx={1} fill="#fde68a" opacity={0.9} />
        </g>

        <text x={8} y={16} fill="#06b6d480" fontSize={10} fontFamily="monospace">
          {v.speed.toFixed(1)} km/h
        </text>
        <text x={W - 8} y={16} fill="#06b6d480" fontSize={10} fontFamily="monospace" textAnchor="end">
          TTC: {a.ttc < 99 ? a.ttc.toFixed(1) + 's' : '---'}
        </text>
      </svg>
      {isFull && (
        <div className="font-mono text-[10px] text-gray-500">
          WebGL unavailable — showing 2D fallback
        </div>
      )}
    </div>
  );
}

function clampX(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export default MiniMap;
