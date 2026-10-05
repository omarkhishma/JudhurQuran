"""A comment that quotes its source (B41): a verse by its key or a dictionary article by its identifier, kept as that
reference and drawn from the dataset when the comment is read — never the quoted words. A deleted comment keeps no
quotation, as it keeps no words.

Revision ID: 0051
Revises: 0050
"""

from alembic import op

revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table graphs.comments add column quote jsonb
          check (quote is null or (jsonb_typeof(quote) = 'object' and quote ->> 'kind' in ('verse', 'entry')));
        alter table graphs.comments add constraint comments_quote_gone check (deleted_at is null or quote is null);
        """
    )


def downgrade() -> None:
    op.execute("alter table graphs.comments drop constraint comments_quote_gone; alter table graphs.comments drop column quote;")
