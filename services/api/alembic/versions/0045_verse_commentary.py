"""A verse's commentary in the books (PLAN B55): each verse a tafsir book's section comments on, read from the book's
own heading by a rule of that book (``range``, ``named``, ``reference``, ``quoted``; ecosystem/commentary.py).

Revision ID: 0045
Revises: 0044
"""

from alembic import op

revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.verse_commentary (
          id          integer primary key,
          verse_id    integer not null references content.verses(id),
          text_id     integer not null references content.texts(id),
          chapter_id  integer not null references content.chapters(id),
          rule        text not null check (rule in ('range', 'named', 'reference', 'quoted')),
          unique (verse_id, chapter_id)
        );
        create index verse_commentary_verse on content.verse_commentary (verse_id, text_id);
        """
    )


def downgrade() -> None:
    op.execute("drop table content.verse_commentary;")
