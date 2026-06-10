/** Shared scenario labels + colours (used by MiniMap, HUD and the 2D fallback). */

export const SCENARIO_LABELS: Record<string, string> = {
  normal_driving: 'Normal Driving',
  highway_acc: 'Highway ACC',
  aeb_trigger: 'AEB Trigger',
  lane_departure: 'Lane Departure',
  sensor_fault: 'Sensor Fault',
};

export function scenarioLabel(s: string): string {
  return SCENARIO_LABELS[s] ?? s;
}

/** Tailwind text-colour class per scenario. */
export function scenarioTextClass(s: string): string {
  const map: Record<string, string> = {
    normal_driving: 'text-emerald-400',
    highway_acc: 'text-blue-400',
    aeb_trigger: 'text-red-400',
    lane_departure: 'text-amber-400',
    sensor_fault: 'text-orange-400',
  };
  return map[s] ?? 'text-gray-400';
}

/** Raw hex per scenario (for SVG fills / 3D colours). */
export function scenarioHex(s: string): string {
  const map: Record<string, string> = {
    normal_driving: '#34d399',
    highway_acc: '#60a5fa',
    aeb_trigger: '#f87171',
    lane_departure: '#fbbf24',
    sensor_fault: '#fb923c',
  };
  return map[s] ?? '#94a3b8';
}
