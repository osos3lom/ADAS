"""
System API (`/api/system/*`)
============================
Backs the dashboard's Admin / Control Center.

    GET /api/system/status   per-service health (backend, database, CARLA, ROS2, CAN)
    GET /api/system/config   effective endpoint config (env < DB < in-memory overlay)
    PUT /api/system/config   update editable endpoints (e.g. CARLA host/port), persisted

The CARLA status is a live TCP probe of ``carla_host:carla_port`` (the CARLA RPC
port). Links are returned as backend-relative paths; the frontend prefixes them
with the public backend base when opening them in a new tab.
"""
from __future__ import annotations

import os
import socket
from typing import Dict, List

from fastapi import APIRouter
from pydantic import BaseModel

from canbus.interface import is_available as can_available
from db import database_configured, database_enabled, db_ping
from db import repository
from ros2.bridge import is_available as ros2_available

router = APIRouter()

_PROBE_TIMEOUT_S = 0.5

# Editable config: in-memory overlay > DB (app_config) > env default.
_DEFAULTS: Dict[str, str] = {
    "carla_host": os.environ.get("CARLA_HOST", "host.docker.internal"),
    "carla_port": os.environ.get("CARLA_PORT", "2000"),
}
_EDITABLE = {"carla_host", "carla_port"}
_overrides: Dict[str, str] = {}


def _effective(key: str) -> str:
    if key in _overrides:
        return _overrides[key]
    db_val = repository.get_config(key)
    if db_val is not None:
        return db_val
    return _DEFAULTS.get(key, "")


def _effective_config() -> Dict[str, str]:
    return {key: _effective(key) for key in _DEFAULTS}


def _tcp_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=_PROBE_TIMEOUT_S):
            return True
    except OSError:
        return False


# ── GET /status ───────────────────────────────────────────────────────────────

@router.get("/status")
def system_status():
    from main import app  # local import avoids a circular import at module load

    carla_host = _effective("carla_host")
    try:
        carla_port = int(_effective("carla_port"))
    except ValueError:
        carla_port = 2000

    if not database_configured():
        db_status, db_detail = "disabled", "No DATABASE_URL configured (in-memory only)"
    elif db_ping():
        db_status, db_detail = "connected", "PostgreSQL reachable"
    else:
        db_status, db_detail = "unreachable", "DATABASE_URL set but ping failed"

    carla_online = _tcp_open(carla_host, carla_port)

    services: List[dict] = [
        {
            "id": "backend",
            "name": "FastAPI Backend",
            "status": "ok",
            "detail": f"v{app.version}",
            "links": [
                {"label": "API Docs", "path": "/docs"},
                {"label": "ReDoc", "path": "/redoc"},
                {"label": "Health", "path": "/health"},
            ],
        },
        {
            "id": "database",
            "name": "PostgreSQL",
            "status": db_status,
            "detail": db_detail,
            "links": [{"label": "DTC history", "path": "/api/history/dtcs"}],
        },
        {
            "id": "carla",
            "name": "CARLA Server",
            "status": "online" if carla_online else "offline",
            "detail": f"{carla_host}:{carla_port}",
            "links": [{"label": "Setup guide", "path": "/", "doc": "docs/PHASE1_SETUP.md"}],
        },
        {
            "id": "ros2",
            "name": "ROS2 Bridge",
            "status": "online" if ros2_available() else "offline",
            "detail": "rclpy bridge — Phase 1+",
            "links": [{"label": "Nodes", "path": "/api/sim/ros2/nodes"}],
        },
        {
            "id": "canbus",
            "name": "CAN / UDS",
            "status": "online" if can_available() else "offline",
            "detail": "ISO 14229 over ISO-TP — Phase 3",
            "links": [{"label": "UDS audit", "path": "/api/history/uds"}],
        },
    ]
    return {"success": True, "data": {"services": services}}


# ── /config ───────────────────────────────────────────────────────────────────

class ConfigUpdate(BaseModel):
    carla_host: str | None = None
    carla_port: str | None = None


@router.get("/config")
def get_system_config():
    return {
        "success": True,
        "data": {
            "config": _effective_config(),
            "editable": sorted(_EDITABLE),
            "persisted": database_enabled(),
        },
    }


@router.put("/config")
def put_system_config(update: ConfigUpdate):
    changed: Dict[str, str] = {}
    for key, value in update.model_dump(exclude_none=True).items():
        if key not in _EDITABLE:
            continue
        _overrides[key] = value
        repository.set_config(key, value)  # no-op when DB disabled
        changed[key] = value
    return {"success": True, "data": {"changed": changed, "config": _effective_config()}}
