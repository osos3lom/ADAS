"use client";

import { cn } from "@/lib/utils";
import type { SimulationState } from "@/types";
import { Activity, Zap, TrendingUp, TrendingDown } from "lucide-react";

interface Props { state: SimulationState; }

function MetricRow({ label, value, unit, color = "text-cyan-400" }: {
  label: string; value: string; unit: string; color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800/60 last:border-0">
      <span className="text-gray-400 text-xs font-mono uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-sm font-mono font-bold tabular-nums", color)}>{value}</span>
        <span className="text-gray-500 text-xs">{unit}</span>
      </div>
    </div>
  );
}

function GaugeBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-300", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function VehicleTelemetry({ state }: Props) {
  const v = state.vehicle;
  const speedColor = v.speed > 100 ? "text-amber-400" : v.speed > 120 ? "text-red-400" : "text-cyan-400";
  const accelColor = v.acceleration > 0 ? "text-emerald-400" : v.acceleration < -2 ? "text-red-400" : "text-cyan-400";

  return (
    <div className="glass-card glass-card-hover p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-[hsl(var(--accent))]" />
        <span className="panel-title">Vehicle Telemetry</span>
        <span className="ml-auto w-2 h-2 rounded-full bg-[hsl(var(--ok))] animate-pulse" aria-label="streaming" />
      </div>

      {/* Speed big display */}
      <div className="text-center mb-4 py-3 glass-well">
        <div className={cn("display-numeral text-[length:var(--text-display)]", speedColor)}>
          {v.speed.toFixed(1)}
        </div>
        <div className="text-[hsl(var(--text-muted))] text-xs font-mono mt-1">KM/H</div>
        <div className="mt-2 px-6">
          <GaugeBar value={v.speed} max={160} color={v.speed > 100 ? "bg-amber-500" : "bg-cyan-500"} />
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-0">
        <MetricRow label="Steering" value={v.steeringAngle >= 0 ? `+${v.steeringAngle.toFixed(1)}` : v.steeringAngle.toFixed(1)} unit="°" color="text-purple-400" />
        <MetricRow label="Accel" value={v.acceleration >= 0 ? `+${v.acceleration.toFixed(2)}` : v.acceleration.toFixed(2)} unit="m/s²" color={accelColor} />
        <MetricRow label="Lane Offset" value={v.laneOffset >= 0 ? `+${v.laneOffset.toFixed(2)}` : v.laneOffset.toFixed(2)} unit="m" color={Math.abs(v.laneOffset) > 0.6 ? "text-amber-400" : "text-cyan-400"} />
        <MetricRow label="Throttle" value={v.throttle.toFixed(0)} unit="%" color="text-emerald-400" />
        <MetricRow label="Brake" value={v.brakePressure.toFixed(0)} unit="%" color={v.brakePressure > 0 ? "text-red-400" : "text-gray-500"} />
        <MetricRow label="Heading" value={v.heading.toFixed(0)} unit="°" />
      </div>

      {/* Throttle / Brake bars */}
      <div className="mt-3 space-y-2">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="font-mono">THR</span>
            <span className="font-mono">{v.throttle.toFixed(0)}%</span>
          </div>
          <GaugeBar value={v.throttle} max={100} color="bg-emerald-500" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="font-mono">BRK</span>
            <span className="font-mono">{v.brakePressure.toFixed(0)}%</span>
          </div>
          <GaugeBar value={v.brakePressure} max={100} color="bg-red-500" />
        </div>
      </div>

      {/* ROS2 node status */}
      <div className="mt-4 pt-3 border-t border-[hsl(var(--glass-border)/0.3)]">
        <div className="panel-title mb-2">ROS2 Nodes</div>
        <div className="grid grid-cols-2 gap-1">
          {['perception','planning','control','ecu_bridge'].map(node => (
            <div key={node} className="flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", state.adas.aebStatus === 'fault' && node === 'perception' ? "bg-red-500" : "bg-emerald-500")} />
              <span className="text-xs text-gray-400 font-mono">{node}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
