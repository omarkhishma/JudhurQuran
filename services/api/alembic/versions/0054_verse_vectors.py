"""Semantic search (PLAN P17, D34): each verse's vectors — its plain text with al-Muyassar's explanation (Arabic) and
Saheeh International's translation (English) as one pinned open model read them — and each verse's nearest verses by
those vectors, computed once per build. A vector is compared only with vectors of its own model (``model``).

Revision ID: 0054
Revises: 0053
"""

from alembic import op

revision = "0054"
down_revision = "0053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.verse_vectors (
          verse_id  integer not null references content.verses(id),
          lang      text not null check (lang in ('ar', 'en')),
          source    text not null references content.works(id),
          model     text not null,
          vec       bytea not null check (length(vec) % 4 = 0 and length(vec) > 0),
          primary key (verse_id, lang)
        );
        create table content.verse_neighbours (
          verse_id      integer not null references content.verses(id),
          rank          smallint not null check (rank >= 1),
          neighbour_id  integer not null references content.verses(id) check (neighbour_id <> verse_id),
          score         real not null,
          model         text not null,
          primary key (verse_id, rank)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table content.verse_neighbours; drop table content.verse_vectors;")
