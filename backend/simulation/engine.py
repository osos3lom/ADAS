"""
Simulation Tick Engine
-----------------------
Dispatches to the correct scenario on each clock tick and maintains
the speed-history ring buffer used by the frontend chart.
"""
from __future__ import annotations

import time

from simulation.state import SimulationState, SpeedSample, add_log
from simulation import scenarios


_SCENARIO_DURATIONS: dict[str, float] = {
    "normal_driving": 30.0,
    "highway_acc":    25.0,
    "aeb_trigger":    18.0,
    "lane_departure": 20.0,
    "sensor_fa…(truncated)