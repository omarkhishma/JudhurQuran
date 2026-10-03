"""The editorial workbench (PLAN P3.0, research 14): the board's work, kept apart from the content.

The loader replaces `content.*` at every dataset release; what the editorial board writes and decides lives here,
keyed by stable keys — a root's key, a pattern's or a lemma's slug, a glossary key, an extracted row's id — and is
read beside the content at request time. An entry is in force only when an editor other than its author approves
its current revision: the database refuses a self-decision and a second approval of one revision by one person,
whatever the API does. Every save, submission and decision is logged.

Revision ID: 0023
Revises: 0022
"""

from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create schema if not exists editorial;

        create table editorial.entries (
          id          uuid primary key default gen_random_uuid(),
          kind        text not null check (kind in ('root_gloss', 'root_core', 'pattern_function', 'pattern_plain',
                                                    'sense_list', 'glossary', 'verdict')),
          target      text not null check (length(target) between 1 and 200),
          value       jsonb not null,
          sources     jsonb not null default '[]',
          status      text not null default 'draft' check (status in ('draft', 'review', 'changes', 'approved', 'retired')),
          revision    smallint not null default 1,
          author_id   uuid references accounts.users(id) on delete set null,
          created_at  timestamptz not null default now(),
          updated_at  timestamptz not null default now(),
          decided_at  timestamptz
        );
        -- one piece of work open at a time on a target; the approved one stays in force until a newer replaces it
        create unique index entries_one_open on editorial.entries (kind, target) where status in ('draft', 'review', 'changes');
        create unique index entries_one_in_force on editorial.entries (kind, target) where status = 'approved';
        create index entries_status_idx on editorial.entries (kind, status, updated_at desc);
        create index entries_author_idx on editorial.entries (author_id, updated_at desc);

        create table editorial.reviews (
          id           bigserial primary key,
          entry_id     uuid not null references editorial.entries(id) on delete cascade,
          revision     smallint not null,
          reviewer_id  uuid references accounts.users(id) on delete set null,
          decision     text not null check (decision in ('approve', 'changes')),
          note         text check (note is null or length(note) <= 2000),
          created_at   timestamptz not null default now()
        );
        create index reviews_entry_idx on editorial.reviews (entry_id, created_at);
        create unique index reviews_one_approval on editorial.reviews (entry_id, revision, reviewer_id) where decision = 'approve';

        -- two people: the author never decides on their own work, in the database as well as the API
        create function editorial.no_self_review() returns trigger language plpgsql as $$
        begin
          if new.reviewer_id is not null and exists (
            select 1 from editorial.entries e where e.id = new.entry_id and e.author_id = new.reviewer_id
          ) then
            raise exception 'an author cannot decide on their own entry' using errcode = 'check_violation';
          end if;
          return new;
        end $$;
        create trigger reviews_no_self before insert on editorial.reviews
          for each row execute function editorial.no_self_review();

        create table editorial.log (
          id        bigserial primary key,
          entry_id  uuid references editorial.entries(id) on delete cascade,
          actor_id  uuid references accounts.users(id) on delete set null,
          action    text not null check (action in ('saved', 'submitted', 'approved', 'changes', 'withdrawn', 'retired')),
          revision  smallint not null,
          detail    jsonb not null default '{}',
          at        timestamptz not null default now()
        );
        create index log_entry_idx on editorial.log (entry_id, at);
        """
    )


def downgrade() -> None:
    op.execute("drop schema editorial cascade")
