"""A root's count in each text beyond the Quran (P11.4b): how many of the text's passages hold it, sure apart from
possible, made once by the build — the root's life across the texts and the panel's timeline read it at once
instead of counting passages at each request.

Revision ID: 0040
Revises: 0039
"""

from alembic import op

revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.root_texts (
          root      text not null,
          text_id   integer not null references content.texts(id),
          sure      integer not null,
          possible  integer not null,
          primary key (root, text_id)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table content.root_texts")
