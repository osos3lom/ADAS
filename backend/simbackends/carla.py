"""
CARLA SimBackend — stub (filled in Phase 5B).
=============================================
Feature-flagged off by default. When implemented it will drive CARLA 0.9.15
via the carla-ros-bridge (Phase 1A) behind the same ``SimBackend`` contract,
so the API layer and Evaluator agent need no changes.

Enable (Phase 5B+) with::

    CARLA_BACKEND_ENABLED=1
    CARLA_HOST=localhost   CARLA_PORT=2000
"""
from __future__ import annotations

import os
from typing import Optional

from simulation.state import SimulationState

from simbackends.base import Action, SimBackend, StepResult

CARLA_BACKEND_ENABLED = os.environ.get("CARLA_BACKEND_ENABLED", "") == "1"
CARLA_HOST = os.environ.get("CARLA_HOST", "localhost")
CARLA_PORT = int(os.environ.get("CARLA_PORT", "2000"))


class CarlaBackend(SimBackend):
    """Placeholder: raises until Phase 5B wires the real CARLA client."""

    name = "carla"

    def __init__(self) -> None:
        if not CARLA_BACKEND_ENABLED:
            raise RuntimeError(
                "CARLA backend is feature-flagged off "
                "(set CARLA_BACKEND_ENABLED=1; implemented in Phase 5B)."
            )
        raise NotImplementedError("CarlaBackend arrives in Phase 5B.")

    @property
    def state(self) -> SimulationState:  # pragma: no cover - stub
        raise NotImplementedError

    def reset(self, scenario: str, seed: Optional[int] = None) -> SimulationState:  # pragma: no cover - stub
        raise NotImplementedError

    def step(self, action: Action = None) -> StepResult:  # pragma: no cover - stub
        raise NotImplementedError
