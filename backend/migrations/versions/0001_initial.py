"""initial schema — dtc/log/uds/run/telemetry/config

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-06

Mirrors db/models.py. Note: ``timestamp_ms`` columns are BIGINT (JS epoch-ms
overflows 32-bit INTEGER). This is the same schema create_all bootstraps; to
adopt Alembic on a DB already created by create_all, run ``alembic stamp head``.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dtc_record",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("occurrence_count", sa.Integer(), nullable=False),
        sa.Column("byte_code", sa.String(), nullable=False),
        sa.Column("timestamp_ms", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_dtc_record_code", "dtc_record", ["code"])

    op.create_table(
        "log_record",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("level", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("timestamp_ms", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "uds_audit",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("request_hex", sa.String(), nullable=False),
        sa.Column("response_hex", sa.String(), nullable=False),
        sa.Column("service", sa.String(), nullable=False),
        sa.Column("positive", sa.Boolean(), nullable=False),
        sa.Column("interpretation", sa.String(), nullable=False),
        sa.Column("timestamp_ms", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "sim_run",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("scenario", sa.String(), nullable=False),
        sa.Column("note", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_sim_run_scenario", "sim_run", ["scenario"])

    op.create_table(
        "telemetry_sample",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=True),
        sa.Column("timestamp_ms", sa.BigInteger(), nullable=False),
        sa.Column("speed", sa.Float(), nullable=False),
        sa.Column("ttc", sa.Float(), nullable=False),
        sa.Column("aeb_status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_telemetry_sample_run_id", "telemetry_sample", ["run_id"])

    op.create_table(
        "app_config",
        sa.Column("key", sa.String(), primary_key=True, nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("app_config")
    op.drop_index("ix_telemetry_sample_run_id", table_name="telemetry_sample")
    op.drop_table("telemetry_sample")
    op.drop_index("ix_sim_run_scenario", table_name="sim_run")
    op.drop_table("sim_run")
    op.drop_table("uds_audit")
    op.drop_table("log_record")
    op.drop_index("ix_dtc_record_code", table_name="dtc_record")
    op.drop_table("dtc_record")
