"""The lexica's articles as citable things (PLAN P1.7a): each carries its namespaced identifier, ``dict:<work>:<root>``
(``-2``, ``-3``… for a work's further articles on a root), issued once by the build's append-only registry
(``data/registry/dict-articles.tsv``) and never given to another article.

Revision ID: 0044
Revises: 0043
"""

from alembic import op

revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table content.lexicon_entries add column uri text;
        create unique index lexicon_entries_uri on content.lexicon_entries (uri);
        """
    )


def downgrade() -> None:
    op.execute("drop index content.lexicon_entries_uri; alter table content.lexicon_entries drop column uri;")
