"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SimulationState } from "@/types";
import { WorkspaceSidebar, WORKSPACES, type WorkspaceId } from "@/components/layout/workspace-sidebar";
import { DiagnoseWorkspace, type BottomTab, type View } from "@/components/workspaces/diagnose";
import { BuildWorkspace } from "@/components/workspaces/build";
import { ResearchWorkspace } from "@/components/workspaces/research";
import { EvalWorkspace } from "@/components/workspaces/eval";
import { GovernWorkspace } from "@/components/workspaces/govern";
import { cn } from "@/lib/utils";
import { Activity, RefreshCw, ChevronDown, WifiOff } from "lucide-react";

const SCENARIOS = [
  { id: "normal_driving", label: "Normal Driving", dot: "bg-[hsl(var(--ok))]",     text: "text-[hsl(var(--ok))]" },
  { id: "highway_acc",    label: "Highway ACC",    dot: "bg-[hsl(var(--info))]",   text: "text-[hsl(var(--info))]" },
  { id: "aeb_trigger",    label: "AEB Trigger",    dot: "bg-[hsl(var(--danger))]", text: "text-[hsl(var(--danger))]" },
  { id: "lane_departure", label: "Lane Departure", dot: "bg-[hsl(var(--warn))]",   text: "text-[hsl(var(--warn))]" },
  { id: "sensor_fault",   label: "Sensor Fault",   dot: "bg-[hsl(var(--warn))]",   text: "text-[hsl(var(--warn))]" },
];

export default function Platform() {
  const [workspace, setWorkspace] = useState<WorkspaceId>("diagnose");
  const [state, setState] = useState<SimulationState | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [activeTab, setActiveTab] = useState<BottomTab>("UDS Console");
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [failures, setFailures] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/sim/state");
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? `HTTP ${res.status}`);
      }
      setState((await res.json()) as SimulationState);
      setLastUpdate(Date.now());
      setFailures(0);
      setLastError(null);
    } catch (err) {
      setFailures((f) => f + 1); // banner appears on sustained failure
      setLastError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    fetchState();
    pollRef.current = setInterval(fetchState, 500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchState]);

  const switchScenario = useCallback(async (id: string) => {
    setSwitching(true);
    setScenarioOpen(false);
    try {
      const res = await fetch("/api/sim/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: id }),
      });
      if (!res.ok) throw new Error(`Scenario switch failed (HTTP ${res.status})`);
      await fetchState();
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
      setFailures((f) => Math.max(f, 3)); // a user action failed — surface it
    } finally {
      setSwitching(false);
    }
  }, [fetchState]);

  const currentScenario = SCENARIOS.find((s) => s.id === state?.scenario) ?? SCENARIOS[0];
  const activeDTCCount = state?.dtcs.filter((d) => d.status === "active").length ?? 0;
  const msSinceUpdate = Date.now() - lastUpdate;
  const connectionLost = failures >= 3;
  const activeWs = WORKSPACES.find((w) => w.id === workspace) ?? WORKSPACES[0];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <WorkspaceSidebar active={workspace} onSelect={setWorkspace} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ── Header ── */}
        <header className="glass-chrome sticky top-0 z-50 border-b">
          <div className="px-4 h-12 flex items-center gap-3">
            <h1 className="text-sm font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {activeWs.label}
            </h1>

            {workspace === "diagnose" && (
              <div className="relative">
                <button onClick={() => setScenarioOpen(!scenarioOpen)} aria-haspopup="listbox" aria-expanded={scenarioOpen}
                  className={cn("flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] glass-well text-xs font-mono transition-colors duration-150 hover:border-[hsl(var(--accent)/0.4)]", currentScenario.text)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", currentScenario.dot)} />
                  {currentScenario.label}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {scenarioOpen && (
                  <div role="listbox" className="glass-card absolute top-full left-0 mt-1.5 z-50 overflow-hidden min-w-[190px] !rounded-[var(--radius-md)]" style={{ boxShadow: "var(--shadow-float)" }}>
                    {SCENARIOS.map((s) => (
                      <button key={s.id} role="option" aria-selected={state?.scenario === s.id} onClick={() => switchScenario(s.id)}
                        className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono hover:bg-[hsl(var(--surface-3)/0.6)] transition-colors duration-150 text-left",
                          state?.scenario === s.id ? s.text : "text-[hsl(var(--text-secondary))]")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", state?.scenario === s.id ? s.dot : "bg-[hsl(var(--text-faint))]")} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {switching && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-[hsl(var(--accent))]">
                <RefreshCw className="w-3 h-3 animate-spin" /> Switching…
              </span>
            )}

            <div className="flex-1" />

            {activeDTCCount > 0 && (
              <button onClick={() => { setWorkspace("diagnose"); setView("dashboard"); setActiveTab("DTC Manager"); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] glass-tint-danger border text-[hsl(var(--danger))] text-xs font-mono animate-pulse">
                <span className="font-bold">{activeDTCCount}</span> DTC{activeDTCCount > 1 ? "s" : ""}
              </button>
            )}

            <div className="flex items-center gap-1.5 text-xs font-mono" role="status">
              <span className={cn("w-2 h-2 rounded-full",
                connectionLost ? "bg-[hsl(var(--danger))] animate-pulse"
                  : msSinceUpdate < 1500 ? "bg-[hsl(var(--ok))]" : "bg-[hsl(var(--warn))]")} />
              <span className="text-[hsl(var(--text-muted))] hidden sm:block">
                {connectionLost ? "OFFLINE" : msSinceUpdate < 1500 ? "LIVE" : "STALE"}
              </span>
            </div>

            {state && (
              <span className="hidden md:flex items-center gap-1.5 text-xs font-mono text-[hsl(var(--text-muted))]">
                <Activity className="w-3 h-3" /> T+{state.simulationTime.toFixed(0)}s
              </span>
            )}
          </div>
        </header>

        {/* ── Connection banner (audit finding #3) ── */}
        {connectionLost && (
          <div role="alert" className="glass-tint-danger border-b">
            <div className="px-4 py-2 flex items-center gap-2.5 text-xs font-mono">
              <WifiOff className="w-3.5 h-3.5 text-[hsl(var(--danger))] shrink-0" />
              <span className="text-[hsl(var(--danger))] font-bold">Backend connection lost</span>
              <span className="text-[hsl(var(--danger))/0.8] truncate">{lastError}</span>
              <span className="ml-auto shrink-0 hidden sm:flex items-center gap-1.5 text-[hsl(var(--text-muted))]">
                <RefreshCw className="w-3 h-3 animate-spin" />
                retrying · last data {lastUpdate ? `${Math.round(msSinceUpdate / 1000)}s ago` : "never"}
              </span>
            </div>
          </div>
        )}

        {/* ── Workspace content ── */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-4">
          {workspace === "diagnose" && (
            <DiagnoseWorkspace state={state} onRefresh={fetchState}
              activeTab={activeTab} onTabChange={setActiveTab} view={view} onViewChange={setView} />
          )}
          {workspace === "build" && <BuildWorkspace />}
          {workspace === "research" && <ResearchWorkspace />}
          {workspace === "eval" && <EvalWorkspace />}
          {workspace === "govern" && <GovernWorkspace />}
        </main>
      </div>

      {scenarioOpen && <div className="fixed inset-0 z-40" onClick={() => setScenarioOpen(false)} />}
    </div>
  );
}
