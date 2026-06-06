/**
 * Client-side types + fetch helpers for the Admin / Control Center.
 *
 * These call the Next.js proxy routes (`/api/system/*`, `/api/history/*`), which
 * forward to the FastAPI backend when `BACKEND_URL` is set, or return a graceful
 * offline payload otherwise.
 */

export type ServiceState =
  | "ok"
  | "online"
  | "connected"
  | "offline"
  | "disabled"
  | "unreachable"
  | "error";

export interface ServiceLink {
  label: string;
  path: string;
  doc?: string;
}

export interface ServiceStatus {
  id: string;
  name: string;
  status: ServiceState;
  detail: string;
  links?: ServiceLink[];
}

export interface SystemStatus {
  services: ServiceStatus[];
  /** false when the dashboard is running on the in-process TS mock (no backend). */
  backendConnected: boolean;
}

export interface SystemConfig {
  config: Record<string, string>;
  editable: string[];
  persisted: boolean;
}

export interface HistoryEnvelope<T = Record<string, unknown>> {
  success: boolean;
  data: T[];
  meta: { count: number; limit: number; offset: number; persisted: boolean };
}

/** Public backend origin used only for opening deep links (docs, health) in a new tab. */
export const PUBLIC_BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

/** Build a safe absolute backend link from a backend-relative path. */
export function backendLink(path: string): string {
  return `${PUBLIC_BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const body = await getJSON<{ data: SystemStatus }>("/api/system/status");
  return body.data;
}

export async function fetchSystemConfig(): Promise<SystemConfig> {
  const body = await getJSON<{ data: SystemConfig }>("/api/system/config");
  return body.data;
}

export async function updateSystemConfig(
  patch: Record<string, string>,
): Promise<SystemConfig> {
  const res = await fetch("/api/system/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`config update → ${res.status}`);
  const body = (await res.json()) as { data: SystemConfig };
  return body.data;
}

export type HistoryKind = "dtcs" | "logs" | "uds" | "runs" | "telemetry";

export async function fetchHistory<T = Record<string, unknown>>(
  kind: HistoryKind,
  limit = 50,
): Promise<HistoryEnvelope<T>> {
  return getJSON<HistoryEnvelope<T>>(`/api/history/${kind}?limit=${limit}`);
}
