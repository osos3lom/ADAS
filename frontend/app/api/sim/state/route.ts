import { NextResponse } from 'next/server';
import { getSimState } from '@/lib/simulation-state';
import { tickSimulation } from '@/lib/scenarios';
import { backendEnabled, proxyJSON } from '@/lib/backend';

export async function GET() {
  if (backendEnabled()) return proxyJSON('/api/sim/state');

  const state = getSimState();
  if (state.running) tickSimulation(state);
  return NextResponse.json(state);
}
