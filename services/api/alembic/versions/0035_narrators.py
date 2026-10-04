"""Narrator profiles (P11.2b): Ibn Ḥajar's Taqrīb al-Tahdhīb, each entry verbatim with his edition's number, and beside
it what is read from his words by rule — his verdict as worded and its rank on his scale, his ṭabaqa, the year of death
by his introduction's rule, the sigla of the books that narrate from him. A cross-reference entry («$$$») is kind
``see``.

Revision ID: 0035
Revises: 0034
"""

from alembic import op

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.narrators (
          id           integer primary key,
          source_id    text not null references content.sources(id),
          number       integer,
          kind         text not null check (kind in ('entry', 'see')),
          text         text not null,
          name         text not null,
          name_norm    text not null,
          verdict      text,
          rank         smallint check (rank between 1 and 12),
          tabaqa       smallint check (tabaqa between 1 and 12),
          tabaqa_rule  text,
          death_text   text,
          death_ah     smallint,
          death_rule   text,
          sigla        text[] not null default '{}'
        );
        create index narrators_number on content.narrators (number);
        create index narrators_name_trgm on content.narrators using gin (name_norm gin_trgm_ops);
        """
    )


def downgrade() -> None:
    op.execute("drop table content.narrators")
