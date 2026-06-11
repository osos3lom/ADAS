"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, Database, Cpu } from "lucide-react";
import {
  fetchHistory,
  fetchSystemConfig,
  fetchSystemStatus,
  updateSystemConfig,
  type HistoryEnvelope,
  type SystemConfig,
  type SystemStatus,
} from "@/lib/api";
import { ServiceCard } from "@/components/service-card";
import { cn } from "@/lib/utils";

interface DtcRow {
  code: string;
  description: string;
  severity: string;
  status: string;
  timestamp_ms: number;
}
interface UdsRow {
  request_hex: string;
  response_hex: string;
  service: string;
  positive: boolean;
  interpretation: string;
}

const STATUS_POLL_MS = 3000;

function fmtTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString();
}

export function ControlCenter() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [carlaHost, setCarlaHost] = useState("");
  const [carlaPort, setCarlaPort] = useState("");
  const [saving, setSaving] = useState(false);
  const [dtcs, setDtcs] = useState<HistoryEnvelope<DtcRow> | null>(null);
  const [uds, setUds] = useState<HistoryEnvelope<UdsRow> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await fetchSystemStatus());
    } catch {
      /* transient */
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const [d, u] = await Promise.all([
        fetchHistory<DtcRow>("dtcs", 25),
        fetchHistory<UdsRow>("uds", 25),
      ]);
      setDtcs(d);
      setUds(u);
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadHistory();
    fetchSystemConfig()
      .then((c) => {
        setConfig(c);
        setCarlaHost(c.config.carla_host ?? "");
        setCarlaPort(c.config.carla_port ?? "");
      })
      .catch(() => {});
    const id = setInterval(loadStatus, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [loadStatus, loadHistory]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      const next = await updateSystemConfig({
        carla_host: carlaHost,
        carla_port: carlaPort,
      });
      setConfig(next);
      await loadStatus();
    } catch {
      /* surfaced via status badge */
    } finally {
      setSaving(false);
    }
  }, [carlaHost, carlaPort, loadStatus]);

  const connected = status?.backendConnected ?? false;

  return (
    <div className="space-y-4">
      {/* Data source banner */}
      <div
        role="status"
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-lg)] border px-4 py-2.5 font-mono text-xs",
          connected
            ? "glass-tint-ok text-[hsl(var(--ok))]"
            : "glass-tint-warn text-[hsl(var(--warn))]",
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500",
          )}
        />
        {connected
          ? "Connected to FastAPI backend — live data + persistence active."
          : "Offline mock — set BACKEND_URL to connect the dashboard to the backend."}
      </div>

      {/* Service grid */}
      <section>
        <h2 className="flex items-center gap-2 mb-2 font-mono text-xs uppercase tracking-widest text-gray-400">
          <Cpu className="w-3.5 h-3.5" /> Services
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(status?.services ?? []).map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      </section>

      {/* Config editor */}
      <section className="glass-card p-4">
        <h2 className="flex items-center gap-2 mb-3 font-mono text-xs uppercase tracking-widest text-gray-400">
          Endpoint configuration
          {config && !config.persisted && (
            <span className="text-gray-600 normal-case tracking-normal">
              (not persisted — DB disabled)
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-gray-500">CARLA host</span>
            <input
              value={carlaHost}
              onChange={(e) => setCarlaHost(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-md px-2.5 py-1.5 font-mono text-xs text-gray-200 w-56 focus:border-cyan-700 outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-gray-500">CARLA port</span>
            <input
              value={carlaPort}
              onChange={(e) => setCarlaPort(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-md px-2.5 py-1.5 font-mono text-xs text-gray-200 w-24 focus:border-cyan-700 outline-none"
            />
          </label>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-600/20 border border-cyan-700 text-cyan-300 font-mono text-xs hover:bg-cyan-600/30 transition-colors disabled:opacity-50"
          >
            <Save className="w-3 h-3" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      {/* History tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HistoryTable
          title="DTC history"
          icon={<Database className="w-3.5 h-3.5" />}
          persisted={dtcs?.meta.persisted}
          onRefresh={loadHistory}
          empty="No DTCs recorded yet."
          rows={dtcs?.data ?? []}
          columns={["code", "severity", "status", "time"]}
          render={(r: DtcRow) => [
            r.code,
            r.severity,
            r.status,
            fmtTime(r.timestamp_ms),
          ]}
        />
        <HistoryTable
          title="UDS audit"
          icon={<Database className="w-3.5 h-3.5" />}
          persisted={uds?.meta.persisted}
          onRefresh={loadHistory}
          empty="No UDS exchanges recorded yet."
          rows={uds?.data ?? []}
          columns={["req", "resp", "service", "ok"]}
          render={(r: UdsRow) => [
            r.request_hex,
            r.response_hex,
            r.service,
            r.positive ? "✓" : "✗",
          ]}
        />
      </div>
    </div>
  );
}

interface HistoryTableProps<T> {
  title: string;
  icon: React.ReactNode;
  persisted?: boolean;
  onRefresh: () => void;
  empty: string;
  rows: T[];
  columns: string[];
  render: (row: T) => React.ReactNode[];
}

function HistoryTable<T>({
  title,
  icon,
  persisted,
  onRefresh,
  empty,
  rows,
  columns,
  render,
}: HistoryTableProps<T>) {
  return (
    <section className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800">
        <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-gray-400">
          {icon} {title}
        </span>
        {persisted === false && (
          <span className="font-mono text-[10px] text-gray-600">(not persisted)</span>
        )}
        <button
          onClick={onRefresh}
          className="ml-auto text-gray-500 hover:text-cyan-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-h-64 overflow-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center font-mono text-xs text-gray-600">
            {empty}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-gray-900">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-gray-600"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-gray-800/60">
                  {render(row).map((cell, j) => (
                    <td
                      key={j}
                      className="px-3 py-1.5 font-mono text-[11px] text-gray-300 whitespace-nowrap"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
