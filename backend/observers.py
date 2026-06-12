"""
Persistence Observer Registry (dependency-free)
===============================================
A tiny pub/sub seam that lets the pure simulation + UDS layers emit domain
events **without importing the database**.

The simulation (``simulation/state.py``) and UDS processor (``uds/processor.py``)
call ``emit_*`` whenever something noteworthy happens. The database layer
(``db/repository.py``) registers handlers at app startup via :func:`register`.

If no handler is registered (e.g. running tests, or ``DATABASE_URL`` unset), the
``emit_*`` calls are cheap no-ops — so the simulation never depends on a database
being present, and the existing tests stay DB-free. Handler exceptions are logged
and swallowed so a database hiccup can never break the live simulation.
"""
from __future__ import annotations

import logging
from typing import Callable, Dict, Optional

logger = logging.getLogger("adas.observers")

# (timestamp_ms, level, source, message)
LogHandler = Callable[[int, str, str, str], None]
# payload dict (code, description, severity, status, occurrence_count, byte_code, timestamp_ms)
DtcHandler = Callable[[Dict[str, object]], None]
# payload dict (request_hex, response_hex, service, positive, interpretation, timestamp_ms)
UdsHandler = Callable[[Dict[str, object]], None]
# (scenario)
RunHandler = Callable[[str], None]
# payload dict — all IncidentRecord fields (Plan v3 §3B / §5.9)
IncidentHandler = Callable[[Dict[str, object]], None]

_log_handler: Optional[LogHandler] = None
_dtc_handler: Optional[DtcHandler] = None
_uds_handler: Optional[UdsHandler] = None
_run_handler: Optional[RunHandler] = None
_incident_handler: Optional[IncidentHandler] = None


def register(
    *,
    log: Optional[LogHandler] = None,
    dtc: Optional[DtcHandler] = None,
    uds: Optional[UdsHandler] = None,
    run: Optional[RunHandler] = None,
    incident: Optional[IncidentHandler] = None,
) -> None:
    """Register persistence handlers (called once by the DB layer at startup)."""
    global _log_handler, _dtc_handler, _uds_handler, _run_handler, _incident_handler
    _log_handler = log
    _dtc_handler = dtc
    _uds_handler = uds
    _run_handler = run
    _incident_handler = incident


def clear() -> None:
    """Drop all handlers (used on shutdown and in tests)."""
    register(log=None, dtc=None, uds=None, run=None, incident=None)


def emit_log(timestamp_ms: int, level: str, source: str, message: str) -> None:
    if _log_handler is None:
        return
    try:
        _log_handler(timestamp_ms, level, source, message)
    except Exception:  # pragma: no cover - persistence is best-effort
        logger.warning("persistence log handler failed", exc_info=True)


def emit_dtc(payload: Dict[str, object]) -> None:
    if _dtc_handler is None:
        return
    try:
        _dtc_handler(payload)
    except Exception:  # pragma: no cover - persistence is best-effort
        logger.warning("persistence dtc handler failed", exc_info=True)


def emit_uds(payload: Dict[str, object]) -> None:
    if _uds_handler is None:
        return
    try:
        _uds_handler(payload)
    except Exception:  # pragma: no cover - persistence is best-effort
        logger.warning("persistence uds handler failed", exc_info=True)


def emit_run(scenario: str) -> None:
    if _run_handler is None:
        return
    try:
        _run_handler(scenario)
    except Exception:  # pragma: no cover - persistence is best-effort
        logger.warning("persistence run handler failed", exc_info=True)


def emit_incident(payload: Dict[str, object]) -> None:
    """Emit an at-fault incident event (Plan v3 §5.9 — the diagnostics bridge).

    ``payload`` must contain at minimum ``incident_type``, ``scenario``,
    ``timestamp_ms``, and ``dtc_code`` (a P1Cxx code from the reserved range).
    All other IncidentRecord fields are optional and default to safe values.
    """
    if _incident_handler is None:
        return
    try:
        _incident_handler(payload)
    except Exception:  # pragma: no cover - persistence is best-effort
        logger.warning("persistence incident handler failed", exc_info=True)
