"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PreviewBanner } from "./preview-banner";
import { ShieldCheck, Power, Cpu, Coins, ScrollText, RotateCcw, OctagonX } from "lucide-react";

const AUTONOMY_LEVELS = [
  { level: 0, name: "Observe", desc: "Agents read & report only" },
  { level: 1, name: "Suggest", desc: "Insights + drafts, no writes" },
  { level: 2, name: "Sandbox", desc: "Builds & evals in isolation" },
  { level: 3, name: "Propose", desc: "Opens PRs behind human gate" },
  { level: 4, name: "Scheduled", desc: "Daily OODA loop, gated merges" },
  { level: 5, name: "Standing goals", desc: "Weekly RC packets, full audit" },
];

const SWITCHES = [
  { id: "scout", name: "Scout / Analyst", desc: "daily industry scan" },
  { id: "builder", name: "Builder / Reviewer", desc: "sandboxed code loop" },
  { id: "policy", name: "Policy training", desc: "GPU RL jobs" },
  { id: "challenge", name: "Challenge Ops", desc: "submission pipeline" },
];

const AUDIT = [
  { t: "09:14", who: "Osama", what: "Approved PR-0042 (AEB DTC edge trigger)", kind: "approve" },
  { t: "09:02", who: "Evaluator", what: "Golden-bank run #311 — 25/25 PASS on ckpt-094", kind: "auto" },
  { t: "08:47", who: "Builder", what: "Drafted PR-0043 from Scout digest 06-09", kind: "auto" },
  { t: "08:30", who: "Scout", what: "Daily scan: 5 insights, 1 ruleset change flagged", kind: "auto" },
  { t: "yesterday", who: "Osama", what: "Rejected PR-0039 — 'wrong fix layer, belongs in perception'", kind: "reject" },
];

