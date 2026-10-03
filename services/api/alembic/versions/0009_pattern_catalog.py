"""Pattern catalog (PLAN P3.3): what each pattern does, verbatim from named sarf works.

Rows are slices of al-Shāfiya, al-Kāfiya and al-Raḍī's commentary with their locators, mapped to our
pattern slugs only mechanically (method and confidence per row); status stays ``extracted`` until an editor
reviews a row. Nothing is generated (law L2).

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-03
"""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.pattern_sources (
          id               text primary key,
          role             text not null check (role in ('matn', 'commentary')),
          comments_on      text references content.pattern_sources(id),
          sort_order       int not null,
          title_ar         text not null,
          title_en         text not null,
          author_ar        text not null,
          author_en        text not null,
          death_hijri      int,
          death_ce         int,
          edition_ar       text,
          edition_en       text,
          openiti_uri      text,
          openiti_release  text,
          openiti_commit   text,
          source_url       text,
          file_sha256      text,
          page_numbering   text not null check (page_numbering in ('matches-print', 'unverified')),
          licence          text not null,
          licence_url      text,
          licence_clause   text,
          redistributable  text,
          attribution_ar   text not null,
          attribution_en   text not null
        );

        create table content.pattern_functions (
          id                text primary key,
          source_id         text not null references content.pattern_sources(id),
          seq               int not null,
          section           text not null,
          heading_ar        text,
          kind              text not null
                            check (kind in ('meaning', 'inventory', 'definition', 'statement', 'commentary')),
          statement_index   int,
          sense_index       int,
          pattern_ar        text,
          pattern_slugs     text[] not null default '{}',
          inflected_slugs   text[] not null default '{}',
          suffix_slugs      text[] not null default '{}',
          form_number       int,
          match_method      text,
          match_confidence  text check (match_confidence in ('high', 'medium')),
          match_candidates  text[] not null default '{}',
          unmapped_reason   text,
          text_ar           text not null,
          examples_ar       text[] not null default '{}',
          mentions          jsonb not null,
          comments_on       text[] not null default '{}',
          cue_ar            text,
          locator           text not null,
          page_vol          int,
          page              int,
          milestone         text,
          notes             text[] not null default '{}',
          status            text not null check (status in ('extracted', 'reviewed'))
        );
        create index pattern_functions_pattern_slugs on content.pattern_functions using gin (pattern_slugs);
        create index pattern_functions_inflected_slugs on content.pattern_functions using gin (inflected_slugs);
        create index pattern_functions_suffix_slugs on content.pattern_functions using gin (suffix_slugs);
        create index pattern_functions_comments_on on content.pattern_functions using gin (comments_on);
        """
    )


def downgrade() -> None:
    op.execute("drop table content.pattern_functions; drop table content.pattern_sources;")
