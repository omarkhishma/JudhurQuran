"""API keys (PLAN P10.2b, research 18): a signed-in reader makes keys for the public API — each shown once, kept only
as its hash with a short prefix to recognise it, revocable, its last day of use noted (never the requests). A key
reads at its own limit; without one, reads are limited per address. Deleting the account deletes its keys.

Revision ID: 0031
Revises: 0030
"""

from alembic import op

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table accounts.api_keys (
          id            uuid primary key default gen_random_uuid(),
          user_id       uuid not null references accounts.users(id) on delete cascade,
          name          text not null check (length(name) between 1 and 80),
          prefix        text not null check (prefix ~ '^jk_[A-Za-z0-9_-]{4,12}$'),
          key_hash      text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
          created_at    timestamptz not null default now(),
          last_used_on  date,
          revoked_at    timestamptz
        );
        create index api_keys_user_idx on accounts.api_keys (user_id);
        """
    )


def downgrade() -> None:
    op.execute("drop table accounts.api_keys;")
