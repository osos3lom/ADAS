"""FastAPI route tests (contract the Next.js dashboard depends on)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_state_shape_is_camelcase():
    r = client.get("/api/sim/state")
    assert r.status_code == 200
    data = r.json()
    for key in ("vehicle", "adas", "ecu", "dtcs", "scenario", "speedHistory", "systemLog"):
        assert key in data
    assert "aebStatus" in data["adas"]
    assert "ecuSerialNumber" in data["ecu"]


def test_set_scenario_ok():
    r = client.post("/api/sim/scenario", json={"scenario": "aeb_trigger"})
    assert r.status_code == 200
    assert r.json() == {"ok": True, "scenario": "aeb_trigger"}


def test_set_scenario_invalid():
    r = client.post("/api/sim/scenario", json={"scenario": "nope"})
    assert r.status_code == 400
    assert r.json() == {"error": "Invalid scenario"}


def test_uds_endpoint_positive():
    r = client.post("/api/sim/uds", json={"command": "10 03"})
    assert r.status_code == 200
    body = r.json()
    assert body["positive"] is True
    assert body["serviceName"] == "DiagnosticSessionControl"
    assert body["requestHex"] == "10 03"


def test_inject_fault_then_clear():
    inj = client.post("/api/sim/inject-fault", json={"code": "B1001"})
    assert inj.status_code == 200
    assert inj.json()["dtc"]["code"] == "B1001"

    state = client.get("/api/sim/state").json()
    assert any(d["code"] == "B1001" for d in state["dtcs"])

    cleared = client.post("/api/sim/clear-dtcs")
    assert cleared.status_code == 200
    assert cleared.json()["ok"] is True


def test_list_injectable_faults():
    r = client.get("/api/sim/inject-fault")
    assert r.status_code == 200
    faults = r.json()["faults"]
    assert any(f["code"] == "B1001" for f in faults)
