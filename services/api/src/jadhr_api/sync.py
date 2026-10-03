"""Sync (PLAN P6.2, P6.5): the reader's records on the server, record by record, newest wins, nothing destroyed.

The browser keeps working on its own copy (local-first); when signed in it sends the records it changed and
fetches those changed elsewhere since its cursor. For one record, the newer ``updated_at`` wins — never later than
the server's own clock — and the version it replaces is kept for 30 days and can be put back (PRF-33). A deletion
is a tombstone, so it travels to the other devices too, for a stated period; a device behind that resyncs in full.
A record's key and value are both sealed, bound to their user and store; the key is found by a keyed hash (F2).
One account's writes are taken one at a time, so its cursor never skips a record (F10). The journal syncs only if
the reader turned that on (NTB-Q02).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Connection, text

from .accounts import key_hash, q, q1, seal, tx, unseal
from .settings import get_settings

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

_COLS = "store, key_hash, key_sealed, value, deleted, updated_at"


def _aad(user_id: Any, store: str, key: str) -> str:
    return f"{user_id}:{store}:{key}"


def _ms(t: datetime) -> int:
    return int(t.timestamp() * 1000)


def _dt(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, UTC)


def _seal_key(user_id: Any, store: str, key: str) -> bytes:
    return seal(key.encode(), f"{user_id}:{store}:key")


def _key(user_id: Any, r: dict[str, Any]) -> str:
    return unseal(bytes(r["key_sealed"]), f"{user_id}:{r['store']}:key").decode()


def _value(user_id: Any, r: dict[str, Any], key: str) -> Any:
    if r["deleted"] or r["value"] is None:
        return None
    return json.loads(unseal(bytes(r["value"]), _aad(user_id, r["store"], key)))


def _out(user_id: Any, r: dict[str, Any]) -> dict[str, Any]:
    key = _key(user_id, r)
    return {
        "store": r["store"],
        "key": key,
        "value": _value(user_id, r, key),
        "deleted": r["deleted"],
        "updated_at": _ms(r["updated_at"]),
        "seq": r.get("seq"),
    }


def _lock(conn: Connection, user_id: Any) -> None:
    """One account's writes one at a time: sequence numbers then follow commits, so no cursor skips a record."""
    conn.execute(text("select 1 from accounts.users where id = :u for update"), {"u": user_id})


def pull(u: dict[str, Any], since: int) -> dict[str, Any]:
    """Changes since the cursor. A cursor behind the purged deletions starts again from the beginning, and says
    so: the device then treats what it synced and no longer finds as deleted elsewhere (F6)."""
    full = 0 < since < int(u.get("tombstone_horizon") or 0)
    start = 0 if full else since
    with tx() as conn:
        rows = q(
            conn,
            f"select {_COLS}, seq from accounts.records where user_id = :u and seq > :s order by seq limit :n",
            {"u": u["id"], "s": start, "n": PAGE + 1},
        )
    more = len(rows) > PAGE
    rows = rows[:PAGE]
    return {
        "records": [_out(u["id"], r) for r in rows],
        "cursor": rows[-1]["seq"] if rows else start,
        "more": more,
        "full": full,
        # every device learns the account's choices with its changes (the journal turned off elsewhere stops here)
        "settings": u["settings"] or {},
    }


def _same(user_id: Any, cur: dict[str, Any], key: str, value: Any, deleted: bool) -> bool:
    """The incoming version says what the server already holds: nothing to replace, nothing to keep."""
    if cur["deleted"] or deleted:
        return bool(cur["deleted"]) and deleted
    return cur["value"] is not None and _value(user_id, cur, key) == value


def _keep(
    conn: Connection,
    user_id: Any,
    store: str,
    h: str,
    sealed_key: bytes,
    value: Any,
    deleted: bool,
    when: datetime,
) -> None:
    conn.execute(
        text(
            """insert into accounts.record_history (user_id, store, key_hash, key_sealed, value, deleted, updated_at)
               values (:u, :st, :h, :k, :v, :d, :t)"""
        ),
        {"u": user_id, "st": store, "h": h, "k": sealed_key, "v": value, "d": deleted, "t": when},
    )


def _write(
    conn: Connection, user_id: Any, store: str, key: str, body: bytes | None, deleted: bool, when: datetime
) -> None:
    conn.execute(
        text(
            """insert into accounts.records (user_id, store, key_hash, key_sealed, value, deleted, updated_at, seq)
               values (:u, :st, :h, :k, :v, :d, :t, nextval('accounts.record_seq'))
               on conflict (user_id, store, key_hash) do update
               set value = excluded.value, deleted = excluded.deleted, updated_at = excluded.updated_at,
                   seq = excluded.seq"""
        ),
        {
            "u": user_id,
            "st": store,
            "h": key_hash(user_id, store, key),
            "k": _seal_key(user_id, store, key),
            "v": None if body is None else seal(body, _aad(user_id, store, key)),
            "d": deleted,
            "t": when,
        },
    )


