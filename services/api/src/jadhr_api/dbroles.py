"""The login role the API connects as (security review L9; the grants are migration 0048's ``jadhr_app``).

    python -m jadhr_api.dbroles     # make or update it: JADHR_APP_DB_USER (default jadhr_api), JADHR_APP_DB_PASSWORD

Run by the loader after the migrations, as the database's owner. The role logs in, belongs to ``jadhr_app`` and has
nothing of its own: no superuser, no database or role to create, no replication. Running it again sets the password
again (a rotation is this, then the API restarted with the new one)."""

from __future__ import annotations

import os
import re
import sys

import psycopg
from psycopg import sql

from .settings import get_settings

GROUP = "jadhr_app"
NAME = re.compile(r"[a-z_][a-z0-9_]{0,40}")


def ensure(dsn: str, user: str, password: str) -> str:
    if not NAME.fullmatch(user) or user == GROUP:
        raise SystemExit(f"not a role name: {user!r}")
    if len(password) < 16:
        raise SystemExit("JADHR_APP_DB_PASSWORD: at least 16 characters")
    with psycopg.connect(dsn, autocommit=True) as conn:
        if conn.execute("select 1 from pg_roles where rolname = %s", (GROUP,)).fetchone() is None:
            raise SystemExit(f"no role {GROUP}: run the migrations first (alembic upgrade head)")
        made = conn.execute("select 1 from pg_roles where rolname = %s", (user,)).fetchone() is None
        verb = "create" if made else "alter"
        conn.execute(
            sql.SQL(
                "{} role {} login password {} nosuperuser nocreatedb nocreaterole noreplication inherit"
            ).format(sql.SQL(verb), sql.Identifier(user), sql.Literal(password))
        )
        conn.execute(sql.SQL("grant {} to {}").format(sql.Identifier(GROUP), sql.Identifier(user)))
    return "made" if made else "updated"


def main() -> None:
    password = os.environ.get("JADHR_APP_DB_PASSWORD", "")
    if not password:
        raise SystemExit("set JADHR_APP_DB_PASSWORD (the password the API connects with)")
    user = os.environ.get("JADHR_APP_DB_USER", "jadhr_api")
    dsn = get_settings().database_url.replace("postgresql+psycopg://", "postgresql://")
    print(f"role {user}: {ensure(dsn, user, password)}, a member of {GROUP}", file=sys.stderr)


if __name__ == "__main__":
    main()
