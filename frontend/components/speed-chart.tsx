"use client";

import type { SimulationState } from "@/types";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface Props { state: SimulationState; }

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: number }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs font-mono">
      <div className="text-gray-400 mb-1">T+{label}s</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

export function SpeedChart({ state }: Props) {
  const data = state.speedHistory.slice(-50).map(s => ({
    time: s.time,
    'Speed (km/h)': Math.round(s.speed * 10) / 10,
    'TTC (s)': s.ttc > 30 ? 30 : Math.round(s.ttc * 10) / 10,
  }));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-gray-300 uppercase tracking-widest">Speed & TTC History</span>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-500 inline-block" />
            <span className="text-xs text-gray-400 font-mono">Speed km/h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-500 inline-block" />
            <span className="text-xs text-gray-400 font-mono">TTC s</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 2, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ttcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fill: '#4b5563', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: '#4b5563', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="Speed (km/h)" stroke="#06b6d4" strokeWidth={1.5} fill="url(#speedGrad)" dot={false} />
          <Area type="monotone" dataKey="TTC (s)" stroke="#f59e0b" strokeWidth={1.5} fill="url(#ttcGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
