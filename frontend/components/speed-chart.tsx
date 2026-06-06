"use client";

import type { SimulationState } from "@/types";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface Props {
  state: SimulationState;
}

const chartConfig = {
  speed: { label: "Speed (km/h)", color: "#06b6d4" },
  ttc: { label: "TTC (s)", color: "#f59e0b" },
} satisfies ChartConfig;

export function SpeedChart({ state }: Props) {
  const data = state.speedHistory.slice(-50).map((s) => ({
    time: s.time,
    speed: Math.round(s.speed * 10) / 10,
    ttc: s.ttc > 30 ? 30 : Math.round(s.ttc * 10) / 10,
  }));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-gray-300 uppercase tracking-widest">
          Speed &amp; TTC History
        </span>
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
      <ChartContainer config={chartConfig} className="h-[120px] w-full">
        <AreaChart data={data} margin={{ top: 2, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-speed)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-speed)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ttcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-ttc)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--color-ttc)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" />
          <XAxis
            dataKey="time"
            tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent labelFormatter={(v) => `T+${v}s`} />
            }
          />
          <Area
            type="monotone"
            dataKey="speed"
            stroke="var(--color-speed)"
            strokeWidth={1.5}
            fill="url(#speedGrad)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="ttc"
            stroke="var(--color-ttc)"
            strokeWidth={1.5}
            fill="url(#ttcGrad)"
            dot={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
