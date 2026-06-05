"""
ADAS Scenario Implementations
------------------------------
Five scenarios that drive the simulation state machine.
Each tick_* function is called at ~20 Hz by the engine.

Ported 1-to-1 from the TypeScript scenarios in frontend/lib/scenarios.ts.
"""
from __future__ import annotations

import math

from simulation.state import SimulationState, add_log, set_dtc


# ── Math helpers ──────────────────────────────────────────────────────────────

def _clamp(v: float, lo: float, hi: float) -> fl…(truncated)