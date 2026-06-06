"""Tests for the Admin / Control Center backend (/api/system/*) and history API."""
from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_system_status_lists_services():
    with TestClient(app) as client:
        res = client.get("/api/system/status")
    assert res.status_code == 200
    data = res.json()["data"]
    ids = {s["id"] for s in data["services"]}
    assert {"backend", "database", "carla", "ros2", "canbus"} <= ids
    backend = next(s for s in data["services"] if s["id"] == "backend")
    assert backend["status"] == "ok"


def test_system_status_database_disabled_without_url():
    # No DATABASE_URL configured in the test env → database reports "disabled".
    with TestClient(app) as client:
        res = client.get("/api/system/status")
    db = next(s for s in res.json()["data"]["services"] if s["id"] == "database")
    assert db["status"] == "disabled"


def test_system_config_get_and_update():
    with TestClient(app) as client:
        before = client.get("/api/system/config").json()["data"]
        assert "carla_host" in before["config"]
        assert "carla_port" in before["editable"]

        res = client.put("/api/system/config", json={"carla_port": "2010"})
        assert res.status_code == 200
        assert res.json()["data"]["config"]["carla_port"] == "2010"

        after = client.get("/api/system/config").json()["data"]
        assert after["config"]["carla_port"] == "2010"


def test_history_endpoints_empty_when_db_disabled():
    with TestClient(app) as client:
        for path in ("dtcs", "logs", "uds", "runs", "telemetry"):
            res = client.get(f"/api/history/{path}")
            assert res.status_code == 200
            body = res.json()
            assert body["success"] is True
            assert body["data"] == []
            assert body["meta"]["persisted"] is False
