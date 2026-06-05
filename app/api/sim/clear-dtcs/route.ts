import { NextResponse } from 'next/server';
import { getSimState, addLog } from '@/lib/simulation-state';

export async function POST() {
  const state = getSimState();
  const count = state.dtcs.length;
  state.dtcs = [];
  addLog(state, 'info', 'ECU', `Manual DTC clear: ${count} DTC(s) removed`);
  return NextResponse.json({ ok: true, cleared: count });
}
