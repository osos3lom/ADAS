"""
Phase 3B — incident model tests.

Coverage:
1. POST /api/incidents — creates and returns an incident payload (no DB)
2. POST /api/incidents — validation rejects unknown incident_type / backend
3. POST /api/incidents — validation rejects DTC code outside P1C range
4. GET /api/incidents  — returns empty list (no DB)
5. GET /api/incidents/{id} — 404 when DB disabled
6. Observer: emit_incident is a no-op when no handler registered
7. Observer: emit_incident calls the registered handler with the payload
8. Repository: record_incident is a no-op when DB disabled
9. Constants: VALIDATION_DTC_NAMES contains the canonical P1Cxx codes
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

import observers
from main import app
from uds.constants import VALIDATION_DTC_NAMES

client = TestClient(app)

# ── 1. POST creates an incident ───────────────────────────────────────────────

def test_post_incident_ok():
    body = {
        "incident_type": "collision",
        "scenario": "aeb_trigger",
        "dtc_code": "P1C01",
        "ttc_trace": [[5.5, 1.8], [5.6, 1.5], [5.7, 1.2]],
        "freeze_frame": {"t": 5.7, "ego": {"speed": 80, "brake_pressure": 100}},
    }
    r = client.post("/api/incidents", json=body)
    assert r.status_code == 201
    data = r.json()
    assert data["success"] is True
    assert data["data"]["incident_type"] == "collision"
    assert data["data"]["dtc_code"] == "P1C01"
    assert data["data"]["scenario"] == "aeb_trigger"
    assert data["data"]["dtc_description"] == "At-Fault Forward Collision"
    # ttc_trace stored as JSON string
    assert json.loads(data["data"]["ttc_trace"]) == [[5.5, 1.8], [5.6, 1.5], [5.7, 1.2]]


def test_post_incident_defaults():
    """at_fault=True and backend_name=internal are the safe defaults."""
    r = client.post("/api/incidents", json={
        "incident_type": "road_excursion",
        "scenario": "lane_departure",
        "dtc_code": "P1C02",
    })
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["at_fault"] is True
    assert data["backend_name"] == "internal"


# ── 2. Validation — unknown incident_type ─────────────────────────────────────

def test_post_incident_invalid_type():
    r = client.post("/api/incidents", json={
        "incident_type": "fire",
        "scenario": "aeb_trigger",
        "dtc_code": "P1C01",
    })
    assert r.status_code == 422


def test_post_incident_invalid_backend():
    r = client.post("/api/incidents", json={
        "incident_type": "collision",
        "scenario": "aeb_trigger",
        "backend_name": "matlab_sim",
        "dtc_code": "P1C01",
    })
    assert r.status_code == 422


# ── 3. Validation — DTC outside P1C range ────────────────────────────────────

def test_post_incident_dtc_outside_range():
    r = client.post("/api/incidents", json={
        "incident_type": "collision",
        "scenario": "aeb_trigger",
        "dtc_code": "P1001",  # real operational DTC, not validation range
    })
    assert r.status_code == 422


# ── 4. GET /api/incidents — empty without DB ─────────────────────────────────

def test_list_incidents_no_db():
    r = client.get("/api/incidents")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"] == []
    assert body["meta"]["persisted"] is False


# ── 5. GET /api/incidents/{id} — 404 without DB ──────────────────────────────

def test_get_incident_not_found():
    r = client.get("/api/incidents/999")
    assert r.status_code == 404


# ── 6. emit_incident is a no-op without a handler ────────────────────────────

def test_emit_incident_noop_without_handler():
    observers.clear()
    # Should not raise
    observers.emit_incident({"incident_type": "collision", "scenario": "aeb_trigger",
                             "dtc_code": "P1C01", "timestamp_ms": 0})


# ── 7. emit_incident calls the registered handler ────────────────────────────

def test_emit_incident_calls_handler():
    received: list[dict] = []
    observers.clear()
    observers.register(incident=lambda p: received.append(p))

    payload = {"incident_type": "collision", "scenario": "aeb_trigger",
               "dtc_code": "P1C01", "timestamp_ms": 1_700_000_000_000}
    observers.emit_incident(payload)

    assert len(received) == 1
    assert received[0]["dtc_code"] == "P1C01"

    observers.clear()


# ── 8. record_incident is no-op when DB disabled ─────────────────────────────

def test_record_incident_no_db():
    from db import repository
    # Should not raise; database_enabled() is False in test environment
    repository.record_incident({
        "incident_type": "collision",
        "at_fault": True,
        "scenario": "aeb_trigger",
        "dtc_code": "P1C01",
        "timestamp_ms": 0,
    })


# ── 9. VALIDATION_DTC_NAMES contains canonical P1Cxx codes ───────────────────

def test_validation_dtc_names_coverage():
    required = {"P1C00", "P1C01", "P1C02", "P1C03", "P1C10", "P1C20", "P1C30"}
    assert required <= set(VALIDATION_DTC_NAMES.keys())
    for code, desc in VALIDATION_DTC_NAMES.items():
        assert code.startswith("P1C"), f"{code!r} is not in the P1C range"
        assert len(desc) > 0
