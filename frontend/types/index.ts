export interface VehicleState {
  speed: number;
  steeringAngle: number;
  acceleration: number;
  heading: number;
  position: { x: number; y: number };
  laneOffset: number;
  brakePressure: number;
  throttle: number;
}

export interface ADASState {
  aebStatus: 'standby' | 'warning' | 'active' | 'fault';
  ldwStatus: 'inactive' | 'left' | 'right';
  accStatus: 'inactive' | 'active' | 'override';
  ttc: number;
  targetDistance: number;
  targetSpeed: number;
  targetPresent: boolean;
}

export interface ECUState {
  session: 'default' | 'extended' | 'programming';
  securityUnlocked: boolean;
  pendingSeed: number[];
  aebSensitivity: number;
  adasMode: number;
  ecuSerialNumber: string;
}

export interface DTC {
  code: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  status: 'active' | 'pending' | 'stored';
  occurrenceCount: number;
  byteCode: number[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  source: 'CARLA' | 'ROS2' | 'ADAS' | 'UDS' | 'ECU' | 'SYSTEM';
  message: string;
}

export interface SpeedSample {
  time: number;
  speed: number;
  ttc: number;
}

export interface SimulationState {
  vehicle: VehicleState;
  adas: ADASState;
  ecu: ECUState;
  dtcs: DTC[];
  scenario: string;
  simulationTime: number;
  scenarioTime: number;
  scenarioStartWall: number;
  lastTick: number;
  systemLog: LogEntry[];
  scenarioProgress: number;
  speedHistory: SpeedSample[];
  running: boolean;
}

export interface UDSCommandResult {
  requestHex: string;
  responseHex: string;
  serviceName: string;
  positive: boolean;
  interpretation: string;
  timestamp: number;
}
