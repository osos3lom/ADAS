/**
 * Declarative part list for the ego vehicle's ADAS sensor suite.
 *
 * Each part is rendered as a small group inside <EgoVehicle/>. The same data
 * drives BOTH the exploded-view animation (base position + explodeDir * dist * factor)
 * AND the <Hotspots/> annotations, so a tag always tracks the part it points at.
 *
 * Pure data — no three.js — so the geometry layer and the HTML overlay layer can
 * both import it without coupling.
 */
import { PALETTE } from './scene-config';

export type Vec3 = [number, number, number];

export interface EgoPart {
  id: string;
  /** Short label shown on the hotspot pill. */
  label: string;
  /** One-line role, shown under the label. */
  role: string;
  /** Longer copy revealed when the hotspot is expanded. */
  description: string;
  /** Resting (collapsed) position on the car, local space. */
  base: Vec3;
  /** Unit-ish direction the part travels when exploded. */
  explodeDir: Vec3;
  /** Explode travel distance in metres. */
  dist: number;
  /** Small puck/box size [w,h,d] for the sensor mesh. */
  size: Vec3;
  /** Accent colour for the sensor + its hotspot. */
  accent: string;
  /** Which live ADAS signal this part reflects (drives hotspot status text). */
  signal: 'radar' | 'camera' | 'corner' | 'lidar' | 'ecu' | 'rear';
}

// Forward = -Z, up = +Y, right = +X. Body centre at origin.
export const EGO_PARTS: EgoPart[] = [
  {
    id: 'front-radar',
    label: 'Front Radar',
    role: 'Long-range 77 GHz',
    description:
      'Forward-looking radar behind the lower fascia. Primary range/closing-speed input for ACC and AEB target tracking.',
    base: [0, 0.42, -2.26],
    explodeDir: [0, -0.25, -1],
    dist: 1.7,
    size: [0.34, 0.16, 0.12],
    accent: PALETTE.cyan,
    signal: 'radar',
  },
  {
    id: 'windshield-camera',
    label: 'Forward Camera',
    role: 'Mono/stereo vision',
    description:
      'Windshield-mounted camera for lane detection (LDW/LKA), traffic-sign and object classification.',
    base: [0, 1.24, -0.42],
    explodeDir: [0, 0.85, 0.55],
    dist: 1.25,
    size: [0.2, 0.1, 0.18],
    accent: PALETTE.emerald,
    signal: 'camera',
  },
  {
    id: 'corner-radar-l',
    label: 'Corner Radar L',
    role: 'Blind-spot / cross-traffic',
    description:
      'Front-left corner radar covering adjacent lanes and intersections for blind-spot and cross-traffic alerts.',
    base: [-0.92, 0.46, -2.0],
    explodeDir: [-1, 0.1, -0.45],
    dist: 1.35,
    size: [0.18, 0.14, 0.12],
    accent: PALETTE.cyan,
    signal: 'corner',
  },
  {
    id: 'corner-radar-r',
    label: 'Corner Radar R',
    role: 'Blind-spot / cross-traffic',
    description:
      'Front-right corner radar covering adjacent lanes and intersections for blind-spot and cross-traffic alerts.',
    base: [0.92, 0.46, -2.0],
    explodeDir: [1, 0.1, -0.45],
    dist: 1.35,
    size: [0.18, 0.14, 0.12],
    accent: PALETTE.cyan,
    signal: 'corner',
  },
  {
    id: 'roof-lidar',
    label: 'Roof LiDAR',
    role: 'High-res 3D point cloud',
    description:
      'Roof-edge LiDAR providing a dense 3D point cloud for redundancy and precise free-space estimation.',
    base: [0, 1.5, 0.08],
    explodeDir: [0, 1, 0.1],
    dist: 1.9,
    size: [0.42, 0.12, 0.22],
    accent: PALETTE.emerald,
    signal: 'lidar',
  },
  {
    id: 'adas-ecu',
    label: 'ADAS ECU',
    role: 'Central compute / fusion',
    description:
      'The domain controller. Fuses radar + camera + LiDAR, runs the AEB/LDW/ACC state machines and exposes the UDS diagnostic interface.',
    base: [0, 0.58, 0.62],
    explodeDir: [0, 1, 0.25],
    dist: 2.3,
    size: [0.5, 0.16, 0.4],
    accent: PALETTE.amber,
    signal: 'ecu',
  },
  {
    id: 'rear-radar',
    label: 'Rear Radar',
    role: 'Rear cross-traffic',
    description:
      'Rear bumper radar for rear cross-traffic alert and lane-change assistance.',
    base: [0, 0.5, 2.22],
    explodeDir: [0, -0.1, 1],
    dist: 1.5,
    size: [0.3, 0.14, 0.12],
    accent: PALETTE.cyan,
    signal: 'rear',
  },
];
