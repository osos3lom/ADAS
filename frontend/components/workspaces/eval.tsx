"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PreviewBanner } from "./preview-banner";
import { Gauge, Trophy, Film, GitCompareArrows, Play, AlertTriangle } from "lucide-react";

interface Incident {
  id: string;
  scenario: string;
  dtc: string;
  severity: "critical" | "warning";
  t: string;
  desc: string;
  freeze: { speed: string; ttc: string; offset: string };
}

const INCIDENTS: Incident[] = [
  { id: "INC-118", scenario: "cutin_dense_rain · seed 41", dtc: "P1C03", severity: "critical", t: "T+12.4s", desc: "Late brake on cut-in — min gap 0.4 m", freeze: { speed: "82.3 km/h", ttc: "0.61 s", offset: "+0.12 m" } },
  { id: "INC-117", scenario: "aeb_trigger · seed 7", dtc: "P1001", severity: "warning", t: "T+5.9s", desc: "AEB engaged inside spec — logged for regression", freeze: { speed: "79.8 km/h", ttc: "1.42 s", offset: "-0.03 m" } },
  { id: "INC-116", scenario: "lane_departure · seed 19", dtc: "P1003", severity: "warning", t: "T+8.1s", desc: "LKA correction 180 ms past gate", freeze: { speed: "67.2 km/h", ttc: "—", offset: "+0.71 m" } },
];

// Mock reward curves (per checkpoint, 12 epochs)
const CURVES = [
  { name: "ckpt-094 (candidate)", color: "var(--accent)", pts: [12, 18, 25, 31, 38, 42, 49, 55, 58, 63, 66, 71] },
  { name: "ckpt-087 (baseline)", color: "var(--accent-2)", pts: [12, 16, 22, 27, 31, 36, 40, 44, 47, 49, 50, 52] },
] as const;