export function GovernWorkspace() {
  const [autonomy, setAutonomy] = useState(2);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ scout: true, builder: true, policy: false, challenge: false });
  const [killed, setKilled] = useState(false);

  return (
    <div className="space-y-4 animate-fade-up">
      <PreviewBanner phase="Phase 7B" agents="Orchestrator + governance controls" />

      {killed && (
        <div role="alert" className="glass-tint-danger border rounded-[var(--radius-lg)] px-4 py-2.5 flex items-center gap-2.5 text-xs font-mono">
          <OctagonX className="w-4 h-4 text-[hsl(var(--danger))]" />
          <span className="text-[hsl(var(--danger))] font-bold">KILL SWITCH ENGAGED</span>
          <span className="text-[hsl(var(--text-muted))]">— all agent loops halted; pending actions rolled back; audit entry written.</span>
          <button onClick={() => setKilled(false)} className="ml-auto px-2.5 py-1 rounded-[var(--radius-sm)] glass-well text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--accent)/0.4)]">
            Re-arm
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Autonomy dial */}
        <div className="glass-card p-4">
          <div className="panel-title flex items-center gap-2 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--accent))]" /> Autonomy Dial
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="display-numeral text-4xl text-gradient-brand">L{autonomy}</span>
            <div>
              <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>{AUTONOMY_LEVELS[autonomy].name}</div>
              <div className="text-[11px] font-mono text-[hsl(var(--text-muted))]">{AUTONOMY_LEVELS[autonomy].desc}</div>
            </div>
          </div>
          <input type="range" min={0} max={5} value={autonomy} onChange={(e) => setAutonomy(Number(e.target.value))}
            aria-label="Autonomy level" aria-valuetext={`L${autonomy} ${AUTONOMY_LEVELS[autonomy].name}`}
            className="w-full accent-[hsl(var(--accent))]" disabled={killed} />
          <div className="flex justify-between mt-1">
            {AUTONOMY_LEVELS.map((l) => (
              <span key={l.level} className={cn("text-[9px] font-mono", l.level <= autonomy && !killed ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-faint))]")}>
                L{l.level}
              </span>
            ))}
          </div>
          <p className="text-[10px] font-mono text-[hsl(var(--text-faint))] mt-2">
            Raising past L3 requires a second approver (P7B policy). Current phase cap: L2.
          </p>
        </div>

        {/* Kill switches */}
        <div className="glass-card p-4">
          <div className="panel-title flex items-center gap-2 mb-3">
            <Power className="w-3.5 h-3.5 text-[hsl(var(--danger))]" /> Agent Loops — kill switches
          </div>
          <div className="space-y-2">
            {SWITCHES.map((s) => {
              const on = enabled[s.id] && !killed;
              return (
                <div key={s.id} className="flex items-center gap-3 glass-well px-3 py-2">
                  <button role="switch" aria-checked={on} aria-label={`${s.name} loop`} disabled={killed}
                    onClick={() => setEnabled((m) => ({ ...m, [s.id]: !m[s.id] }))}
                    className={cn("relative w-9 h-5 rounded-full transition-colors duration-150 shrink-0",
                      on ? "bg-[hsl(var(--ok)/0.55)]" : "bg-[hsl(var(--surface-4))]")}>
                    <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-[hsl(var(--text-primary))] transition-all duration-150", on ? "left-[18px]" : "left-0.5")} />
                  </button>
                  <div className="min-w-0">
                    <div className="text-xs text-[hsl(var(--text-primary))]">{s.name}</div>
                    <div className="text-[10px] font-mono text-[hsl(var(--text-faint))]">{s.desc}</div>
                  </div>
                  <span className={cn("ml-auto text-[10px] font-mono font-bold", on ? "text-[hsl(var(--ok))]" : "text-[hsl(var(--text-faint))]")}>
                    {on ? "RUNNING" : "STOPPED"}
                  </span>
                </div>
              );
            })}
          </div>
          <button onClick={() => setKilled(true)} disabled={killed}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--radius-md)] glass-tint-danger border text-[hsl(var(--danger))] text-xs font-mono font-bold hover:brightness-110 transition disabled:opacity-40">
            <OctagonX className="w-4 h-4" /> EMERGENCY STOP — halt all agent activity
          </button>
        </div>
      </div>

      {/* Resource telemetry */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Cpu, label: "GPU hours (week)", value: "11.2 / 40", pct: 28, tone: "--ok" },
          { icon: Coins, label: "LLM tokens (day)", value: "1.4M / 5M", pct: 28, tone: "--ok" },
          { icon: Coins, label: "Cloud spend (month)", value: "$212 / $400", pct: 53, tone: "--warn" },
          { icon: Cpu, label: "RTX 2080 Ti util", value: "62%", pct: 62, tone: "--accent" },
        ].map((m) => (
          <div key={m.label} className="glass-card p-3.5">
            <div className="panel-title flex items-center gap-1.5 mb-1.5"><m.icon className="w-3 h-3" /> {m.label}</div>
            <div className="font-mono text-sm font-bold text-[hsl(var(--text-primary))]">{m.value}</div>
            <div className="mt-1.5 h-1 rounded-full bg-[hsl(var(--surface-3))] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: `hsl(var(${m.tone}))` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Audit log */}
      <div className="glass-card overflow-hidden">
        <div className="panel-title flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--glass-border)/0.3)]">
          <ScrollText className="w-3.5 h-3.5 text-[hsl(var(--accent))]" /> Audit Log — every agent action, every human decision
          <button className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-[hsl(var(--text-muted))] hover:text-[hsl(var(--accent))] transition-colors">
            <RotateCcw className="w-3 h-3" /> One-click rollback to last human-approved state
          </button>
        </div>
        <ul>
          {AUDIT.map((a, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2 border-t border-[hsl(var(--glass-border)/0.2)] first:border-t-0 text-[11px] font-mono">
              <span className="text-[hsl(var(--text-faint))] w-16 shrink-0">{a.t}</span>
              <span className={cn("w-20 shrink-0 font-bold",
                a.kind === "approve" ? "text-[hsl(var(--ok))]" : a.kind === "reject" ? "text-[hsl(var(--danger))]" : "text-[hsl(var(--accent-2))]")}>
                {a.who}
              </span>
              <span className="text-[hsl(var(--text-secondary))]">{a.what}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
