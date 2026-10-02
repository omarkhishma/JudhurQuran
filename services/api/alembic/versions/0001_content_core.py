"""Content core: dataset, sources, surahs, verses, tokens, roots, lemmas, words, root variants.

The `content` schema is loaded wholesale per dataset release (see judhur_api.loader) and is
read-only for the application role. Search shadow columns are derived; the displayed Quran
text (`verses.text_qpc`, `tokens.text`) is byte-identical to the verified source.

Revision ID: 0001
Revises:
Create Date: 2026-10-02
"""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create extension if not exists pg_trgm;
        create schema if not exists content;

        create table content.dataset (
          version      text primary key,
          text_sha256  text not null,
          counts       jsonb not null,
          report       jsonb not null,
          loaded_at    timestamptz not null default now()
        );

        create table content.sources (
          id             text primary key,
          kind           text not null,
          title_ar       text not null,
          title_en       text not null,
          version        text,
          url            text not null,
          license        text not null check (license <> ''),
          license_url    text,
          attribution_ar text not null,
          attribution_en text not null,
          role           text not null,
          files          jsonb not null default '[]'
        );

        create table content.surahs (
          number            smallint primary key check (number between 1 and 114),
          name_ar           text not null,
          name_translit     text not null,
          name_en           text not null,
          revelation_place  text not null check (revelation_place in ('meccan', 'medinan')),
          revelation_order  smallint not null,
          verse_count       smallint not null,
          rukus             smallint not null,
          page_start        smallint not null,
          page_end          smallint not null,
          juz_start         smallint not null,
          word_count        integer not null,
          has_basmala       boolean not null
        );

        create table content.verses (
          id            integer primary key check (id between 1 and 6236),
          surah         smallint not null references content.surahs(number),
          ayah          smallint not null,
          key           text not null unique,
          page          smallint not null check (page between 1 and 604),
          juz           smallint not null check (juz between 1 and 30),
          line_start    smallint not null,
          line_end      smallint not null,
          hizb_mark     boolean not null,
          hizb_quarter  smallint not null,
          manzil        smallint not null,
          ruku          smallint not null,
          sajda         text check (sajda in ('recommended', 'obligatory')),
          text_qpc      text not null,
          number_text   text not null,
          text_tanzil   text not null,
          text_imlaei   text not null,
          norm          text not null,
          norm_uthmani  text not null,
          word_count    smallint not null,
          token_count   smallint not null,
          sha256        text not null,
          unique (surah, ayah)
        );
        create index verses_page_idx on content.verses (page);
        create index verses_juz_idx on content.verses (juz);
        create index verses_norm_trgm on content.verses using gin (norm gin_trgm_ops);
        create index verses_norm_uthmani_trgm on content.verses using gin (norm_uthmani gin_trgm_ops);

        create table content.tokens (
          id         integer primary key,
          verse_id   integer not null references content.verses(id),
          position   smallint not null,
          text       text not null,
          word_from  smallint not null,
          word_to    smallint not null,
          unique (verse_id, position)
        );

        create table content.roots (
          id           integer primary key,
          key          text not null unique,
          letters      text[] not null,
          spaced       text not null,
          translit     text not null,
          occurrences  integer not null,
          verse_count  integer not null,
          surah_count  integer not null,
          lemma_count  integer not null
        );
        create index roots_letters_idx on content.roots using gin (letters);

        create table content.lemmas (
          id           integer primary key,
          key          text not null unique,
          ar           text not null,
          ar_bare      text not null,
          norm         text not null,
          norm_plain   text not null,
          root_id      integer references content.roots(id),
          pos          text not null,
          verb_form    smallint,
          derivation   text,
          occurrences  integer not null,
          verse_count  integer not null,
          gloss_en     text,
          pattern      text
        );
        create index lemmas_root_idx on content.lemmas (root_id);
        create index lemmas_norm_idx on content.lemmas (norm);
        create index lemmas_norm_plain_idx on content.lemmas (norm_plain);

        create table content.words (
          id            integer primary key,
          verse_id      integer not null references content.verses(id),
          surah         smallint not null,
          ayah          smallint not null,
          position      smallint not null,
          location      text not null unique,
          token_from    smallint not null,
          token_to      smallint not null,
          text_uthmani  text not null,
          text_imlaei   text not null,
          norm          text not null,
          norm_uthmani  text not null,
          root_id       integer references content.roots(id),
          lemma_id      integer references content.lemmas(id),
          pos           text not null,
          definite      boolean not null,
          features      jsonb not null,
          segments      jsonb not null,
          translit      text,
          gloss_en      text,
          unique (verse_id, position)
        );
        create index words_root_idx on content.words (root_id, id);
        create index words_lemma_idx on content.words (lemma_id, id);
        create index words_norm_idx on content.words (norm);
        create index words_norm_uthmani_idx on content.words (norm_uthmani);
        create index words_norm_trgm on content.words using gin (norm gin_trgm_ops);

        create table content.root_variants (
          word_id   integer not null references content.words(id),
          source    text not null,
          root_key  text,
          primary key (word_id, source)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop schema if exists content cascade;")
