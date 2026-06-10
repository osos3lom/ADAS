/**
 * Pure functions that map the domain `SimulationState` onto 3D scene values.
 *
 * Kept free of three.js and React so the mapping is unit-testable and the
 * render layer can call these from inside `useFrame` without allocating.
 */
import type { ADASState, SimulationState, VehicleState } from '@/types';
import { PALETTE, SCALE, VEHICLE, clamp } from './scene-config';
import type { EgoPart } from './ego-parts';

/** Lateral offset of the ego within its lane (world X, metres). */
export function egoLateral(laneOffset: number): number {
  return clamp(laneOffset, -SCALE.egoLateralClamp, SCALE.egoLateralClamp);
}

/** Depth-compressed Z for the lead/target car (negative = ahead). */
export function targetZ(targetDistance: number): number {
  const d = clamp(targetDistance, 2, SCALE.targetMaxZ / SCALE.targetDepth);
  return -d * SCALE.targetDepth;
}

/** Wheel angular velocity (rad/s) for a given road speed. */
export function wheelAngularVelocity(speedKmh: number): number {
  return speedKmh / 3.6 / VEHICLE.wheelRadius;
}

/** Ground/marking scroll speed in world units per second. */
export function roadSpeed(speedKmh: number): number {
  return speedKmh / 3.6;
}

/** Headlight emissive intensity — lifts slightly with speed. */
export function headlightIntensity(speedKmh: number): number {
  return 1.4 + clamp(speedKmh / 120, 0, 1) * 1.2;
}

/** Brake-light emissive (0..1) from brake pressure (0..100 bar). */
export function brakeEmissive(brakePressure: number): number {
  return clamp(brakePressure / 60, 0, 1);
}

/** Front-wheel steer angle in radians (input is degrees). */
export function steerYaw(steeringAngleDeg: number): number {
  return clamp(steeringAngleDeg, -32, 32) * (Math.PI / 180);
}

/** Subtle body roll (radians) for cornering feel. */
export function bodyRoll(steeringAngleDeg: number, speedKmh: number): number {
  const lateral = clamp(steeringAngleDeg / 32, -1, 1) * clamp(speedKmh / 100, 0, 1);
  return -lateral * 0.045;
}

export function aebColor(status: ADASState['aebStatus']): string {
  switch (status) {
    case 'warning':
      return PALETTE.amber;
    case 'active':
      return PALETTE.red;
    case 'fault':
      return PALETTE.orange;
    default:
      return PALETTE.cyan;
  }
}

/** AEB zone fill opacity by status. */
export function aebZoneOpacity(status: ADASState['aebStatus']): number {
  switch (status) {
    case 'warning':
      return 0.22;
    case 'active':
      return 0.4;
    case 'fault':
      return 0.18;
    default:
      return 0.06;
  }
}

/** Lane-edge colour — highlights the side a departure is happening on. */
export function laneEdgeColor(side: 'left' | 'right', ldw: ADASState['ldwStatus']): string {
  return ldw === side ? PALETTE.amber : PALETTE.laneEdge;
}

export function ttcColor(ttc: number): string {
  if (ttc < 2) return PALETTE.red;
  if (ttc < 4) return PALETTE.amber;
  return PALETTE.emerald;
}

export interface HotspotStatus {
  text: string;
  color: string;
  /** false = degraded/alarm — used to pulse the hotspot. */
  ok: boolean;
}

/** Live status line shown on a sensor's hotspot, derived from the feed. */
export function hotspotStatus(part: EgoPart, state: SimulationState): HotspotStatus {
  const a = state.adas;
  switch (part.signal) {
    case 'radar':
      if (!a.targetPresent) return { text: 'No target locked', color: PALETTE.emerald, ok: true };
      return {
        text: `Target ${a.targetDistance.toFixed(0)} m · TTC ${a.ttc < 99 ? a.ttc.toFixed(1) + ' s' : '—'}`,
        color: aebColor(a.aebStatus),
        ok: a.aebStatus === 'standby',
      };
    case 'camera':
      if (a.ldwStatus !== 'inactive')
        return { text: `Lane departure: ${a.ldwStatus}`, color: PALETTE.amber, ok: false };
      return { text: 'Lane centred', color: PALETTE.emerald, ok: true };
    case 'corner':
      return a.aebStatus === 'fault'
        ? { text: 'Degraded', color: PALETTE.orange, ok: false }
        : { text: 'Clear', color: PALETTE.cyan, ok: true };
    case 'lidar':
      return a.aebStatus === 'fault'
        ? { text: 'Sensor dropout', color: PALETTE.orange, ok: false }
        : { text: 'Point cloud nominal', color: PALETTE.emerald, ok: true };
    case 'ecu':
      return {
        text: `Session: ${state.ecu.session}${state.ecu.securityUnlocked ? ' · unlocked' : ''}`,
        color: PALETTE.amber,
        ok: true,
      };
    case 'rear':
      return { text: 'Rear clear', color: PALETTE.cyan, ok: true };
    default:
      return { text: '—', color: PALETTE.cyan, ok: true };
  }
}

/** Convenience snapshot used by the canvas to set damping targets once per data tick. */
export interface SceneTargets {
  egoX: number;
  speed: number;
  targetZ: number;
  targetPresent: boolean;
  steer: number;
  roll: number;
  brake: number;
  headlight: number;
  aeb: ADASState['aebStatus'];
  ldw: ADASState['ldwStatus'];
  ttc: number;
}

/** Mutates an existing target object in place (no per-tick allocation). */
export function writeTargets(out: SceneTargets, state: SimulationState): SceneTargets {
  const v: VehicleState = state.vehicle;
  out.egoX = egoLateral(v.laneOffset);
  out.speed = v.speed;
  out.targetZ = targetZ(state.adas.targetDistance);
  out.targetPresent = state.adas.targetPresent;
  out.steer = steerYaw(v.steeringAngle);
  out.roll = bodyRoll(v.steeringAngle, v.speed);
  out.brake = brakeEmissive(v.brakePressure);
  out.headlight = headlightIntensity(v.speed);
  out.aeb = state.adas.aebStatus;
  out.ldw = state.adas.ldwStatus;
  out.ttc = state.adas.ttc;
  return out;
}

export function deriveTargets(state: SimulationState): SceneTargets {
  return writeTargets(
    {
      egoX: 0,
      speed: 0,
      targetZ: 0,
      targetPresent: false,
      steer: 0,
      roll: 0,
      brake: 0,
      headlight: 1.4,
      aeb: 'standby',
      ldw: 'inactive',
      ttc: 99,
    },
    state,
  );
}
