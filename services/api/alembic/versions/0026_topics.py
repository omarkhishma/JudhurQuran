"""Topics (PLAN P8.3, research 06 Part 3, D29): headings a source gives and the verses it gathers under each.

Quranpedia's Arabic tree (shown to readers, credited with its version) and QSAC's English tags (kept for the editorial
board, ``shown`` false). A topic keeps its source's id and name verbatim; a link keeps its source and version. Replaced
whole at each dataset release, as the rest of ``content`` is; the board's verdicts on links live in ``editorial``.

Revision ID: 0026
Revises: 0025
"""

from alembic import op

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.topic_sources (
          id              text primary key,
          title_ar        text not null,
          title_en        text not null,
          publisher_ar    text not null,
          publisher_en    text not null,
          language        text not null,
          method          text not null,
          version         text not null,
          generated_at    text,
          url             text not null,
          licence         text not null,
          licence_url     text not null,
          shown           boolean not null,
          attribution_ar  text not null,
          attribution_en  text not null,
          file_sha256     text not null
        );

        create table content.topics (
          id           text primary key,
          source_id    text not null references content.topic_sources(id),
          source_ref   text not null,
          name_ar      text,
          name_en      text,
          description  text,
          parent_id    text references content.topics(id) deferrable initially deferred,
          level        smallint not null,
          verse_count  integer not null,
          name_norm    text,
          check (name_ar is not null or name_en is not null)
        );
        create index topics_parent_idx on content.topics (parent_id);
        create index topics_source_idx on content.topics (source_id, level);
        create index topics_name_trgm on content.topics using gin (name_norm gin_trgm_ops);

        create table content.topic_links (
          id         text primary key,  -- topic@verse: what the editorial board's verdict names
          topic_id   text not null references content.topics(id),
          verse_key  text not null,
          source_id  text not null references content.topic_sources(id),
          version    text not null,
          unique (topic_id, verse_key)
        );
        create index topic_links_verse_idx on content.topic_links (verse_key);
        """
    )


def downgrade() -> None:
    op.execute("drop table content.topic_links; drop table content.topics; drop table content.topic_sources;")
