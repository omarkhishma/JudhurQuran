"""The dictionary's roots (P11.1): every root the lexica file an article under, and each article's roots.

Revision ID: 0032
Revises: 0031
"""

from alembic import op

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.dict_roots (
          key                 text primary key,
          display             text not null,
          letters             smallint not null,
          first               text not null,
          quran_root          text,
          lexica              text[] not null,
          articles            integer not null,
          attested_as_written boolean not null,
          unsure              boolean not null,
          filed_under         text
        );
        create index dict_roots_first on content.dict_roots (first, letters, key);
        alter table content.lexicon_entries
          add column dict_roots text[] not null default '{}',
          add column dict_rule text,
          add column dict_candidates text[];
        create index lexicon_entries_dict_roots on content.lexicon_entries using gin (dict_roots);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop index content.lexicon_entries_dict_roots;
        alter table content.lexicon_entries drop column dict_roots, drop column dict_rule, drop column dict_candidates;
        drop table content.dict_roots;
        """
    )
