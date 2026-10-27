"""add_pomodoro_session_table

Revision ID: 007
Revises: 006
Create Date: 2026-10-26 19:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "007"
down_revision: Union[str, Sequence[str], None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pomodoro_session",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("phase", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("date_str", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("day", sa.Integer(), nullable=False),
        sa.Column("hour_of_day", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("interrupted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("focus_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("break_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("elapsed_focus_seconds", sa.Integer(), nullable=False),
        sa.Column("is_manual", sa.Boolean(), nullable=False),
        sa.Column("device_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("timer_end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notification_sent", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_pomodoro_session_date_str"),
        "pomodoro_session",
        ["date_str"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pomodoro_session_day"),
        "pomodoro_session",
        ["day"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pomodoro_session_hour_of_day"),
        "pomodoro_session",
        ["hour_of_day"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pomodoro_session_is_manual"),
        "pomodoro_session",
        ["is_manual"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pomodoro_session_month"),
        "pomodoro_session",
        ["month"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pomodoro_session_status"),
        "pomodoro_session",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pomodoro_session_timer_end_time"),
        "pomodoro_session",
        ["timer_end_time"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pomodoro_session_user_id"),
        "pomodoro_session",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pomodoro_session_year"),
        "pomodoro_session",
        ["year"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_pomodoro_session_year"), table_name="pomodoro_session")
    op.drop_index(op.f("ix_pomodoro_session_user_id"), table_name="pomodoro_session")
    op.drop_index(
        op.f("ix_pomodoro_session_timer_end_time"), table_name="pomodoro_session"
    )
    op.drop_index(op.f("ix_pomodoro_session_status"), table_name="pomodoro_session")
    op.drop_index(op.f("ix_pomodoro_session_month"), table_name="pomodoro_session")
    op.drop_index(op.f("ix_pomodoro_session_is_manual"), table_name="pomodoro_session")
    op.drop_index(
        op.f("ix_pomodoro_session_hour_of_day"), table_name="pomodoro_session"
    )
    op.drop_index(op.f("ix_pomodoro_session_day"), table_name="pomodoro_session")
    op.drop_index(op.f("ix_pomodoro_session_date_str"), table_name="pomodoro_session")
    op.drop_table("pomodoro_session")
