"""Unit tests for the Phase 2B ADAS FSM (pure Python — no ROS required).

Run:  pytest ros2_ws/src/adas_planning/test/test_fsm.py
"""
import math

from adas_planning.fsm import AdasFsm, FsmInput
from adas_planning import thresholds as TH

DT = 0.05


def tick(fsm, **kw):
    return fsm.step(FsmInput(ego_speed_mps=kw.pop("speed", 15.0), dt=DT, **kw))


def test_no_obstacle_is_standby_cruise():
    fsm = AdasFsm()
    out = tick(fsm)
    assert out.aeb_status == "standby"
    assert out.ldw_status == "inactive"
    assert math.isinf(out.ttc_s)
    assert out.acc_setpoint_mps == TH.ACC_DEFAULT_SETPOINT_MPS


def test_aeb_warning_window():
    # TTC = 20 / 10 = 2.0 → 1.5 < 2.0 < 3.0 → warning
    fsm = AdasFsm()
    out = tick(fsm, obstacle_range_m=20.0, closing_speed_mps=10.0)
    assert out.aeb_status == "warning"
    assert out.events == []


def test_aeb_active_at_or_below_1_5s_and_emits_late_brake_once():
    fsm = AdasFsm()
    out = tick(fsm, obstacle_range_m=15.0, closing_speed_mps=10.0)  # TTC 1.5
    assert out.aeb_status == "active"
    assert out.brake_pct == TH.AEB_BRAKE_PCT
    assert out.commanded_accel_mps2 == TH.AEB_DECEL_MPS2
    assert out.acc_setpoint_mps == 0.0
    assert out.events == ["late_brake"]
    # still active next tick, but no duplicate event
    out2 = tick(fsm, obstacle_range_m=12.0, closing_speed_mps=10.0)
    assert out2.aeb_status == "active"
    assert out2.events == []


def test_aeb_recovers_to_standby():
    fsm = AdasFsm()
    tick(fsm, obstacle_range_m=10.0, closing_speed_mps=10.0)
    out = tick(fsm, obstacle_range_m=10.0, closing_speed_mps=0.0)  # not closing
    assert out.aeb_status == "standby"


def test_ttc_infinite_when_opening_gap():
    fsm = AdasFsm()
    out = tick(fsm, obstacle_range_m=10.0, closing_speed_mps=-3.0)
    assert math.isinf(out.ttc_s)
    assert out.aeb_status == "standby"


def test_ldw_hysteresis_and_single_event():
    fsm = AdasFsm()
    out = tick(fsm, lane_offset_m=0.55)
    assert out.ldw_status == "warning"
    assert out.events == ["lane_departure"]
    # between clear (0.4) and warn (0.5) → stays warning, no new event
    out = tick(fsm, lane_offset_m=0.45)
    assert out.ldw_status == "warning"
    assert out.events == []
    out = tick(fsm, lane_offset_m=0.39)
    assert out.ldw_status == "inactive"


def test_acc_reduces_setpoint_inside_follow_gap():
    fsm = AdasFsm(cruise_setpoint_mps=25.0)
    # lead 40 m ahead, ego 25 m/s, closing 10 → lead ~15 m/s
    out = tick(fsm, speed=25.0, obstacle_range_m=40.0, closing_speed_mps=10.0)
    assert out.acc_setpoint_mps < 25.0
    # beyond 80 m gap → cruise
    out = tick(fsm, speed=25.0, obstacle_range_m=120.0, closing_speed_mps=1.0)
    assert out.acc_setpoint_mps == 25.0
