import type { SimulationState, LogEntry, DTC } from '@/types';

declare global {
  // eslint-disable-next-line no-var
  var __simState: SimulationState | undefined;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeLog(level: LogEntry['level'], source: LogEntry['source'], message: string): LogEntry {
  return { id: generateId(), timestamp: Date.now(), level, source, message };
}

function createInitialState(): SimulationState {
  return {
    vehicle: {
      speed: 65,
      steeringAngle: 0,
      acceleration: 0,
      heading: 0,
      position: { x: 0, y: 0 },
      laneOffset: 0,
      brakePressure: 0,
      throttle: 25,
    },
    adas: {
      aebStatus: 'standby',
      ldwStatus: 'inactive',
      accStatus: 'inactive',
      ttc: 12.0,
      targetDistance: 100,
      targetSpeed: 65,
      targetPresent: true,
    },
    ecu: {
      session: 'default',
      securityUnlocked: false,
      pendingSeed: [],
      aebSensitivity: 0x02,
      adasMode: 0x01,
      ecuSerialNumber: 'LUCID-ADAS-2024-0042',
    },
    dtcs: [],
    scenario: 'normal_driving',
    simulationTime: 0,
    scenarioTime: 0,
    scenarioStartWall: Date.now(),
    lastTick: Date.now(),
    systemLog: [
      makeLog('info', 'SYSTEM', 'ADAS-ECU Simulator initialized'),
      makeLog('info', 'CARLA', 'World loaded: Town04 Highway'),
      makeLog('info', 'ROS2', 'Nodes online: perception, planning, control, ecu_bridge'),
      makeLog('info', 'ADAS', 'AEB / LDW / ACC modules ACTIVE'),
      makeLog('info', 'UDS', 'ISO 14229 server listening on vcan0'),
    ],
    scenarioProgress: 0,
    speedHistory: Array.from({ length: 30 }, (_, i) => ({
      time: -30 + i,
      speed: 60 + Math.sin(i * 0.4) * 5,
      ttc: 12,
    })),
    running: true,
  };
}

export function getSimState(): SimulationState {
  if (!global.__simState) {
    global.__simState = createInitialState();
  }
  return global.__simState;
}

export function setSimState(s: SimulationState): void {
  global.__simState = s;
}

export function addLog(state: SimulationState, level: LogEntry['level'], source: LogEntry['source'], message: string) {
  state.systemLog.unshift(makeLog(level, source, message));
  if (state.systemLog.length > 200) state.systemLog.length = 200;
}

export function addDTC(state: SimulationState, dtc: Omit<DTC, 'timestamp' | 'occurrenceCount'>) {
  const existing = state.dtcs.find(d => d.code === dtc.code);
  if (existing) {
    existing.status = 'active';
    existing.occurrenceCount += 1;
    existing.timestamp = Date.now();
    addLog(state, 'warn', 'ADAS', `DTC ${dtc.code} occurrence #${existing.occurrenceCount}`);
  } else {
    state.dtcs.push({ ...dtc, timestamp: Date.now(), occurrenceCount: 1 });
    addLog(state, dtc.severity === 'critical' ? 'error' : 'warn', 'ECU', `DTC SET: ${dtc.code} — ${dtc.description}`);
  }
}
