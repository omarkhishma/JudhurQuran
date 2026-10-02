"""Classical lexica (root articles) and Quran-gharib verse glosses.

Arabic lexicon texts are display-only (see data/lexica.yaml licences); only works flagged
`redistributable` may ever be offered in bulk.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-02
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.lexicon_works (
          id               text primary key,
          title_ar         text not null,
          title_en         text not null,
          author_ar        text not null,
          author_en        text not null,
          death_hijri      smallint,
          death_ce         smallint,
          lang             text not null,
          edition_note     text not null,
          source_url       text not null,
          license          text not null,
          attribution_ar   text not null,
          attribution_en   text not null,
          redistributable  boolean not null,
          sort_order       smallint not null
        );

        create table content.lexicon_entries (
          id            integer primary key,
          work_id       text not null references content.lexicon_works(id),
          root_key      text,
          headword      text not null,
          match         text,
          confidence    text not null,
          displayable   boolean not null,
          body          text not null,
          core_meaning  text,
          page_ref      text,
          source_ref    text not null
        );
        create index lexicon_entries_root on content.lexicon_entries (root_key, work_id) where displayable;

        create table content.gharib_glosses (
          id              integer primary key,
          work_id         text not null references content.lexicon_works(id),
          surah           smallint not null,
          ayah            smallint not null,
          phrase          text not null,
          gloss           text not null,
          word_locations  text[] not null,
          page_ref        text,
          source_ref      text not null
        );
        create index gharib_glosses_locations on content.gharib_glosses using gin (word_locations);
        """
    )


def downgrade() -> None:
    op.execute(
        "drop table content.gharib_glosses; drop table content.lexicon_entries; drop table content.lexicon_works;"
    )
