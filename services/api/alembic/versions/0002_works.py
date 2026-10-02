"""Tafsir and translation works with verbatim passages over contiguous verse ranges.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-02
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.works (
          id                    text primary key,
          kind                  text not null check (kind in ('tafsir', 'translation')),
          lang                  text not null,
          level                 text,
          title_ar              text not null,
          title_en              text not null,
          author_ar             text not null,
          author_en             text not null,
          source_id             text not null references content.sources(id),
          version               text not null,
          file_sha256           text not null,
          sort_order            smallint not null,
          default_for           text,
          strip_leading_number  boolean not null default false,
          verse_coverage        integer not null,
          passage_count         integer not null
        );

        create table content.work_passages (
          id          integer primary key,
          work_id     text not null references content.works(id),
          verse_from  integer not null references content.verses(id),
          verse_to    integer not null references content.verses(id),
          text        text not null,
          footnotes   text,
          check (verse_to >= verse_from)
        );
        create index work_passages_lookup on content.work_passages (work_id, verse_from, verse_to);
        """
    )


def downgrade() -> None:
    op.execute("drop table content.work_passages; drop table content.works;")
