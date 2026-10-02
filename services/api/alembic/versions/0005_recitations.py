"""Reciters and per-verse word timings mapped onto display tokens.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-02
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.reciters (
          id          text primary key,
          name_ar     text not null,
          name_en     text not null,
          style       text not null,
          folder      text not null,
          audio_url   text not null,
          is_default  boolean not null,
          sort_order  smallint not null
        );
        create table content.recitation_timings (
          reciter_id  text not null references content.reciters(id),
          verse_id    integer not null references content.verses(id),
          segments    jsonb not null,
          primary key (reciter_id, verse_id)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table content.recitation_timings; drop table content.reciters;")
