"""Generic text model, patterns, glossary, corpora, senses; lemma slugs (PLAN P1.1, P1.2, P1.3b, P1.7a).

texts → chapters → passages → passage_tokens hold every text the product reads. The Quran is
projected into them from the verified Quran tables; its passages carry no copy of the mushaf text
(``ar_full`` is null and readers join ``verses.text_qpc``). Every row has a namespaced ``uri``.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-03
"""

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.texts (
          id             integer primary key,
          slug           text not null unique,
          uri            text not null unique,
          kind           text not null check (kind in ('quran', 'hadith', 'book', 'dictionary', 'user')),
          title_ar       text not null,
          title_en       text not null,
          author_ar      text,
          author_en      text,
          meta_ar        text,
          meta_en        text,
          era_year       integer,
          source_id      text references content.sources(id),
          sort_order     smallint not null,
          chapter_count  integer not null,
          passage_count  integer not null,
          token_count    integer not null
        );

        create table content.chapters (
          id              integer primary key,
          text_id         integer not null references content.texts(id),
          ordinal         integer not null,
          uri             text not null unique,
          title_ar        text not null,
          title_en        text not null,
          title_translit  text,
          passage_count   integer not null,
          meta            jsonb not null default '{}',
          unique (text_id, ordinal)
        );

        create table content.passages (
          id           integer primary key,
          text_id      integer not null references content.texts(id),
          chapter_id   integer not null references content.chapters(id),
          ordinal      integer not null,
          ref          text not null,
          uri          text not null unique,
          verse_id     integer references content.verses(id),
          ar_full      text,
          norm         text not null,
          token_count  integer not null,
          unique (chapter_id, ordinal),
          unique (text_id, ref),
          check ((verse_id is null) <> (ar_full is null))
        );
        create index passages_text_idx on content.passages (text_id, chapter_id, ordinal);

        create table content.patterns (
          id            integer primary key,
          slug          text not null unique,
          ar            text not null unique,
          ar_bare       text not null,
          translit      text not null,
          form_number   smallint,
          pos_hint      text,
          lemma_count   integer not null,
          occurrences   integer not null,
          function_ar   text,
          function_en   text,
          plain_ar      text,
          plain_en      text
        );

        alter table content.lemmas
          add column slug text,
          add column translit text,
          add column pattern_id integer references content.patterns(id),
          add column pos_ar text,
          add column pos_en text;
        create unique index lemmas_slug_idx on content.lemmas (slug);
        create index lemmas_pattern_id_idx on content.lemmas (pattern_id);

        alter table content.roots
          add column gloss_en text,
          add column gist_ar text,
          add column gist_source jsonb;

        create table content.passage_tokens (
          id            integer primary key,
          passage_id    integer not null references content.passages(id),
          ordinal       integer not null,
          uri           text not null unique,
          surface       text not null,
          surface_bare  text not null,
          norm          text not null,
          lemma_id      integer references content.lemmas(id),
          root_id       integer references content.roots(id),
          pattern_id    integer references content.patterns(id),
          pos           text,
          confidence    real not null check (confidence between 0 and 1),
          word_id       integer references content.words(id),
          unique (passage_id, ordinal)
        );
        create index passage_tokens_root_idx on content.passage_tokens (root_id, id);
        create index passage_tokens_lemma_idx on content.passage_tokens (lemma_id, id);
        create index passage_tokens_pattern_idx on content.passage_tokens (pattern_id, id);
        create index passage_tokens_norm_idx on content.passage_tokens (norm);

        create table content.corpora (
          id          text primary key,
          text_id     integer references content.texts(id),
          label_ar    text not null,
          label_en    text not null,
          year        integer not null,
          sort_order  smallint not null
        );

        create table content.glossary_terms (
          key          text primary key,
          category     text not null,
          category_ar  text not null,
          category_en  text not null,
          label_ar     text not null,
          label_en     text not null,
          body_ar      text not null,
          body_en      text not null,
          href         text,
          jump_target  text,
          sort_order   smallint not null
        );

        -- Numbered senses per lemma, each tied to its sources. Written in the editorial workbench (P3);
        -- the reader shows an honest empty state until a lemma has them.
        create table content.senses (
          id           integer primary key,
          lemma_id     integer not null references content.lemmas(id),
          ordinal      smallint not null,
          text_ar      text,
          text_en      text,
          sources      jsonb not null default '[]',
          status       text not null check (status in ('sourced', 'reviewed')),
          unique (lemma_id, ordinal),
          check (text_ar is not null or text_en is not null)
        );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop table content.senses; drop table content.glossary_terms; drop table content.corpora;
        drop table content.passage_tokens;
        alter table content.roots drop column gloss_en, drop column gist_ar, drop column gist_source;
        alter table content.lemmas drop column slug, drop column translit, drop column pattern_id, drop column pos_ar, drop column pos_en;
        drop table content.patterns; drop table content.passages; drop table content.chapters;
        drop table content.texts;
        """
    )
