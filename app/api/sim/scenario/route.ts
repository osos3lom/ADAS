import { NextResponse } from 'next/server';
import { getSimState, addLog } from '@/lib/simulation-state';

const VALID = ['normal_driving','highway_acc','aeb_trigger','lane_departure','sensor_fault'];

export async function POST(req: Request) {
  const { scenario } = await req.json();
  if (!VALID.includes(scenario)) {
    return NextResponse.json({ error: 'Invalid scenario' }, { status: 400 });
  }

  const state = getSimState();
  state.scenario = scenario;
  state.scenarioTime = 0;
  state.scenarioStartWall = Date.now();
  state.scenarioProgress = 0;

  // Reset ADAS on scenario change
  state.adas.aebStatus = 'standby';
  state.adas.ldwStatus = 'inactive';
  state.adas.accStatus = 'inactive';
  state.vehicle.brakePressure = 0;

  const labels: Record<string, string> = {
    normal_driving: 'Normal Driving',
    highway_acc:    'Highway ACC',
    aeb_trigger:    'AEB Trigger',
    lane_departure: 'Lane Departure',
    sensor_fault:   'Sensor Fault',
  };

  addLog(state, 'info', 'SYSTEM', `Scenario switched → ${labels[scenario]}`);
  addLog(state, 'info', 'CARLA', `World: spawning scenario actors for ${labels[scenario]}`);

  return NextResponse.json({ ok: true, scenario });
}
