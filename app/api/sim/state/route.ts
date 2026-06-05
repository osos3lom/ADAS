import { NextResponse } from 'next/server';
import { getSimState } from '@/lib/simulation-state';
import { tickSimulation } from '@/lib/scenarios';

export async function GET() {
  const state = getSimState();
  if (state.running) tickSimulation(state);
  return NextResponse.json(state);
}
