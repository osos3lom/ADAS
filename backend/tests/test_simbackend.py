"""
Phase 1B gate tests — SimBackend seam.

1. Golden snapshot: ``InternalBackend`` produces byte-identical output to the
   legacy engine path for all 5 scenarios across 100 ticks each.
2. Interface tests: registry, reset/step/events contract, CARLA stub flag.
"""
from __future__ import annotations

import itertools
import json

import pytest

import simbackends
import simbackends.internal as internal_mod
import simulation.engine as engine_mod
import simulation.state as state_mod
from simbackends import BuiltinFSMPolicy, InternalBackend, StepResult, get_backend
from simbackends.internal import make_isolated_backend
from simulation.engine import tick_simulation
from simulation.state import add_log, create_initial_state, now_ms

ALL_SCENARIOS = ["normal_driving", "highway_acc", "aeb_trigger", "lane_departure", "sensor_fault"]
TICKS = 100
TICK_MS = 100
EPOCH_MS = 1_750_000_000_000

_SCENARIO_LABELS = {
    "normal_driving": "Normal Driving",
    "highway_acc": "Highway ACC",
    "aeb_trigger": "AEB Trigger",
    "lane_departure": "Lane Departure",
    "sensor_fault": "Sensor Fault",
}


class DeterministicClock:
    """Frozen clock: every ``now_ms()`` in one tick sees the same timestamp."""

    def __init__(self, t0: int = EPOCH_MS) -> None:
        self.t = t0

    def now(self) -> int:
        return self.t

    def advance(self, ms: int) -> None:
        self.t += ms


def _pin_determinism(monkeypatch, clock: DeterministicClock) -> None:
    """Pin the wall clock and log-id generator everywhere they were imported."""
    counter = itertools.count()
    monkeypatch.setattr(state_mod, "now_ms", clock.now)
    monkeypatch.setattr(engine_mod, "now_ms", clock.now)
    monkeypatch.setattr(internal_mod, "now_ms", clock.now)
    monkeypatch.setattr(state_mod, "_gen_id", lambda: f"{next(counter):08x}")


def _legacy_scenario_switch(state, scenario: str) -> None:
    """The pre-Phase-1B POST /scenario logic, verbatim (the golden reference)."""
    state.scenario = scenario
    state.scenario_time = 0
    state.scenario_start_wall = state_mod.now_ms()
    state.scenario_progress = 0
    state.adas.aeb_status = "standby"
    state.adas.ldw_status = "inactive"
    state.adas.acc_status = "inactive"
    state.vehicle.brake_pressure = 0
    label = _SCENARIO_LABELS[scenario]
    add_log(state, "info", "SYSTEM", f"Scenario switched → {label}")
    add_log(state, "info", "CARLA", f"World: spawning scenario actors for {label}")


def _snapshot(state) -> str:
    return json.dumps(state.model_dump(by_alias=True), sort_keys=True)


# ── 1. Golden snapshot ────────────────────────────────────────────────────────

@pytest.mark.parametrize("scenario", ALL_SCENARIOS)
def test_internal_backend_matches_legacy_engine(monkeypatch, scenario):
    """internal.py is byte-identical to the legacy engine: 100 ticks, same world."""
    # Run A — legacy path: create → switch scenario → tick_simulation() x100
    clock = DeterministicClock()
    _pin_determinism(monkeypatch, clock)
    legacy_state = create_initial_state()
    _legacy_scenario_switch(legacy_state, scenario)
    for _ in range(TICKS):
        clock.advance(TICK_MS)
        tick_simulation(legacy_state)
    legacy_snapshot = _snapshot(legacy_state)

    # Run B — seam path: identical clock/id schedule through InternalBackend
    monkeypatch.undo()
    clock = DeterministicClock()
    _pin_determinism(monkeypatch, clock)
    backend = InternalBackend(state=create_initial_state())
    backend.reset(scenario)
    for _ in range(TICKS):
        clock.advance(TICK_MS)
        backend.step()
    seam_snapshot = _snapshot(backend.state)

    assert seam_snapshot == legacy_snapshot, (
        f"SimBackend output diverged from legacy engine for scenario {scenario!r}"
    )


# ── 2. Interface tests ────────────────────────────────────────────────────────

def test_registry_defaults_to_internal_singleton():
    b1 = get_backend()
    b2 = get_backend("internal")
    assert isinstance(b1, InternalBackend)
    assert b1 is b2  # process-wide singleton


def test_registry_rejects_unknown_backend():
    with pytest.raises(KeyError):
        get_backend("alpasim")  # registered in Phase 5B


def test_carla_stub_is_feature_flagged_off(monkeypatch):
    from simbackends.carla import CarlaBackend

    with pytest.raises(RuntimeError, match="feature-flagged off"):
        CarlaBackend()


def test_reset_returns_state_and_sets_scenario():
    backend = make_isolated_backend()
    state = backend.reset("aeb_trigger")
    assert state.scenario == "aeb_trigger"
    assert state.scenario_progress == 0
    assert state.adas.aeb_status == "standby"
    # Scenario-switch log entries written (legacy parity)
    assert "Scenario switched" in state.system_log[1].message


def test_step_returns_obs_state_events(monkeypatch):
    clock = DeterministicClock()
    _pin_determinism(monkeypatch, clock)
    backend = make_isolated_backend()
    backend.reset("normal_driving")

    clock.advance(TICK_MS)
    result = backend.step()

    assert isinstance(result, StepResult)
    assert result.state is backend.state
    assert result.obs["scenario"] == "normal_driving"
    assert {"vehicle", "adas", "simulationTime"} <= result.obs.keys()
    assert isinstance(result.events, list)


def test_step_surfaces_dtc_and_log_events(monkeypatch):
    """The sensor_fault radar dropout (t≈3.1s) must surface as step events.

    Note: aeb_trigger's P1001 can't be used here — its TTC window never opens
    (known issue 'AEB DTC timing window too narrow', fixed in Phase 2B).
    """
    clock = DeterministicClock()
    _pin_determinism(monkeypatch, clock)
    backend = make_isolated_backend()
    backend.reset("sensor_fault")

    dtc_events, log_events = [], []
    for _ in range(60):  # 6s of sim time — covers the t≈3.1s dropout
        clock.advance(TICK_MS)
        result = backend.step()
        dtc_events += [e for e in result.events if e["type"] == "dtc"]
        log_events += [e for e in result.events if e["type"] == "log"]

    assert any(e["code"] == "B1001" for e in dtc_events)
    assert any(e["code"] == "U0100" for e in dtc_events)
    assert any("RADAR FAULT" in e["message"] for e in log_events)


def test_builtin_fsm_policy_defers_to_scenario():
    policy = BuiltinFSMPolicy()
    assert policy.act({"vehicle": {}, "adas": {}}) is None


def test_isolated_backend_does_not_touch_singleton():
    from simulation.state import get_sim_state

    singleton_before = get_sim_state().simulation_time
    backend = make_isolated_backend()
    backend.reset("sensor_fault")
    backend.step()
    assert get_sim_state().simulation_time == singleton_before
    assert backend.state is not get_sim_state()
