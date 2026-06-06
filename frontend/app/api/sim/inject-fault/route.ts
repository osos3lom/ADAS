import { NextResponse } from 'next/server';
import { getSimState, addDTC, addLog } from '@/lib/simulation-state';
import { backendEnabled, proxyJSON } from '@/lib/backend';

const FAULTS = [
  { code: 'P1001', description: 'AEB Emergency Activation',           severity: 'warning' as const, byteCode: [0x01,0x10,0x01] },
  { code: 'P1002', description: 'LDW Left Lane Departure',            severity: 'warning' as const, byteCode: [0x01,0x20,0x02] },
  { code: 'P1003', description: 'LDW Right Lane Departure',           severity: 'warning' as const, byteCode: [0x01,0x20,0x03] },
  { code: 'B1001', description: 'Forward Radar Sensor Fault',         severity: 'critical' as const, byteCode: [0x02,0x10,0x01] },
  { code: 'B1002', description: 'Front Camera Calibration Error',     severity: 'warning' as const, byteCode: [0x02,0x20,0x01] },
  { code: 'U0100', description: 'Lost Communication With ECM/PCM',    severity: 'critical' as const, byteCode: [0x03,0x00,0x00] },
  { code: 'U0416', description: 'Invalid Data Received From VSS ECU', severity: 'info' as const,    byteCode: [0x03,0x04,0x16] },
];

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: undefined }));

  if (backendEnabled()) return proxyJSON('/api/sim/inject-fault', { method: 'POST', body: { code } });

  const fault = FAULTS.find(f => f.code === code) ?? FAULTS[Math.floor(Math.random() * FAULTS.length)];

  const state = getSimState();
  addDTC(state, { ...fault, status: 'active' });
  addLog(state, 'error', 'SYSTEM', `Fault injected: ${fault.code} — ${fault.description}`);

  return NextResponse.json({ ok: true, dtc: fault });
}

export async function GET() {
  if (backendEnabled()) return proxyJSON('/api/sim/inject-fault');

  return NextResponse.json({ faults: FAULTS.map(f => ({ code: f.code, description: f.description, severity: f.severity })) });
}
