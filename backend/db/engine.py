"""
Database engine + session management
====================================
Synchronous SQLModel/SQLAlchemy engine. FastAPI runs the (sync) route handlers
in a threadpool, so plain sync sessions are simplest and safe here.

Driven by ``DATABASE_URL``:
    postgresql+psycopg://adas:adas@db:5432/adas   ← docker-compose / production
    sqlite:///./adas.db                            ← local file
    sqlite://                                      ← in-memory (tests)

If ``DATABASE_URL`` is unset, the database is **disabled**: the backend still
boots and serves the live simulation; persistence + history endpoints become
no-ops. This keeps the pure-Python simulation runnable anywhere (Phase 0 parity).
"""
from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Iterator, Optional

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

logger = logging.getLogger("adas.db")

_engine: Optional[Engine] = None


def _configured_url() -> str:
    """The configured DATABASE_URL, read at call time (not frozen at import)."""
    return os.environ.get("DATABASE_URL", "").strip()


def database_configured() -> bool:
    """True when a DATABASE_URL is set (the operator *intends* to persist)."""
    return bool(_configured_url())


def database_enabled() -> bool:
    """True when the engine is initialized and ready (persistence is active).

    Writers/readers gate on this so they're safe no-ops until startup (or a test)
    has called :func:`init_engine`.
    """
    return _engine is not None


def _build_engine(url: str) -> Engine:
    connect_args: dict = {}
    engine_kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        # Allow cross-thread use (FastAPI threadpool) and keep an in-memory DB
        # alive across connections for tests.
        connect_args["check_same_thread"] = False
        if url in ("sqlite://", "sqlite:///:memory:"):
            from sqlalchemy.pool import StaticPool

            engine_kwargs["poolclass"] = StaticPool
        engine_kwargs.pop("pool_pre_ping", None)
    return create_engine(url, connect_args=connect_args, **engine_kwargs)


def init_engine(url: Optional[str] = None) -> Engine:
    """Create (idempotently) and return the process-wide engine."""
    global _engine
    if _engine is not None:
        return _engine
    target = (url or _configured_url()).strip()
    if not target:
        raise RuntimeError("init_engine called without a DATABASE_URL")
    _engine = _build_engine(target)
    logger.info("Database engine initialized (%s)", _redact(target))
    return _engine


def get_engine() -> Optional[Engine]:
    return _engine


def init_db() -> None:
    """Create any missing tables (idempotent bootstrap; Alembic owns migrations)."""
    # Importing models registers them on SQLModel.metadata.
    from db import models  # noqa: F401

    engine = init_engine()
    SQLModel.metadata.create_all(engine)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional session context. Commits on success, rolls back on error."""
    engine = get_engine()
    if engine is None:
        raise RuntimeError("Database is not enabled (no DATABASE_URL)")
    session = Session(engine)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def db_ping() -> bool:
    """Return True if a trivial query succeeds against the configured database."""
    engine = get_engine()
    if engine is None:
        return False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:  # pragma: no cover - depends on a live DB
        logger.warning("db_ping failed", exc_info=True)
        return False


def dispose() -> None:
    """Dispose the engine (shutdown / test teardown)."""
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None


def _redact(url: str) -> str:
    """Hide credentials in a DSN for logging."""
    if "@" in url and "//" in url:
        scheme, rest = url.split("//", 1)
        if "@" in rest:
            _, host = rest.split("@", 1)
            return f"{scheme}//***@{host}"
    return url
