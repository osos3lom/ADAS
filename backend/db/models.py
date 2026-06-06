"""
SQLModel tables — the durable history store
===========================================
These tables persist what the in-memory simulation produces so the dashboard's
Admin / Control Center can show history across restarts:

    dtc_record       every DTC set / re-occurrence
    log_record       system-log lines (CARLA/ROS2/ADAS/UDS/ECU/SYSTEM)
    uds_audit        every UDS request/response pair
    sim_run          a scenario session marker
    telemetry_sample time-series samples (speed/TTC/AEB) — for Phase 2+ charts
    app_config       editable endpoint config for the admin UI (key/value)

``timestamp_ms`` mirrors the JS ``Date.now()`` epoch-ms convention used across
the simulation; ``created_at`` is the server insert time (UTC).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import BigInteger
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# JS Date.now() epoch-ms (~1.7e12) overflows a 32-bit INTEGER on PostgreSQL,
# so every millisecond timestamp column must be BIGINT.
def _ms_field() -> object:
    return Field(default=0, sa_type=BigInteger)


class DtcRecord(SQLModel, table=True):
    __tablename__ = "dtc_record"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True)
    description: str = ""
    severity: str = "warning"
    status: str = "active"
    occurrence_count: int = 1
    byte_code: str = ""  # space-separated hex, e.g. "01 10 01"
    timestamp_ms: int = _ms_field()
    created_at: datetime = Field(default_factory=_utcnow)


class LogRecord(SQLModel, table=True):
    __tablename__ = "log_record"

    id: Optional[int] = Field(default=None, primary_key=True)
    level: str = "info"
    source: str = "SYSTEM"
    message: str = ""
    timestamp_ms: int = _ms_field()
    created_at: datetime = Field(default_factory=_utcnow)


class UdsAudit(SQLModel, table=True):
    __tablename__ = "uds_audit"

    id: Optional[int] = Field(default=None, primary_key=True)
    request_hex: str = ""
    response_hex: str = ""
    service: str = ""
    positive: bool = True
    interpretation: str = ""
    timestamp_ms: int = _ms_field()
    created_at: datetime = Field(default_factory=_utcnow)


class SimRun(SQLModel, table=True):
    __tablename__ = "sim_run"

    id: Optional[int] = Field(default=None, primary_key=True)
    scenario: str = Field(index=True)
    note: str = ""
    started_at: datetime = Field(default_factory=_utcnow)


class TelemetrySample(SQLModel, table=True):
    __tablename__ = "telemetry_sample"

    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: Optional[int] = Field(default=None, index=True)
    timestamp_ms: int = _ms_field()
    speed: float = 0.0
    ttc: float = 0.0
    aeb_status: str = "standby"
    created_at: datetime = Field(default_factory=_utcnow)


class AppConfig(SQLModel, table=True):
    __tablename__ = "app_config"

    key: str = Field(primary_key=True)
    value: str = ""
    updated_at: datetime = Field(default_factory=_utcnow)
