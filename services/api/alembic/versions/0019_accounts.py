"""Accounts and sync (PLAN P6, decision D3): optional accounts for sync and credit, in their own schema.

Nothing here is needed to read, search or study — every feature works without an account (L6). An account
holds what the reader chooses to sync: their records (encrypted at rest, one row per record, newest wins,
deletions as tombstones), each replaced version kept 30 days so a merge never destroys anything (P6.2), their
sessions (opaque tokens, hashed; no cookie), single-use sign-in tokens, and — only if they opt in — lookup
events for a classroom, with a stated retention. The content loader never touches this schema.

Revision ID: 0019
Revises: 0018
"""

from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create schema if not exists accounts;

        create table accounts.users (
          id            uuid primary key default gen_random_uuid(),
          email         text not null unique check (email = lower(email)),
          display_name  text,
          affiliation   text,
          orcid         text check (orcid is null or orcid ~ '^\\d{4}-\\d{4}-\\d{4}-\\d{3}[\\dX]$'),
          role          text not null default 'member' check (role in ('member', 'reviewer', 'instructor', 'admin')),
          settings      jsonb not null default '{}',
          created_at    timestamptz not null default now(),
          last_seen_at  timestamptz
        );

        create table accounts.identities (
          provider    text not null,
          subject     text not null,
          user_id     uuid not null references accounts.users(id) on delete cascade,
          email       text,
          created_at  timestamptz not null default now(),
          primary key (provider, subject)
        );

        create table accounts.login_tokens (
          token_hash  text primary key,
          email       text not null,
          return_to   text,
          created_at  timestamptz not null default now(),
          expires_at  timestamptz not null,
          used_at     timestamptz
        );
        create index login_tokens_email_idx on accounts.login_tokens (email, created_at);

        create table accounts.sessions (
          token_hash    text primary key,
          user_id       uuid not null references accounts.users(id) on delete cascade,
          device        text,
          created_at    timestamptz not null default now(),
          last_seen_at  timestamptz not null default now(),
          expires_at    timestamptz not null
        );
        create index sessions_user_idx on accounts.sessions (user_id);

        create sequence accounts.record_seq;
        create table accounts.records (
          user_id     uuid not null references accounts.users(id) on delete cascade,
          store       text not null,
          key         text not null,
          value       bytea,
          deleted     boolean not null default false,
          updated_at  timestamptz not null,
          seq         bigint not null,
          primary key (user_id, store, key)
        );
        create index records_seq_idx on accounts.records (user_id, seq);

        create table accounts.record_history (
          id           bigserial primary key,
          user_id      uuid not null references accounts.users(id) on delete cascade,
          store        text not null,
          key          text not null,
          value        bytea,
          deleted      boolean not null,
          updated_at   timestamptz not null,
          replaced_at  timestamptz not null default now()
        );
        create index record_history_user_idx on accounts.record_history (user_id, replaced_at);

        create table accounts.delete_requests (
          token_hash  text primary key,
          user_id     uuid not null references accounts.users(id) on delete cascade,
          expires_at  timestamptz not null
        );

        create table accounts.lookup_events (
          user_id  uuid not null references accounts.users(id) on delete cascade,
          at       timestamptz not null default now(),
          lemma    text,
          root     text,
          verse    text
        );
        create index lookup_events_user_idx on accounts.lookup_events (user_id, at);
        """
    )


def downgrade() -> None:
    op.execute("drop schema accounts cascade;")
