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

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import observers
from api.history import router as history_router
from api.routes import router as sim_router
from api.system import router as system_router

logger = logging.getLogger("adas.main")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize persistence on startup; register the live simulation's writers.

    When ``DATABASE_URL`` is unset the database is disabled and the backend runs
    the pure in-memory simulation exactly as in Phase 0 (no DB required).
    """
    import db

    if db.database_configured():
        try:
            db.init_db()  # idempotent create_all; Alembic owns schema evolution
            from db import repository

            observers.register(
                log=repository.record_log,
                dtc=repository.record_dtc,
                uds=repository.record_uds,
                run=repository.start_run,
            )
            logger.info("Persistence enabled — simulation events will be recorded.")
        except Exception:  # pragma: no cover - depends on a live DB
            logger.warning("Database init failed; continuing in-memory only", exc_info=True)
            observers.clear()
    else:
        logger.info("DATABASE_URL not set — running in-memory only (no persistence).")

    try:
        yield
    finally:
        observers.clear()
        db.dispose()


app = FastAPI(
    title="ADAS-ECU Simulation Backend",
    description="ADAS simulation + ISO 14229 UDS diagnostics over a REST API.",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(history_router, prefix="/api/history", tags=["history"])
app.include_router(system_router, prefix="/api/system", tags=["system"])


@app.get("/health", tags=["meta"])
def health():
    import db

    return {
        "status": "ok",
        "service": "adas-ecu-backend",
        "version": app.version,
        "database": "enabled" if db.database_configured() else "disabled",
    }


@app.get("/", tags=["meta"])
def root():
    return {
        "service": "ADAS-ECU Simulation Backend",
        "version": app.version,
        "docs": "/docs",
        "health": "/health",
        "api": "/api/sim",
        "history": "/api/history",
        "system": "/api/system",
    }
