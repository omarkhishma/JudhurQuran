"""Meanings (PLAN P3.1): al-Muyassar fī Gharīb per word occurrence and al-Mufradāt cut per word and sense.

Every row is a verbatim slice of its source with a locator and status ``extracted``; mappings carry their
method and confidence. al-Muyassar is display-only and never part of the bulk release. The source's
``start``/``end`` offsets are stored as ``start_offset``/``end_offset`` (``end`` is reserved in SQL).

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-03
"""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.gharib_works (
          id                text primary key,
          sort_order        int not null,
          lang              text not null,
          title_ar          text not null,
          title_en          text not null,
          publisher_ar      text not null,
          publisher_en      text not null,
          version           text,
          source_url        text,
          download_url      text,
          licence           text not null,
          licence_clause    text,
          licence_url       text,
          redistributable   boolean not null,
          display_only      boolean not null,
          attribution_ar    text not null,
          attribution_en    text not null,
          prepared_by_note  text,
          file              text,
          file_sha256       text
        );

        create table content.gharib_meanings (
          id                    text primary key,
          work_id               text not null references content.gharib_works(id),
          seq                   int not null,
          surah                 smallint not null,
          ayah                  smallint not null,
          ayah_label            text,
          verse_keys            text[] not null default '{}',
          word_locations        text[] not null default '{}',
          phrase_ar             text not null,
          meaning_ar            text not null,
          locator               text not null,
          paragraph             int,
          line                  int,
          mushaf_page           smallint,
          match_method          text not null,
          match_confidence      text not null,
          occurrences_in_verse  int,
          rekeyed_from          text,
          notes                 text[] not null default '{}',
          status                text not null check (status in ('extracted', 'reviewed'))
        );
        create index gharib_meanings_locations on content.gharib_meanings using gin (word_locations);

        create table content.mufradat_subentries (
          id                   text primary key,
          entry_id             int not null references content.lexicon_entries(id),
          work_id              text not null references content.lexicon_works(id),
          article_headword_ar  text not null,
          article_root_key     text,
          seq                  int not null,
          start_offset         int not null,
          end_offset           int not null,
          text_ar              text not null,
          cut_rule             text not null,
          headword_ar          text not null,
          headword_start       int,
          headword_end         int,
          headwords            jsonb not null,
          lemma_keys           text[] not null default '{}',
          lemma_key            text,
          match_method         text,
          match_confidence     text,
          unmapped_reason      text,
          verses               text[] not null default '{}',
          page_ref             text,
          page_method          text,
          source_ref           text,
          article_sha256       text,
          status               text not null check (status in ('extracted', 'reviewed'))
        );
        create index mufradat_subentries_lemma on content.mufradat_subentries (lemma_key);
        create index mufradat_subentries_lemmas on content.mufradat_subentries using gin (lemma_keys);

        create table content.mufradat_senses (
          id                  text primary key,
          subentry_id         text not null references content.mufradat_subentries(id),
          entry_id            int not null,
          work_id             text not null,
          list_no             int not null,
          list_kind           text not null,
          sense_index         int not null,
          marker_ar           text,
          marker_start        int,
          marker_end          int,
          announcement_ar     text,
          announcement_start  int,
          announcement_end    int,
          stated_count        int,
          found_count         int not null,
          start_offset        int not null,
          end_offset          int not null,
          text_ar             text not null,
          end_rule            text not null,
          verses              text[] not null default '{}',
          page_ref            text,
          status              text not null check (status in ('extracted', 'reviewed'))
        );
        create index mufradat_senses_subentry on content.mufradat_senses (subentry_id);

        create table content.mufradat_citations (
          id                text primary key,
          entry_id          int not null,
          subentry_id       text not null references content.mufradat_subentries(id),
          work_id           text not null,
          quote_ar          text not null,
          start_offset      int not null,
          end_offset        int not null,
          marked_by         text not null,
          reference_ar      text,
          reference_start   int,
          reference_end     int,
          reference_surah   int,
          reference_ayahs   int[] not null default '{}',
          verse_keys        text[] not null default '{}',
          status            text not null,
          method            text,
          score             real,
          exact             real,
          candidates        jsonb not null,
          ref_mismatch      boolean not null
        );
        create index mufradat_citations_subentry on content.mufradat_citations (subentry_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """drop table content.mufradat_citations; drop table content.mufradat_senses;
           drop table content.mufradat_subentries; drop table content.gharib_meanings; drop table content.gharib_works;"""
    )
