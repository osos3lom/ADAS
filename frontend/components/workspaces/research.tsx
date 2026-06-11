"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PreviewBanner } from "./preview-banner";
import { FlaskConical, ThumbsUp, ThumbsDown, ArrowUpRight, Trophy, BookOpen, Rss } from "lucide-react";

interface Insight {
  id: number;
  rank: number;
  tag: "challenge" | "standard" | "research" | "tooling";
  title: string;
  source: string;
  age: string;
  relevance: string;
  action?: string;
}

const INSIGHTS: Insight[] = [
  { id: 1, rank: 98, tag: "challenge", title: "AlpaSim 2026 ruleset v1.3: incident reports must include 2 s lateral-offset history in freeze-frames", source: "alpasim.nvidia.com/rules", age: "6 h", relevance: "Direct gap — our 19 04 freeze-frame carries speed+TTC only. Maps to P3B incident model.", action: "PR-0043 drafted" },
  { id: 2, rank: 91, tag: "research", title: "Wayve: closed-loop eval correlates with on-road disengagement only above 2 k scenario-km", source: "arxiv.org/abs/2606.01142", age: "1 d", relevance: "Sets a floor for our golden-bank size before CLVE gates are meaningful (P5A)." },
  { id: 3, rank: 84, tag: "standard", title: "ISO 14229-1:2026 draft adds 0x86 ResponseOnEvent for periodic DTC push", source: "iso.org — TC22/SC31", age: "2 d", relevance: "Our UDS server could replace 500 ms polling with event push — aligns with the SSE migration (P4D)." },
  { id: 4, rank: 77, tag: "tooling", title: "carla-ros-bridge 0.9.16 fixes ego-vehicle TF drift on WSL2 + adds Humble binary packages", source: "github.com/carla-simulator", age: "3 d", relevance: "Removes our last ❌ env item without a colcon source build (P1A)." },
  { id: 5, rank: 65, tag: "research", title: "Comma.ai openpilot 0.10 moves planning FSM to learned trajectory scoring", source: "blog.comma.ai", age: "5 d", relevance: "Architecture reference for our P6A policy track — FSM → PolicyAdapter swap." },
];

const TAG_STYLE: Record<Insight["tag"], string> = {
  challenge: "glass-tint-warn text-[hsl(var(--warn))]",
  standard: "glass-tint-ok text-[hsl(var(--ok))]",
  research: "text-[hsl(var(--accent-2))] border-[hsl(var(--accent-2)/0.35)] bg-[hsl(var(--accent-2)/0.08)]",
  tooling: "text-[hsl(var(--info))] border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info)/0.08)]",
};

