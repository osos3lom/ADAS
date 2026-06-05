"""
FastAPI REST Routes
--------------------
All paths are prefixed with /api/sim by the router mount in main.py.

GET  /api/sim/state              → current simulation state (JSON, camelCase)
POST /api/sim/scenario           → change active scenario
POST /api/sim/uds                → send UDS hex command
POST /api/sim/clear-dtcs         → clear all stored DTCs
POST /api/sim/inject-fault       → inject a named DTC
GET  /api/sim/inject-fault       → list all injectable faults
GET  /api/sim/ros2/n…(truncated)