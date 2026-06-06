import { NextResponse } from "next/server";
import { backendEnabled, BACKEND_URL } from "@/lib/backend";
import type { ServiceStatus } from "@/lib/api";

// Status shown when there is no backend (dashboard running on the TS mock).
function offlineServices(): ServiceStatus[] {
  return [
    {
      id: "backend",
      name: "FastAPI Backend",
      status: "offline",
      detail: "Set BACKEND_URL to connect (running offline mock)",
    },
    { id: "database", name: "PostgreSQL", status: "disabled", detail: "No backend" },
    { id: "carla", name: "CARLA Server", status: "offline", detail: "No backend" },
    { id: "ros2", name: "ROS2 Bridge", status: "offline", detail: "No backend" },
    { id: "canbus", name: "CAN / UDS", status: "offline", detail: "No backend" },
  ];
}

export async function GET() {
  if (backendEnabled()) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/system/status`, {
        cache: "no-store",
      });
      const body = await res.json();
      return NextResponse.json({
        data: { services: body?.data?.services ?? [], backendConnected: res.ok },
      });
    } catch {
      return NextResponse.json({
        data: { services: offlineServices(), backendConnected: false },
      });
    }
  }
  return NextResponse.json({
    data: { services: offlineServices(), backendConnected: false },
  });
}
