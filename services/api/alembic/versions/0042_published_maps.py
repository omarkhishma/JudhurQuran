"""Published maps (PLAN P8.5, research 13; the handoff's 08 §8.6, EDT-343…346).

A map is published by its signed-in owner under a slug: the whole map as it was, an immutable version, read by
anyone. Publishing again adds a version; every version stays, each cited by its own address, and the database
refuses any change to one. Withdrawing a map — by its owner, by the board after a report, or with the account —
deletes its versions; the slug stays in `slugs` for ever, so an address once cited never shows another map.
Fork and cite counts are numbers only: nothing is kept about who forked or cited. A report names its reader (a
signed-in act, like a proposal's report) until the account goes.

Revision ID: 0042
Revises: 0041
"""

from alembic import op

revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        -- every slug ever published, kept when its map is withdrawn: an address never changes hands
        create table graphs.slugs (
          slug        text primary key
                      check (slug ~ '^[a-z0-9ء-ي]+(-[a-z0-9ء-ي]+)*$' and char_length(slug) between 3 and 60),
          created_at  timestamptz not null default now()
        );

        create table graphs.published (
          slug                 text primary key references graphs.slugs(slug),
          owner_id             uuid not null references accounts.users(id) on delete cascade,
          -- the owner's own id for the map in their browser: their copy and the published one are one map
          local_id             text not null check (local_id ~ '^[A-Za-z0-9_-]{1,40}$'),
          latest               integer not null default 1 check (latest >= 1),
          fork_count           integer not null default 0 check (fork_count >= 0),
          cite_count           integer not null default 0 check (cite_count >= 0),
          -- a fork, published: the map it was copied from, by its slug and version (the original may be withdrawn)
          forked_from          text references graphs.slugs(slug),
          forked_from_version  integer,
          created_at           timestamptz not null default now(),
          updated_at           timestamptz not null default now(),
          unique (owner_id, local_id)
        );
        create index published_updated_idx on graphs.published (updated_at desc);
        create index published_owner_idx on graphs.published (owner_id, updated_at desc);

        create table graphs.published_versions (
          slug          text not null references graphs.published(slug) on delete cascade,
          version       integer not null check (version >= 1),
          title         text not null check (char_length(title) between 1 and 200),
          description   text not null default '' check (char_length(description) <= 500),
          kind          text not null check (kind in ('root', 'topic', 'meaning', 'free')),
          doc           jsonb not null,
          doc_version   smallint not null default 2,
          -- cards (frames left out), roots and words, and the first root's letters for a list row
          counts        jsonb not null,
          published_at  timestamptz not null default now(),
          primary key (slug, version)
        );

        -- a version is what was published: never changed (it goes only with its map)
        create function graphs.version_unchanged() returns trigger language plpgsql as $$
        begin
          raise exception 'a published version is never changed' using errcode = 'check_violation';
        end $$;
        create trigger published_versions_unchanged before update on graphs.published_versions
          for each row execute function graphs.version_unchanged();

        -- why a slug no longer shows its map
        create table graphs.withdrawn (
          slug          text primary key references graphs.slugs(slug),
          withdrawn_by  text not null check (withdrawn_by in ('author', 'board')),
          withdrawn_at  timestamptz not null default now()
        );

        create table graphs.published_reports (
          id            bigint generated always as identity primary key,
          slug          text not null references graphs.slugs(slug),
          version       integer not null,
          reporter_id   uuid not null references accounts.users(id) on delete cascade,
          reason        text not null check (char_length(btrim(reason)) between 1 and 1000),
          created_at    timestamptz not null default now(),
          resolved_at   timestamptz,
          resolved_by   uuid references accounts.users(id) on delete set null,
          outcome       text check (outcome in ('dismissed', 'withdrawn'))
        );
        -- one open report per reader and map
        create unique index published_reports_open_idx on graphs.published_reports (slug, reporter_id)
          where resolved_at is null;
        create index published_reports_queue_idx on graphs.published_reports (created_at) where resolved_at is null;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop table graphs.published_reports;
        drop table graphs.withdrawn;
        drop table graphs.published_versions;
        drop function graphs.version_unchanged();
        drop table graphs.published;
        drop table graphs.slugs;
        """
    )
