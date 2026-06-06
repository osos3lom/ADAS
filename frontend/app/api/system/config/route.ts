import { NextResponse } from "next/server";
import { backendEnabled, proxyJSON } from "@/lib/backend";

const OFFLINE_CONFIG = {
  config: { carla_host: "host.docker.internal", carla_port: "2000" },
  editable: ["carla_host", "carla_port"],
  persisted: false,
};

export async function GET() {
  if (backendEnabled()) return proxyJSON("/api/system/config");
  return NextResponse.json({ success: true, data: OFFLINE_CONFIG });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (backendEnabled()) {
    return proxyJSON("/api/system/config", { method: "PUT", body });
  }
  return NextResponse.json({
    success: true,
    data: {
      ...OFFLINE_CONFIG,
      config: { ...OFFLINE_CONFIG.config, ...body },
    },
  });
}
