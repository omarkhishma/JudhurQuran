"""Word audio (PLAN P3.7, D10): which reciter's slices pronounce a word, and how sure each slice is.

``reciters.word_audio`` marks the recitation words are cut from (al-Ḥuṣarī's teaching recitation, whose
boundaries are refined against the audio). ``recitation_timings.quality`` keeps what the aligner and the
refinement measured for a verse: quran-align's insertions, deletions and transpositions, the display
tokens whose time comes from a segment shared with another word (``shared``), and the tokens that run
into the next word with no audible dip between them (``joined_next``).

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-03
"""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table content.reciters add column word_audio boolean not null default false;
        alter table content.recitation_timings add column quality jsonb;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        alter table content.recitation_timings drop column quality;
        alter table content.reciters drop column word_audio;
        """
    )
