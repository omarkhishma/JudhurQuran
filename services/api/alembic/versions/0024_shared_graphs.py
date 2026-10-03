"""Shared maps, their revisions and comments (PLAN P8.1-E, research 13 §3).

A reader's private maps stay in their browser and, signed in, in sealed sync records (0021): the server cannot read
them. A map gets a document here only when its owner shares it for comments — their act, undone by stopping the
share, which deletes the document, its revisions and its comments. The document is the whole map as the owner last
saved it, under a revision number that every save must name (a save over a newer one is refused, not merged); a
snapshot is kept at most every ten minutes of editing for the map's history. Comments anchor to a card by its id,
with the card's Arabic as written then, or to the whole map; one level of replies; resolved by the owner or the
author; deleted by either, leaving a mark in place of a comment others replied to. `reads` holds when each person
last read a map's comments: what is new to them and who mentioned them.

Revision ID: 0024
Revises: 0023
"""

from alembic import op

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create schema if not exists graphs;

        create table graphs.documents (
          id           uuid primary key default gen_random_uuid(),
          owner_id     uuid not null references accounts.users(id) on delete cascade,
          local_id     text not null check (local_id ~ '^[A-Za-z0-9_-]{1,40}$'),
          title        text not null check (length(title) <= 200),
          kind         text not null check (kind in ('root', 'topic', 'meaning', 'free')),
          doc          jsonb not null,
          doc_version  smallint not null default 2,
          revision     integer not null default 1 check (revision >= 1),
          cards        integer not null default 0,
          created_at   timestamptz not null default now(),
          updated_at   timestamptz not null default now(),
          unique (owner_id, local_id)
        );
        create index documents_owner_idx on graphs.documents (owner_id, updated_at desc);

        create table graphs.revisions (
          graph_id     uuid not null references graphs.documents(id) on delete cascade,
          revision     integer not null,
          title        text not null,
          doc          jsonb not null,
          doc_version  smallint not null,
          cards        integer not null,
          saved_at     timestamptz not null default now(),
          primary key (graph_id, revision)
        );

        create table graphs.comments (
          id           uuid primary key default gen_random_uuid(),
          graph_id     uuid not null references graphs.documents(id) on delete cascade,
          parent_id    uuid references graphs.comments(id) on delete cascade,
          author_id    uuid references accounts.users(id) on delete set null,
          node_id      text check (node_id is null or length(node_id) <= 200),
          anchor       text not null default '' check (length(anchor) <= 200),
          body         text not null check (length(body) <= 2000),
          mentions     uuid[] not null default '{}',
          resolved_at  timestamptz,
          resolved_by  uuid references accounts.users(id) on delete set null,
          created_at   timestamptz not null default now(),
          deleted_at   timestamptz,
          -- a comment has words, unless it was deleted with replies under it and stands as a mark
          check ((deleted_at is null and length(btrim(body)) between 1 and 2000) or (deleted_at is not null and body = ''))
        );
        create index comments_graph_idx on graphs.comments (graph_id, created_at);
        create index comments_author_idx on graphs.comments (author_id, created_at);
        create index comments_mentions_idx on graphs.comments using gin (mentions);

        -- a reply answers a top-level comment of the same map: one level of threads
        create function graphs.reply_rules() returns trigger language plpgsql as $$
        declare p graphs.comments;
        begin
          if new.parent_id is null then return new; end if;
          select * into p from graphs.comments where id = new.parent_id;
          if p.graph_id <> new.graph_id or p.parent_id is not null then
            raise exception 'a reply answers a top-level comment of the same map' using errcode = 'check_violation';
          end if;
          return new;
        end $$;
        create trigger comments_reply_rules before insert on graphs.comments
          for each row execute function graphs.reply_rules();

        create table graphs.reads (
          graph_id  uuid not null references graphs.documents(id) on delete cascade,
          user_id   uuid not null references accounts.users(id) on delete cascade,
          read_at   timestamptz not null default now(),
          primary key (graph_id, user_id)
        );
        create index reads_user_idx on graphs.reads (user_id);
        """
    )


def downgrade() -> None:
    op.execute("drop schema graphs cascade")
