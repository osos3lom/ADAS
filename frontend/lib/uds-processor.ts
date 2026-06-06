import type { SimulationState, UDSCommandResult } from '@/types';
import { addLog } from './simulation-state';

// Service handlers build everything except `requestHex` / `timestamp`;
// processUDS fills those in once it has parsed the request.
type PartialUDSResult = Omit<UDSCommandResult, 'timestamp' | 'requestHex'>;

// ── Service names ─────────────────────────────────────────────────────────────

const SERVICE_NAMES: Record<number, string> = {
  0x10: 'DiagnosticSessionControl',
  0x11: 'ECUReset',
  0x14: 'ClearDiagnosticInformation',
  0x19: 'ReadDTCInformation',
  0x22: 'ReadDataByIdentifier',
  0x27: 'SecurityAccess',
  0x2E: 'WriteDataByIdentifier',
  0x31: 'RoutineControl',
};

const NRC_NAMES: Record<number, string> = {
  0x10: 'generalReject',
  0x11: 'serviceNotSupported',
  0x12: 'subFunctionNotSupported',
  0x13: 'incorrectMessageLength',
  0x22: 'conditionsNotCorrect',
  0x24: 'requestSequenceError',
  0x31: 'requestOutOfRange',
  0x33: 'securityAccessDenied',
  0x35: 'invalidKey',
  0x36: 'exceededNumberOfAttempts',
};

