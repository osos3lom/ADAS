import type { SimulationState } from '@/types';
import { addLog, addDTC } from './simulation-state';

// ── Helpers ──────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.clamp01(t); }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function noise(t: number, freq = 1) { return Math.sin(t * freq * 2.31) * 0.5 + Math.cos(t * freq * 0.97) * 0.5; }

// Extend Math for convenience
declare global { interface Math { clamp01(t: number): number; } }
Math.clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// ── Tick dispatcher ───────────────────────────────────────────────────────────

export function tickSimulation(state: SimulationState): void {
  const now = Date.now();
  const dt = Math.min((now - state.lastTick) / 1000, 0.5);
  const wallElapsed = (now - state.scenarioStartWall) / 1000;

  state.lastTick = now;
  state.simulationTime += dt;
  state.scenarioTime = wallElapsed;

  switch (state.scenario) {
    case 'normal_driving':   tickNormal(state, wallElapsed, dt); break;
    case 'highway_acc':      tickHighway(state, wallElapsed, dt); break;
    case 'aeb_trigger':      tickAEB(state, wallElapsed, dt); break;
    case 'lane_departure':   tickLDW(state, wallElapsed, dt); break;
    case 'sensor_fault':     tickFault(state, wallElapsed, dt); break;
    default:                 tickNormal(state, wallElapsed, dt);
  }

  // Update speed history every ~1s
  const lastSample = state.speedHistory[state.speedHistory.length - 1];
  if (!lastSample || state.simulationTime - lastSample.time > 1) {
    state.speedHistory.push({
      time: Math.round(state.simulationTime),
      speed: Math.round(state.vehicle.speed * 10) / 10,
      ttc: Math.round(state.adas.ttc * 10) / 10,
    });
    if (state.speedHistory.length > 60) state.speedHistory.shift();
  }

  // Scenario progress
  const durations: Record<string, number> = {
    normal_driving: 30, highway_acc: 25, aeb_trigger: 18, lane_departure: 20, sensor_fault: 20,
  };
  const dur = durations[state.scenario] ?? 30;
  state.scenarioProgress = Math.min(100, Math.round((wallElapsed / dur) * 100));
  if (state.scenarioProgress >= 100) {
    state.scenarioProgress = 100;
  }
}

// ── Scenario 1: Normal Driving ────────────────────────────────────────────────

function tickNormal(state: SimulationState, t: number, dt: number) {
  const v = state.vehicle;
  const a = state.adas;

  v.speed = clamp(65 + noise(t, 0.12) * 8, 55, 78);
  v.steeringAngle = noise(t, 0.3) * 4;
  v.acceleration = noise(t, 0.5) * 0.8;
  v.laneOffset = noise(t, 0.2) * 0.15;
  v.throttle = 22 + noise(t, 0.4) * 8;
  v.brakePressure = 0;

  a.aebStatus = 'standby';
  a.ldwStatus = 'inactive';
  a.accStatus = 'inactive';
  a.targetPresent = true;
  a.targetDistance = clamp(90 + noise(t, 0.1) * 20, 70, 115);
  a.targetSpeed = clamp(63 + noise(t, 0.15) * 6, 55, 75);
  a.ttc = a.targetDistance / Math.max(0.1, (v.speed - a.targetSpeed) / 3.6);
  if (a.ttc < 0 || !isFinite(a.ttc)) a.ttc = 99;
  a.ttc = clamp(a.ttc, 5, 30);
}

// ── Scenario 2: Highway ACC ───────────────────────────────────────────────────

function tickHighway(state: SimulationState, t: number, dt: number) {
  const v = state.vehicle;
  const a = state.adas;

  const targetBaseSpeed = t < 8 ? 120 : t < 14 ? lerp(120, 90, (t - 8) / 6) : t < 20 ? 90 : 110;
  a.targetSpeed = clamp(targetBaseSpeed + noise(t, 0.2) * 5, 80, 130);
  a.targetPresent = true;

  // ACC maintains 80m following distance
  const desiredDist = 80;
  a.targetDistance = clamp(desiredDist + noise(t, 0.15) * 12, 55, 110);
  const speedError = a.targetSpeed - v.speed;
  v.speed = clamp(v.speed + speedError * 0.3 * dt, 85, 135);
  v.steeringAngle = noise(t, 0.2) * 2;
  v.acceleration = (speedError > 0 ? 1 : -0.5) * Math.abs(speedError) * 0.05;
  v.throttle = clamp(35 + speedError * 0.5, 5, 80);
  v.brakePressure = speedError < -5 ? Math.min(30, Math.abs(speedError) * 1.5) : 0;
  v.laneOffset = noise(t, 0.15) * 0.1;

  a.accStatus = 'active';
  a.aebStatus = 'standby';
  a.ldwStatus = 'inactive';
  a.ttc = a.targetDistance / Math.max(0.1, (v.speed - a.targetSpeed) / 3.6);
  if (a.ttc < 0 || !isFinite(a.ttc)) a.ttc = 99;
  a.ttc = clamp(a.ttc, 4, 30);

  if (Math.abs(t - 8.1) < 0.6) addLog(state, 'info', 'ADAS', 'ACC: Target deceleration detected, adapting setpoint');
  if (Math.abs(t - 14.1) < 0.6) addLog(state, 'info', 'ADAS', 'ACC: Target re-accelerating, increasing setpoint to 110 km/h');
}

