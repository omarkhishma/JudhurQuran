"""The Tafsir Center's layers for each word (PLAN P13, D33): the meaning of the word in its place, its sarf statement,
its iʿrāb, its qirāʾāt note (where the readers differ) with what the difference means, and its rasm note, keyed to our display tokens; and each
verse's iʿrāb. The Center's words, verbatim (knowledge source ``tafsircenter-quran-db``).

Revision ID: 0052
Revises: 0051
"""

from alembic import op

revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.word_layers (
          token_id   integer not null references content.tokens(id),
          verse_id   integer not null references content.verses(id),
          position   smallint not null,
          part       smallint not null check (part >= 1),
          kind       text not null check (kind in ('meaning', 'sarf', 'irab', 'qiraat', 'qiraat_note', 'rasm')),
          text       text not null check (length(text) > 0),
          source_id  text not null references content.knowledge_sources(id),
          primary key (token_id, kind, part)
        );
        create index word_layers_verse_idx on content.word_layers (verse_id);
        create table content.verse_irab (
          verse_id   integer primary key references content.verses(id),
          text       text not null check (length(text) > 0),
          source_id  text not null references content.knowledge_sources(id)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table content.verse_irab; drop table content.word_layers;")
