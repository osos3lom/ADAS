"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { DTC } from "@/types";
import { AlertTriangle, Trash, Zap, CheckCircle } from "lucide-react";

interface Props { dtcs: DTC[]; onRefresh: () => void; }

const FAULT_CODES = [
  { code: 'P1001', description: 'AEB Emergency Activation' },
  { code: 'P1002', description: 'LDW Left Lane Departure' },
  { code: 'P1003', description: 'LDW Right Lane Departure' },
  { code: 'B1001', description: 'Forward Radar Sensor Fault' },
  { code: 'B1002', description: 'Front Camera Calibration Error' },
  { code: 'U0100', description: 'Lost Comm With ECM/PCM' },
  { code: 'U0416', description: 'Invalid Data Received From VSS' },
];

function severityIcon(severity: DTC['severity']) {
  if (severity === 'critical') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  if (severity === 'warning')  return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  return <CheckCircle className="w-3.5 h-3.5 text-blue-400" />;
}

export function DtcManager({ dtcs, onRefresh }: Props) {
  const [clearing, setClearing] = useState(false);
  const [injecting, setInjecting] = useState(false);

  const clearAll = useCallback(async () => {
    setClearing(true);
    await fetch('/api/sim/clear-dtcs', { method: 'POST' });
    onRefresh();
    setClearing(false);
  }, [onRefresh]);

  const inject = useCallback(async (code: string) => {
    setInjecting(true);
    await fetch('/api/sim/inject-fault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    onRefresh();
    setInjecting(false);
  }, [onRefresh]);

  const activeDTCs = dtcs.filter(d => d.status === 'active');
  const otherDTCs  = dtcs.filter(d => d.status !== 'active');

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Active', count: dtcs.filter(d=>d.status==='active').length, color: 'text-[hsl(var(--danger))] glass-tint-danger' },
          { label: 'Pending', count: dtcs.filter(d=>d.status==='pending').length, color: 'text-[hsl(var(--warn))] glass-tint-warn' },
          { label: 'Stored', count: dtcs.filter(d=>d.status==='stored').length, color: 'text-[hsl(var(--text-secondary))] glass-well' },
        ].map(s => (
          <div key={s.label} className={cn("rounded-[var(--radius-md)] border p-2 text-center", s.color)}>
            <div className="panel-title mb-0.5">{s.label}</div>
            <div className="display-numeral text-2xl">{s.count}</div>
          </div>
        ))}
      </div>

      {/* DTC List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5" style={{ maxHeight: '200px' }}>
        {dtcs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-20 text-gray-600 font-mono text-xs">
            <CheckCircle className="w-6 h-6 mb-2 text-emerald-700" />
            No DTCs stored
          </div>
        )}
        {[...activeDTCs, ...otherDTCs].map(dtc => (
          <div key={dtc.code + dtc.timestamp} className={cn(
            "rounded-lg border p-2.5 flex items-start gap-3",
            dtc.status === 'active' ? "bg-red-950/20 border-red-800/50" :
            dtc.status === 'pending' ? "bg-amber-950/20 border-amber-800/50" :
            "bg-gray-800/30 border-gray-700/50"
          )}>
            <div className="mt-0.5">{severityIcon(dtc.severity)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-gray-200">{dtc.code}</span>
                <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded",
                  dtc.status === 'active' ? "bg-red-900/50 text-red-400" :
                  dtc.status === 'pending' ? "bg-amber-900/50 text-amber-400" :
                  "bg-gray-700 text-gray-400"
                )}>{dtc.status.toUpperCase()}</span>
                <span className="text-gray-600 text-xs font-mono ml-auto">#{dtc.occurrenceCount}</span>
              </div>
              <div className="text-xs text-gray-400 font-mono mt-0.5">{dtc.description}</div>
              <div className="text-xs text-gray-600 font-mono">
                Byte: {dtc.byteCode.map(b => '0x' + b.toString(16).toUpperCase().padStart(2,'0')).join(' ')}
                {' · '}{new Date(dtc.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800 pt-3 space-y-3">
        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={clearAll} disabled={clearing || dtcs.length === 0}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-red-700 text-gray-300 hover:text-red-400 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Trash className="w-3 h-3" />
            {clearing ? 'Clearing...' : 'Clear All DTCs'}
          </button>
        </div>

        {/* Fault injection */}
        <div>
          <div className="text-xs text-gray-500 font-mono mb-2 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-orange-500" />
            Fault Injection
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FAULT_CODES.map(f => (
              <button key={f.code} onClick={() => inject(f.code)} disabled={injecting}
                className="text-xs font-mono px-2 py-1 bg-gray-800/80 hover:bg-orange-950/40 border border-gray-700 hover:border-orange-700 text-gray-400 hover:text-orange-400 rounded transition-colors disabled:opacity-40">
                {f.code}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