// ── Scenario 3: AEB Trigger ───────────────────────────────────────────────────

function tickAEB(state: SimulationState, t: number, dt: number) {
  const v = state.vehicle;
  const a = state.adas;

  if (t < 4) {
    // Normal approach
    v.speed = 80 + noise(t, 0.3) * 3;
    a.targetDistance = clamp(90 - t * 2 + noise(t, 0.4) * 3, 60, 95);
    a.targetSpeed = 78;
    a.aebStatus = 'standby';
    v.brakePressure = 0;
    v.throttle = 30;
  } else if (t < 7) {
    // Target emergency brakes
    const phase = (t - 4) / 3;
    a.targetSpeed = clamp(lerp(78, 0, phase), 0, 80);
    const relSpeed = (v.speed - a.targetSpeed) / 3.6;
    a.targetDistance = clamp(a.targetDistance - relSpeed * dt, 5, 90);
    v.speed = 80 + noise(t, 0.3) * 2;
    a.ttc = a.targetDistance / Math.max(0.1, relSpeed);
    v.throttle = 0;

    if (a.ttc < 3.0 && a.ttc > 1.5) {
      a.aebStatus = 'warning';
      if (Math.abs(t - 4.5) < 0.3) {
        addLog(state, 'warn', 'ADAS', `AEB WARNING: TTC ${a.ttc.toFixed(1)}s — forward collision imminent`);
      }
    }
    if (a.ttc <= 1.5) {
      a.aebStatus = 'active';
      v.brakePressure = 100;
      v.acceleration = -8.5;
      if (Math.abs(t - 5.8) < 0.3) {
        addLog(state, 'error', 'ADAS', 'AEB ACTIVE: Emergency braking engaged');
        addDTC(state, { code: 'P1001', description: 'AEB Emergency Activation', severity: 'warning', status: 'active', byteCode: [0x01, 0x10, 0x01] });
      }
    }
  } else if (t < 12) {
    // Ego decelerates to stop
    v.speed = clamp(v.speed - 8.5 * dt * (t < 9 ? 1 : 0.3), 0, 80);
    v.brakePressure = v.speed > 1 ? 80 : 0;
    a.targetDistance = clamp(a.targetDistance + 0.5 * dt, 5, 20);
    a.aebStatus = v.speed > 1 ? 'active' : 'standby';
    a.ttc = v.speed > 1 ? a.targetDistance / Math.max(0.1, v.speed / 3.6) : 99;
    if (Math.abs(t - 9.5) < 0.3) addLog(state, 'info', 'ADAS', 'AEB: Ego vehicle stopped. Collision avoided.');
  } else {
    // Recovery
    v.speed = clamp(v.speed + 2 * dt, 0, 40);
    a.targetDistance = clamp(a.targetDistance + 3 * dt, 15, 60);
    a.aebStatus = 'standby';
    a.targetSpeed = 30;
    v.brakePressure = 0;
    v.throttle = 15;
    a.ttc = 15;
  }

  a.targetPresent = true;
  a.accStatus = 'inactive';
  a.ldwStatus = 'inactive';
  v.steeringAngle = noise(t, 0.4) * 1.5;
  v.laneOffset = noise(t, 0.3) * 0.1;
  if (!isFinite(a.ttc) || a.ttc < 0) a.ttc = 99;
}

// ── Scenario 4: Lane Departure ────────────────────────────────────────────────

