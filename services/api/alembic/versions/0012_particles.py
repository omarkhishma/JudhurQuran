"""Particle entries (PLAN P3.8): Ibn Hishām's Mughnī al-Labīb and al-Murādī's al-Janā al-Dānī.

Each entry is linked to corpus lemmas (``lemma_slugs``) or to the affixes the corpus tags (``affix_tags``,
e.g. ``w:CONJ+``); senses keep the author's numbering and nesting. Rows are verbatim slices with locators,
status ``extracted``; particles never get a root (law L2). Offsets are stored as ``start_offset``/``end_offset``.

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-03
"""

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.particle_sources (
          id                  text primary key,
          sort_order          smallint not null,
          title_ar            text not null,
          title_en            text not null,
          author_ar           text not null,
          author_en           text not null,
          death_hijri         smallint,
          death_ce            smallint,
          edition_ar          text,
          edition_en          text,
          scope_ar            text,
          scope_en            text,
          openiti_uri         text,
          page_uri            text,
          openiti_release     text,
          openiti_commit      text,
          source_url          text,
          file_sha256         text,
          page_source_sha256  text,
          licence             text not null,
          licence_url         text,
          licence_clause      text,
          redistributable     text,
          attribution_ar      text not null,
          attribution_en      text not null,
          use                 text
        );

        create table content.particle_entries (
          id                    text primary key,
          source_id             text not null references content.particle_sources(id),
          seq                   int not null,
          section_ar            text not null,
          chapter_letters       smallint,
          heading_ar            text,
          headword_ar           text not null,
          headword_supplied     boolean not null,
          headword_evidence_ar  text,
          descriptor_ar         text,
          listed_as_ar          jsonb,
          mapped_forms_ar       jsonb not null,
          lemma_ids             int[] not null default '{}',
          lemma_keys            text[] not null default '{}',
          lemma_slugs           text[] not null default '{}',
          affix_tags            text[] not null default '{}',
          corpus_pos            jsonb not null,
          corpus_links          jsonb not null,
          homograph_lemma_keys  jsonb not null,
          match_method          text,
          match_confidence      text,
          match_constraints     jsonb not null,
          match_excluded        jsonb not null,
          unmapped_reason       text,
          stated_count          int,
          stated_count_ar       text,
          sense_count           int not null,
          first_list_count      int not null,
          lists                 jsonb not null,
          locator               text not null,
          page_vol              int,
          page                  int,
          milestone             text,
          notes                 jsonb not null,
          status                text not null check (status in ('extracted', 'reviewed'))
        );
        create index particle_entries_lemma_slugs on content.particle_entries using gin (lemma_slugs);
        create index particle_entries_affix_tags on content.particle_entries using gin (affix_tags);

        create table content.particle_senses (
          id              text primary key,
          entry_id        text not null references content.particle_entries(id),
          source_id       text not null references content.particle_sources(id),
          ordinal         int not null,
          kind            text not null check (kind in ('intro', 'sense', 'note')),
          list_no         int,
          list_depth      int,
          parent_id       text,
          sense_index     int,
          marker_ar       text,
          marker_noun_ar  text,
          label_ar        text,
          text_ar         text not null,
          verses          jsonb not null,
          locator         text not null,
          page_vol        int,
          page            int,
          milestone       text,
          notes           jsonb not null,
          status          text not null check (status in ('extracted', 'reviewed'))
        );
        create index particle_senses_entry on content.particle_senses (entry_id, ordinal);

        create table content.particle_citations (
          id             text primary key,
          sense_id       text not null references content.particle_senses(id),
          ordinal        int not null,
          kind           text not null,
          marked_by      text not null,
          quote          text,
          start_offset   int not null,
          end_offset     int not null,
          surah          int,
          surah_hint     int,
          verse_keys     jsonb not null,
          candidates     jsonb not null,
          status         text not null,
          method         text,
          score          real,
          exact          real,
          hint_mismatch  boolean not null
        );
        create index particle_citations_sense on content.particle_citations (sense_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """drop table content.particle_citations; drop table content.particle_senses;
           drop table content.particle_entries; drop table content.particle_sources;"""
    )
