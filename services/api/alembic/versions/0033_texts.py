"""Texts beyond the Quran (P11.2, P11.3, P11.4a): hadith collections and books in the generic model.

A text says where it comes from (``info``: edition, licence, version, collection); chapters form a tree (``parent_id``,
``level``: a collection's kitāb and bāb, a book's headings); a passage keeps its verbatim text, the form id of each word
in the order the shared tokeniser cuts them, the roots its words reach (``roots`` where the form is the Quran's,
``roots_low`` where a pattern or a weak-root rule found it) and what its source says of it (``meta``: a hadith's number
and segments, a page). ``text_forms`` holds each written form's reading once. The Quran's rows leave these empty.

Revision ID: 0033
Revises: 0032
"""

from alembic import op

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table content.texts add column info jsonb;
        alter table content.chapters
          add column parent_id integer references content.chapters(id),
          add column level smallint;
        alter table content.passages
          add column form_ids integer[],
          add column roots text[],
          add column roots_low text[],
          add column meta jsonb;
        create index passages_roots on content.passages using gin (roots);
        create index passages_roots_low on content.passages using gin (roots_low);
        create table content.text_forms (
          id          integer primary key,
          norm        text not null unique,
          kind        text not null,
          confidence  real not null,
          clitics     text[] not null,
          readings    jsonb not null
        );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop table content.text_forms;
        drop index content.passages_roots_low;
        drop index content.passages_roots;
        alter table content.passages drop column meta, drop column roots_low, drop column roots, drop column form_ids;
        alter table content.chapters drop column level, drop column parent_id;
        alter table content.texts drop column info;
        """
    )
