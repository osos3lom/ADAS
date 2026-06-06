"""
ADAS Scenario Implementations
=============================
Five scenarios that drive the simulation state machine.  Each ``tick_*``
function is called once per frame by :func:`simulation.engine.tick_simulation`.

Ported 1-to-1 from the TypeScript scenarios in ``frontend/lib/scenarios.ts``.
The dispatcher itself lives in :mod:`simulation.engine`.
"""
from __future__ import annotations

import math

from simulation.state import SimulationState, add_dtc, add_log


# ── Math helpers ──────────────────────────────────────────────────────────────

def _clamp01(t: float) -> float:
    return max(0.0, min(1.0, t))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * _clamp01(t)


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def noise(t: float, freq: float = 1.0) -> float:
    return math.sin(t * freq * 2.31) * 0.5 + math.cos(t * freq * 0.97) * 0.5


# ── Scenario 1: Normal Driving ────────────────────────────────────────────────

def tick_normal(state: SimulationState, t: float, dt: float) -> None:
    v = state.vehicle
    a = state.adas

    v.speed = clamp(65 + noise(t, 0.12) * 8, 55, 78)
    v.steering_angle = noise(t, 0.3) * 4
    v.acceleration = noise(t, 0.5) * 0.8
    v.lane_offset = noise(t, 0.2) * 0.15
    v.throttle = 22 + noise(t, 0.4) * 8
    v.brake_pressure = 0

    a.aeb_status = "standby"
    a.ldw_status = "inactive"
    a.acc_status = "inactive"
    a.target_present = True
    a.target_distance = clamp(90 + noise(t, 0.1) * 20, 70, 115)
    a.target_speed = clamp(63 + noise(t, 0.15) * 6, 55, 75)
    rel = max(0.1, (v.speed - a.target_speed) / 3.6)
    a.ttc = a.target_distance / rel
    if a.ttc < 0 or not math.isfinite(a.ttc):
        a.ttc = 99
    a.ttc = clamp(a.ttc, 5, 30)


# ── Scenario 2: Highway ACC ───────────────────────────────────────────────────

def tick_highway(state: SimulationState, t: float, dt: float) -> None:
    v = state.vehicle
    a = state.adas

    if t < 8:
        target_base_speed = 120
    elif t < 14:
        target_base_speed = lerp(120, 90, (t - 8) / 6)
    elif t < 20:
        target_base_speed = 90
    else:
        target_base_speed = 110
    a.target_speed = clamp(target_base_speed + noise(t, 0.2) * 5, 80, 130)
    a.target_present = True

    # ACC maintains 80m following distance
    desired_dist = 80
    a.target_distance = clamp(desired_dist + noise(t, 0.15) * 12, 55, 110)
    speed_error = a.target_speed - v.speed
    v.speed = clamp(v.speed + speed_error * 0.3 * dt, 85, 135)
    v.steering_angle = noise(t, 0.2) * 2
    v.acceleration = (1 if speed_error > 0 else -0.5) * abs(speed_error) * 0.05
    v.throttle = clamp(35 + speed_error * 0.5, 5, 80)
    v.brake_pressure = min(30, abs(speed_error) * 1.5) if speed_error < -5 else 0
    v.lane_offset = noise(t, 0.15) * 0.1

    a.acc_status = "active"
    a.aeb_status = "standby"
    a.ldw_status = "inactive"
    rel = max(0.1, (v.speed - a.target_speed) / 3.6)
    a.ttc = a.target_distance / rel
    if a.ttc < 0 or not math.isfinite(a.ttc):
        a.ttc = 99
    a.ttc = clamp(a.ttc, 4, 30)

    if abs(t - 8.1) < 0.6:
        add_log(state, "info", "ADAS", "ACC: Target deceleration detected, adapting setpoint")
    if abs(t - 14.1) < 0.6:
        add_log(state, "info", "ADAS", "ACC: Target re-accelerating, increasing setpoint to 110 km/h")


# ── Scenario 3: AEB Trigger ───────────────────────────────────────────────────

def tick_aeb(state: SimulationState, t: float, dt: float) -> None:
    v = state.vehicle
    a = state.adas

    if t < 4:
        # Normal approach
        v.speed = 80 + noise(t, 0.3) * 3
        a.target_distance = clamp(90 - t * 2 + noise(t, 0.4) * 3, 60, 95)
        a.target_speed = 78
        a.aeb_status = "standby"
        v.brake_pressure = 0
        v.throttle = 30
    elif t < 7:
        # Target emergency brakes
        phase = (t - 4) / 3
        a.target_speed = clamp(lerp(78, 0, phase), 0, 80)
        rel_speed = (v.speed - a.target_speed) / 3.6
        a.target_distance = clamp(a.target_distance - rel_speed * dt, 5, 90)
        v.speed = 80 + noise(t, 0.3) * 2
        a.ttc = a.target_distance / max(0.1, rel_speed)
        v.throttle = 0

        if 1.5 < a.ttc < 3.0:
            a.aeb_status = "warning"
            if abs(t - 4.5) < 0.3:
                add_log(state, "warn", "ADAS",
                        f"AEB WARNING: TTC {a.ttc:.1f}s — forward collision imminent")
        if a.ttc <= 1.5:
            a.aeb_status = "active"
            v.brake_pressure = 100
            v.acceleration = -8.5
            if abs(t - 5.8) < 0.3:
                add_log(state, "error", "ADAS", "AEB ACTIVE: Emergency braking engaged")
                add_dtc(state, code="P1001", description="AEB Emergency Activation",
                        severity="warning", status="active", byte_code=[0x01, 0x10, 0x01])
    elif t < 12:
        # Ego decelerates to stop
        v.speed = clamp(v.speed - 8.5 * dt * (1 if t < 9 else 0.3), 0, 80)
        v.brake_pressure = 80 if v.speed > 1 else 0
        a.target_distance = clamp(a.target_distance + 0.5 * dt, 5, 20)
        a.aeb_status = "active" if v.speed > 1 else "standby"
        a.ttc = a.target_distance / max(0.1, v.speed / 3.6) if v.speed > 1 else 99
        if abs(t - 9.5) < 0.3:
            add_log(state, "info", "ADAS", "AEB: Ego vehicle stopped. Collision avoided.")
    else:
        # Recovery
        v.speed = clamp(v.speed + 2 * dt, 0, 40)
        a.target_distance = clamp(a.target_distance + 3 * dt, 15, 60)
        a.aeb_status = "standby"
        a.target_speed = 30
        v.brake_pressure = 0
        v.throttle = 15
        a.ttc = 15

    a.target_present = True
    a.acc_status = "inactive"
    a.ldw_status = "inactive"
    v.steering_angle = noise(t, 0.4) * 1.5
    v.lane_offset = noise(t, 0.3) * 0.1
    if not math.isfinite(a.ttc) or a.ttc < 0:
        a.ttc = 99


