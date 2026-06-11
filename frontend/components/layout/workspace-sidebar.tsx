"use client";

import { cn } from "@/lib/utils";
import {
  Stethoscope,
  Hammer,
  FlaskConical,
  Gauge,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** The five workspaces (Plan v3 §5.10). Diagnose is live; the rest are UI previews. */
export type WorkspaceId = "diagnose" | "build" | "research" | "eval" | "govern";

export interface Workspace {
  id: WorkspaceId;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
  phase: string; // when the agent backend lands
  blurb: string;
}

export const WORKSPACES: Workspace[] = [
  { id: "diagnose", label: "Diagnose", icon: Stethoscope,  enabled: true, phase: "Live",    blurb: "Live sim, UDS console, DTCs, incident triage" },
  { id: "build",    label: "Build",    icon: Hammer,       enabled: true, phase: "Preview", blurb: "Proposal inbox, sandbox builder, approval packets" },
  { id: "research", label: "Research", icon: FlaskConical, enabled: true, phase: "Preview", blurb: "Scout/Analyst insights feed, knowledge base" },
  { id: "eval",     label: "Eval",     icon: Gauge,        enabled: true, phase: "Preview", blurb: "Closed-loop runs, golden-bank gates, replays" },
  { id: "govern",   label: "Govern",   icon: ShieldCheck,  enabled: true, phase: "Preview", blurb: "Autonomy dial, audit, kill-switch, budgets" },
];

interface Props {
  active: WorkspaceId;
  onSelect: (id: WorkspaceId) => void;
}

export function WorkspaceSidebar({ active, onSelect }: Props) {
  return (
    <nav
      aria-label="Workspaces"
      className="glass-chrome flex lg:flex-col items-center lg:items-stretch gap-1 border-b lg:border-b-0 lg:border-r px-2 py-1.5 lg:py-4 lg:w-[212px] shrink-0"
    >
      {/* Brand */}
      <div className="hidden lg:flex items-center gap-2.5 px-2.5 pb-4 mb-2 border-b border-[hsl(var(--glass-border)/0.3)]">
        <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center"
          style={{ background: "var(--gradient-brand)" }}>
          <Zap className="w-4 h-4 text-[hsl(var(--surface-0))]" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            ADAS Platform
          </div>
          <div className="text-[10px] font-mono text-[hsl(var(--text-muted))]">v3 · Phase 1</div>
        </div>
      </div>

      {WORKSPACES.map((ws) => {
        const isActive = ws.id === active;
        const Icon = ws.icon;
        return (
          <button
            key={ws.id}
            onClick={() => ws.enabled && onSelect(ws.id)}
            disabled={!ws.enabled}
            aria-current={isActive ? "page" : undefined}
            title={ws.blurb}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-left",
              "transition-colors duration-150",
              isActive
                ? "bg-[hsl(var(--surface-3)/0.9)] text-[hsl(var(--text-primary))]"
                : ws.enabled
                  ? "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-3)/0.5)] hover:text-[hsl(var(--text-primary))]"
                  : "text-[hsl(var(--text-faint))] cursor-not-allowed",
            )}
          >
            {isActive && (
              <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
                style={{ background: "var(--gradient-brand)" }} />
            )}
            <Icon className={cn("w-4 h-4 shrink-0", isActive && "text-[hsl(var(--accent))]")} />
            <span className="hidden sm:block text-xs font-medium flex-1">{ws.label}</span>
            {ws.phase !== "Live" && (
              <span className="hidden lg:block text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-[hsl(var(--accent-2)/0.35)] text-[hsl(var(--accent-2))]">
                {ws.phase}
              </span>
            )}
          </button>
        );
      })}

      <div className="hidden lg:block mt-auto px-2.5 pt-3 border-t border-[hsl(var(--glass-border)/0.3)] text-[10px] font-mono text-[hsl(var(--text-faint))] leading-relaxed">
        CARLA 0.9.15 · ROS2 Humble
        <br />ISO 14229 · SimBackend: internal
      </div>
    </nav>
  );
}
