"""Dataset releases (PLAN P10.1b, research 18): each release recorded once, its manifest — every file with its
sha256, rows, format and the hold it is under — kept as it was built and never changed, so a citation that names a
version names the same bytes for ever.

The database refuses a change to a release's version, manifest or manifest hash, and its deletion; what may change is
when it was published (the owner's go) and its DOI, set once.

Revision ID: 0030
Revises: 0029
"""

from alembic import op

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create schema if not exists releases;

        create table releases.dataset_releases (
          version          text primary key check (version ~ '^\\d{4}\\.\\d{1,2}\\.\\d{1,3}$'),
          dataset          text not null,
          built_at         timestamptz not null,
          manifest         jsonb not null,
          manifest_sha256  text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
          recorded_at      timestamptz not null default now(),
          published_at     timestamptz,
          doi              text check (doi ~ '^10\\.\\d{4,9}/\\S+$')
        );

        -- a release never changes: its manifest is what it was built as; it is published once, and given a DOI once
        create function releases.immutable() returns trigger language plpgsql as $$
        begin
          if tg_op = 'DELETE' then
            raise exception 'a dataset release is never deleted (%)', old.version;
          end if;
          if new.version <> old.version or new.manifest <> old.manifest or new.manifest_sha256 <> old.manifest_sha256
             or new.dataset <> old.dataset or new.built_at <> old.built_at or new.recorded_at <> old.recorded_at then
            raise exception 'a dataset release never changes (%)', old.version;
          end if;
          if old.published_at is not null and new.published_at is distinct from old.published_at then
            raise exception 'a release is published once (%)', old.version;
          end if;
          if old.doi is not null and new.doi is distinct from old.doi then
            raise exception 'a release is given its DOI once (%)', old.version;
          end if;
          return new;
        end $$;

        create trigger dataset_releases_immutable before update or delete on releases.dataset_releases
          for each row execute function releases.immutable();
        """
    )


def downgrade() -> None:
    op.execute("drop schema releases cascade;")