def _current(conn: Connection, user_id: Any, store: str, key: str) -> dict[str, Any] | None:
    return q1(
        conn,
        f"select {_COLS}, seq from accounts.records where user_id = :u and store = :st and key_hash = :h for update",
        {"u": user_id, "st": store, "h": key_hash(user_id, store, key)},
    )


def push(u: dict[str, Any], records: list[dict[str, Any]]) -> dict[str, Any]:
    settings = u["settings"] or {}
    applied: list[dict[str, str]] = []
    rejected: list[dict[str, Any]] = []
    refused: list[dict[str, str]] = []
    now = datetime.now(UTC)
    with tx() as conn:
        _lock(conn, u["id"])
        total = q1(conn, "select count(*) as n from accounts.records where user_id = :u", {"u": u["id"]})
        count = int(total["n"]) if total else 0
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
                refused.append({"store": store, "key": key, "reason": "too_large"})
                continue
            # a device's clock ahead of the server's wins nothing by it (F13)
            when = min(_dt(int(rec["updated_at"])), now)
            cur = _current(conn, u["id"], store, key)
            if cur is not None and _same(u["id"], cur, key, rec.get("value"), deleted):
                # a device that signs in again sends what it already synced: no copy, no change
                applied.append({"store": store, "key": key})
                continue
            if cur is not None and cur["updated_at"] >= when:
                # the server's version is as new or newer: it stays, and the client learns it; the version that lost
                # is kept with the replaced ones, so a merge never destroys anything — a tie too, since two devices'
                # first syncs can both carry the same placeholder time
                _keep(
                    conn,
                    u["id"],
                    store,
                    cur["key_hash"],
                    cur["key_sealed"],
                    None if body is None else seal(body, _aad(u["id"], store, key)),
                    deleted,
                    when,
                )
                rejected.append({"store": store, "key": key, "server": _out(u["id"], cur)})
                continue
            if cur is None and count >= MAX_RECORDS:
                # a full account refuses the new record only; the others in the same push go through (F14)
                refused.append({"store": store, "key": key, "reason": "full"})
                continue
            if cur is not None:
                # the replaced version is kept, recoverable for 30 days
                _keep(
                    conn,
                    u["id"],
                    store,
                    cur["key_hash"],
                    cur["key_sealed"],
                    cur["value"],
                    cur["deleted"],
                    cur["updated_at"],
                )
            else:
                count += 1
            _write(conn, u["id"], store, key, body, deleted, when)
            applied.append({"store": store, "key": key})
    return {"applied": applied, "rejected": rejected, "refused": refused}


