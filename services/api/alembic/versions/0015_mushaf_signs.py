"""What the signs written in the mushaf mean (PLAN P3.9): the waqf, sakt, sajda and ḥizb signs in the words of
the Madinah Mushaf's own note «التعريف بهذا المصحف» (knowledge source ``kfgqpc-mushaf-key``), each tied to the
code point the KFGQPC text writes it with.

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-03
"""

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.mushaf_signs (
          id             text primary key,
          sort_order     smallint not null,
          kind           text not null check (kind in ('waqf', 'sakt', 'sajda', 'hizb')),
          codepoints     jsonb not null,
          chars          text not null,
          label_ar       text not null,
          text_ar        text not null,
          example_key    text,
          example_token  smallint,
          page           text not null,
          occurrences    integer not null,
          source_id      text not null references content.knowledge_sources(id)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table content.mushaf_signs;")
