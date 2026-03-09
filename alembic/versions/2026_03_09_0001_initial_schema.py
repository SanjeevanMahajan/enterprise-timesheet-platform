"""Initial schema placeholder.

Revision ID: 0001
Revises:
Create Date: 2026-03-09 00:00:00.000000+00:00

This is a placeholder migration. Run `alembic revision --autogenerate -m "..."` to
generate a real migration from the current model metadata.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Auto-generate will populate this with CREATE TABLE statements
    pass


def downgrade() -> None:
    # Auto-generate will populate this with DROP TABLE statements
    pass
