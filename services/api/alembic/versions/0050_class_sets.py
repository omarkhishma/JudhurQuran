"""A class's sets of words (B29): a teacher's own set for a class — its title and the rule its words are computed by,
never a list of words someone typed — read by the class's members.

Revision ID: 0050
Revises: 0049
"""

from alembic import op

revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table classroom.sets (
          id          uuid primary key default gen_random_uuid(),
          class_id    uuid not null references classroom.classes(id) on delete cascade,
          title       text not null check (length(title) between 1 and 120),
          rule        jsonb not null check (jsonb_typeof(rule) = 'object'),
          created_at  timestamptz not null default now()
        );
        create index sets_class_idx on classroom.sets (class_id, created_at);
        """
    )


def downgrade() -> None:
    op.execute("drop table classroom.sets;")
