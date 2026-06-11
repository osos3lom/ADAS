"use client";

import type { Workspace } from "@/components/layout/workspace-sidebar";
import { Lock } from "lucide-react";

/** Shell for not-yet-built workspaces (audit finding #9: orientation). */
export function LockedWorkspace({ workspace }: { workspace: Workspace }) {
  const Icon = workspace.icon;
  return (
    <div className="glass-card animate-fade-up flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="relative mb-5">
        <div className="w-14 h-14 rounded-2xl glass-well flex items-center justify-center">
          <Icon className="w-6 h-6 text-[hsl(var(--text-muted))]" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[hsl(var(--surface-4))] border border-[hsl(var(--glass-border)/0.5)] flex items-center justify-center">
          <Lock className="w-3 h-3 text-[hsl(var(--text-muted))]" />
        </div>
      </div>
      <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
        {workspace.label} workspace
      </h2>
      <p className="text-sm text-[hsl(var(--text-secondary))] max-w-sm mb-3">{workspace.blurb}.</p>
      <span className="text-xs font-mono px-3 py-1 rounded-full glass-well text-[hsl(var(--text-muted))]">
        Unlocks in {workspace.phase} of the master plan
      </span>
    </div>
  );
}
