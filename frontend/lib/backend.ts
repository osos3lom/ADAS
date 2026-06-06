/**
 * Backend proxy helper.
 *
 * When `BACKEND_URL` is set (e.g. http://backend:8000 in docker-compose, or
 * http://localhost:8000 locally), the Next.js `/api/sim/*` routes forward to the
 * Python FastAPI backend — which is the source of truth for the simulation +
 * UDS logic. When it is NOT set, the routes fall back to the in-process
 * TypeScript mock in `lib/` so the dashboard still runs fully standalone
 * ("offline / demo mode").
 */
import { NextResponse } from 'next/server';

export const BACKEND_URL = (process.env.BACKEND_URL ?? '').replace(/\/+$/, '');

export function backendEnabled(): boolean {
  return BACKEND_URL.length > 0;
}

/** Forward a JSON request to the backend and pass the response straight through. */
export async function proxyJSON(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<NextResponse> {
  const method = init?.method ?? 'GET';
  const hasBody = init?.body !== undefined;

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Backend unreachable', detail: String(err), backendUrl: BACKEND_URL },
      { status: 502 },
    );
  }
}
