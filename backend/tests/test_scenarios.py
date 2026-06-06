"""Scenario engine tests (deterministic gates + dispatcher)."""
from __future__ import annotations

from simulation import scenarios
from simulation.engine import tick_simulation
from simulation.state import create_initial_state, now_ms


def test_sensor_fault_raises_radar_dtc():
    """The sensor-fault scenario sets a radar fault and raises B1001 at t≈3.1s."""
    state = create_initial_state()
    scenarios.tick_fault(state, 3.1, 0.1)
    codes = {d.code for d in state.dtcs}
    assert "B1001" in codes
    assert "U0100" in codes
    assert state.adas.aeb_status == "fault"
    assert state.adas.target_present is False


def test_highway_engages_acc():
    state = create_initial_state()
    scenarios.tick_highway(state, 10.0, 0.1)
    assert state.adas.acc_status == "active"
    assert state.adas.aeb_status == "standby"


def test_normal_driving_is_nominal():
    state = create_initial_state()
    scenarios.tick_normal(state, 1.0, 0.1)
    assert state.adas.aeb_status == "standby"
    assert state.adas.ldw_status == "inactive"
    assert 55 <= state.vehicle.speed <= 78
    assert 5 <= state.adas.ttc <= 30


def test_aeb_recovery_branch_is_standby():
    state = create_initial_state()
    scenarios.tick_aeb(state, 13.0, 0.1)  # t >= 12 → recovery
    assert state.adas.aeb_status == "standby"


def test_ttc_never_nan_or_negative_across_scenarios():
    import math

    for scenario in ("normal_driving", "highway_acc", "aeb_trigger", "lane_departure", "sensor_fault"):
        state = create_initial_state()
        state.scenario = scenario
        for step in range(0, 250):  # ~25s at 0.1s steps
            t = step * 0.1
            {
                "normal_driving": scenarios.tick_normal,
                "highway_acc": scenarios.tick_highway,
                "aeb_trigger": scenarios.tick_aeb,
                "lane_departure": scenarios.tick_ldw,
                "sensor_fault": scenarios.tick_fault,
            }[scenario](state, t, 0.1)
            assert math.isfinite(state.adas.ttc)
            assert state.adas.ttc >= 0


def test_engine_tick_updates_progress():
    state = create_initial_state()
    state.scenario = "aeb_trigger"  # duration 18s
    state.scenario_start_wall = now_ms() - 9000  # 9s elapsed
    tick_simulation(state)
    # 9 / 18 ≈ 50%
    assert 40 <= state.scenario_progress <= 60
    assert state.last_tick > 0
