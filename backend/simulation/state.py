"""
ADAS-ECU Simulation State
=========================
Pydantic v2 models that mirror ``frontend/types/index.ts`` exactly.

All models use ``alias_generator=to_camel`` so that ``model_dump(by_alias=True)``
produces the camelCase keys the TypeScript frontend already expects
(e.g. ``aebStatus``, ``laneOffset``, ``ecuSerialNumber``).

Timestamps are stored in milliseconds (like JS ``Date.now()``) so the
frontend's ``new Date(ts).toLocaleTimeString()`` renders correctly.

This module is the Python source of truth, ported 1-to-1 from
``frontend/lib/simulation-state.ts``.
"""
from __future__ import annotations

import math
import time
import uuid
from typing import List, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


def now_ms() -> int:
    """Current wall-clock time in milliseconds (mirrors JS ``Date.now()``)."""
    return int(time.time() * 1000)


def _gen_id() -> str:
    return uuid.uuid4().hex[:8]


class _CamelModel(BaseModel):
    """Base model: snake_case in Python, camelCase on the wire."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


# ── Sub-models ────────────────────────────────────────────────────────────────

class Position(_CamelModel):
    x: float = 0.0
    y: float = 0.0


class VehicleState(_CamelModel):
    speed: float = 0.0
    steering_angle: float = 0.0
    acceleration: float = 0.0
    heading: float = 0.0
    position: Position = Field(default_factory=Position)
    lane_offset: float = 0.0
    brake_pressure: float = 0.0
    throttle: float = 0.0


class ADASState(_CamelModel):
    aeb_status: Literal["standby", "warning", "active", "fault"] = "standby"
    ldw_status: Literal["inactive", "left", "right"] = "inactive"
    acc_status: Literal["inactive", "active", "override"] = "inactive"
    ttc: float = 0.0
    target_distance: float = 0.0
    target_speed: float = 0.0
    target_present: bool = False


class ECUState(_CamelModel):
    session: Literal["default", "extended", "programming"] = "default"
    security_unlocked: bool = False
    pending_seed: List[int] = Field(default_factory=list)
    aeb_sensitivity: int = 0x02
    adas_mode: int = 0x01
    ecu_serial_number: str = "LUCID-ADAS-2024-0042"


class DTC(_CamelModel):
    code: str
    description: str
    severity: Literal["info", "warning", "critical"]
    timestamp: int = 0
    status: Literal["active", "pending", "stored"] = "active"
    occurrence_count: int = 1
    byte_code: List[int] = Field(default_factory=list)


class LogEntry(_CamelModel):
    id: str
    timestamp: int
    level: Literal["info", "warn", "error"]
    source: Literal["CARLA", "ROS2", "ADAS", "UDS", "ECU", "SYSTEM"]
    message: str


class SpeedSample(_CamelModel):
    time: float
    speed: float
    ttc: float


class SimulationState(_CamelModel):
    vehicle: VehicleState = Field(default_factory=VehicleState)
    adas: ADASState = Field(default_factory=ADASState)
    ecu: ECUState = Field(default_factory=ECUState)
    dtcs: List[DTC] = Field(default_factory=list)
    scenario: str = "normal_driving"
    simulation_time: float = 0.0
    scenario_time: float = 0.0
    scenario_start_wall: int = 0
    last_tick: int = 0
    system_log: List[LogEntry] = Field(default_factory=list)
    scenario_progress: int = 0
    speed_history: List[SpeedSample] = Field(default_factory=list)
    running: bool = True


# ── Factory + helpers (ported from simulation-state.ts) ───────────────────────

def _make_log(level: str, source: str, message: str) -> LogEntry:
    return LogEntry(id=_gen_id(), timestamp=now_ms(), level=level, source=source, message=message)


def create_initial_state() -> SimulationState:
    """Build a fresh simulation state identical to ``createInitialState()`` in TS."""
    t0 = now_ms()
    return SimulationState(
        vehicle=VehicleState(
            speed=65,
            steering_angle=0,
            acceleration=0,
            heading=0,
            position=Position(x=0, y=0),
            lane_offset=0,
            brake_pressure=0,
            throttle=25,
        ),
        adas=ADASState(
            aeb_status="standby",
            ldw_status="inactive",
            acc_status="inactive",
            ttc=12.0,
            target_distance=100,
            target_speed=65,
            target_present=True,
        ),
        ecu=ECUState(
            session="default",
            security_unlocked=False,
            pending_seed=[],
            aeb_sensitivity=0x02,
            adas_mode=0x01,
            ecu_serial_number="LUCID-ADAS-2024-0042",
        ),
        dtcs=[],
        scenario="normal_driving",
        simulation_time=0,
        scenario_time=0,
        scenario_start_wall=t0,
        last_tick=t0,
        system_log=[
            _make_log("info", "SYSTEM", "ADAS-ECU Simulator initialized"),
            _make_log("info", "CARLA", "World loaded: Town04 Highway"),
            _make_log("info", "ROS2", "Nodes online: perception, planning, control, ecu_bridge"),
            _make_log("info", "ADAS", "AEB / LDW / ACC modules ACTIVE"),
            _make_log("info", "UDS", "ISO 14229 server listening on vcan0"),
        ],
        scenario_progress=0,
        speed_history=[
            SpeedSample(time=-30 + i, speed=60 + math.sin(i * 0.4) * 5, ttc=12)
            for i in range(30)
        ],
        running=True,
    )


# Module-level singleton (mirrors the TS ``global.__simState``).
_state: SimulationState | None = None


def get_sim_state() -> SimulationState:
    global _state
    if _state is None:
        _state = create_initial_state()
    return _state


def set_sim_state(state: SimulationState) -> None:
    global _state
    _state = state


def reset_sim_state() -> SimulationState:
    """Replace the singleton with a fresh initial state and return it."""
    set_sim_state(create_initial_state())
    return get_sim_state()


def add_log(state: SimulationState, level: str, source: str, message: str) -> None:
    state.system_log.insert(0, _make_log(level, source, message))
    if len(state.system_log) > 200:
        del state.system_log[200:]


def add_dtc(
    state: SimulationState,
    *,
    code: str,
    description: str,
    severity: str,
    status: str = "active",
    byte_code: List[int] | None = None,
) -> None:
    """Set or re-trigger a DTC (ported from ``addDTC`` in TS)."""
    byte_code = list(byte_code or [])
    existing = next((d for d in state.dtcs if d.code == code), None)
    if existing is not None:
        existing.status = "active"
        existing.occurrence_count += 1
        existing.timestamp = now_ms()
        add_log(state, "warn", "ADAS", f"DTC {code} occurrence #{existing.occurrence_count}")
    else:
        state.dtcs.append(
            DTC(
                code=code,
                description=description,
                severity=severity,
                status=status,
                byte_code=byte_code,
                timestamp=now_ms(),
                occurrence_count=1,
            )
        )
        add_log(
            state,
            "error" if severity == "critical" else "warn",
            "ECU",
            f"DTC SET: {code} — {description}",
        )
