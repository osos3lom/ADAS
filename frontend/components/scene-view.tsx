"use client";

import type { SimulationState } from "@/types";
import { cn } from "@/lib/utils";

interface Props { state: SimulationState; }

const SCENARIO_LABELS: Record<string, string> = {
  normal_driving: 'Normal Driving',
  highway_acc:    'Highway ACC',
  aeb_trigger:    'AEB Trigger',
  lane_departure: 'Lane Departure',
  sensor_fault:   'Sensor Fault',
};

function getScenarioColor(s: string) {
  const map: Record<string, string> = {
    normal_driving: 'text-emerald-400', highway_acc: 'text-blue-400',
    aeb_trigger: 'text-red-400', lane_departure: 'text-amber-400', sensor_fault: 'text-orange-400',
  };
  return map[s] ?? 'text-gray-400';
}

export function SceneView({ state }: Props) {
  const v = state.vehicle;
  const a = state.adas;

  // Layout constants
  const W = 280, H = 420;
  const roadLeft = 65, roadRight = 215, roadW = 150;
  const laneCenter = 152;  // ego lane center
  const egoY = 340;
  const egoW = 28, egoH = 50;

  // Ego X offset by lane offset (clamp visual)
  const egoX = laneCenter - egoW / 2 + v.laneOffset * 18;

  // Target vehicle
  const maxVisualDist = 280;
  const targetY = egoY - Math.min(a.targetDistance * 2.0, maxVisualDist);
  const targetX = laneCenter - egoW / 2;

  // AEB warning zone color
  const aebColors: Record<string, string> = {
    standby: 'transparent', warning: '#f59e0b44', active: '#ef444455', fault: '#f9731644',
  };
  const aebZoneColor = aebColors[a.aebStatus] ?? 'transparent';
  const aebStroke = a.aebStatus === 'warning' ? '#f59e0b' : a.aebStatus === 'active' ? '#ef4444' : a.aebStatus === 'fault' ? '#f97316' : 'transparent';

  // Lane departure color
  const laneLeftColor = a.ldwStatus === 'left' ? '#f59e0b' : '#facc1566';
  const laneRightColor = a.ldwStatus === 'right' ? '#f59e0b' : '#facc1566';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-gray-300 uppercase tracking-widest">Scene View</span>
        <span className={cn("text-xs font-mono font-bold", getScenarioColor(state.scenario))}>
          ● {SCENARIO_LABELS[state.scenario] ?? state.scenario}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 font-mono mb-1">
          <span>SCENARIO PROGRESS</span>
          <span>{state.scenarioProgress}%</span>
        </div>
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", state.scenarioProgress >= 100 ? "bg-emerald-500" : getScenarioColor(state.scenario).replace('text-', 'bg-').replace('-400','-500'))}
            style={{ width: `${state.scenarioProgress}%` }}
          />
        </div>
      </div>

      {/* SVG scene */}
      <div className="flex-1 flex items-center justify-center">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="rounded-lg overflow-hidden">
          {/* Sky / background */}
          <rect width={W} height={H} fill="#0a0a12" />

          {/* Road surface */}
          <rect x={roadLeft} y={0} width={roadW} height={H} fill="#1a1a2e" />

          {/* Shoulder / curb */}
          <rect x={roadLeft - 12} y={0} width={12} height={H} fill="#111118" />
          <rect x={roadRight} y={0} width={12} height={H} fill="#111118" />

          {/* Outer lane lines */}
          <line x1={roadLeft} y1={0} x2={roadLeft} y2={H} stroke={laneLeftColor} strokeWidth={3} />
          <line x1={roadRight} y1={0} x2={roadRight} y2={H} stroke={laneRightColor} strokeWidth={3} />

          {/* Center dashed line */}
          {Array.from({ length: 14 }, (_, i) => (
            <line key={i} x1={(roadLeft + roadRight) / 2} y1={i * 32} x2={(roadLeft + roadRight) / 2} y2={i * 32 + 18}
              stroke="#334155" strokeWidth={2} />
          ))}

          {/* Distance markers */}
          {[50, 100, 150].map(dist => {
            const y = egoY - dist * 2;
            if (y < 10) return null;
            return (
              <g key={dist}>
                <line x1={roadLeft + 5} y1={y} x2={roadLeft + 20} y2={y} stroke="#334155" strokeWidth={1} strokeDasharray="3 3" />
                <text x={roadLeft + 22} y={y + 4} fill="#334155" fontSize={9} fontFamily="monospace">{dist}m</text>
              </g>
            );
          })}

          {/* AEB warning zone (around target vehicle) */}
          {a.targetPresent && a.aebStatus !== 'standby' && (
            <ellipse cx={laneCenter} cy={targetY + egoH / 2} rx={24} ry={35}
              fill={aebZoneColor} stroke={aebStroke} strokeWidth={1.5} strokeDasharray="4 3" />
          )}

          {/* Target vehicle */}
          {a.targetPresent && (
            <g>
              <rect x={targetX} y={targetY} width={egoW} height={egoH} rx={3}
                fill={a.aebStatus === 'fault' ? '#374151' : '#334155'} stroke={a.aebStatus === 'warning' ? '#f59e0b' : a.aebStatus === 'active' ? '#ef4444' : '#475569'} strokeWidth={1.5} />
              {/* Taillights */}
              <rect x={targetX + 3} y={targetY + egoH - 8} width={8} height={4} rx={1} fill={a.aebStatus === 'active' ? '#ef4444' : '#7f1d1d'} />
              <rect x={targetX + egoW - 11} y={targetY + egoH - 8} width={8} height={4} rx={1} fill={a.aebStatus === 'active' ? '#ef4444' : '#7f1d1d'} />
              {/* Distance label */}
              <text x={targetX + egoW + 5} y={targetY + egoH / 2 + 4} fill="#64748b" fontSize={9} fontFamily="monospace">
                {a.targetDistance.toFixed(0)}m
              </text>
              {a.aebStatus === 'fault' && (
                <text x={targetX - 2} y={targetY - 5} fill="#f97316" fontSize={9} fontFamily="monospace">NO RADAR</text>
              )}
            </g>
          )}

          {/* TTC line */}
          {a.targetPresent && a.ttc < 6 && a.ttc > 0 && (
            <line x1={laneCenter} y1={targetY + egoH} x2={laneCenter} y2={egoY}
              stroke={a.ttc < 2 ? '#ef4444' : '#f59e0b'} strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
          )}

          {/* Ego vehicle */}
          <g>
            {/* Shadow */}
            <ellipse cx={egoX + egoW / 2} cy={egoY + egoH + 4} rx={egoW / 2} ry={5} fill="#000000" opacity={0.4} />

            {/* Body */}
            <rect x={egoX} y={egoY} width={egoW} height={egoH} rx={4}
              fill="#164e63" stroke="#06b6d4" strokeWidth={1.5} />

            {/* Windshield */}
            <rect x={egoX + 4} y={egoY + 6} width={egoW - 8} height={14} rx={2} fill="#0e7490" opacity={0.6} />

            {/* Headlights */}
            <rect x={egoX + 2} y={egoY + 2} width={8} height={4} rx={1} fill="#fde68a" opacity={0.9} />
            <rect x={egoX + egoW - 10} y={egoY + 2} width={8} height={4} rx={1} fill="#fde68a" opacity={0.9} />

            {/* Headlight beams */}
            <polygon points={`${egoX + 6},${egoY} ${egoX - 8},${egoY - 25} ${egoX + 14},${egoY - 25}`} fill="#fde68a" opacity={0.06} />
            <polygon points={`${egoX + egoW - 6},${egoY} ${egoX + egoW - 14},${egoY - 25} ${egoX + egoW + 8},${egoY - 25}`} fill="#fde68a" opacity={0.06} />

            {/* Wheel indicator for steering */}
            <text x={egoX + egoW / 2} y={egoY - 8} fill="#22d3ee" fontSize={8} fontFamily="monospace" textAnchor="middle">
              EGO
            </text>
          </g>

          {/* Lane offset indicator at bottom */}
          <g>
            <text x={10} y={H - 28} fill="#334155" fontSize={8} fontFamily="monospace">LANE OFFSET</text>
            <rect x={10} y={H - 18} width={W - 20} height={6} rx={3} fill="#1f2937" />
            <line x1={(W - 20) / 2 + 10} y1={H - 22} x2={(W - 20) / 2 + 10} y2={H - 10} stroke="#334155" strokeWidth={1} />
            <rect
              x={clampX((W - 20) / 2 + 10 + v.laneOffset * 30 - 4, 10, W - 14)}
              y={H - 18} width={8} height={6} rx={2}
              fill={Math.abs(v.laneOffset) > 0.7 ? '#f59e0b' : '#22d3ee'}
            />
          </g>

          {/* Speed overlay */}
          <text x={8} y={16} fill="#06b6d480" fontSize={10} fontFamily="monospace">{v.speed.toFixed(1)} km/h</text>
          <text x={W - 8} y={16} fill="#06b6d480" fontSize={10} fontFamily="monospace" textAnchor="end">
            TTC: {a.ttc < 99 ? a.ttc.toFixed(1) + 's' : '---'}
          </text>
        </svg>
      </div>

      {/* Quick stats below SVG */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Target Dist', value: a.targetPresent ? `${a.targetDistance.toFixed(0)}m` : '---', color: 'text-blue-400' },
          { label: 'TTC', value: a.ttc < 99 ? `${a.ttc.toFixed(1)}s` : '---', color: a.ttc < 2 ? 'text-red-400' : a.ttc < 4 ? 'text-amber-400' : 'text-emerald-400' },
          { label: 'Lane Δ', value: `${v.laneOffset.toFixed(2)}m`, color: Math.abs(v.laneOffset) > 0.6 ? 'text-amber-400' : 'text-cyan-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-800/50 rounded-lg p-2 text-center">
            <div className="text-gray-500 text-xs font-mono mb-0.5">{label}</div>
            <div className={`text-sm font-mono font-bold tabular-nums ${color}`}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function clampX(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}
