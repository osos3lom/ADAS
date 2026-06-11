"use client";

import { ExternalLink } from "lucide-react";
import { backendLink, type ServiceState, type ServiceStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  service: ServiceStatus;
}

const STATE_STYLES: Record<
  ServiceState,
  { dot: string; text: string; label: string }
> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-400", label: "OK" },
  online: { dot: "bg-emerald-500", text: "text-emerald-400", label: "ONLINE" },
  connected: { dot: "bg-emerald-500", text: "text-emerald-400", label: "CONNECTED" },
  offline: { dot: "bg-gray-600", text: "text-gray-500", label: "OFFLINE" },
  disabled: { dot: "bg-gray-700", text: "text-gray-500", label: "DISABLED" },
  unreachable: { dot: "bg-red-500", text: "text-red-400", label: "UNREACHABLE" },
  error: { dot: "bg-red-500", text: "text-red-400", label: "ERROR" },
};

export function ServiceCard({ service }: Props) {
  const style = STATE_STYLES[service.status] ?? STATE_STYLES.offline;
  const isLive = ["ok", "online", "connected"].includes(service.status);

  return (
    <div className="glass-card glass-card-hover p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0",
            style.dot,
            isLive && "animate-pulse",
          )}
        />
        <span className="font-mono text-sm text-gray-100 font-semibold">
          {service.name}
        </span>
        <span className={cn("ml-auto font-mono text-[10px] tracking-wider", style.text)}>
          {style.label}
        </span>
      </div>

      <p className="font-mono text-xs text-gray-500 leading-relaxed min-h-[1.5rem]">
        {service.detail}
      </p>

      {service.links && service.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {service.links.map((link) => (
            <a
              key={link.label}
              href={backendLink(link.path)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800/70 border border-gray-700 text-[11px] font-mono text-gray-300 hover:text-cyan-300 hover:border-cyan-700 transition-colors"
              title={link.doc ? `See ${link.doc}` : backendLink(link.path)}
            >
              {link.label}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
