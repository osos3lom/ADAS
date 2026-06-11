"""
Internal SimBackend — wraps the existing pure-Python engine.
============================================================
ZERO behavior change: ``step()`` calls the same ``tick_simulation()`` the API
called directly before Phase 1B, on the same module-level state singleton, so
``GET /api/sim/state`` output is byte-identical to the legacy path (verified
by the golden snapshot test in ``tests/test_simbackend.py``).
"""
from __future__ import annotations

from typing import List, Optional

from simulation.engine import tick_simulation
from simulation.state import (
    SimulationState,
    get_sim_state,
    now_ms,
    set_sim_state,
)

from simbackends.base import Action, Observation, SimBackend, StepResult

_SCENARIO_LABELS = {
    "normal_driving": "Normal Driving",
    "highway_acc": "Highway ACC",
    "aeb_trigger": "AEB Trigger",
    "lane_departure": "Lane Departure",
    "sensor_fault": "Sensor Fault",
}


class InternalBackend(SimBackend):
    """The Phase-0 scripted-scenario engine behind the SimBackend seam."""

    name = "internal"

    def __init__(self, state: Optional[SimulationState] = None) -> None:
        # ``None`` → operate on the module-level singleton (live API mode).
        # Passing a state gives an isolated world (tests, evals, rollouts).
        self._own_state = state

    # ── SimBackend API ───────────────────────────────────────────────────────

    @property
    def state(self) -> SimulationState:
        return self._own_state if self._own_state is not None else get_sim_state()

    def reset(self, scenario: str, seed: Optional[int] = None) -> SimulationState:
        """Switch the active scenario (mirrors the legacy POST /scenario logic).

        ``seed`` is accepted for interface parity; the internal engine is
        deterministic given a clock, so the seed is currently unused.
        """
        # Local import: add_log lives in state.py; keep import-time deps light.
        from simulation.state import add_log

        state = self.state
        state.scenario = scenario
        state.scenario_time = 0
        state.scenario_start_wall = now_ms()
        state.scenario_progress = 0

        # Reset ADAS on scenario change (identical to legacy route logic)
        state.adas.aeb_status = "standby"
        state.adas.ldw_status = "inactive"
        state.adas.acc_status = "inactive"
        state.vehicle.brake_pressure = 0

        label = _SCENARIO_LABELS.get(scenario, scenario)
        add_log(state, "info", "SYSTEM", f"Scenario switched → {label}")
        add_log(state, "info", "CARLA", f"World: spawning scenario actors for {label}")
        return state

    def step(self, action: Action = None) -> StepResult:
        """Advance one tick. ``action`` is ignored by the scripted FSM (Phase 1);
        the parameter exists so learned policies plug in without API changes."""
        state = self.state

        # Snapshot counters to derive the events this step produced.
        n_logs = len(state.system_log)
        dtc_counts = {d.code: d.occurrence_count for d in state.dtcs}

        tick_simulation(state)  # the legacy engine, unchanged

        events = self._collect_events(state, n_logs, dtc_counts)
        return StepResult(obs=self._observe(state), state=state, events=events)

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _observe(state: SimulationState) -> Observation:
        """Policy-facing observation (ego + ADAS perception)."""
        return {
            "vehicle": state.vehicle.model_dump(by_alias=True),
            "adas": state.adas.model_dump(by_alias=True),
            "scenario": state.scenario,
            "simulationTime": state.simulation_time,
        }

    @staticmethod
    def _collect_events(
        state: SimulationState, n_logs_before: int, dtc_counts_before: dict
    ) -> List[dict]:
        events: List[dict] = []
        # New log entries are inserted at the front of system_log.
        new_logs = len(state.system_log) - n_logs_before
        for entry in state.system_log[:new_logs]:
            events.append({"type": "log", **entry.model_dump(by_alias=True)})
        for dtc in state.dtcs:
            before = dtc_counts_before.get(dtc.code)
            if before is None or dtc.occurrence_count > before:
                events.append({"type": "dtc", **dtc.model_dump(by_alias=True)})
        return events


def make_isolated_backend() -> InternalBackend:
    """A backend with its own fresh world, independent of the API singleton."""
    from simulation.state import create_initial_state

    return InternalBackend(state=create_initial_state())


__all__ = ["InternalBackend", "make_isolated_backend", "set_sim_state"]
