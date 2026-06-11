"use client";

import { Sparkles } from "lucide-react";

/** Thin ribbon marking a workspace whose agent backend lands in a later phase. */
export function PreviewBanner({ phase, agents }: { phase: string; agents: string }) {
  return (
    <div role="note" className="glass-well flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono text-[hsl(var(--text-muted))]">
      <Sparkles className="w-3 h-3 text-[hsl(var(--accent-2))]" />
      <span>
        UI preview with sample data — <span className="text-[hsl(var(--text-secondary))]">{agents}</span> wire
        in <span className="text-[hsl(var(--accent))]">{phase}</span>.
      </span>
    </div>
  );
}
