"""
FastAPI REST Routes
===================
All paths are mounted under ``/api/sim`` by :mod:`main`.

    GET  /api/sim/state          → current simulation state (camelCase JSON)
    POST /api/sim/scenario       → change active scenario     {scenario}
    POST /api/sim/uds            → send a UDS hex command      {command}
    POST /api/sim/clear-dtcs     → clear all stored DTCs
    POST /api/sim/inject-fault   → inject a named (or random) DTC  {code?}
    GET  /api/sim/inject-fault   → list all injectable faults
    GET  /api/sim/ros2/nodes     → ROS2 node status (Phase-3 placeholder)

This mirrors the contract the Next.js frontend already speaks
(``frontend/app/api/sim/*``) so the dashboard can proxy to this backend
unchanged.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from observers import emit_run
from simulation.engine import tick_simulation
from simulation.state import add_dtc, add_log, get_sim_state
from uds.processor import process_uds

router = APIRouter()

VALID_SCENARIOS = ["normal_driving", "highway_acc", "aeb_trigger", "lane_departure", "sensor_fault"]

SCENARIO_LABELS = {
    "normal_driving": "Normal Driving",
    "highway_acc": "Highway ACC",
    "aeb_trigger": "AEB Trigger",
    "lane_departure": "Lane Departure",
    "sensor_fault": "Sensor Fault",
}

# Mirror of frontend/app/api/sim/inject-fault/route.ts
FAULTS = [
    {"code": "P1001", "description": "AEB Emergency Activation", "severity": "warning", "byteCode": [0x01, 0x10, 0x01]},
    {"code": "P1002", "description": "LDW Left Lane Departure", "severity": "warning", "byteCode": [0x01, 0x20, 0x02]},
    {"code": "P1003", "description": "LDW Right Lane Departure", "severity": "warning", "byteCode": [0x01, 0x20, 0x03]},
    {"code": "B1001", "description": "Forward Radar Sensor Fault", "severity": "critical", "byteCode": [0x02, 0x10, 0x01]},
    {"code": "B1002", "description": "Front Camera Calibration Error", "severity": "warning", "byteCode": [0x02, 0x20, 0x01]},
    {"code": "U0100", "description": "Lost Communication With ECM/PCM", "severity": "critical", "byteCode": [0x03, 0x00, 0x00]},
    {"code": "U0416", "description": "Invalid Data Received From VSS ECU", "severity": "info", "byteCode": [0x03, 0x04, 0x16]},
]


class ScenarioBody(BaseModel):
    scenario: str


class UDSBody(BaseModel):
    command: str


class InjectFaultBody(BaseModel):
    code: Optional[str] = None


# ── GET /state ────────────────────────────────────────────────────────────────

@router.get("/state")
def get_state():
    state = get_sim_state()
    if state.running:
        tick_simulation(state)
    return state.model_dump(by_alias=True)


# ── POST /scenario ────────────────────────────────────────────────────────────

@router.post("/scenario")
def set_scenario(body: ScenarioBody):
    if body.scenario not in VALID_SCENARIOS:
        return JSONResponse({"error": "Invalid scenario"}, status_code=400)

    state = get_sim_state()
    from simulation.state import now_ms

    state.scenario = body.scenario
    state.scenario_time = 0
    state.scenario_start_wall = now_ms()
    state.scenario_progress = 0

    # Reset ADAS on scenario change
    state.adas.aeb_status = "standby"
    state.adas.ldw_status = "inactive"
    state.adas.acc_status = "inactive"
    state.vehicle.brake_pressure = 0

    label = SCENARIO_LABELS[body.scenario]
    add_log(state, "info", "SYSTEM", f"Scenario switched → {label}")
    add_log(state, "info", "CARLA", f"World: spawning scenario actors for {label}")
    emit_run(body.scenario)

    return {"ok": True, "scenario": body.scenario}


# ── POST /uds ─────────────────────────────────────────────────────────────────

@router.post("/uds")
def send_uds(body: UDSBody):
    if not body.command or not isinstance(body.command, str):
        return JSONResponse({"error": "Missing command"}, status_code=400)
    state = get_sim_state()
    return process_uds(body.command, state)


# ── POST /clear-dtcs ──────────────────────────────────────────────────────────

@router.post("/clear-dtcs")
def clear_dtcs():
    state = get_sim_state()
    count = len(state.dtcs)
    state.dtcs = []
    add_log(state, "info", "ECU", f"Manual DTC clear: {count} DTC(s) removed")
    return {"ok": True, "cleared": count}


# ── /inject-fault ─────────────────────────────────────────────────────────────

@router.post("/inject-fault")
def inject_fault(body: InjectFaultBody | None = None):
    import secrets

    code = body.code if body else None
    fault = next((f for f in FAULTS if f["code"] == code), None) or FAULTS[secrets.randbelow(len(FAULTS))]

    state = get_sim_state()
    add_dtc(
        state,
        code=fault["code"],
        description=fault["description"],
        severity=fault["severity"],
        status="active",
        byte_code=fault["byteCode"],
    )
    add_log(state, "error", "SYSTEM", f"Fault injected: {fault['code']} — {fault['description']}")
    return {"ok": True, "dtc": fault}


@router.get("/inject-fault")
def list_faults():
    return {
        "faults": [
            {"code": f["code"], "description": f["description"], "severity": f["severity"]}
            for f in FAULTS
        ]
    }


# ── GET /ros2/nodes (Phase-3 placeholder) ─────────────────────────────────────

@router.get("/ros2/nodes")
def ros2_nodes():
    """Static ROS2 node status. Replaced by a live rclpy bridge in Phase 3."""
    nodes: List[dict] = [
        {"name": "perception", "language": "C++", "status": "offline", "topic": "/obstacles"},
        {"name": "planning", "language": "Python", "status": "offline", "topic": "/adas/state"},
        {"name": "control", "language": "C++", "status": "offline", "topic": "/carla/ego/control"},
        {"name": "ecu_bridge", "language": "Python", "status": "offline", "topic": "/uds/vcan0"},
    ]
    return {"nodes": nodes, "connected": False, "note": "ROS2 bridge not active (Phase 3)"}
