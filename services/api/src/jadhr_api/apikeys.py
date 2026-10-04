"""API keys (PLAN P10.2b): made by a signed-in reader for the public API, shown once, kept as a hash, revoked at will.

A key is `jk_` and 32 random characters. The server keeps its sha256 and its first characters (to recognise it on the
Profile), the day it was last used — never the requests themselves. A key that is checked is remembered for a minute,
so the limit does not ask the database on every request; a revoked key stops at the latest a minute later.
"""

from __future__ import annotations

import hashlib
import secrets
import time
from datetime import UTC, date, datetime
from typing import Any

from . import plain
from .accounts import q, q1, tx
from .refusal import Refusal

MAX_KEYS = 10  # active keys one account holds
_SEEN: dict[str, tuple[str | None, float, date | None]] = {}  # hash → (key id or None, until, last day noted)
TTL = 60.0


def _hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def _out(r: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(r["id"]),
        "name": r["name"],
        "prefix": r["prefix"],
        "created_at": r["created_at"].isoformat(),
        "last_used_on": r["last_used_on"].isoformat() if r["last_used_on"] else None,
        "revoked_at": r["revoked_at"].isoformat() if r["revoked_at"] else None,
    }


def keys(u: dict[str, Any]) -> dict[str, Any]:
    with tx() as conn:
        rows = q(
            conn,
            "select * from accounts.api_keys where user_id = :u order by created_at desc",
            {"u": u["id"]},
        )
    return {"data": [_out(r) for r in rows], "most": MAX_KEYS}


def create(u: dict[str, Any], name: Any) -> dict[str, Any]:
    """A new key: its whole value is in this answer and nowhere else, ever."""
    label = plain.name(name).strip()[:80] if isinstance(name, str) else ""
    if not label:
        raise Refusal(422, "empty", "Name the key: what will use it?")
    if u.get("blocked_at"):
        raise Refusal(403, "blocked", "This account cannot make keys.")
    key = "jk_" + secrets.token_urlsafe(24)
    with tx() as conn:
        n = q1(
            conn,
            "select count(*)::int as n from accounts.api_keys where user_id = :u and revoked_at is null",
            {"u": u["id"]},
        )
        if n and n["n"] >= MAX_KEYS:
            raise Refusal(429, "too_many", "That is as many keys as one account holds; revoke one first.")
        r = q1(
            conn,
            """insert into accounts.api_keys (user_id, name, prefix, key_hash) values (:u, :n, :p, :h) returning *""",
            {"u": u["id"], "n": label, "p": key[:10], "h": _hash(key)},
        )
    assert r is not None
    return {**_out(r), "key": key}


def revoke(u: dict[str, Any], key_id: str) -> dict[str, Any]:
    import uuid

    try:
        kid = str(uuid.UUID(key_id))
    except ValueError:
        raise Refusal(404, "not_found", "No such key.") from None
    with tx() as conn:
        r = q1(
            conn,
            """update accounts.api_keys set revoked_at = coalesce(revoked_at, now())
               where id = :k and user_id = :u returning *""",
            {"k": kid, "u": u["id"]},
        )
    if r is None:
        raise Refusal(404, "not_found", "No such key.")
    # forgotten here at once; other workers forget it within a minute
    for h, (who, _, _) in list(_SEEN.items()):
        if who == kid:
            del _SEEN[h]
    return _out(r)


def check(key: str) -> str | None:
    """The key's id when it is a live key, else None; its day of use noted once a day."""
    if not key.startswith("jk_") or len(key) > 64:
        return None
    h = _hash(key)
    now = time.monotonic()
    today = datetime.now(UTC).date()
    seen = _SEEN.get(h)
    if seen and seen[1] > now:
        if seen[0] and seen[2] != today:
            _note(seen[0], today)
            _SEEN[h] = (seen[0], seen[1], today)
        return seen[0]
    with tx() as conn:
        r = q1(
            conn,
            "select id, last_used_on from accounts.api_keys where key_hash = :h and revoked_at is null",
            {"h": h},
        )
    who = str(r["id"]) if r else None
    if r is not None and who and r["last_used_on"] != today:
        _note(who, today)
    if len(_SEEN) > 10_000:
        _SEEN.clear()
    _SEEN[h] = (who, now + TTL, today if who else None)
    return who


def _note(key_id: str, today: date) -> None:
    with tx() as conn:
        q(
            conn,
            "update accounts.api_keys set last_used_on = :d where id = :k returning id",
            {"d": today, "k": key_id},
        )


def export_for(u: dict[str, Any]) -> dict[str, Any]:
    """The account's keys in its export: their names, prefixes and days — never a key's value, which is not kept."""
    return {"api_keys": keys(u)["data"]}