function tickLDW(state: SimulationState, t: number, dt: number) {
  const v = state.vehicle;
  const a = state.adas;

  v.speed = clamp(72 + noise(t, 0.2) * 5, 60, 80);
  a.targetPresent = false;
  a.targetDistance = 0;
  a.ttc = 99;

  if (t < 3) {
    v.steeringAngle = noise(t, 0.3) * 3;
    v.laneOffset = noise(t, 0.2) * 0.1;
    a.ldwStatus = 'inactive';
    v.brakePressure = 0;
  } else if (t < 8) {
    // Gradual drift right (distracted driver)
    const drift = (t - 3) / 5;
    v.steeringAngle = lerp(0, 6, drift) + noise(t, 0.5) * 1;
    v.laneOffset = lerp(0, 1.1, drift) + noise(t, 0.3) * 0.05;

    if (v.laneOffset > 0.5) {
      a.ldwStatus = 'right';
      if (Math.abs(t - 4.2) < 0.3) {
        addLog(state, 'warn', 'ADAS', `LDW RIGHT: Lane offset ${v.laneOffset.toFixed(2)}m — correction required`);
        addDTC(state, { code: 'P1003', description: 'LDW Right Lane Departure', severity: 'warning', status: 'active', byteCode: [0x01, 0x20, 0x03] });
      }
    } else {
      a.ldwStatus = 'inactive';
    }
  } else if (t < 14) {
    // LKA corrective steering
    const correct = (t - 8) / 6;
    v.laneOffset = lerp(1.1, 0.05, correct) + noise(t, 0.4) * 0.05;
    v.steeringAngle = lerp(6, -3, correct) + noise(t, 0.5) * 1;
    a.ldwStatus = v.laneOffset > 0.4 ? 'right' : 'inactive';
    if (Math.abs(t - 8.2) < 0.3) addLog(state, 'info', 'ADAS', 'LKA: Corrective steering applied — returning to lane center');
  } else {
    v.laneOffset = noise(t, 0.2) * 0.1;
    v.steeringAngle = noise(t, 0.3) * 3;
    a.ldwStatus = 'inactive';
    if (Math.abs(t - 14.2) < 0.3) addLog(state, 'info', 'ADAS', 'LKA: Vehicle re-centered. Lane departure resolved.');
  }

  a.aebStatus = 'standby';
  a.accStatus = 'inactive';
  v.throttle = 25;
  v.brakePressure = 0;
  v.acceleration = noise(t, 0.5) * 0.5;
}

// ── Scenario 5: Sensor Fault ──────────────────────────────────────────────────

function tickFault(state: SimulationState, t: number, dt: number) {
  const v = state.vehicle;
  const a = state.adas;

  v.speed = clamp(68 + noise(t, 0.2) * 6, 55, 78);
  v.steeringAngle = noise(t, 0.3) * 4;
  v.laneOffset = noise(t, 0.2) * 0.12;
  v.throttle = 24;
  v.brakePressure = 0;
  v.acceleration = noise(t, 0.4) * 0.6;

  if (t < 3) {
    a.aebStatus = 'standby';
    a.targetPresent = true;
    a.targetDistance = 95 + noise(t, 0.2) * 10;
    a.targetSpeed = 66;
    a.ttc = 20;
  } else if (t >= 3 && t < 10) {
    // Radar dropout
    a.aebStatus = 'fault';
    a.targetPresent = false;
    a.targetDistance = 0;
    a.ttc = 0;

    if (Math.abs(t - 3.1) < 0.3) {
      addLog(state, 'error', 'ADAS', 'RADAR FAULT: No valid target data from forward radar');
      addLog(state, 'error', 'ROS2', 'radar_node: scan timeout — republishing last known frame');
      addDTC(state, { code: 'B1001', description: 'Forward Radar Sensor Fault', severity: 'critical', status: 'active', byteCode: [0x02, 0x10, 0x01] });
      addDTC(state, { code: 'U0100', description: 'Lost Communication With ECM/PCM', severity: 'warning', status: 'pending', byteCode: [0x03, 0x00, 0x00] });
    }
    if (Math.abs(t - 3.5) < 0.3) {
      addLog(state, 'warn', 'ADAS', 'AEB degraded — sensor validation failed. Switching to camera-only mode.');
    }
  } else {
    // Radar recovery
    a.aebStatus = 'standby';
    a.targetPresent = true;
    a.targetDistance = 90 + noise(t, 0.1) * 10;
    a.targetSpeed = 66;
    a.ttc = 18;

    if (Math.abs(t - 10.1) < 0.3) {
      addLog(state, 'info', 'ADAS', 'RADAR RECOVERED: Signal reacquired. AEB restored to full operation.');
      const b1001 = state.dtcs.find(d => d.code === 'B1001');
      if (b1001) b1001.status = 'stored';
    }
  }

  a.ldwStatus = 'inactive';
  a.accStatus = 'inactive';
}