const DID_NAMES: Record<number, string> = {
  0xF190: 'VehicleSpeed',
  0xF18C: 'ECUSerialNumber',
  0xF197: 'SystemSupplierECUSoftwareNumber',
  0x0200: 'ADAS_Mode',
  0x0201: 'AEB_Status',
  0x0202: 'LDW_Status',
  0x0203: 'AEB_Sensitivity',
  0x0204: 'TimeToCollision',
  0x0205: 'LaneOffset',
  0x0206: 'TargetDistance',
  0x0207: 'TargetSpeed',
  0x0210: 'ActiveDTCCount',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function negativeResponse(svcId: number, nrc: number, note: string): PartialUDSResult {
  return {
    responseHex: toHex([0x7F, svcId, nrc]),
    serviceName: SERVICE_NAMES[svcId] ?? `Service_0x${svcId.toString(16).toUpperCase()}`,
    positive: false,
    interpretation: `NRC 0x${nrc.toString(16).toUpperCase()} — ${NRC_NAMES[nrc] ?? 'unknown'}: ${note}`,
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function processUDS(hexInput: string, state: SimulationState): UDSCommandResult {
  const parts = hexInput.trim().split(/\s+/).filter(Boolean);
  const bytes = parts.map(p => parseInt(p, 16));

  if (bytes.some(b => isNaN(b) || b < 0 || b > 255)) {
    const res = negativeResponse(0x00, 0x13, 'Invalid hex input');
    return { ...res, requestHex: hexInput, timestamp: Date.now() };
  }

  const svcId = bytes[0];
  const reqHex = toHex(bytes);
  const svcName = SERVICE_NAMES[svcId] ?? `UnknownService_0x${svcId.toString(16).toUpperCase()}`;

  addLog(state, 'info', 'UDS', `REQ → ${reqHex}  [${svcName}]`);

  let result: PartialUDSResult;

  switch (svcId) {
    case 0x10: result = handleSession(bytes, state); break;
    case 0x11: result = handleReset(bytes, state); break;
    case 0x14: result = handleClearDTC(bytes, state); break;
    case 0x19: result = handleReadDTC(bytes, state); break;
    case 0x22: result = handleReadDID(bytes, state); break;
    case 0x27: result = handleSecurityAccess(bytes, state); break;
    case 0x2E: result = handleWriteDID(bytes, state); break;
    default:   result = negativeResponse(svcId, 0x11, 'Service not implemented');
  }

  addLog(state, result.positive ? 'info' : 'warn', 'UDS', `RES ← ${result.responseHex}  [${result.interpretation}]`);

  return { ...result, requestHex: reqHex, timestamp: Date.now() };
}

// ── 0x10 DiagnosticSessionControl ────────────────────────────────────────────

function handleSession(bytes: number[], state: SimulationState): PartialUDSResult {
  const sub = bytes[1];
  const SESSION_MAP: Record<number, SimulationState['ecu']['session']> = {
    0x01: 'default', 0x03: 'extended', 0x02: 'programming',
  };
  const SESSION_LABEL: Record<number, string> = {
    0x01: 'DefaultSession', 0x03: 'ExtendedDiagnosticSession', 0x02: 'ProgrammingSession',
  };

  if (!SESSION_MAP[sub]) {
    return negativeResponse(0x10, 0x12, 'SubFunction not supported');
  }
  if (sub === 0x02 && !state.ecu.securityUnlocked) {
    return negativeResponse(0x10, 0x22, 'SecurityAccess required for ProgrammingSession');
  }

  state.ecu.session = SESSION_MAP[sub];
  const responseBytes = [0x50, sub, 0x00, 0x19, 0x01, 0xF4];
  return {
    responseHex: toHex(responseBytes),
    serviceName: 'DiagnosticSessionControl',
    positive: true,
    interpretation: `Session changed to ${SESSION_LABEL[sub]} (P2=25ms, P2*=500ms)`,
  };
}

// ── 0x11 ECUReset ─────────────────────────────────────────────────────────────

function handleReset(bytes: number[], state: SimulationState): PartialUDSResult {
  const sub = bytes[1];
  const types: Record<number, string> = { 0x01: 'HardReset', 0x02: 'KeyOffOnReset', 0x03: 'SoftReset' };
  if (!types[sub]) return negativeResponse(0x11, 0x12, 'Unknown reset type');

  state.ecu.session = 'default';
  state.ecu.securityUnlocked = false;
  state.ecu.pendingSeed = [];
  addLog(state, 'warn', 'ECU', `ECU ${types[sub]} executed — session reset`);

  return {
    responseHex: toHex([0x51, sub]),
    serviceName: 'ECUReset',
    positive: true,
    interpretation: `${types[sub]} acknowledged. ECU rebooting...`,
  };
}

// ── 0x14 ClearDiagnosticInformation ──────────────────────────────────────────

function handleClearDTC(bytes: number[], state: SimulationState): PartialUDSResult {
  if (bytes.length < 4) return negativeResponse(0x14, 0x13, 'Need 3-byte groupOfDTC');
  const group = toHex(bytes.slice(1, 4));

  if (group === 'FF FF FF') {
    const count = state.dtcs.length;
    state.dtcs = [];
    addLog(state, 'info', 'ECU', `ClearDTC: All ${count} DTCs cleared`);
    return {
      responseHex: toHex([0x54]),
      serviceName: 'ClearDiagnosticInformation',
      positive: true,
      interpretation: `All DTCs cleared (${count} removed). Group: 0xFFFFFF`,
    };
  }

  return {
    responseHex: toHex([0x54]),
    serviceName: 'ClearDiagnosticInformation',
    positive: true,
    interpretation: `DTC group 0x${group.replace(/ /g, '')} cleared`,
  };
}

// ── 0x19 ReadDTCInformation ───────────────────────────────────────────────────

function handleReadDTC(bytes: number[], state: SimulationState): PartialUDSResult {
  const sub = bytes[1];

  if (sub === 0x02) {
    // reportDTCByStatusMask
    const mask = bytes[2] ?? 0xFF;
    const active = state.dtcs.filter(d => d.status === 'active' || d.status === 'pending');
    const responseBytes = [0x59, 0x02, mask];
    active.forEach(dtc => {
      responseBytes.push(...dtc.byteCode, 0x08 /* confirmedDTC */);
    });
    return {
      responseHex: toHex(responseBytes),
      serviceName: 'ReadDTCInformation',
      positive: true,
      interpretation: `${active.length} DTC(s) found: ${active.map(d => d.code).join(', ') || 'none'}`,
    };
  }

  if (sub === 0x0A) {
    // reportSupportedDTC
    const responseBytes = [0x59, 0x0A, 0xFF];
    state.dtcs.forEach(dtc => {
      responseBytes.push(...dtc.byteCode, dtc.status === 'active' ? 0x08 : 0x00);
    });
    return {
      responseHex: toHex(responseBytes),
      serviceName: 'ReadDTCInformation',
      positive: true,
      interpretation: `All stored DTCs (${state.dtcs.length}): ${state.dtcs.map(d => `${d.code}[${d.status}]`).join(', ') || 'none'}`,
    };
  }

  return negativeResponse(0x19, 0x12, 'SubFunction not supported (use 02 or 0A)');
}

// ── 0x22 ReadDataByIdentifier ─────────────────────────────────────────────────

function handleReadDID(bytes: number[], state: SimulationState): PartialUDSResult {
  if (bytes.length < 3) return negativeResponse(0x22, 0x13, 'Need 2-byte DID');
  const did = (bytes[1] << 8) | bytes[2];
  const didName = DID_NAMES[did] ?? `DID_0x${did.toString(16).toUpperCase().padStart(4, '0')}`;

  const responseBytes = [0x62, bytes[1], bytes[2]];
  let interp = '';

  const v = state.vehicle;
  const a = state.adas;
  const ecu = state.ecu;

  switch (did) {
    case 0xF190: {
      const raw = Math.round(v.speed * 100);
      responseBytes.push((raw >> 8) & 0xFF, raw & 0xFF);
      interp = `${didName} = ${v.speed.toFixed(1)} km/h (raw: 0x${raw.toString(16).toUpperCase()})`;
      break;
    }
    case 0xF18C: {
      const serial = ecu.ecuSerialNumber;
      for (let i = 0; i < serial.length && i < 20; i++) responseBytes.push(serial.charCodeAt(i));
      interp = `${didName} = "${serial}"`;
      break;
    }
    case 0xF197: {
      responseBytes.push(0x41, 0x44, 0x41, 0x53, 0x5F, 0x32, 0x2E, 0x34, 0x2E, 0x31);
      interp = `${didName} = "ADAS_2.4.1"`;
      break;
    }
    case 0x0200: {
      responseBytes.push(ecu.adasMode);
      interp = `${didName} = 0x${ecu.adasMode.toString(16).toUpperCase()} (${ecu.adasMode ? 'ACTIVE' : 'OFF'})`;
      break;
    }
    case 0x0201: {
      const aebMap: Record<string, number> = { standby: 0x01, warning: 0x02, active: 0x03, fault: 0xFF };
      const val = aebMap[a.aebStatus] ?? 0x00;
      responseBytes.push(val);
      interp = `${didName} = 0x${val.toString(16).toUpperCase()} (${a.aebStatus.toUpperCase()})`;
      break;
    }
    case 0x0202: {
      const ldwMap: Record<string, number> = { inactive: 0x00, left: 0x01, right: 0x02 };
      const val = ldwMap[a.ldwStatus] ?? 0x00;
      responseBytes.push(val);
      interp = `${didName} = 0x${val.toString(16).toUpperCase()} (${a.ldwStatus.toUpperCase()})`;
      break;
    }
    case 0x0203: {
      responseBytes.push(ecu.aebSensitivity);
      const sensMap: Record<number, string> = { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH' };
      interp = `${didName} = 0x${ecu.aebSensitivity.toString(16).toUpperCase()} (${sensMap[ecu.aebSensitivity] ?? 'UNKNOWN'})`;
      break;
    }
    case 0x0204: {
      const raw = Math.min(9999, Math.round(a.ttc * 100));
      responseBytes.push((raw >> 8) & 0xFF, raw & 0xFF);
      interp = `${didName} = ${a.ttc.toFixed(2)}s (raw: 0x${raw.toString(16).toUpperCase()})`;
      break;
    }
    case 0x0205: {
      const raw = Math.round(v.laneOffset * 100) & 0xFFFF;
      responseBytes.push((raw >> 8) & 0xFF, raw & 0xFF);
      interp = `${didName} = ${v.laneOffset.toFixed(2)}m (raw: 0x${raw.toString(16).toUpperCase()})`;
      break;
    }
    case 0x0206: {
      const raw = Math.round(a.targetDistance * 10);
      responseBytes.push((raw >> 8) & 0xFF, raw & 0xFF);
      interp = `${didName} = ${a.targetDistance.toFixed(1)}m (raw: 0x${raw.toString(16).toUpperCase()})`;
      break;
    }
    case 0x0207: {
      const raw = Math.round(a.targetSpeed * 10);
      responseBytes.push((raw >> 8) & 0xFF, raw & 0xFF);
      interp = `${didName} = ${a.targetSpeed.toFixed(1)} km/h`;
      break;
    }
    case 0x0210: {
      const active = state.dtcs.filter(d => d.status === 'active').length;
      responseBytes.push(active);
      interp = `${didName} = ${active} active DTC(s)`;
      break;
    }
    default:
      return negativeResponse(0x22, 0x31, `DID 0x${did.toString(16).toUpperCase().padStart(4,'0')} not supported`);
  }

  return {
    responseHex: toHex(responseBytes),
    serviceName: 'ReadDataByIdentifier',
    positive: true,
    interpretation: interp,
  };
}

// ── 0x27 SecurityAccess ───────────────────────────────────────────────────────

function handleSecurityAccess(bytes: number[], state: SimulationState): PartialUDSResult {
  const sub = bytes[1];

  if (sub === 0x01) {
    // Seed request
    if (state.ecu.session === 'default') {
      return negativeResponse(0x27, 0x22, 'Not in ExtendedDiagnosticSession');
    }
    const seed = Array.from({ length: 4 }, () => Math.floor(Math.random() * 256));
    state.ecu.pendingSeed = seed;
    return {
      responseHex: toHex([0x67, 0x01, ...seed]),
      serviceName: 'SecurityAccess',
      positive: true,
      interpretation: `Seed issued: 0x${seed.map(b=>b.toString(16).padStart(2,'0')).join('')}. Send key = seed XOR 0xCAFEBABE`,
    };
  }

  if (sub === 0x02) {
    // Key response
    if (state.ecu.pendingSeed.length === 0) {
      return negativeResponse(0x27, 0x24, 'No pending seed — request seed first (0x27 0x01)');
    }
    const clientKey = bytes.slice(2, 6);
    const xorKey = [0xCA, 0xFE, 0xBA, 0xBE];
    const expectedKey = state.ecu.pendingSeed.map((b, i) => b ^ xorKey[i]);
    const match = clientKey.length === 4 && clientKey.every((b, i) => b === expectedKey[i]);

    if (!match) {
      state.ecu.pendingSeed = [];
      addLog(state, 'warn', 'UDS', `SecurityAccess DENIED — invalid key (expected 0x${expectedKey.map(b=>b.toString(16).padStart(2,'0')).join('')})`);
      return negativeResponse(0x27, 0x35, `Invalid key. Expected: 0x${expectedKey.map(b=>b.toString(16).padStart(2,'0')).join('')}`);
    }

    state.ecu.securityUnlocked = true;
    state.ecu.pendingSeed = [];
    addLog(state, 'info', 'ECU', 'SecurityAccess GRANTED — Level 1 unlocked');
    return {
      responseHex: toHex([0x67, 0x02]),
      serviceName: 'SecurityAccess',
      positive: true,
      interpretation: 'Access GRANTED. Security level 1 unlocked. WriteDID now available.',
    };
  }

  return negativeResponse(0x27, 0x12, 'SubFunction must be 0x01 (seedReq) or 0x02 (keyResp)');
}

// ── 0x2E WriteDataByIdentifier ────────────────────────────────────────────────

function handleWriteDID(bytes: number[], state: SimulationState): PartialUDSResult {
  if (!state.ecu.securityUnlocked) {
    return negativeResponse(0x2E, 0x33, 'SecurityAccess required before WriteDataByIdentifier');
  }
  if (bytes.length < 4) return negativeResponse(0x2E, 0x13, 'Need DID (2 bytes) + data (1+ bytes)');

  const did = (bytes[1] << 8) | bytes[2];
  const data = bytes.slice(3);
  const didName = DID_NAMES[did] ?? `DID_0x${did.toString(16).toUpperCase().padStart(4,'0')}`;

  if (did === 0x0203) {
    // AEB Sensitivity
    const val = data[0];
    if (val < 1 || val > 3) {
      return negativeResponse(0x2E, 0x31, 'AEB_Sensitivity must be 0x01 (Low) / 0x02 (Med) / 0x03 (High)');
    }
    const sensMap: Record<number, string> = { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH' };
    state.ecu.aebSensitivity = val;
    addLog(state, 'info', 'ECU', `WriteDID: AEB_Sensitivity updated to ${sensMap[val]} (0x${val.toString(16).toUpperCase()})`);
    return {
      responseHex: toHex([0x6E, bytes[1], bytes[2]]),
      serviceName: 'WriteDataByIdentifier',
      positive: true,
      interpretation: `${didName} written: 0x${val.toString(16).toUpperCase()} (${sensMap[val]})`,
    };
  }

  if (did === 0x0200) {
    // ADAS Mode
    const val = data[0] & 0x01;
    state.ecu.adasMode = val;
    addLog(state, 'info', 'ECU', `WriteDID: ADAS_Mode set to ${val ? 'ACTIVE' : 'OFF'}`);
    return {
      responseHex: toHex([0x6E, bytes[1], bytes[2]]),
      serviceName: 'WriteDataByIdentifier',
      positive: true,
      interpretation: `${didName} written: 0x${val.toString(16).toUpperCase()} (ADAS ${val ? 'ACTIVE' : 'OFF'})`,
    };
  }

  return negativeResponse(0x2E, 0x31, `DID 0x${did.toString(16).toUpperCase().padStart(4,'0')} is read-only or not supported for write`);
}
