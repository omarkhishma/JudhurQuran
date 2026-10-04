"""Each narrator's name in an isnād linked to his entry in the Taqrīb (P11.2b): the name's place in the verbatim text,
the entry chosen or none, the rule that chose it and its measured confidence, the candidates, and ``status`` ``auto``
until the board reviews it.

Revision ID: 0036
Revises: 0035
"""

from alembic import op

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.narrator_links (
          id           integer primary key,
          passage_id   integer not null references content.passages(id),
          ordinal      smallint not null,
          span_start   integer not null,
          span_end     integer not null,
          text         text not null,
          narrator_id  integer references content.narrators(id),
          rule         text not null,
          confidence   real not null check (confidence between 0 and 1),
          status       text not null check (status in ('auto', 'reviewed', 'rejected')),
          candidates   integer[] not null default '{}',
          unique (passage_id, ordinal)
        );
        create index narrator_links_narrator on content.narrator_links (narrator_id, passage_id);
        """
    )


def downgrade() -> None:
    op.execute("drop table content.narrator_links")
