"""Sync (PLAN P6.2): the reader's records on the server, record by record, newest wins, nothing destroyed.

The browser keeps working on its own copy (local-first); when signed in it sends the records it changed and
fetches those changed elsewhere since its cursor. For one record, the newer ``updated_at`` wins; the version
it replaces is kept for 30 days and can be put back (P6.2, PRF-33). A deletion is a tombstone, so it travels
to the other devices too. Values are encrypted at rest, bound to their user, store and key. The journal syncs
only if the reader turned that on (NTB-Q02).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from .accounts import q, q1, seal, tx, unseal

STORES = {
    "saved",
    "personal",
    "journal",
    "notebook",
    "review",
    "prefs",
    "audio",
    "analyse",
    "graphs",
    "texts",
}
MAX_VALUE = 1_000_000  # bytes of JSON for one record (a long text of the reader's own)
MAX_RECORDS = 20_000
PAGE = 1000


def _aad(user_id: Any, store: str, key: str) -> str:
    return f"{user_id}:{store}:{key}"


def _ms(t: datetime) -> int:
    return int(t.timestamp() * 1000)


def _dt(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, UTC)


def _out(user_id: Any, r: dict[str, Any]) -> dict[str, Any]:
    value = (
        None
        if r["deleted"] or r["value"] is None
        else json.loads(unseal(r["value"], _aad(user_id, r["store"], r["key"])))
    )
    return {
        "store": r["store"],
        "key": r["key"],
        "value": value,
        "deleted": r["deleted"],
        "updated_at": _ms(r["updated_at"]),
        "seq": r.get("seq"),
    }


def pull(u: dict[str, Any], since: int) -> dict[str, Any]:
    with tx() as conn:
        rows = q(
            conn,
            """select store, key, value, deleted, updated_at, seq from accounts.records
               where user_id = :u and seq > :s order by seq limit :n""",
            {"u": u["id"], "s": since, "n": PAGE + 1},
        )
    more = len(rows) > PAGE
    rows = rows[:PAGE]
    return {
        "records": [_out(u["id"], r) for r in rows],
        "cursor": rows[-1]["seq"] if rows else since,
        "more": more,
    }


def push(u: dict[str, Any], records: list[dict[str, Any]]) -> dict[str, Any]:
    settings = u["settings"] or {}
    applied: list[dict[str, str]] = []
    rejected: list[dict[str, Any]] = []
    with tx() as conn:
        total = q1(conn, "select count(*) as n from accounts.records where user_id = :u", {"u": u["id"]})
        for rec in records:
            store, key = rec["store"], rec["key"]
            if store not in STORES:
                raise HTTPException(status_code=422, detail=f"unknown store {store}")
            if store == "journal" and not settings.get("sync_journal"):
                raise HTTPException(status_code=403, detail="The journal syncs only when you turn that on.")
            deleted = bool(rec.get("deleted"))
            body = (
                None
                if deleted
                else json.dumps(rec.get("value"), ensure_ascii=False, separators=(",", ":")).encode()
            )
            if body is not None and len(body) > MAX_VALUE:
                raise HTTPException(status_code=413, detail=f"{store}/{key} is too large to sync")
            when = _dt(int(rec["updated_at"]))
            cur = q1(
                conn,
                "select store, key, value, deleted, updated_at, seq from accounts.records where user_id = :u and store = :st and key = :k for update",
                {"u": u["id"], "st": store, "k": key},
            )
            if cur is not None and cur["updated_at"] >= when:
                # the server's version is as new or newer: it stays, and the client learns it; the version that
                # lost is kept with the replaced ones, so a merge never destroys anything (P6.2)
                if cur["updated_at"] > when:
                    conn.execute(
                        text(
                            """insert into accounts.record_history (user_id, store, key, value, deleted, updated_at)
                               values (:u, :st, :k, :v, :d, :t)"""
                        ),
                        {
                            "u": u["id"],
                            "st": store,
                            "k": key,
                            "v": None if body is None else seal(body, _aad(u["id"], store, key)),
                            "d": deleted,
                            "t": when,
                        },
                    )
                    rejected.append({"store": store, "key": key, "server": _out(u["id"], cur)})
                continue
            if cur is None and total and total["n"] >= MAX_RECORDS:
                raise HTTPException(status_code=413, detail="This account holds as many records as it can")
            if cur is not None:
                # the replaced version is kept, recoverable for 30 days
                conn.execute(
                    text(
                        """insert into accounts.record_history (user_id, store, key, value, deleted, updated_at)
                           values (:u, :st, :k, :v, :d, :t)"""
                    ),
                    {
                        "u": u["id"],
                        "st": store,
                        "k": key,
                        "v": cur["value"],
                        "d": cur["deleted"],
                        "t": cur["updated_at"],
                    },
                )
            conn.execute(
                text(
                    """insert into accounts.records (user_id, store, key, value, deleted, updated_at, seq)
                       values (:u, :st, :k, :v, :d, :t, nextval('accounts.record_seq'))
                       on conflict (user_id, store, key) do update
                       set value = excluded.value, deleted = excluded.deleted, updated_at = excluded.updated_at, seq = excluded.seq"""
                ),
                {
                    "u": u["id"],
                    "st": store,
                    "k": key,
                    "v": None if body is None else seal(body, _aad(u["id"], store, key)),
                    "d": deleted,
                    "t": when,
                },
            )
            applied.append({"store": store, "key": key})
    return {"applied": applied, "rejected": rejected}


def history(u: dict[str, Any]) -> list[dict[str, Any]]:
    with tx() as conn:
        rows = q(
            conn,
            """select id, store, key, value, deleted, updated_at, replaced_at from accounts.record_history
               where user_id = :u order by replaced_at desc limit 500""",
            {"u": u["id"]},
        )
    return [{**_out(u["id"], r), "id": r["id"], "replaced_at": _ms(r["replaced_at"])} for r in rows]


def restore(u: dict[str, Any], history_id: int) -> dict[str, Any]:
    """Put a replaced version back: it becomes the current record (newest, so every device takes it), and the
    version it replaces goes into the history in turn — restoring never destroys either."""
    with tx() as conn:
        h = q1(
            conn,
            "select store, key, value, deleted, updated_at from accounts.record_history where id = :id and user_id = :u",
            {"id": history_id, "u": u["id"]},
        )
    if h is None:
        raise HTTPException(status_code=404, detail="No such version, or it is older than 30 days.")
    old = _out(u["id"], h)
    # newer than the current version even if a device's clock ran ahead: a restore is asked for, so it wins
    with tx() as conn:
        cur = q1(
            conn,
            "select updated_at from accounts.records where user_id = :u and store = :st and key = :k",
            {"u": u["id"], "st": old["store"], "k": old["key"]},
        )
    when = max(_ms(datetime.now(UTC)), _ms(cur["updated_at"]) + 1 if cur else 0)
    res = push(
        u,
        [
            {
                "store": old["store"],
                "key": old["key"],
                "value": old["value"],
                "deleted": old["deleted"],
                "updated_at": when,
            }
        ],
    )
    return {"restored": {"store": old["store"], "key": old["key"]}, **res}


def export(u: dict[str, Any]) -> dict[str, Any]:
    with tx() as conn:
        rows = q(
            conn,
            "select store, key, value, deleted, updated_at, seq from accounts.records where user_id = :u and not deleted order by store, key",
            {"u": u["id"]},
        )
    return {"records": [_out(u["id"], r) for r in rows]}


def request_delete(u: dict[str, Any]) -> str:
    from .accounts import hash_token, new_token

    token = new_token()
    with tx() as conn:
        conn.execute(
            text(
                "insert into accounts.delete_requests (token_hash, user_id, expires_at) values (:h, :u, now() + interval '10 minutes')"
            ),
            {"h": hash_token(token), "u": u["id"]},
        )
    return token


def delete_account(u: dict[str, Any], token: str) -> bool:
    """Everything the account holds — records, history, sessions, identities, lookups — goes with it (cascade)."""
    from .accounts import hash_token

    with tx() as conn:
        ok = q1(
            conn,
            "delete from accounts.delete_requests where token_hash = :h and user_id = :u and expires_at > now() returning user_id",
            {"h": hash_token(token), "u": u["id"]},
        )
        if ok is None:
            return False
        conn.execute(text("delete from accounts.users where id = :u"), {"u": u["id"]})
    return True


def record_lookups(u: dict[str, Any], events: list[dict[str, Any]]) -> int:
    if not (u["settings"] or {}).get("share_lookups"):
        raise HTTPException(status_code=403, detail="Lookups are shared only when you turn that on.")
    with tx() as conn:
        for e in events[:500]:
            conn.execute(
                text(
                    "insert into accounts.lookup_events (user_id, lemma, root, verse) values (:u, :l, :r, :v)"
                ),
                {
                    "u": u["id"],
                    "l": (e.get("lemma") or None),
                    "r": (e.get("root") or None),
                    "v": (e.get("verse") or None),
                },
            )
    return min(len(events), 500)
