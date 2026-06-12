"""add incident table (Phase 3B — structured incident model)

Revision ID: 0002_add_incidents
Revises: 0001_initial
Create Date: 2026-06-11

Adds the ``incident`` table that persists every at-fault event from any
SimBackend. Each row is also expressed as a P1Cxx DTC (reserved validation
range) so engineers can triage closed-loop failures through the standard UDS
0x19/0x14 flow — the diagnostics bridge described in Plan v3 §5.9.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_add_incidents"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "incident",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("incident_type", sa.String(), nullable=False),
        sa.Column("at_fault", sa.Boolean(), nullable=False),
        sa.Column("scenario", sa.String(), nullable=False),
        sa.Column("seed", sa.Integer(), nullable=True),
        sa.Column("sim_run_id", sa.Integer(), nullable=True),
        sa.Column("backend_name", sa.String(), nullable=False),
        sa.Column("dtc_code", sa.String(), nullable=False),
        sa.Column("ttc_trace", sa.Text(), nullable=False),
        sa.Column("freeze_frame", sa.Text(), nullable=False),
        sa.Column("policy_decision_id", sa.String(), nullable=True),
        sa.Column("timestamp_ms", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_incident_incident_type", "incident", ["incident_type"])
    op.create_index("ix_incident_scenario", "incident", ["scenario"])
    op.create_index("ix_incident_sim_run_id", "incident", ["sim_run_id"])


def downgrade() -> None:
    op.drop_index("ix_incident_sim_run_id", table_name="incident")
    op.drop_index("ix_incident_scenario", table_name="incident")
    op.drop_index("ix_incident_incident_type", table_name="incident")
    op.drop_table("incident")
