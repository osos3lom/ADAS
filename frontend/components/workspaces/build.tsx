"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PreviewBanner } from "./preview-banner";
import { GitPullRequest, Check, X, PenLine, FileDiff, FlaskConical, ShieldCheck } from "lucide-react";

type Verdict = "pending" | "approved" | "rejected";

interface Proposal {
  id: string;
  title: string;
  agent: string;
  risk: "low" | "medium" | "high";
  summary: string;
  files: string[];
  diff: { sign: "+" | "-" | " "; text: string }[];
  evalReport: { metric: string; before: string; after: string; pass: boolean }[];
}

const PROPOSALS: Proposal[] = [
  {
    id: "PR-0042",
    title: "Widen AEB DTC trigger window in planning FSM",
    agent: "Builder · from Analyst insight #128",
    risk: "low",
    summary: "Known issue: P1001 window requires TTC ≤ 1.5 s at t≈5.8 s but the approach geometry never reaches it. Couple the DTC emit to the aeb_status edge instead of the wall-clock window.",
    files: ["ros2_ws/src/planning/planning_fsm.py", "backend/tests/test_scenarios.py"],
    diff: [
      { sign: " ", text: "if ttc <= AEB_TTC_THRESHOLD:" },
      { sign: " ", text: "    state.aeb_status = 'active'" },
      { sign: "-", text: "    if abs(t - 5.8) < 0.3:  # narrow wall-clock window" },
      { sign: "-", text: "        emit_dtc('P1001', freeze_frame(state))" },
      { sign: "+", text: "    if prev_status != 'active':  # rising edge — always fires" },
      { sign: "+", text: "        emit_dtc('P1001', freeze_frame(state))" },
    ],
    evalReport: [
      { metric: "Golden bank (25 scenarios)", before: "25/25", after: "25/25", pass: true },
      { metric: "P1001 emitted in aeb_trigger", before: "0/100 runs", after: "100/100 runs", pass: true },
      { metric: "False-positive DTCs", before: "0", after: "0", pass: true },
    ],
  },
  {
    id: "PR-0043",
    title: "Add freeze-frame snapshot to LDW DTCs (19 04 parity)",
    agent: "Builder · from Scout digest 06-09",
    risk: "medium",
    summary: "AlpaSim 2026 ruleset change: incident reports now require lateral-offset history. Attach a 2 s lane-offset ring buffer to P1002/P1003 freeze-frames.",
    files: ["backend/uds/services.py", "backend/simulation/scenarios.py"],
    diff: [
      { sign: " ", text: "def freeze_frame(state):" },
      { sign: "-", text: "    return {'speed': v.speed, 'ttc': a.ttc}" },
      { sign: "+", text: "    return {'speed': v.speed, 'ttc': a.ttc," },
      { sign: "+", text: "            'lane_offset_2s': list(state.offset_ring)}" },
    ],
    evalReport: [
      { metric: "Golden bank (25 scenarios)", before: "25/25", after: "24/25", pass: false },
      { metric: "19 04 response size", before: "12 B", after: "92 B", pass: true },
    ],
  },
];

const RISK_STYLE = {
  low: "glass-tint-ok text-[hsl(var(--ok))]",
  medium: "glass-tint-warn text-[hsl(var(--warn))]",
  high: "glass-tint-danger text-[hsl(var(--danger))]",
};

