"use client";

import { useState } from "react";
import type { SimulationState } from "@/types";
import { VehicleTelemetry } from "@/components/vehicle-telemetry";
import { SceneView } from "@/components/scene-view";
import { AdasStatus } from "@/components/adas-status";
import { SpeedChart } from "@/components/speed-chart";
import { UDSConsole } from "@/components/uds-console";
import { DtcManager } from "@/components/dtc-manager";
import { SystemLog } from "@/components/system-log";
import { ControlCenter } from "@/components/control-center";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Server } from "lucide-react";

const BOTTOM_TABS = ["UDS Console", "DTC Manager", "System Log"] as const;
type BottomTab = (typeof BOTTOM_TABS)[number];
type View = "dashboard" | "control";

interface Props {
  state: SimulationState | null;
  onRefresh: () => void;
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  view: View;
  onViewChange: (v: View) => void;
}

export type { BottomTab, View };

export function DiagnoseWorkspace({ state, onRefresh, activeTab, onTabChange, view, onViewChange }: Props) {
  const activeDTCCount = state?.dtcs.filter((d) => d.status === "active").length ?? 0;

  return (
    <div className="space-y-4">
      {/* Sub-view toggle */}
      <div className="flex items-center gap-1 rounded-[var(--radius-md)] glass-well p-0.5 w-fit" role="tablist" aria-label="Diagnose views">
        {([
          { id: "dashboard" as const, label: "Dashboard", Icon: LayoutDashboard },
          { id: "control" as const, label: "Control Center", Icon: Server },
        ]).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => onViewChange(id)} role="tab" aria-selected={view === id}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-mono transition-colors duration-150",
              view === id
                ? "bg-[hsl(var(--surface-4))] text-[hsl(var(--accent))]"
                : "text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]",
            )}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {view === "control" && <ControlCenter />}

      {view === "dashboard" && !state && (
        <div className="glass-card flex items-center justify-center py-32">
          <div className="text-center space-y-4 w-72">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5 mx-auto" />
            <div className="skeleton h-3 w-3/5 mx-auto" />
            <div className="text-[hsl(var(--text-muted))] font-mono text-sm pt-2">
              Initializing ADAS platform…
            </div>
          </div>
        </div>
      )}

      {view === "dashboard" && state && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-4 animate-fade-up" style={{ minHeight: "480px" }}>
            <VehicleTelemetry state={state} />
            <SceneView state={state} />
            <AdasStatus state={state} />
          </div>

          <SpeedChart state={state} />

          {/* Bottom panels */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center border-b border-[hsl(var(--glass-border)/0.3)]" role="tablist" aria-label="Diagnostic panels">
              {BOTTOM_TABS.map((tab) => (
                <button key={tab} onClick={() => onTabChange(tab)} role="tab" aria-selected={activeTab === tab}
                  className={cn(
                    "px-4 py-2.5 text-xs font-mono transition-colors duration-150 border-b-2",
                    activeTab === tab
                      ? "text-[hsl(var(--accent))] border-[hsl(var(--accent))] bg-[hsl(var(--surface-3)/0.4)]"
                      : "text-[hsl(var(--text-muted))] border-transparent hover:text-[hsl(var(--text-secondary))]",
                  )}>
                  {tab}
                  {tab === "DTC Manager" && activeDTCCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[hsl(var(--danger)/0.18)] text-[hsl(var(--danger))]">
                      {activeDTCCount}
                    </span>
                  )}
                </button>
              ))}
              <div className="ml-auto pr-3 text-[10px] text-[hsl(var(--text-faint))] font-mono hidden sm:block">
                vcan0 · ISO 14229 · ROS2 Humble · CARLA 0.9.15
              </div>
            </div>
            <div className="p-4">
              {activeTab === "UDS Console" && <UDSConsole />}
              {activeTab === "DTC Manager" && <DtcManager dtcs={state.dtcs} onRefresh={onRefresh} />}
              {activeTab === "System Log" && <SystemLog log={state.systemLog} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
