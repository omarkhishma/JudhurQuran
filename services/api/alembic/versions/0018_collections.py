"""Curated sets of Quranic words (PLAN P5.2, COL-Q03): editorial titles, copy and rules from
data/collections.yaml, items computed by the build from each rule (most frequent first), each with its
lemma's first place in the mushaf.

Revision ID: 0018
Revises: 0017
"""

from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.collections (
          id          text primary key,
          ordinal     smallint not null,
          colour      text not null,
          title_ar    text not null,
          title_en    text not null,
          intro_ar    text not null,
          intro_en    text not null,
          why_ar      text not null,
          why_en      text not null,
          rule        jsonb not null,
          item_count  integer not null,
          root_count  integer not null,
          occurrences integer not null,
          coverage    numeric(6, 4) not null,
          quote       jsonb,
          source      jsonb
        );
        create table content.collection_items (
          collection_id  text not null references content.collections(id),
          ordinal        smallint not null,
          lemma_id       integer not null references content.lemmas(id),
          first_location text,
          primary key (collection_id, ordinal)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table content.collection_items; drop table content.collections;")
