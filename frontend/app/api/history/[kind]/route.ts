import { NextResponse } from "next/server";
import { backendEnabled, proxyJSON } from "@/lib/backend";

const VALID_KINDS = new Set(["dtcs", "logs", "uds", "runs", "telemetry"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json({ error: "Unknown history kind" }, { status: 404 });
  }

  const search = new URL(req.url).search; // forward ?limit=&offset=

  if (backendEnabled()) {
    return proxyJSON(`/api/history/${kind}${search}`);
  }

  // Offline: no backend means no persistence — return an empty, valid envelope.
  return NextResponse.json({
    success: true,
    data: [],
    meta: { count: 0, limit: 0, offset: 0, persisted: false },
  });
}
