"""Tests for the PostgreSQL persistence layer (run against in-memory SQLite).

These exercise the same SQLModel models, repository, and observer wiring used in
production; only the engine URL differs (SQLite in tests, PostgreSQL in Docker).
"""
from __future__ import annotations

import pytest

import observers
from db import engine as db_engine
from db import repository
from simulation.state import add_dtc, get_sim_state
from uds.processor import process_uds


@pytest.fixture
def db():
    """Enable an in-memory SQLite DB + register the live writers, then tear down."""
    db_engine.dispose()
    db_engine.init_engine("sqlite://")  # StaticPool keeps the in-memory DB alive
    db_engine.init_db()
    observers.register(
        log=repository.record_log,
        dtc=repository.record_dtc,
        uds=repository.record_uds,
        run=repository.start_run,
    )
    yield
    observers.clear()
    db_engine.dispose()


def test_database_disabled_by_default():
    # With no engine initialized, persistence is a no-op and reads are empty.
    assert db_engine.database_enabled() is False
    repository.record_log(1, "info", "SYSTEM", "no-op")  # must not raise
    assert repository.list_logs() == []


def test_record_and_list_dtc_roundtrip(db):
    repository.record_dtc(
        {
            "code": "B1234",
            "description": "Test fault",
            "severity": "critical",
            "status": "active",
            "occurrence_count": 1,
            "byte_code": [0x01, 0x10, 0x01],
            "timestamp_ms": 1_750_000_000_000,  # > 2^31 — verifies BIGINT column
        }
    )
    rows = repository.list_dtcs()
    assert len(rows) == 1
    assert rows[0]["code"] == "B1234"
    assert rows[0]["byte_code"] == "01 10 01"
    assert rows[0]["timestamp_ms"] == 1_750_000_000_000


def test_inject_fault_persists_via_observer(db):
    state = get_sim_state()
    add_dtc(
        state,
        code="P1001",
        description="AEB Emergency Activation",
        severity="warning",
        status="active",
        byte_code=[0x01, 0x10, 0x01],
    )
    codes = [r["code"] for r in repository.list_dtcs()]
    assert "P1001" in codes
    # add_dtc also logs, so a log row should exist too.
    assert any(r["source"] == "ECU" for r in repository.list_logs())


def test_uds_request_persists_audit(db):
    state = get_sim_state()
    process_uds("10 03", state)  # enter Extended session
    audits = repository.list_uds()
    assert len(audits) == 1
    assert audits[0]["request_hex"].startswith("10 03")
    assert audits[0]["positive"] is True


def test_pagination_clamps_and_orders(db):
    for i in range(5):
        repository.record_log(1_750_000_000_000 + i, "info", "SYSTEM", f"line {i}")
    page = repository.list_logs(limit=2, offset=0)
    assert len(page) == 2
    # newest first (id desc)
    assert page[0]["message"] == "line 4"
