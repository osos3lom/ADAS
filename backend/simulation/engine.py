"""
Simulation Tick Engine
======================
Dispatches to the correct scenario on each clock tick and maintains the
speed-history ring buffer + scenario progress used by the frontend chart.

Ported from the ``tickSimulation`` dispatcher in ``frontend/lib/scenarios.ts``.
"""
from __future__ import annotations

from simulation import scenarios
from simulation.state import SimulationState, SpeedSample, now_ms

_SCENARIO_DURATIONS: dict[str, float] = {
    "normal_driving": 30.0,
    "highway_acc": 25.0,
    "aeb_trigger": 18.0,
    "lane_departure": 20.0,
    "sensor_fault": 20.0,
}

_DISPATCH = {
    "normal_driving": scenarios.tick_normal,
    "highway_acc": scenarios.tick_highway,
    "aeb_trigger": scenarios.tick_aeb,
    "lane_departure": scenarios.tick_ldw,
    "sensor_fault": scenarios.tick_fault,
}


def tick_simulation(state: SimulationState) -> None:
    """Advance the simulation by one frame (mirrors ``tickSimulation`` in TS)."""
    now = now_ms()
    dt = min((now - state.last_tick) / 1000.0, 0.5)
    wall_elapsed = (now - state.scenario_start_wall) / 1000.0

    state.last_tick = now
    state.simulation_time += dt
    state.scenario_time = wall_elapsed

    handler = _DISPATCH.get(state.scenario, scenarios.tick_normal)
    handler(state, wall_elapsed, dt)

    # Update speed history every ~1s
    last_sample = state.speed_history[-1] if state.speed_history else None
    if last_sample is None or state.simulation_time - last_sample.time > 1:
        state.speed_history.append(
            SpeedSample(
                time=round(state.simulation_time),
                speed=round(state.vehicle.speed * 10) / 10,
                ttc=round(state.adas.ttc * 10) / 10,
            )
        )
        if len(state.speed_history) > 60:
            state.speed_history.pop(0)

    # Scenario progress
    dur = _SCENARIO_DURATIONS.get(state.scenario, 30.0)
    state.scenario_progress = min(100, round((wall_elapsed / dur) * 100))