export function ResearchWorkspace() {
  const [votes, setVotes] = useState<Record<number, 1 | -1 | 0>>({});

  const vote = (id: number, v: 1 | -1) =>
    setVotes((m) => ({ ...m, [id]: m[id] === v ? 0 : v }));

  return (
    <div className="space-y-4 animate-fade-up">
      <PreviewBanner phase="Phase 4B/4C" agents="Scout & Analyst agents + knowledge base" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Insights feed */}
        <div className="space-y-3 min-w-0">
          <div className="panel-title flex items-center gap-2 px-1">
            <Rss className="w-3.5 h-3.5 text-[hsl(var(--accent))]" /> Insights Feed — ranked by relevance to current phase
          </div>
          {INSIGHTS.map((ins) => (
            <article key={ins.id} className="glass-card glass-card-hover p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="display-numeral text-sm text-[hsl(var(--accent))]" title="relevance score">{ins.rank}</span>
                <span className={cn("px-1.5 py-0.5 rounded-full border text-[9px] font-mono uppercase", TAG_STYLE[ins.tag])}>{ins.tag}</span>
                <span className="ml-auto text-[10px] font-mono text-[hsl(var(--text-faint))]">{ins.age} ago</span>
              </div>
              <h3 className="text-sm text-[hsl(var(--text-primary))] leading-snug mb-1.5" style={{ fontFamily: "var(--font-display)" }}>
                {ins.title}
              </h3>
              <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed mb-1.5">
                <span className="text-[hsl(var(--text-muted))] font-mono">Analyst:</span> {ins.relevance}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[hsl(var(--text-faint))]">{ins.source}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => vote(ins.id, 1)} aria-pressed={votes[ins.id] === 1} aria-label="Useful — reinforce this kind of insight"
                    className={cn("p-1.5 rounded-[var(--radius-sm)] transition-colors", votes[ins.id] === 1 ? "text-[hsl(var(--ok))] bg-[hsl(var(--ok)/0.12)]" : "text-[hsl(var(--text-faint))] hover:text-[hsl(var(--text-secondary))]")}>
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => vote(ins.id, -1)} aria-pressed={votes[ins.id] === -1} aria-label="Not useful — demote this kind of insight"
                    className={cn("p-1.5 rounded-[var(--radius-sm)] transition-colors", votes[ins.id] === -1 ? "text-[hsl(var(--danger))] bg-[hsl(var(--danger)/0.12)]" : "text-[hsl(var(--text-faint))] hover:text-[hsl(var(--text-secondary))]")}>
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                  {ins.action && (
                    <button className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-md)] glass-well text-[11px] font-mono text-[hsl(var(--accent))] hover:border-[hsl(var(--accent)/0.45)] transition">
                      Review proposal <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Side rail: challenge tracker + KB */}
        <div className="space-y-4 h-fit">
          <div className="glass-card p-4">
            <div className="panel-title flex items-center gap-2 mb-3">
              <Trophy className="w-3.5 h-3.5 text-[hsl(var(--warn))]" /> Challenge Watch
            </div>
            <div className="text-xs text-[hsl(var(--text-primary))] font-semibold mb-1">NVIDIA AlpaSim E2E Closed-Loop 2026</div>
            <dl className="space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between"><dt className="text-[hsl(var(--text-muted))]">Submission opens</dt><dd className="text-[hsl(var(--text-secondary))]">Sep 2026</dd></div>
              <div className="flex justify-between"><dt className="text-[hsl(var(--text-muted))]">Ruleset</dt><dd className="text-[hsl(var(--warn))]">v1.3 (changed)</dd></div>
              <div className="flex justify-between"><dt className="text-[hsl(var(--text-muted))]">Our readiness</dt><dd className="text-[hsl(var(--text-secondary))]">Phase 1 / 7</dd></div>
            </dl>
          </div>

          <div className="glass-card p-4">
            <div className="panel-title flex items-center gap-2 mb-3">
              <BookOpen className="w-3.5 h-3.5 text-[hsl(var(--accent))]" /> Knowledge Base
            </div>
            <input placeholder="kb_search — e.g. 'NRC 0x33 conditions'…" aria-label="Search knowledge base"
              className="w-full glass-well px-3 py-2 text-xs font-mono text-[hsl(var(--text-primary))] placeholder-[hsl(var(--text-faint))] outline-none focus:border-[hsl(var(--accent)/0.5)] bg-transparent" />
            <div className="mt-3 space-y-1.5">
              {["ISO 14229 service map", "AlpaSim 2026 ruleset", "CARLA 0.9.15 sensor suite", "Golden scenario bank"].map((d) => (
                <div key={d} className="text-[11px] font-mono text-[hsl(var(--text-muted))] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[hsl(var(--accent)/0.6)]" /> {d}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-4">
            <div className="panel-title flex items-center gap-2 mb-2">
              <FlaskConical className="w-3.5 h-3.5 text-[hsl(var(--accent-2))]" /> Feedback loop
            </div>
            <p className="text-[11px] text-[hsl(var(--text-muted))] leading-relaxed">
              Thumbs are written to <span className="font-mono text-[hsl(var(--text-secondary))]">engineer_feedback</span> and
              steer tomorrow's scan ranking. Your judgment becomes durable memory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