def history(u: dict[str, Any]) -> list[dict[str, Any]]:
    with tx() as conn:
        rows = q(
            conn,
            f"""select id, {_COLS}, replaced_at from accounts.record_history
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
            f"select {_COLS} from accounts.record_history where id = :id and user_id = :u",
            {"id": history_id, "u": u["id"]},
        )
    if h is None:
        raise HTTPException(status_code=404, detail="No such version, or it is older than 30 days.")
    old = _out(u["id"], h)
    store, key = old["store"], old["key"]
    with tx() as conn:
        _lock(conn, u["id"])
        cur = _current(conn, u["id"], store, key)
        # the server chooses the time: newer than the current version, so every device takes the restored one
        when = max(_ms(datetime.now(UTC)), _ms(cur["updated_at"]) + 1 if cur else 0)
        if cur is not None:
            _keep(
                conn,
                u["id"],
                store,
                cur["key_hash"],
                cur["key_sealed"],
                cur["value"],
                cur["deleted"],
                cur["updated_at"],
            )
        body = (
            None
            if old["deleted"]
            else json.dumps(old["value"], ensure_ascii=False, separators=(",", ":")).encode()
        )
        _write(conn, u["id"], store, key, body, old["deleted"], _dt(when))
    return {
        "restored": {"store": store, "key": key},
        "applied": [{"store": store, "key": key}],
        "rejected": [],
        "refused": [],
    }


def held(u: dict[str, Any]) -> dict[str, Any]:
    """What the server keeps for this account, counted, with the day the oldest of each kind goes (plan B35): the
    privacy page's periods shown for one account. Counts only — nothing is unsealed to say them."""
    s = get_settings()
    with tx() as conn:
        rows = q(
            conn,
            """select store, count(*) filter (where not deleted) as live, count(*) filter (where deleted) as gone,
                      min(updated_at) filter (where deleted) as first_gone
               from accounts.records where user_id = :u group by store""",
            {"u": u["id"]},
        )
        hist = q1(
            conn,
            "select count(*) as n, min(replaced_at) as first from accounts.record_history where user_id = :u",
            {"u": u["id"]},
        )
        looks = q1(
            conn,
            "select count(*) as n, min(at) as first from accounts.lookup_events where user_id = :u",
            {"u": u["id"]},
        )

    def goes(first: datetime | None, days: int) -> str | None:
        return None if first is None else (first + timedelta(days=days)).isoformat()

    gone = [r["first_gone"] for r in rows if r["first_gone"] is not None]
    return {
        "stores": {r["store"]: int(r["live"]) for r in rows if r["live"]},
        "used": sum(int(r["live"]) + int(r["gone"]) for r in rows),
        "limit": MAX_RECORDS,
        "deletions": {
            "count": sum(int(r["gone"]) for r in rows),
            "first_goes": goes(min(gone) if gone else None, s.tombstone_days),
        },
        "history": {
            "count": int(hist["n"]) if hist else 0,
            "first_goes": goes(hist["first"] if hist else None, s.history_days),
        },
        "lookups": {
            "count": int(looks["n"]) if looks else 0,
            "first_goes": goes(looks["first"] if looks else None, s.lookup_retention_days),
        },
    }


def export(u: dict[str, Any]) -> dict[str, Any]:
    """Everything the account holds about the reader (PRF-14, Q03, F5): the live records, what was deleted and
    when, the replaced versions kept 30 days, the lookups shared, and the ways of signing in. Secrets (session and
    link hashes) are not the reader's data; the devices are listed with the account."""
    with tx() as conn:
        rows = q(
            conn, f"select {_COLS} from accounts.records where user_id = :u order by store", {"u": u["id"]}
        )
        hist = q(
            conn,
            f"select id, {_COLS}, replaced_at from accounts.record_history where user_id = :u order by replaced_at",
            {"u": u["id"]},
        )
        looks = q(
            conn,
            "select at, event from accounts.lookup_events where user_id = :u order by at",
            {"u": u["id"]},
        )
        idents = q(
            conn,
            "select provider, email, created_at from accounts.identities where user_id = :u order by created_at",
            {"u": u["id"]},
        )
    live = [_out(u["id"], r) for r in rows]
    return {
        "records": [r for r in live if not r["deleted"]],
        "deleted": [
            {"store": r["store"], "key": r["key"], "deleted_at": r["updated_at"]}
            for r in live
            if r["deleted"]
        ],
        "history": [{**_out(u["id"], r), "replaced_at": _ms(r["replaced_at"])} for r in hist],
        "lookups": [
            {"at": _ms(r["at"]), **json.loads(unseal(bytes(r["event"]), f"{u['id']}:lookup"))} for r in looks
        ],
        "identities": [
            {"provider": r["provider"], "email": r["email"], "since": r["created_at"].isoformat()}
            for r in idents
        ],
    }


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
        # sign-in links are kept by address, not by account: they go too; so do unmerged proposals and every name
        conn.execute(text("delete from accounts.login_tokens where email = :e"), {"e": u["email"]})
        from .contrib import forget

        forget(conn, u["id"])
        conn.execute(text("delete from accounts.users where id = :u"), {"u": u["id"]})
        # the id only, for fifteen days: a backup restored later deletes the account again (F4)
        conn.execute(
            text("insert into accounts.deleted_accounts (user_id) values (:u) on conflict do nothing"),
            {"u": u["id"]},
        )
    return True


def record_lookups(u: dict[str, Any], events: list[dict[str, Any]]) -> int:
    if not (u["settings"] or {}).get("share_lookups"):
        raise HTTPException(status_code=403, detail="Lookups are shared only when you turn that on.")
    with tx() as conn:
        for e in events[:500]:
            # sealed whole, like a record (F2)
            body = json.dumps(
                {k: (str(e[k])[:120] if e.get(k) else None) for k in ("lemma", "root", "verse")},
                ensure_ascii=False,
            ).encode()
            conn.execute(
                text("insert into accounts.lookup_events (user_id, event) values (:u, :e)"),
                {"u": u["id"], "e": seal(body, f"{u['id']}:lookup")},
            )
    return min(len(events), 500)
