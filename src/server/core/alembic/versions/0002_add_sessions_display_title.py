"""Add display_title to sessions.

Revision ID: 0002_add_sessions_display_title
Revises: 0001_core_schema_baseline
Create Date: 2026-04-01 00:00:01
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_add_sessions_display_title"
down_revision: Union[str, Sequence[str], None] = "0001_core_schema_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Older databases may already have this column from the temporary runtime
    # patch, so keep the tracked migration idempotent during the rollout.
    op.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS display_title TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE sessions DROP COLUMN IF EXISTS display_title")
