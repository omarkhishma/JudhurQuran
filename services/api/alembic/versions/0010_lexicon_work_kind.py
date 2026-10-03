"""Lexicon works carry the design's kind and their Shamela book id (P3.2).

``kind`` is one of earliest, general, root, interpretive, english, gharib (inventory RDR-048…056); the
display order stays ``sort_order``, which the registry now sets to the author's death date.

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-03
"""

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table content.lexicon_works
          add column kind text check (kind in ('earliest', 'general', 'root', 'interpretive', 'english', 'gharib')),
          add column shamela_id int;
        """
    )


def downgrade() -> None:
    op.execute("alter table content.lexicon_works drop column kind, drop column shamela_id;")
