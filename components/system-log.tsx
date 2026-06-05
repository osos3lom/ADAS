"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@/types";

interface Props { log: LogEntry[]; }

const SOURCE_COLORS: Record<string, string> = {
  CARLA:  'text-purple-400 bg-purple-950/30',
  ROS2:   'text-blue-400   bg-blue-950/30',
  ADAS:   'text-cyan-400   bg-cyan-950/30',
  UDS:    'text-emerald-400 bg-emerald-950/30',
  ECU:    'text-amber-400  bg-amber-950/30',
  SYSTEM: 'text-gray-400   bg-gray-800',
};

const LEVEL_COLORS: Record<string, string> = {
  info:  'text-gray-300',
  warn:  'text-amber-300',
  error: 'text-red-300',
};

const LEVEL_BADGE: Record<string, string> = {
  info:  'text-gray-500',
  warn:  'text-amber-500',
  error: 'text-red-500',
};

export function SystemLog({ log }: Props) {
  const [filter, setFilter] = useState<string>('ALL');
  const sources = ['ALL', 'SYSTEM', 'CARLA', 'ROS2', 'ADAS', 'UDS', 'ECU'];

  const filtered = filter === 'ALL' ? log : log.filter(l => l.source === filter);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {sources.map(src => (
          <button key={src} onClick={() => setFilter(src)}
            className={cn("text-xs font-mono px-2 py-1 rounded border transition-colors",
              filter === src
                ? "bg-gray-700 border-gray-500 text-gray-100"
                : "bg-gray-800/60 border-gray-800 text-gray-500 hover:text-gray-300"
            )}>
            {src}
          </button>
        ))}
      </div>

      {/* Log entries */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 font-mono text-xs" style={{ maxHeight: '320px' }}>
        {filtered.length === 0 && (
          <div className="text-gray-600 p-4 text-center">No log entries</div>
        )}
        {filtered.map(entry => (
          <div key={entry.id}
            className={cn("flex items-start gap-2 py-1 px-2 rounded hover:bg-gray-800/30 transition-colors", LEVEL_COLORS[entry.level])}>
            <span className="text-gray-600 shrink-0 tabular-nums">
              {new Date(entry.timestamp).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded shrink-0", SOURCE_COLORS[entry.source] ?? SOURCE_COLORS.SYSTEM)}>
              {entry.source}
            </span>
            <span className={cn("shrink-0", LEVEL_BADGE[entry.level])}>
              {entry.level.toUpperCase()}
            </span>
            <span className="break-all">{entry.message}</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-700 font-mono pt-1 border-t border-gray-800">
        {filtered.length} entries · auto-scrolling newest first
      </div>
    </div>
  );
}
