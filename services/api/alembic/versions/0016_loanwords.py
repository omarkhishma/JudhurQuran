"""Loanword claims (PLAN P3.7a): al-Suyūṭī's «المهذب فيما وقع في القرآن من المعرب» — the introduction's dispute
over loanwords in the Quran, each view with the names the text gives; one entry per word he lists, verbatim
with its printed page and the languages it names; and each entry's mechanical links to Quran lemmas. Rows are
verbatim slices with locators, status ``extracted`` (registry data/loanwords.yaml).

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-03
"""

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.loanword_sources (
          id text primary key, sort_order smallint not null, title_ar text not null, title_en text not null,
          author_ar text not null, author_en text not null, death_hijri smallint, death_ce smallint,
          edition_ar text, edition_en text, scope_ar text, scope_en text, openiti_uri text, page_uri text,
          openiti_release text, openiti_commit text, source_url text, file_sha256 text, cross_check jsonb,
          licence text not null, licence_url text, licence_clause text, corpus_citation text, redistributable text,
          attribution_ar text not null, attribution_en text not null, use text
        );
        create table content.loanword_passages (
          id text primary key, source_id text not null references content.loanword_sources(id),
          ordinal integer not null, section text not null, kind text not null,
          view_id text, view_stated_as_ar text, view_held_by_ar jsonb, speakers jsonb, introduced_by_ar text,
          text_ar text not null, offsets jsonb, locator text, page smallint, pages jsonb, milestone text,
          copy_of_entry_id text, copy_heading_ar text, copy_headword_ar text, set_aside_block text,
          languages jsonb, notes jsonb, status text not null
        );
        create index loanword_passages_section_idx on content.loanword_passages (section, ordinal);
        create table content.loanword_entries (
          id text primary key, source_id text not null references content.loanword_sources(id),
          seq integer not null, chapter_ar text, chapter_seq smallint, heading_ar text, headword_ar text not null,
          headword_reads_ar text, heading_style text, heading_registered boolean, text_ar text not null,
          segments jsonb, locator text, page smallint, pages jsonb, milestone text, languages jsonb,
          language_keys jsonb, said_non_arabic boolean, link_status text, lemma_ids jsonb, link_methods jsonb,
          quran_verses jsonb, parts jsonb, candidates jsonb, unlinked_reason text, set_aside_copy_ids jsonb,
          notes jsonb, status text not null
        );
        create table content.loanword_links (
          id text primary key, entry_id text not null references content.loanword_entries(id),
          source_id text not null references content.loanword_sources(id), headword_ar text, part_ar text,
          kind text not null, lemma_id integer references content.lemmas(id), lemma_key text, lemma_ar text,
          lemma_pos text, method text not null, level text, confidence text, scope text, locations jsonb,
          verse_keys jsonb, evidence jsonb, excluded jsonb, status text not null
        );
        create index loanword_links_lemma_idx on content.loanword_links (lemma_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop table content.loanword_links;
        drop table content.loanword_entries;
        drop table content.loanword_passages;
        drop table content.loanword_sources;
        """
    )