export function BuildWorkspace() {
  const [selected, setSelected] = useState(PROPOSALS[0].id);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [note, setNote] = useState("");
  const p = PROPOSALS.find((x) => x.id === selected) ?? PROPOSALS[0];
  const verdict = verdicts[p.id] ?? "pending";

  const decide = (v: Verdict) => setVerdicts((m) => ({ ...m, [p.id]: v }));

  return (
    <div className="space-y-4 animate-fade-up">
      <PreviewBanner phase="Phase 6C" agents="Builder, Reviewer & Planner agents" />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Proposal inbox */}
        <div className="glass-card p-3 space-y-2 h-fit">
          <div className="panel-title flex items-center gap-2 px-1 pb-1">
            <GitPullRequest className="w-3.5 h-3.5 text-[hsl(var(--accent))]" /> Proposal Inbox
          </div>
          {PROPOSALS.map((x) => {
            const v = verdicts[x.id] ?? "pending";
            return (
              <button key={x.id} onClick={() => setSelected(x.id)} aria-current={selected === x.id}
                className={cn("w-full text-left rounded-[var(--radius-md)] border p-2.5 transition-colors duration-150",
                  selected === x.id ? "border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--surface-3)/0.6)]" : "glass-well hover:border-[hsl(var(--accent)/0.3)]")}>
                <div className="flex items-center gap-2 text-[11px] font-mono text-[hsl(var(--text-muted))]">
                  {x.id}
                  <span className={cn("px-1.5 py-0.5 rounded-full border text-[9px] uppercase", RISK_STYLE[x.risk])}>{x.risk}</span>
                  {v !== "pending" && (
                    <span className={cn("ml-auto text-[9px] uppercase font-bold", v === "approved" ? "text-[hsl(var(--ok))]" : "text-[hsl(var(--danger))]")}>{v}</span>
                  )}
                </div>
                <div className="text-xs text-[hsl(var(--text-primary))] mt-1 leading-snug">{x.title}</div>
                <div className="text-[10px] font-mono text-[hsl(var(--text-faint))] mt-1">{x.agent}</div>
              </button>
            );
          })}
        </div>

        {/* Detail: summary + diff + eval report + actions */}
        <div className="space-y-4 min-w-0">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs text-[hsl(var(--text-muted))]">{p.id}</span>
              <h2 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>{p.title}</h2>
            </div>
            <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed">{p.summary}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {p.files.map((f) => (
                <span key={f} className="glass-well px-2 py-0.5 text-[10px] font-mono text-[hsl(var(--text-muted))]">{f}</span>
              ))}
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="panel-title flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--glass-border)/0.3)]">
              <FileDiff className="w-3.5 h-3.5 text-[hsl(var(--accent))]" /> Diff
            </div>
            <pre className="p-4 text-xs font-mono overflow-x-auto bg-[hsl(var(--surface-1)/0.7)]">
              {p.diff.map((l, i) => (
                <div key={i} className={cn("px-2 -mx-2 whitespace-pre",
                  l.sign === "+" ? "bg-[hsl(var(--ok)/0.1)] text-[hsl(var(--ok))]" :
                  l.sign === "-" ? "bg-[hsl(var(--danger)/0.1)] text-[hsl(var(--danger))]" : "text-[hsl(var(--text-secondary))]")}>
                  {l.sign} {l.text}
                </div>
              ))}
            </pre>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="panel-title flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--glass-border)/0.3)]">
              <FlaskConical className="w-3.5 h-3.5 text-[hsl(var(--accent))]" /> Eval Report (closed-loop)
            </div>
            <table className="w-full text-left">
              <thead><tr>{["Metric", "Before", "After", "Gate"].map((c) => (
                <th key={c} className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-faint))]">{c}</th>))}
              </tr></thead>
              <tbody>
                {p.evalReport.map((r) => (
                  <tr key={r.metric} className="border-t border-[hsl(var(--glass-border)/0.25)]">
                    <td className="px-4 py-1.5 font-mono text-[11px] text-[hsl(var(--text-secondary))]">{r.metric}</td>
                    <td className="px-4 py-1.5 font-mono text-[11px] text-[hsl(var(--text-muted))]">{r.before}</td>
                    <td className="px-4 py-1.5 font-mono text-[11px] text-[hsl(var(--text-primary))]">{r.after}</td>
                    <td className={cn("px-4 py-1.5 font-mono text-[11px] font-bold", r.pass ? "text-[hsl(var(--ok))]" : "text-[hsl(var(--danger))]")}>
                      {r.pass ? "PASS" : "FAIL"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Approval packet actions */}
          <div className="glass-card p-4 space-y-3">
            <div className="panel-title flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--accent))]" /> Human Gate — decision recorded to audit log
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional reviewer note (becomes durable steering memory)…"
              className="w-full glass-well px-3 py-2 text-xs font-mono text-[hsl(var(--text-primary))] placeholder-[hsl(var(--text-faint))] outline-none focus:border-[hsl(var(--accent)/0.5)] resize-none bg-transparent" />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => decide("approved")} disabled={verdict !== "pending"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] glass-tint-ok border text-[hsl(var(--ok))] text-xs font-mono disabled:opacity-40 hover:brightness-110 transition">
                <Check className="w-3.5 h-3.5" /> Approve &amp; merge
              </button>
              <button onClick={() => decide("pending")} disabled={verdict !== "pending"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] glass-well text-[hsl(var(--text-secondary))] text-xs font-mono disabled:opacity-40 hover:border-[hsl(var(--accent)/0.4)] transition">
                <PenLine className="w-3.5 h-3.5" /> Request changes
              </button>
              <button onClick={() => decide("rejected")} disabled={verdict !== "pending"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] glass-tint-danger border text-[hsl(var(--danger))] text-xs font-mono disabled:opacity-40 hover:brightness-110 transition">
                <X className="w-3.5 h-3.5" /> Reject
              </button>
              {verdict !== "pending" && (
                <span className={cn("self-center text-xs font-mono font-bold", verdict === "approved" ? "text-[hsl(var(--ok))]" : "text-[hsl(var(--danger))]")}>
                  {verdict === "approved" ? "✓ Approved — queued for merge" : "✗ Rejected — feedback sent to Builder"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
