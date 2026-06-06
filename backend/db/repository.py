"""
Repository — data access for the durable history store
======================================================
Writers (``record_*``, ``start_run``) are registered into :mod:`observers` at
startup and called from the live simulation. Readers (``list_*``) back the
``/api/history/*`` endpoints. Config helpers back ``/api/system/config``.

Every function is a safe no-op / empty result when the database is disabled, so
the simulation and API keep working without a database.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from sqlmodel import select

from db.engine import database_enabled, session_scope
from db.models import (
    AppConfig,
    DtcRecord,
    LogRecord,
    SimRun,
    TelemetrySample,
    UdsAudit,
)

_MAX_LIMIT = 500


def _bytes_to_hex(byte_code: object) -> str:
    if isinstance(byte_code, (list, tuple)):
        return " ".join(f"{int(b):02X}" for b in byte_code)
    return str(byte_code or "")


def _clamp(limit: int, offset: int) -> tuple[int, int]:
    return max(1, min(limit, _MAX_LIMIT)), max(0, offset)


# ── Writers (registered into observers) ───────────────────────────────────────

def record_log(timestamp_ms: int, level: str, source: str, message: str) -> None:
    if not database_enabled():
        return
    with session_scope() as s:
        s.add(LogRecord(timestamp_ms=timestamp_ms, level=level, source=source, message=message))


def record_dtc(payload: Dict[str, object]) -> None:
    if not database_enabled():
        return
    with session_scope() as s:
        s.add(
            DtcRecord(
                code=str(payload.get("code", "")),
                description=str(payload.get("description", "")),
                severity=str(payload.get("severity", "warning")),
                status=str(payload.get("status", "active")),
                occurrence_count=int(payload.get("occurrence_count", 1)),
                byte_code=_bytes_to_hex(payload.get("byte_code")),
                timestamp_ms=int(payload.get("timestamp_ms", 0)),
            )
        )


def record_uds(payload: Dict[str, object]) -> None:
    if not database_enabled():
        return
    with session_scope() as s:
        s.add(
            UdsAudit(
                request_hex=str(payload.get("request_hex", "")),
                response_hex=str(payload.get("response_hex", "")),
                service=str(payload.get("service", "")),
                positive=bool(payload.get("positive", True)),
                interpretation=str(payload.get("interpretation", "")),
                timestamp_ms=int(payload.get("timestamp_ms", 0)),
            )
        )


def start_run(scenario: str) -> None:
    if not database_enabled():
        return
    with session_scope() as s:
        s.add(SimRun(scenario=scenario))


# ── Readers (back the /api/history/* endpoints) ───────────────────────────────

def list_dtcs(limit: int = 100, offset: int = 0) -> List[dict]:
    return _list(DtcRecord, limit, offset)


def list_logs(limit: int = 100, offset: int = 0) -> List[dict]:
    return _list(LogRecord, limit, offset)


def list_uds(limit: int = 100, offset: int = 0) -> List[dict]:
    return _list(UdsAudit, limit, offset)


def list_runs(limit: int = 100, offset: int = 0) -> List[dict]:
    return _list(SimRun, limit, offset)


def list_telemetry(limit: int = 200, offset: int = 0) -> List[dict]:
    return _list(TelemetrySample, limit, offset)


def _list(model, limit: int, offset: int) -> List[dict]:
    if not database_enabled():
        return []
    limit, offset = _clamp(limit, offset)
    with session_scope() as s:
        rows = s.exec(
            select(model).order_by(model.id.desc()).offset(offset).limit(limit)
        ).all()
        return [r.model_dump() for r in rows]


# ── App config (admin-editable endpoint URLs) ─────────────────────────────────

def get_config(key: str) -> Optional[str]:
    if not database_enabled():
        return None
    with session_scope() as s:
        row = s.get(AppConfig, key)
        return row.value if row else None


def set_config(key: str, value: str) -> None:
    if not database_enabled():
        return
    from datetime import datetime, timezone

    with session_scope() as s:
        row = s.get(AppConfig, key)
        if row is None:
            s.add(AppConfig(key=key, value=value))
        else:
            row.value = value
            row.updated_at = datetime.now(timezone.utc)
            s.add(row)
