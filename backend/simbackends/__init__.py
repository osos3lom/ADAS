"""SimBackend registry (Plan v3, Phase 1B).

``get_backend()`` returns the process-wide backend the API routes use.
Default is ``internal`` (the Phase-0 engine, zero behavior change); ``carla``
is a feature-flagged stub until Phase 5B.
"""
from __future__ import annotations

from typing import Dict, Optional

from simbackends.base import (
    Action,
    BuiltinFSMPolicy,
    Observation,
    PolicyAdapter,
    SimBackend,
    StepResult,
)
from simbackends.internal import InternalBackend

AVAILABLE_BACKENDS = ("internal", "carla")
DEFAULT_BACKEND = "internal"

_instances: Dict[str, SimBackend] = {}


def get_backend(name: Optional[str] = None) -> SimBackend:
    """Return (and lazily create) the named backend. Default: ``internal``."""
    name = name or DEFAULT_BACKEND
    if name not in AVAILABLE_BACKENDS:
        raise KeyError(f"Unknown sim backend: {name!r} (available: {AVAILABLE_BACKENDS})")
    if name not in _instances:
        if name == "internal":
            _instances[name] = InternalBackend()
        elif name == "carla":  # pragma: no cover - stub until Phase 5B
            from simbackends.carla import CarlaBackend

            _instances[name] = CarlaBackend()
    return _instances[name]


__all__ = [
    "Action",
    "AVAILABLE_BACKENDS",
    "BuiltinFSMPolicy",
    "DEFAULT_BACKEND",
    "InternalBackend",
    "Observation",
    "PolicyAdapter",
    "SimBackend",
    "StepResult",
    "get_backend",
]
