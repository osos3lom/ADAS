"use client";

import { cn } from "@/lib/utils";
import type { SimulationState } from "@/types";
import { Shield, AlertTriangle, CheckCircle, XCircle, Zap } from "lucide-react";

interface Props { state: SimulationState; }

function StatusBadge({ label, status, value }: { label: string; status: string; value?: string }) {
  const configs: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; pulse?: boolean }> = {
    standby:  { color: 'text-gray-400',   bg: 'bg-gray-800/60',   border: 'border-gray-700', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    warning:  { color: 'text-amber-400',  bg: 'bg-amber-950/40',  border: 'border-amber-700', icon: <AlertTriangle className="w-3.5 h-3.5" />, pulse: true },
    active:   { color: 'text-red-400',    bg: 'bg-red-950/50',    border: 'border-red-700',   icon: <Zap className="w-3.5 h-3.5" />, pulse: true },
    fault:    { color: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-700', icon: <XCircle className="w-3.5 h-3.5" />, pulse: true },
    inactive: { color: 'text-gray-500',   bg: 'bg-gray-800/40',   border: 'border-gray-800',  icon: <Shield className="w-3.5 h-3.5" /> },
    left:     { color: 'text-amber-400',  bg: 'bg-amber-950/40',  border: 'border-amber-700', icon: <AlertTriangle className="w-3.5 h-3.5" />, pulse: true },
    right:    { color: 'text-amber-400',  bg: 'bg-amber-950/40',  border: 'border-amber-700', icon: <AlertTriangle className="w-3.5 h-3.5" />, pulse: true },
    'override': { color: 'text-blue-400', bg: 'bg-blue-950/40',   border: 'border-blue-700',  icon: <Zap className="w-3.5 h-3.5" /> },
  };
  const cfg = configs[status] ?? configs.inactive;

  return (
    <div className={cn("rounded-lg border p-3", cfg.bg, cfg.border)}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-400 font-mono uppercase tracking-widest">{label}</span>
        {cfg.pulse && <span className={cn("w-2 h-2 rounded-full animate-pulse", cfg.color.replace('text-','bg-'))} />}
      </div>
      <div className={cn("flex items-center gap-2", cfg.color)}>
        {cfg.icon}
        <span className="font-mono font-bold text-sm">{status.toUpperCase()}</span>
      </div>
      {value && <div className="text-xs text-gray-500 font-mono mt-1">{value}</div>}
    </div>
  );
}

function DIDRow({ did, label, value }: { did: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-800/40 last:border-0">
      <span className="text-gray-600 font-mono text-xs w-14 shrink-0">{did}</span>
      <span className="text-gray-400 font-mono text-xs flex-1">{label}</span>
      <span className="text-cyan-400 font-mono text-xs font-bold">{value}</span>
    </div>
  );
}

export function AdasStatus({ state }: Props) {
  const a = state.adas;
  const e = state.ecu;

  const sensLabel = { 1: 'LOW', 2: 'MED', 3: 'HIGH' }[e.aebSensitivity] ?? '?';
  const sessionColors: Record<string, string> = {
    default: 'text-gray-400', extended: 'text-blue-400', programming: 'text-amber-400',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-cyan-500" />
        <span className="text-xs font-mono text-gray-300 uppercase tracking-widest">ADAS Status</span>
        <span className="ml-auto text-xs text-gray-500 font-mono">T+{state.scenarioTime.toFixed(1)}s</span>
      </div>

      {/* Three ADAS system badges */}
      <div className="space-y-2">
        <StatusBadge label="AEB — Auto Emergency Brake" status={a.aebStatus} value={a.aebStatus === 'warning' || a.aebStatus === 'active' ? `TTC: ${a.ttc.toFixed(1)}s` : undefined} />
        <StatusBadge label="LDW — Lane Departure Warning" status={a.ldwStatus} value={a.ldwStatus !== 'inactive' ? `Offset: ${state.vehicle.laneOffset.toFixed(2)}m` : undefined} />
        <StatusBadge label="ACC — Adaptive Cruise Control" status={a.accStatus} value={a.accStatus === 'active' ? `Set: ${a.targetSpeed.toFixed(0)} km/h` : undefined} />
      </div>

      {/* Target info */}
      <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50">
        <div className="text-xs text-gray-500 font-mono uppercase mb-2">Target Vehicle</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="text-xs font-mono text-gray-400">Present</div>
          <div className={cn("text-xs font-mono font-bold", a.targetPresent ? "text-emerald-400" : "text-red-400")}>
            {a.targetPresent ? 'YES' : 'NO'}
          </div>
          <div className="text-xs font-mono text-gray-400">Distance</div>
          <div className="text-xs font-mono font-bold text-cyan-400">{a.targetPresent ? `${a.targetDistance.toFixed(1)}m` : '---'}</div>
          <div className="text-xs font-mono text-gray-400">Speed</div>
          <div className="text-xs font-mono font-bold text-cyan-400">{a.targetPresent ? `${a.targetSpeed.toFixed(1)} km/h` : '---'}</div>
          <div className="text-xs font-mono text-gray-400">TTC</div>
          <div className={cn("text-xs font-mono font-bold", a.ttc < 2 ? 'text-red-400' : a.ttc < 4 ? 'text-amber-400' : 'text-emerald-400')}>
            {a.ttc < 99 ? `${a.ttc.toFixed(2)}s` : '---'}
          </div>
        </div>
      </div>

      {/* ECU state */}
      <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50">
        <div className="text-xs text-gray-500 font-mono uppercase mb-2">ECU State</div>
        <div className="space-y-0">
          <DIDRow did="0x10" label="Session" value={<span className={sessionColors[e.session] + ' font-bold'}>{e.session.toUpperCase()}</span> as unknown as string} />
          <DIDRow did="0x27" label="Security" value={e.securityUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'} />
          <DIDRow did="0x0203" label="AEB Sens." value={`0x0${e.aebSensitivity} (${sensLabel})`} />
          <DIDRow did="0x0200" label="ADAS Mode" value={e.adasMode ? '0x01 (ACTIVE)' : '0x00 (OFF)'} />
          <DIDRow did="0xF18C" label="Serial" value={e.ecuSerialNumber.slice(-8)} />
        </div>
      </div>

      {/* DTC count badge */}
      <div className={cn(
        "rounded-lg p-3 border text-center",
        state.dtcs.filter(d => d.status === 'active').length > 0
          ? "bg-red-950/30 border-red-800" : "bg-gray-800/40 border-gray-700/50"
      )}>
        <div className="text-xs text-gray-500 font-mono uppercase mb-1">Active DTCs</div>
        <div className={cn("text-3xl font-mono font-black",
          state.dtcs.filter(d => d.status === 'active').length > 0 ? "text-red-400" : "text-emerald-400"
        )}>
          {state.dtcs.filter(d => d.status === 'active').length}
        </div>
        <div className="text-xs text-gray-500 font-mono">{state.dtcs.length} total stored</div>
      </div>
    </div>
  );
}
