"""The everyday spelling read off the mushaf's text, a third matching shadow on words and verses.

The imlāʾī shadow (``norm``) keeps Tanzil's spellings (السموات، الصلوة); the Uthmani one (``norm_uthmani``)
drops the dagger alif (السموت). A reader types السماوات. ``norm_plain`` is ``plain_spelling`` of the mushaf's
text (the dagger alif and the small wāw/yāʾ written out) — derived, for matching only, never displayed.

Revision ID: 0017
Revises: 0016
"""

from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table content.words add column norm_plain text not null default '';
        alter table content.verses add column norm_plain text not null default '';
        create index words_norm_plain_idx on content.words (norm_plain);
        create index verses_norm_plain_trgm on content.verses using gin (norm_plain gin_trgm_ops);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop index content.verses_norm_plain_trgm;
        drop index content.words_norm_plain_idx;
        alter table content.verses drop column norm_plain;
        alter table content.words drop column norm_plain;
        """
    )
