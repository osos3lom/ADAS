"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SimulationState } from "@/types";
import { VehicleTelemetry } from "@/components/vehicle-telemetry";
import { SceneView } from "@/components/scene-view";
import { AdasStatus } from "@/components/adas-status";
import { SpeedChart } from "@/components/speed-chart";
import { UDSConsole } from "@/components/uds-console";
import { DtcManager } from "@/components/dtc-manager";
import { SystemLog } from "@/components/system-log";
import { cn } from "@/lib/utils";
import { Activity, Zap, RefreshCw, ChevronDown, Play, Pause } from "lucide-react";

// ── Scenario config ───────────────────────────────────────────────────────────

const SCENARIOS = [
  { id: 'normal_driving', label: 'Normal Driving',   color: 'text-emerald-400', badge: 'bg-emerald-950 border-emerald-800' },
  { id: 'highway_acc',    label: 'Highway ACC',      color: 'text-blue-400',    badge: 'bg-blue-950 border-blue-800' },
  { id: 'aeb_trigger',    label: 'AEB Trigger',      color: 'text-red-400',     badge: 'bg-red-950 border-red-800' },
  { id: 'lane_departure', label: 'Lane Departure',   color: 'text-amber-400',   badge: 'bg-amber-950 border-amber-800' },
  { id: 'sensor_fault',   label: 'Sensor Fault',     color: 'text-orange-400',  badge: 'bg-orange-950 border-orange-800' },
];

const BOTTOM_TABS = ['UDS Console', 'DTC Manager', 'System Log'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [activeTab, setActiveTab] = useState('UDS Console');
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/sim/state');
      const data: SimulationState = await res.json();
      setState(data);
      setLastUpdate(Date.now());
    } catch { /* ignore network blips */ }
  }, []);

  useEffect(() => {
    fetchState();
    pollRef.current = setInterval(fetchState, 500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchState]);

  const switchScenario = useCallback(async (id: string) => {
    setSwitching(true);
    setScenarioOpen(false);
    await fetch('/api/sim/scenario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: id }) });
    await fetchState();
    setSwitching(false);
  }, [fetchState]);

  const currentScenario = SCENARIOS.find(s => s.id === state?.scenario) ?? SCENARIOS[0];
  const activeDTCCount = state?.dtcs.filter(d => d.status === 'active').length ?? 0;
  const msSinceUpdate = Date.now() - lastUpdate;

  if (!state) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-center space-y-3">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <div className="text-gray-400 font-mono text-sm">Initializing ADAS-ECU Simulator...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col" style={{ fontFamily: 'var(--font-inter)' }}>

      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="font-mono font-bold text-sm text-gray-100 tracking-tight">ADAS-ECU SIM</span>
            <span className="text-gray-600 font-mono text-xs hidden sm:block">v2.4.1</span>
          </div>

          <div className="w-px h-6 bg-gray-700" />

          {/* Scenario selector */}
          <div className="relative">
            <button onClick={() => setScenarioOpen(!scenarioOpen)}
              className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors",
                currentScenario.badge, currentScenario.color,
                "hover:brightness-110"
              )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {currentScenario.label}
              <ChevronDown className="w-3 h-3" />
            </button>

            {scenarioOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden min-w-[180px]">
                {SCENARIOS.map(s => (
                  <button key={s.id} onClick={() => switchScenario(s.id)}
                    className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono hover:bg-gray-800 transition-colors text-left",
                      state.scenario === s.id ? s.color : "text-gray-400"
                    )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", state.scenario === s.id ? "bg-current" : "bg-gray-600")} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {switching && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Switching...
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Status indicators */}
          {activeDTCCount > 0 && (
            <button onClick={() => setActiveTab('DTC Manager')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800 text-red-400 text-xs font-mono animate-pulse hover:brightness-110">
              <span className="font-bold">{activeDTCCount}</span> DTC{activeDTCCount > 1 ? 's' : ''}
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className={cn("w-2 h-2 rounded-full", msSinceUpdate < 1500 ? "bg-emerald-500" : "bg-amber-500")} />
            <span className="text-gray-500 hidden sm:block">{msSinceUpdate < 1500 ? 'LIVE' : 'STALE'}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hidden md:flex">
            <Activity className="w-3 h-3" />
            T+{state.simulationTime.toFixed(0)}s
          </div>
        </div>
      </header>

      {/* ── Main Grid ──────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-4 space-y-4">

        {/* Row 1: Three panels */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-4" style={{ minHeight: '480px' }}>
          <VehicleTelemetry state={state} />
          <SceneView state={state} />
          <AdasStatus state={state} />
        </div>

        {/* Row 2: Speed / TTC chart */}
        <SpeedChart state={state} />

        {/* Row 3: Bottom panels with tabs */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b border-gray-800 bg-gray-900/60">
            {BOTTOM_TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn("px-4 py-2.5 text-xs font-mono transition-colors border-b-2",
                  activeTab === tab
                    ? "text-cyan-400 border-cyan-500 bg-gray-800/40"
                    : "text-gray-500 border-transparent hover:text-gray-300"
                )}>
                {tab}
                {tab === 'DTC Manager' && activeDTCCount > 0 && (
                  <span className="ml-1.5 px-1 py-0.5 bg-red-900/60 text-red-400 rounded text-xs">{activeDTCCount}</span>
                )}
              </button>
            ))}
            <div className="ml-auto pr-3 text-xs text-gray-600 font-mono hidden sm:block">
              vcan0 · ISO 14229 · ROS2 Humble · CARLA 0.9.15
            </div>
          </div>

          {/* Tab content */}
          <div className="p-4">
            {activeTab === 'UDS Console'  && <UDSConsole />}
            {activeTab === 'DTC Manager'  && <DtcManager dtcs={state.dtcs} onRefresh={fetchState} />}
            {activeTab === 'System Log'   && <SystemLog log={state.systemLog} />}
          </div>
        </div>

        {/* Architecture badge */}
        <div className="flex flex-wrap items-center gap-2 justify-center pb-2">
          {['CARLA 0.9.15', 'ROS2 Humble', 'C++ rclcpp', 'Python rclpy', 'ISO 14229 UDS', 'SocketCAN vcan0', 'python-can', 'udsoncan'].map(tag => (
            <span key={tag} className="text-xs font-mono px-2 py-0.5 bg-gray-800/60 border border-gray-700 text-gray-500 rounded">
              {tag}
            </span>
          ))}
        </div>
      </main>

      {/* Click outside to close dropdown */}
      {scenarioOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setScenarioOpen(false)} />
      )}
    </div>
  );
}
