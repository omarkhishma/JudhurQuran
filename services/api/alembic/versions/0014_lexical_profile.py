"""How common a verse's words are in the Quran (PLAN P3.6, pipeline lexical_profile.py).

``verses.lexical_profile`` counts the verse's words by how often their lemma occurs in the Quran (≥100,
20–99, 5–19, 2–4, once); ``verses.lexical_level`` (1–5) follows the share under 20 occurrences.
``surahs.lexical_profile`` sums its verses' and counts them per level. Descriptive only (law L4).

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-03
"""

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table content.verses add column lexical_level smallint, add column lexical_profile jsonb;
        alter table content.surahs add column lexical_profile jsonb;
        create index verses_lexical_level_idx on content.verses (lexical_level);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop index content.verses_lexical_level_idx;
        alter table content.surahs drop column lexical_profile;
        alter table content.verses drop column lexical_profile, drop column lexical_level;
        """
    )
