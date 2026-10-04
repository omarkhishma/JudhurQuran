"""Search over the texts beyond the Quran (P11.4a): a trigram index on a passage's search shadow, for the Postgres
engine's phrase search when OpenSearch is away — partial, the Quran's verses having their own.

Revision ID: 0034
Revises: 0033
"""

from alembic import op

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "create index passages_norm_trgm on content.passages using gin (norm gin_trgm_ops) where verse_id is null"
    )


def downgrade() -> None:
    op.execute("drop index content.passages_norm_trgm")