function Sparkline({ pts, color }: { pts: readonly number[]; color: string }) {
  const max = 80;
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * 100} ${36 - (p / max) * 36}`).join(" ");
  return (
    <svg viewBox="0 0 100 38" className="w-full h-12" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={`hsl(${color})`} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function EvalWorkspace() {
  const [sel, setSel] = useState(INCIDENTS[0].id);
  const [scrub, setScrub] = useState(62);
  const inc = INCIDENTS.find((i) => i.id === sel) ?? INCIDENTS[0];

  return (
    <div className="space-y-4 animate-fade-up">
      <PreviewBanner phase="Phase 5" agents="Evaluator agent + CARLA/AlpaSim backends" />

      {/* Challenge dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Local score (dev set)", value: "61.8", sub: "AlpaSim metric v1.3", tone: "text-[hsl(var(--accent))]" },
          { label: "Leaderboard P50", value: "58.2", sub: "as of 06-10", tone: "text-[hsl(var(--text-primary))]" },
          { label: "Leaderboard P10", value: "74.5", sub: "top decile", tone: "text-[hsl(var(--text-primary))]" },
          { label: "Gap to P10", value: "−12.7", sub: "driven by cut-in class", tone: "text-[hsl(var(--warn))]" },
        ].map((m) => (
          <div key={m.label} className="glass-card glass-card-hover p-3.5">
            <div className="panel-title mb-1">{m.label}</div>
            <div className={cn("display-numeral text-2xl", m.tone)}>{m.value}</div>
            <div className="text-[10px] font-mono text-[hsl(var(--text-faint))] mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Incident inbox */}
        <div className="glass-card p-3 space-y-2 h-fit">
          <div className="panel-title flex items-center gap-2 px-1 pb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--warn))]" /> Incident Inbox
          </div>
          {INCIDENTS.map((i) => (
            <button key={i.id} onClick={() => setSel(i.id)} aria-current={sel === i.id}
              className={cn("w-full text-left rounded-[var(--radius-md)] border p-2.5 transition-colors duration-150",
                sel === i.id ? "border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--surface-3)/0.6)]" : "glass-well hover:border-[hsl(var(--accent)/0.3)]")}>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-[hsl(var(--text-muted))]">{i.id}</span>
                <span className={cn("font-bold", i.severity === "critical" ? "text-[hsl(var(--danger))]" : "text-[hsl(var(--warn))]")}>{i.dtc}</span>
                <span className="ml-auto text-[hsl(var(--text-faint))]">{i.t}</span>
              </div>
              <div className="text-xs text-[hsl(var(--text-primary))] mt-1 leading-snug">{i.desc}</div>
              <div className="text-[10px] font-mono text-[hsl(var(--text-faint))] mt-0.5">{i.scenario}</div>
            </button>
          ))}
        </div>

        {/* Replay + freeze frame */}
        <div className="space-y-4 min-w-0">
          <div className="glass-card overflow-hidden">
            <div className="panel-title flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--glass-border)/0.3)]">
              <Film className="w-3.5 h-3.5 text-[hsl(var(--accent))]" /> 3D Incident Replay — {inc.id}
            </div>
            <div className="relative h-44 bg-[hsl(var(--surface-1))] flex items-center justify-center">
              <div className="text-center">
                <Play className="w-8 h-8 mx-auto text-[hsl(var(--text-faint))]" />
                <div className="text-[11px] font-mono text-[hsl(var(--text-muted))] mt-2">
                  Replay renders via the Diagnose 3D scene (P5C) — scrub to inspect
                </div>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[hsl(var(--surface-3))]">
                <div className="h-full" style={{ width: `${scrub}%`, background: "var(--gradient-brand)" }} />
              </div>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              <span className="text-[10px] font-mono text-[hsl(var(--text-muted))] w-14">T+{(scrub * 0.2).toFixed(1)}s</span>
              <input type="range" min={0} max={100} value={scrub} onChange={(e) => setScrub(Number(e.target.value))}
                aria-label="Replay scrubber" className="flex-1 accent-[hsl(var(--accent))]" />
              <span className="text-[10px] font-mono text-[hsl(var(--text-faint))]">20.0s</span>
            </div>
            {/* Synced DTC / freeze-frame panel */}
            <div className="border-t border-[hsl(var(--glass-border)/0.3)] grid grid-cols-2 sm:grid-cols-4 divide-x divide-[hsl(var(--glass-border)/0.2)]">
              {[
                { k: "DTC", v: inc.dtc, tone: inc.severity === "critical" ? "text-[hsl(var(--danger))]" : "text-[hsl(var(--warn))]" },
                { k: "Speed", v: inc.freeze.speed, tone: "text-[hsl(var(--text-primary))]" },
                { k: "TTC", v: inc.freeze.ttc, tone: "text-[hsl(var(--text-primary))]" },
                { k: "Lane offset", v: inc.freeze.offset, tone: "text-[hsl(var(--text-primary))]" },
              ].map((c) => (
                <div key={c.k} className="px-4 py-2.5">
                  <div className="panel-title">{c.k}</div>
                  <div className={cn("font-mono text-sm font-bold mt-0.5", c.tone)}>{c.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Checkpoint comparison */}
          <div className="glass-card p-4">
            <div className="panel-title flex items-center gap-2 mb-3">
              <GitCompareArrows className="w-3.5 h-3.5 text-[hsl(var(--accent))]" /> Checkpoint Comparison — reward curves
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CURVES.map((c) => (
                <div key={c.name} className="glass-well p-3">
                  <div className="text-[11px] font-mono text-[hsl(var(--text-secondary))] mb-1">{c.name}</div>
                  <Sparkline pts={c.pts} color={c.color} />
                  <div className="text-[10px] font-mono text-[hsl(var(--text-faint))] mt-1">final reward {c.pts[c.pts.length - 1]} · 12 epochs</div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "cut-in", a: 14, b: 22 }, { k: "AEB", a: 2, b: 2 }, { k: "lane-keep", a: 5, b: 9 },
              ].map((r) => (
                <div key={r.k} className="glass-well py-2">
                  <div className="panel-title">{r.k} incidents</div>
                  <div className="font-mono text-xs mt-0.5">
                    <span className="text-[hsl(var(--accent))] font-bold">{r.a}</span>
                    <span className="text-[hsl(var(--text-faint))]"> vs </span>
                    <span className="text-[hsl(var(--accent-2))] font-bold">{r.b}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-mono">
              <Gauge className="w-3.5 h-3.5 text-[hsl(var(--ok))]" />
              <span className="text-[hsl(var(--ok))] font-bold">Golden-bank gate: PASS</span>
              <span className="text-[hsl(var(--text-muted))]">— ckpt-094 eligible for submission packet (human gate required)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
