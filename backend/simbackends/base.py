"""
SimBackend / PolicyAdapter abstractions (Plan v3, Phase 1B — the keystone)
==========================================================================
Decouples the simulation engine from the rest of the stack so that CARLA
(Phase 5B) and AlpaSim backends can be swapped in later without touching the
API layer, observers, or frontend. Also creates the policy-in/observation-out
seam that all closed-loop work (Phases 5-7) depends on.

Contract::

    backend.reset(scenario, seed)      -> SimulationState
    backend.step(action)               -> StepResult(obs, state, events)

    policy.act(obs)                    -> action

`events` are the domain events produced during the step (new log entries and
new/retriggered DTCs), so callers no longer need to diff state themselves —
persistence observers still fire internally exactly as before.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from simulation.state import SimulationState


# ── Step I/O ──────────────────────────────────────────────────────────────────

#: Observation handed to a PolicyAdapter: a plain dict (JSON-safe) view of the
#: world. Internal backend exposes ego vehicle + ADAS perception; CARLA/AlpaSim
#: backends will expose sensor-derived observations behind the same key space.
Observation = Dict[str, Any]

#: Action produced by a PolicyAdapter. ``None`` means "let the scenario's
#: built-in FSM drive" (today's behavior). Later: throttle/brake/steer dicts.
Action = Optional[Dict[str, Any]]


@dataclass
class StepResult:
    """Everything a single simulation step produced."""

    obs: Observation
    state: SimulationState
    events: List[Dict[str, Any]] = field(default_factory=list)


# ── Backend ABC ───────────────────────────────────────────────────────────────

class SimBackend(ABC):
    """A simulation world that can be reset and stepped."""

    #: Registry / API name, e.g. ``"internal"``, ``"carla"``.
    name: str = "abstract"

    @abstractmethod
    def reset(self, scenario: str, seed: Optional[int] = None) -> SimulationState:
        """Start (or restart) ``scenario``; return the resulting state."""

    @abstractmethod
    def step(self, action: Action = None) -> StepResult:
        """Advance the world one tick, optionally applying ``action``."""

    @property
    @abstractmethod
    def state(self) -> SimulationState:
        """The current simulation state."""

    def close(self) -> None:  # pragma: no cover - default no-op
        """Release any resources (CARLA connections etc.)."""


# ── Policy ABC ────────────────────────────────────────────────────────────────

class PolicyAdapter(ABC):
    """Maps observations to actions (scenario FSM today; ONNX/VLA later)."""

    name: str = "abstract"

    @abstractmethod
    def act(self, obs: Observation) -> Action:
        """Return the action to apply for ``obs`` (``None`` = built-in FSM)."""


class BuiltinFSMPolicy(PolicyAdapter):
    """Phase-1 default: defer to the scenario's built-in finite-state machine.

    Returning ``None`` tells the backend to drive exactly as Phase 0 did —
    zero behavior change. Real learned policies replace this in Phase 6A.
    """

    name = "builtin_fsm"

    def act(self, obs: Observation) -> Action:  # noqa: ARG002 - seam, not logic
        return None
