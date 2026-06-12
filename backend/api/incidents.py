"""
Incidents API (`/api/incidents`)
=================================
REST endpoint for the structured incident model (Plan v3 §3B / §5.9).

Every at-fault event from any SimBackend is persisted as an IncidentRecord and
simultaneously expressed as a P1Cxx DTC so diagnostics engineers can triage AV
validation failures through standard UDS 0x19/0x14 flows.

    GET  /api/incidents           — list incidents (paginated + filtered)
    GET  /api/incidents/{id}      — get single incident by id
    POST /api/incidents           — record an incident (used by Evaluator in Phase 5)
"""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from db import database_enabled
from db import repository
from observers import emit_incident
from simulation.state import now_ms
from uds.constants import VALIDATION_DTC_NAMES

router = APIRouter()

VALID_INCIDENT_TYPES = {"collision", "road_excursion", "lane_departure", "sensor_fault"}
VALID_BACKENDS = {"internal", "carla", "alpasim"}


class IncidentBody(BaseModel):
    incident_type: str
    at_fault: bool = True
    scenario: str
    seed: Optional[int] = None
    sim_run_id: Optional[int] = None
    backend_name: str = "internal"
    dtc_code: str = "P1C00"
    ttc_trace: list = Field(default_factory=list)
    freeze_frame: dict = Field(default_factory=dict)
    policy_decision_id: Optional[str] = None
    timestamp_ms: Optional[int] = None

    @field_validator("incident_type")
    @classmethod
    def _valid_type(cls, v: str) -> str:
        if v not in VALID_INCIDENT_TYPES:
            raise ValueError(f"incident_type must be one of {sorted(VALID_INCIDENT_TYPES)}")
        return v

    @field_validator("backend_name")
    @classmethod
    def _valid_backend(cls, v: str) -> str:
        if v not in VALID_BACKENDS:
            raise ValueError(f"backend_name must be one of {sorted(VALID_BACKENDS)}")
        return v

    @field_validator("dtc_code")
    @classmethod
    def _valid_dtc(cls, v: str) -> str:
        if not v.upper().startswith("P1C"):
            raise ValueError("dtc_code must be in the P1C00-P1CFF validation range")
        return v.upper()


# ── GET /api/incidents ────────────────────────────────────────────────────────

@router.get("")
def list_incidents(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    scenario: Optional[str] = Query(None),
    incident_type: Optional[str] = Query(None),
    at_fault: Optional[bool] = Query(None),
):
    items = repository.list_incidents(
        limit=limit,
        offset=offset,
        scenario=scenario,
        incident_type=incident_type,
        at_fault=at_fault,
    )
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


# ── GET /api/incidents/{id} ───────────────────────────────────────────────────

@router.get("/{incident_id}")
def get_incident(incident_id: int):
    row = repository.get_incident(incident_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return {"success": True, "data": row}


# ── POST /api/incidents ───────────────────────────────────────────────────────

@router.post("")
def create_incident(body: IncidentBody):
    ts = body.timestamp_ms if body.timestamp_ms is not None else now_ms()
    dtc_desc = VALIDATION_DTC_NAMES.get(body.dtc_code, "Validation Incident")

    payload = {
        "incident_type": body.incident_type,
        "at_fault": body.at_fault,
        "scenario": body.scenario,
        "seed": body.seed,
        "sim_run_id": body.sim_run_id,
        "backend_name": body.backend_name,
        "dtc_code": body.dtc_code,
        "ttc_trace": json.dumps(body.ttc_trace),
        "freeze_frame": json.dumps(body.freeze_frame),
        "policy_decision_id": body.policy_decision_id,
        "timestamp_ms": ts,
    }

    emit_incident(payload)

    return JSONResponse(
        status_code=201,
        content={
            "success": True,
            "data": {
                **payload,
                "dtc_description": dtc_desc,
                "persisted": database_enabled(),
            },
        },
    )
