"""Error tracking without tracking anyone (PLAN P12): what went wrong, counted by day — where (the web page's address
with its ids taken out, or the API's route), what (the error's kind and message), in which release — and nothing about
who: no address, no account, no request. Kept thirty days (the privacy page says so).

Revision ID: 0046
Revises: 0045
"""

from alembic import op

revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create schema if not exists ops;
        create table ops.errors (
          day       date not null,
          source    text not null check (source in ('web', 'api', 'monitor')),
          kind      text not null,
          message   text not null,
          place     text not null,
          release   text not null default '',
          count     integer not null default 1,
          first_at  timestamptz not null default now(),
          last_at   timestamptz not null default now(),
          primary key (day, source, kind, message, place, release)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table ops.errors; drop schema ops;")