# ── Scenario 4: Lane Departure ────────────────────────────────────────────────

def tick_ldw(state: SimulationState, t: float, dt: float) -> None:
    v = state.vehicle
    a = state.adas

    v.speed = clamp(72 + noise(t, 0.2) * 5, 60, 80)
    a.target_present = False
    a.target_distance = 0
    a.ttc = 99

    if t < 3:
        v.steering_angle = noise(t, 0.3) * 3
        v.lane_offset = noise(t, 0.2) * 0.1
        a.ldw_status = "inactive"
        v.brake_pressure = 0
    elif t < 8:
        # Gradual drift right (distracted driver)
        drift = (t - 3) / 5
        v.steering_angle = lerp(0, 6, drift) + noise(t, 0.5) * 1
        v.lane_offset = lerp(0, 1.1, drift) + noise(t, 0.3) * 0.05

        if v.lane_offset > 0.5:
            a.ldw_status = "right"
            if abs(t - 4.2) < 0.3:
                add_log(state, "warn", "ADAS",
                        f"LDW RIGHT: Lane offset {v.lane_offset:.2f}m — correction required")
                add_dtc(state, code="P1003", description="LDW Right Lane Departure",
                        severity="warning", status="active", byte_code=[0x01, 0x20, 0x03])
        else:
            a.ldw_status = "inactive"
    elif t < 14:
        # LKA corrective steering
        correct = (t - 8) / 6
        v.lane_offset = lerp(1.1, 0.05, correct) + noise(t, 0.4) * 0.05
        v.steering_angle = lerp(6, -3, correct) + noise(t, 0.5) * 1
        a.ldw_status = "right" if v.lane_offset > 0.4 else "inactive"
        if abs(t - 8.2) < 0.3:
            add_log(state, "info", "ADAS", "LKA: Corrective steering applied — returning to lane center")
    else:
        v.lane_offset = noise(t, 0.2) * 0.1
        v.steering_angle = noise(t, 0.3) * 3
        a.ldw_status = "inactive"
        if abs(t - 14.2) < 0.3:
            add_log(state, "info", "ADAS", "LKA: Vehicle re-centered. Lane departure resolved.")

    a.aeb_status = "standby"
    a.acc_status = "inactive"
    v.throttle = 25
    v.brake_pressure = 0
    v.acceleration = noise(t, 0.5) * 0.5


# ── Scenario 5: Sensor Fault ──────────────────────────────────────────────────

def tick_fault(state: SimulationState, t: float, dt: float) -> None:
    v = state.vehicle
    a = state.adas

    v.speed = clamp(68 + noise(t, 0.2) * 6, 55, 78)
    v.steering_angle = noise(t, 0.3) * 4
    v.lane_offset = noise(t, 0.2) * 0.12
    v.throttle = 24
    v.brake_pressure = 0
    v.acceleration = noise(t, 0.4) * 0.6

    if t < 3:
        a.aeb_status = "standby"
        a.target_present = True
        a.target_distance = 95 + noise(t, 0.2) * 10
        a.target_speed = 66
        a.ttc = 20
    elif 3 <= t < 10:
        # Radar dropout
        a.aeb_status = "fault"
        a.target_present = False
        a.target_distance = 0
        a.ttc = 0

        if abs(t - 3.1) < 0.3:
            add_log(state, "error", "ADAS", "RADAR FAULT: No valid target data from forward radar")
            add_log(state, "error", "ROS2", "radar_node: scan timeout — republishing last known frame")
            add_dtc(state, code="B1001", description="Forward Radar Sensor Fault",
                    severity="critical", status="active", byte_code=[0x02, 0x10, 0x01])
            add_dtc(state, code="U0100", description="Lost Communication With ECM/PCM",
                    severity="warning", status="pending", byte_code=[0x03, 0x00, 0x00])
        if abs(t - 3.5) < 0.3:
            add_log(state, "warn", "ADAS",
                    "AEB degraded — sensor validation failed. Switching to camera-only mode.")
    else:
        # Radar recovery
        a.aeb_status = "standby"
        a.target_present = True
        a.target_distance = 90 + noise(t, 0.1) * 10
        a.target_speed = 66
        a.ttc = 18

        if abs(t - 10.1) < 0.3:
            add_log(state, "info", "ADAS",
                    "RADAR RECOVERED: Signal reacquired. AEB restored to full operation.")
            b1001 = next((d for d in state.dtcs if d.code == "B1001"), None)
            if b1001 is not None:
                b1001.status = "stored"

    a.ldw_status = "inactive"
    a.acc_status = "inactive"
