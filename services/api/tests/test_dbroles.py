"""The API's database role (security review L9): every schema is either read (the content, the releases) or read and
written (the readers' schemas) by ``jadhr_app``, every table in it granted so — a migration that adds a schema or a
table without its grant fails here — and a login role in it can do what the API does and nothing more: no write to
the content, no table made, no program run by the database."""

from __future__ import annotations

import secrets

import psycopg
import pytest
from jadhr_api import dbroles
from jadhr_api.settings import get_settings

READ = {"content", "releases"}
WRITE = {"accounts", "classroom", "contributions", "editorial", "graphs", "ops"}
DSN = get_settings().database_url.replace("postgresql+psycopg://", "postgresql://")


def _owner() -> psycopg.Connection:
    return psycopg.connect(DSN, autocommit=True)


def test_every_schema_and_table_is_granted_by_its_kind() -> None:
    with _owner() as c:
        schemas = {
            r[0]
            for r in c.execute(
                "select nspname from pg_namespace where nspname !~ '^pg_' and nspname not in ('information_schema', 'public')"
            )
        }
        assert schemas == READ | WRITE, "a schema the API's role is not granted (migration 0048, dbroles)"
        tables = c.execute(
            """select n.nspname, c.relname,
                      has_table_privilege('jadhr_app', c.oid, 'select'),
                      has_table_privilege('jadhr_app', c.oid, 'insert'),
                      has_table_privilege('jadhr_app', c.oid, 'update'),
                      has_table_privilege('jadhr_app', c.oid, 'delete')
                 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where c.relkind in ('r', 'p', 'v', 'm') and n.nspname = any(%s)""",
            (sorted(schemas),),
        ).fetchall()
    assert tables
    wrong = [
        f"{s}.{t}"
        for s, t, sel, ins, upd, dele in tables
        if not sel or (s in READ and (ins or upd or dele)) or (s in WRITE and not (ins and upd and dele))
    ]
    assert wrong == []


@pytest.fixture
def app_conn() -> psycopg.Connection:
    user, password = f"jadhr_test_{secrets.token_hex(4)}", secrets.token_urlsafe(24)
    assert dbroles.ensure(DSN, user, password) == "made"
    assert dbroles.ensure(DSN, user, password) == "updated"
    host = DSN.split("@", 1)[1]
    conn = psycopg.connect(f"postgresql://{user}:{password}@{host}", autocommit=True)
    try:
        yield conn
    finally:
        conn.close()
        with _owner() as c:
            c.execute(f'drop role "{user}"')


def test_a_role_in_it_does_what_the_api_does_and_nothing_more(app_conn: psycopg.Connection) -> None:
    c = app_conn
    assert c.execute("select count(*) from content.words").fetchone()[0] > 0
    assert c.execute("select rolsuper from pg_roles where rolname = current_user").fetchone()[0] is False
    with c.transaction(force_rollback=True):
        c.execute(
            "insert into ops.errors (day, source, kind, message, place) values (current_date, 'web', 'T', 'm', '/')"
        )
    for refused in (
        "insert into content.sources (id) values ('x')",
        "delete from content.words",
        "create table ops.t (x int)",
        "create table public.t (x int)",
        "copy (select 1) to program 'true'",
        "update releases.dataset_releases set doi = null",
    ):
        with pytest.raises(psycopg.errors.InsufficientPrivilege), c.transaction(force_rollback=True):
            c.execute(refused)


def test_the_command_refuses_a_bad_name_or_a_short_password() -> None:
    for user, password in (("Robert'); drop", "x" * 20), ("jadhr_app", "x" * 20), ("ok_name", "short")):
        with pytest.raises(SystemExit):
            dbroles.ensure(DSN, user, password)
