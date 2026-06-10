/**
 * Central tuning constants for the 3D Scene View.
 * Pure data only — no three.js imports — so this stays cheap to load and easy to test.
 */

// ---------------------------------------------------------------------------
// World scale & layout (1 world unit ≈ 1 metre)
// Forward driving direction is -Z. Up is +Y. Lateral is X (right = +X).
// ---------------------------------------------------------------------------
export const SCALE = {
  /** Lane width in metres (motorway standard ≈ 3.6 m). */
  laneWidth: 3.6,
  /** Lanes per carriageway. Ego occupies the centre lane. */
  laneCount: 3,
  /** Lead/target depth compression so a far car still reads on screen. */
  targetDepth: 0.62,
  /** Clamp for the lead car's Z so it never falls outside the fog wall. */
  targetMaxZ: 64,
  /** Lateral clamp for the ego (metres) — a little past the lane edge for LDW drama. */
  egoLateralClamp: 3.0,
} as const;

export const VEHICLE = {
  length: 4.6,
  width: 1.95,
  height: 1.4,
  wheelRadius: 0.34,
  wheelWidth: 0.26,
  /** Longitudinal wheel positions (Z) measured from body centre. */
  axleFront: -1.42,
  axleRear: 1.5,
  /** Lateral wheel position (X). */
  track: 0.86,
} as const;

// ---------------------------------------------------------------------------
// Highway markings
// ---------------------------------------------------------------------------
export const HIGHWAY = {
  dashLength: 3,
  dashGap: 9,
  /** Number of recycled dash segments rendered per lane line. */
  dashCount: 26,
  /** Total visible road length ahead/behind before recycling. */
  segmentSpan: 320,
  delineatorSpacing: 24,
} as const;

// ---------------------------------------------------------------------------
// Camera presets per mode
// ---------------------------------------------------------------------------
export const CAMERA = {
  drive: {
    position: [5.6, 2.9, 7.2] as [number, number, number],
    target: [0, 0.65, -2.4] as [number, number, number],
    minDistance: 4,
    maxDistance: 24,
    minPolar: 0.16,
    maxPolar: Math.PI / 2 - 0.04,
  },
  inspect: {
    position: [4.6, 2.2, 5.6] as [number, number, number],
    target: [0, 0.75, 0] as [number, number, number],
    minDistance: 3.2,
    maxDistance: 12,
    minPolar: 0.08,
    maxPolar: Math.PI / 2 - 0.02,
  },
} as const;

// ---------------------------------------------------------------------------
// Damping — decouples 60fps render from the 2Hz data feed.
// Larger = snappier. Used with THREE.MathUtils.damp (or maath/easing).
// ---------------------------------------------------------------------------
export const DAMP = {
  position: 5,
  lateral: 4,
  explode: 6,
  emissive: 9,
  steer: 7,
} as const;

// ---------------------------------------------------------------------------
// Palette — dusk-cinematic, Lucid-leaning cyan accents.
// ---------------------------------------------------------------------------
export const PALETTE = {
  bodyPaint: '#26344f', // deep cosmos-navy metallic
  bodyAccent: '#0e1726',
  glass: '#0b1722',
  rim: '#c3ccd6',
  tire: '#0d0f12',
  headlight: '#fff4d6',
  brake: '#ff2d2d',
  road: '#13151c',
  laneMark: '#d8dde6',
  laneEdge: '#e6c14e',
  delineator: '#ff8a3c',
  barrier: '#9aa3ad',
  // ADAS / status
  cyan: '#22d3ee',
  emerald: '#34d399',
  amber: '#f59e0b',
  red: '#ef4444',
  orange: '#f97316',
  // sun / sky
  sun: '#ffd9a0',
  skyTop: '#3a4a78',
  skyHaze: '#e8a36a',
} as const;

// ---------------------------------------------------------------------------
// Quality tiers — the performance budget. `auto` resolves to `balanced` and is
// stepped down by <PerformanceMonitor> when the GPU can't keep up.
// ---------------------------------------------------------------------------
export type QualityTier = 'low' | 'balanced' | 'high';
export type QualityMode = QualityTier | 'auto';

export interface QualitySettings {
  /** Upper clamp for device pixel ratio. */
  dprMax: number;
  /** Whether the directional (sun) light casts a real-time shadow map. */
  dirShadows: boolean;
  shadowMapSize: number;
  contactRes: number;
  ambientCars: number;
  /** Extra clear-coat lobe on the body paint (High only). */
  clearcoat: boolean;
  /** Body geometry roundedness segments. */
  bodySegments: number;
  envResolution: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: {
    dprMax: 1.0,
    dirShadows: false,
    shadowMapSize: 512,
    contactRes: 256,
    ambientCars: 0,
    clearcoat: false,
    bodySegments: 2,
    envResolution: 64,
  },
  balanced: {
    dprMax: 1.5,
    dirShadows: true,
    shadowMapSize: 1024,
    contactRes: 512,
    ambientCars: 6,
    clearcoat: false,
    bodySegments: 4,
    envResolution: 128,
  },
  high: {
    dprMax: 1.75,
    dirShadows: true,
    shadowMapSize: 2048,
    contactRes: 1024,
    ambientCars: 10,
    clearcoat: true,
    bodySegments: 6,
    envResolution: 256,
  },
};

/** Ordered worst→best, used to step the tier up/down under PerformanceMonitor. */
export const TIER_ORDER: QualityTier[] = ['low', 'balanced', 'high'];

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
