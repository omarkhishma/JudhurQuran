"""Quran knowledge layers and relation seeds (PLAN P3.9, P8.4/P3.1).

Every row is verbatim from a pinned, attributed source with its locator; nothing is generated (law L2).
Knowledge rows name a source in ``knowledge_sources``; relation rows name a classical work in
``relation_sources`` and stay ``extracted`` until an editor reviews them.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-03
"""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.knowledge_sources (
          id              text primary key,
          kind            text not null,
          use             text not null,
          title_ar        text not null,
          title_en        text not null,
          version         text,
          url             text not null,
          license         text not null,
          license_ar      text,
          license_url     text,
          attribution_ar  text not null,
          attribution_en  text not null
        );

        create table content.surah_cards (
          surah                       smallint primary key references content.surahs(number),
          name_ar                     text not null,
          place                       text not null check (place in ('meccan', 'medinan')),
          revelation_order            smallint not null,
          verse_count                 smallint not null,
          tc_place                    text not null,
          tc_place_ar                 text not null,
          tc_revelation_order         smallint not null,
          tc_surah_class              text not null,
          tc_opening_type             text not null,
          place_agrees                boolean not null,
          order_agrees                boolean not null,
          names                       text,
          names_notes                 jsonb,
          revelation                  text,
          revelation_notes            jsonb,
          virtues                     text,
          virtues_notes               jsonb,
          count_text_a                text,
          count_text_a_notes          jsonb,
          count_text_b                text,
          count_text_b_notes          jsonb,
          aims                        text,
          aims_notes                  jsonb,
          truncated_fields            text[],
          verse_counts_a              jsonb,
          verse_counts_b              jsonb,
          verse_counts_status         text not null check (verse_counts_status in ('agree', 'one-text', 'disagree', 'unparsed')),
          verse_counts_differences    jsonb,
          verse_counts_checks         jsonb not null,
          source_ids                  text[] not null,
          tc_study_preferred_period   text check (tc_study_preferred_period in ('makki', 'madani'))
        );

        create table content.verse_places (
          id              integer primary key,
          verse_from      integer not null references content.verses(id),
          verse_to        integer not null references content.verses(id),
          surah           smallint not null,
          ayah_from       smallint not null,
          ayah_to         smallint not null,
          place           text,
          period          text check (period in ('makki', 'madani')),
          role            text not null check (role in ('source-note', 'reported', 'preferred')),
          attributed_to   text,
          quote           text not null,
          context         text not null,
          method          text not null,
          scope           text not null check (scope in ('verses', 'surah')),
          source_id       text not null references content.knowledge_sources(id),
          tc_check        text
        );
        create index verse_places_range_idx on content.verse_places (verse_from, verse_to);

        create table content.asbab (
          id              integer primary key,
          work            text not null check (work in ('tafsircenter', 'wahidi', 'suyuti')),
          source_id       text not null references content.knowledge_sources(id),
          surah           smallint,
          ayah_from       smallint,
          ayah_to         smallint,
          verse_from      integer references content.verses(id),
          verse_to        integer references content.verses(id),
          number          integer,
          heading         text,
          text            text not null,
          takhrij         text,
          notes           jsonb,
          locator         text not null,
          match_method    text,
          confidence      text,
          page            text,
          section_kind    text not null check (section_kind in ('narration', 'section', 'surah-intro', 'chapter', 'front-matter'))
        );
        create index asbab_range_idx on content.asbab (verse_from, verse_to);

        create table content.verse_crossrefs (
          id              integer primary key,
          work_id         text not null references content.works(id),
          passage_id      integer not null references content.work_passages(id),
          from_verse      integer not null references content.verses(id),
          to_verse        integer not null references content.verses(id),
          to_verse_end    integer not null references content.verses(id),
          method          text not null check (method in ('reference', 'quote')),
          confidence      text not null check (confidence in ('high', 'medium', 'low')),
          quote           text,
          reference       text,
          quote_check     text,
          resolution      text not null,
          mentions        integer not null,
          quote_found_at  text,
          source_id       text not null references content.knowledge_sources(id)
        );
        create index verse_crossrefs_from_idx on content.verse_crossrefs (from_verse);
        create index verse_crossrefs_to_idx on content.verse_crossrefs (to_verse, to_verse_end);

        create table content.entity_candidates (
          id                    integer primary key,
          lemma_id              integer not null references content.lemmas(id),
          lemma_key             text not null,
          name_ar               text not null,
          name_plain            text not null,
          occurrences           integer not null,
          verse_count           integer not null,
          verses                integer[] not null,
          wikidata_id           text,
          wikidata_label_ar     text,
          wikidata_label_en     text,
          wikidata_description  text,
          wikidata_rule         text,
          wikidata_evidence     text,
          wikidata_suggestions  jsonb,
          status                text not null check (status in ('candidate', 'reviewed')),
          source_ids            text[] not null
        );
        create index entity_candidates_lemma_idx on content.entity_candidates (lemma_id);
        create index entity_candidates_verses_idx on content.entity_candidates using gin (verses);

        create table content.relation_sources (
          id                text primary key,
          kind              text not null,
          sort_order        smallint not null,
          title_ar          text not null,
          title_en          text not null,
          author_ar         text not null,
          author_en         text not null,
          death_hijri       smallint,
          death_ce          smallint,
          edition_ar        text,
          edition_en        text,
          openiti_uri       text not null,
          openiti_release   text not null,
          openiti_commit    text not null,
          source_url        text not null,
          file_sha256       text not null,
          licence           text not null,
          licence_url       text not null,
          licence_clause    text not null,
          redistributable   text not null,
          attribution_ar    text not null,
          attribution_en    text not null
        );

        create table content.relation_entries (
          id                text primary key,
          source_id         text not null references content.relation_sources(id),
          seq               integer not null,
          printed_number    text,
          heading_ar        text not null,
          headword_ar       text not null,
          terms_ar          jsonb not null,
          letters_ar        text,
          root_key          text,
          lemma_key         text,
          match_method      text,
          match_confidence  text,
          unmapped_reason   text,
          match_candidates  jsonb not null,
          stated_count      integer,
          stated_count_ar   text,
          sense_count       integer,
          intro_ar          text,
          section_ar        text,
          locator           text not null,
          page_vol          integer,
          page              integer,
          milestone         text,
          notes             jsonb not null,
          status            text not null,
          unique (source_id, seq)
        );
        create index relation_entries_root_idx on content.relation_entries (root_key);
        create index relation_entries_lemma_idx on content.relation_entries (lemma_key);

        create table content.relation_candidates (
          id                        text primary key,
          type                      text not null check (type in ('wujuh_sense', 'furuq_contrast', 'didd', 'near_synonym_candidate')),
          source_id                 text not null references content.relation_sources(id),
          entry_id                  text not null references content.relation_entries(id),
          locator                   text not null,
          page_vol                  integer,
          page                      integer,
          milestone                 text,
          headword_ar               text not null,
          target_ar                 text,
          terms_ar                  jsonb,
          root_key                  text,
          lemma_key                 text,
          match_method              text,
          match_confidence          text,
          unmapped_reason           text,
          match_candidates          jsonb not null,
          target_root_key           text,
          target_lemma_key          text,
          target_match_method       text,
          target_match_confidence   text,
          target_unmapped_reason    text,
          target_match_candidates   jsonb not null,
          sense_index               integer,
          sense_marker_ar           text,
          sense_list                integer,
          sense_label_ar            text,
          text_ar                   text not null,
          verses                    jsonb not null,
          derived_from              text references content.relation_candidates(id) deferrable initially deferred,
          derivation                text,
          status                    text not null default 'extracted' check (status in ('extracted', 'reviewed', 'rejected'))
        );
        create index relation_candidates_root_idx on content.relation_candidates (root_key);
        create index relation_candidates_target_root_idx on content.relation_candidates (target_root_key);
        create index relation_candidates_type_idx on content.relation_candidates (type);
        create index relation_candidates_entry_idx on content.relation_candidates (entry_id);

        create table content.relation_citations (
          id              text primary key,
          candidate_id    text not null references content.relation_candidates(id) on delete cascade,
          ordinal         integer not null,
          kind            text not null,
          marked_by       text not null,
          quote           text,
          start           integer not null,
          "end"           integer not null,
          surah           integer,
          surah_hint      integer,
          verse_keys      jsonb not null,
          status          text not null,
          method          text,
          score           real,
          exact           real,
          candidates      jsonb not null,
          hint_mismatch   boolean not null
        );
        create index relation_citations_candidate_idx on content.relation_citations (candidate_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop table if exists content.relation_citations;
        drop table if exists content.relation_candidates;
        drop table if exists content.relation_entries;
        drop table if exists content.relation_sources;
        drop table if exists content.entity_candidates;
        drop table if exists content.verse_crossrefs;
        drop table if exists content.asbab;
        drop table if exists content.verse_places;
        drop table if exists content.surah_cards;
        drop table if exists content.knowledge_sources;
        """
    )
