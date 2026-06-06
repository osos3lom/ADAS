"""
ADAS-ECU Backend — FastAPI Application
=====================================
Entry point for the Python simulation backend.

    REST  /api/sim/*   ← Next.js dashboard (proxied via BACKEND_URL) or direct
    GET   /health      ← liveness probe (used by docker-compose healthcheck)
    GET   /            ← service banner + links to /docs

Run locally:
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

The simulation logic (``simulation/*``) and the UDS server (``uds/*``) are pure
Python, ported 1-to-1 from the intact TypeScript reference in ``frontend/lib``.
ROS2 / SocketCAN bridges (``ros2/``, ``can/``) are Phase-3 placeholders.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router as sim_router

app = FastAPI(
    title="ADAS-ECU Simulation Backend",
    description="ADAS simulation + ISO 14229 UDS diagnostics over a REST API.",
    version="0.1.0",
)

# CORS — allow the Next.js dashboard (and direct browsers) to call the API.
_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sim_router, prefix="/api/sim", tags=["simulation"])


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "adas-ecu-backend", "version": app.version}


@app.get("/", tags=["meta"])
def root():
    return {
        "service": "ADAS-ECU Simulation Backend",
        "version": app.version,
        "docs": "/docs",
        "health": "/health",
        "api": "/api/sim",
    }
