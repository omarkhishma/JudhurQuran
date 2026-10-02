"""Arabic role and license summaries for every source.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-02
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "alter table content.sources add column role_ar text not null default '', add column license_ar text not null default ''"
    )


def downgrade() -> None:
    op.execute("alter table content.sources drop column role_ar, drop column license_ar")
