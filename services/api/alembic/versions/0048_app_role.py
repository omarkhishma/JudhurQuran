"""The API's own database role (security review L9): the API, the monitor and the backups' readers had connected as the
superuser the database image makes, so one SQL injection, or a process taken over, would have held every schema and
`COPY … PROGRAM` on the database's machine. ``jadhr_app`` (no login) reads the content and the releases, and reads and
writes the readers' schemas — accounts, classes, contributions, the board's work, maps, error counts — and nothing
else; it creates nothing. The login role the API uses is made a member of it by ``python -m jadhr_api.dbroles``, with
its password from the environment. The superuser runs the migrations and loads releases, and nothing else.

Tables made later in these schemas are granted alike (default privileges for the role that runs the migrations); a new
schema grants itself in its own migration, and a test holds every schema to one of the two kinds (test_dbroles.py).

Revision ID: 0048
Revises: 0047
"""

from alembic import op

revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None

READ = ("content", "releases")
WRITE = ("accounts", "classroom", "contributions", "editorial", "graphs", "ops")


def upgrade() -> None:
    read, write = ", ".join(READ), ", ".join(WRITE)
    op.execute(
        f"""
        do $$ begin
          if not exists (select from pg_roles where rolname = 'jadhr_app') then
            create role jadhr_app nologin nosuperuser nocreatedb nocreaterole noreplication;
          end if;
        end $$;
        revoke create on schema public from public;
        grant usage on schema {read}, {write} to jadhr_app;
        grant select on all tables in schema {read} to jadhr_app;
        grant select, insert, update, delete on all tables in schema {write} to jadhr_app;
        grant usage, select on all sequences in schema {write} to jadhr_app;
        alter default privileges in schema {read} grant select on tables to jadhr_app;
        alter default privileges in schema {write} grant select, insert, update, delete on tables to jadhr_app;
        alter default privileges in schema {write} grant usage, select on sequences to jadhr_app;
        """
    )


def downgrade() -> None:
    read, write = ", ".join(READ), ", ".join(WRITE)
    op.execute(
        f"""
        alter default privileges in schema {read} revoke select on tables from jadhr_app;
        alter default privileges in schema {write} revoke select, insert, update, delete on tables from jadhr_app;
        alter default privileges in schema {write} revoke usage, select on sequences from jadhr_app;
        revoke all on all tables in schema {read}, {write} from jadhr_app;
        revoke all on all sequences in schema {write} from jadhr_app;
        revoke usage on schema {read}, {write} from jadhr_app;
        drop role jadhr_app;
        """
    )
