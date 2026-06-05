import { NextResponse } from 'next/server';
import { getSimState } from '@/lib/simulation-state';
import { processUDS } from '@/lib/uds-processor';

export async function POST(req: Request) {
  const { command } = await req.json();
  if (!command || typeof command !== 'string') {
    return NextResponse.json({ error: 'Missing command' }, { status: 400 });
  }

  const state = getSimState();
  const result = processUDS(command, state);
  return NextResponse.json(result);
}
