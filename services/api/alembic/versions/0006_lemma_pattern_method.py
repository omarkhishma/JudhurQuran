"""How a lemma's morphological pattern (wazn) was established: corpus tag, verb form, or letter match.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-02
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table content.lemmas
          add column pattern_method text
            check (pattern_method in ('tag', 'verb-form', 'verb-form-I', 'match'));
        create index lemmas_pattern_idx on content.lemmas (root_id, pattern);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop index content.lemmas_pattern_idx;
        alter table content.lemmas drop column pattern_method;
        """
    )
