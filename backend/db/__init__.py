"""Database package: SQLModel engine, models, and repository.

Public surface:
    database_enabled()  → is a DATABASE_URL configured?
    init_engine/init_db → bootstrap (idempotent; Alembic owns migrations)
    session_scope       → transactional session context
    db_ping/dispose     → health + shutdown
    repository          → writers (record_*) + readers (list_*) + config
"""
from __future__ import annotations

from db.engine import (
    database_configured,
    database_enabled,
    db_ping,
    dispose,
    get_engine,
    init_db,
    init_engine,
    session_scope,
)

__all__ = [
    "database_configured",
    "database_enabled",
    "db_ping",
    "dispose",
    "get_engine",
    "init_db",
    "init_engine",
    "session_scope",
]
