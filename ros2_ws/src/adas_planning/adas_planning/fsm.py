"""Phase 2B — pure-Python ADAS state machine (no ROS imports → unit-testable).

Implements AEB / LDW / ACC using the exact Phase 0 thresholds from
``adas_planning.thresholds`` (mirrored from backend/simulation/scenarios.py).

Inputs come from perception (nearest in-lane obstacle range + closing speed),
odometry (ego speed) and the lane-offset estimator in planning_node.
Outputs: per-function status, ACC speed setpoint, and edge-triggered DTC
event keys understood by adas_ecu_bridge (``late_brake``, ``lane_departure``).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional

from . import thresholds as TH

AEB_STANDBY = "standby"
AEB_WARNING = "warning"
AEB_ACTIVE = "active"

LDW_INACTIVE = "inactive"
LDW_WARNING = "warning"


@dataclass
class FsmInput:
    """One planning tick worth of sensor-derived inputs."""

    ego_speed_mps: float
    dt: float
    obstacle_range_m: Optional[float] = None      # None → no in-lane obstacle
    closing_speed_mps: Optional[float] = None     # +ve → approaching
    lane_offset_m: float = 0.0


@dataclass
class FsmOutput:
    aeb_status: str
    ldw_status: str
    acc_setpoint_mps: float
    ttc_s: float                                  # math.inf when undefined
    commanded_accel_mps2: float                   # AEB_DECEL_MPS2 when AEB active
    brake_pct: float
    events: List[str] = field(default_factory=list)  # edge-triggered DTC keys


class AdasFsm:
    """AEB / LDW / ACC finite-state machine. Call :meth:`step` at ~20 Hz."""

    def __init__(self, cruise_setpoint_mps: float = TH.ACC_DEFAULT_SETPOINT_MPS):
        self.cruise_setpoint_mps = cruise_setpoint_mps
        self.aeb_status = AEB_STANDBY
        self.ldw_status = LDW_INACTIVE

    # ── helpers ────────────────────────────────────────────────────────────
    @staticmethod
    def compute_ttc(range_m: Optional[float], closing_mps: Optional[float]) -> float:
        if range_m is None or closing_mps is None:
            return math.inf
        if closing_mps < TH.ACC_MIN_CLOSING_SPEED_MPS:
            return math.inf
        return max(0.0, range_m) / closing_mps

    # ── main tick ──────────────────────────────────────────────────────────
    def step(self, inp: FsmInput) -> FsmOutput:
        events: List[str] = []

        # AEB — thresholds are the Phase 0 spec
        ttc = self.compute_ttc(inp.obstacle_range_m, inp.closing_speed_mps)
        prev_aeb = self.aeb_status
        if ttc <= TH.AEB_TTC_ACTIVE_S:
            self.aeb_status = AEB_ACTIVE
        elif TH.AEB_TTC_ACTIVE_S < ttc < TH.AEB_TTC_WARNING_S:
            self.aeb_status = AEB_WARNING
        else:
            self.aeb_status = AEB_STANDBY
        if self.aeb_status == AEB_ACTIVE and prev_aeb != AEB_ACTIVE:
            events.append("late_brake")

        # LDW — warn > 0.5 m, clear < 0.4 m (hysteresis from Phase 0)
        prev_ldw = self.ldw_status
        if self.ldw_status == LDW_INACTIVE:
            if inp.lane_offset_m > TH.LDW_OFFSET_WARN_M:
                self.ldw_status = LDW_WARNING
        else:
            if inp.lane_offset_m <= TH.LDW_OFFSET_CLEAR_M:
                self.ldw_status = LDW_INACTIVE
        if self.ldw_status == LDW_WARNING and prev_ldw != LDW_WARNING:
            events.append("lane_departure")

        # ACC — hold cruise unless inside the 80 m gap; never accelerate
        # toward a closing lead; AEB active forces setpoint 0.
        setpoint = self.cruise_setpoint_mps
        if self.aeb_status == AEB_ACTIVE:
            setpoint = 0.0
        elif (
            inp.obstacle_range_m is not None
            and inp.obstacle_range_m < TH.ACC_FOLLOW_DISTANCE_M
        ):
            lead_speed = inp.ego_speed_mps - (inp.closing_speed_mps or 0.0)
            gap_factor = max(0.0, inp.obstacle_range_m / TH.ACC_FOLLOW_DISTANCE_M)
            setpoint = min(
                self.cruise_setpoint_mps,
                max(0.0, lead_speed) + gap_factor * 2.0,
            )

        accel = TH.AEB_DECEL_MPS2 if self.aeb_status == AEB_ACTIVE else 0.0
        brake = TH.AEB_BRAKE_PCT if self.aeb_status == AEB_ACTIVE else 0.0

        return FsmOutput(
            aeb_status=self.aeb_status,
            ldw_status=self.ldw_status,
            acc_setpoint_mps=setpoint,
            ttc_s=ttc,
            commanded_accel_mps2=accel,
            brake_pct=brake,
            events=events,
        )
