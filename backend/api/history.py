"""
History API (`/api/history/*`)
==============================
Read-only views over the durable PostgreSQL store. Returns a consistent
paginated envelope. When the database is disabled (no ``DATABASE_URL``), the
repository returns empty lists, so these endpoints stay valid (just empty).

    GET /api/history/dtcs        DTC set / re-occurrence history
    GET /api/history/logs        system-log history
    GET /api/history/uds         UDS request/response audit
    GET /api/history/runs        scenario session markers
    GET /api/history/telemetry   telemetry samples (Phase 2+)
"""
from __future__ import annotations

from typing import Callable, List

from fastapi import APIRouter, Query

from db import database_enabled
from db import repository

router = APIRouter()


def _page(reader: Callable[[int, int], List[dict]], limit: int, offset: int) -> dict:
    items = reader(limit, offset)
    return {
        "success": True,
        "data": items,
        "meta": {
            "count": len(items),
            "limit": limit,
            "offset": offset,
            "persisted": database_enabled(),
        },
    }


@router.get("/dtcs")
def history_dtcs(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    return _page(repository.list_dtcs, limit, offset)


@router.get("/logs")
def history_logs(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    return _page(repository.list_logs, limit, offset)


@router.get("/uds")
def history_uds(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    return _page(repository.list_uds, limit, offset)


@router.get("/runs")
def history_runs(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    return _page(repository.list_runs, limit, offset)


@router.get("/telemetry")
def history_telemetry(limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0)):
    return _page(repository.list_telemetry, limit, offset)
