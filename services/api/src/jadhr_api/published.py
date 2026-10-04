"""Published maps (PLAN P8.5, research 13; the handoff's 08 §8.6, EDT-269…274, EDT-343…346, QAN-23).

A signed-in owner publishes a map under a slug: the whole map as it is, version 1, read by anyone at `/g/{slug}`.
Publishing it again adds a version; no version ever changes (the database refuses), and each is cited by its own
address. Withdrawing deletes every version and keeps the slug, so an address once cited never shows another map;
the board withdraws a map a reader reported, and an account deleted takes its maps.

Forks and citations are counted once per reader an hour — a signed-in reader by their account, anyone else by
their address — kept in this process only and gone within the hour: a number, never a record of who.

The slug keeps Arabic letters (QAN-23): a title's vowel marks, tatweel and the mushaf's small marks are dropped,
ٱ is read as ا and the Persian ی ک as ي ك, digits are Western, every other run of characters is one hyphen.
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
from typing import Any

from sqlalchemy import Connection, text

from .accounts import q, q1, tx
from .contrib import BOARD
from .refusal import Refusal
from .shared_maps import _doc as checked_doc

KINDS = ("root", "topic", "meaning", "free")
MAX_PUBLISHED = 200  # maps one reader has published at once
MAX_VERSIONS = 100  # versions of one map
BURST = 20  # versions one reader publishes in an hour
COUNT_EVERY = 3600.0  # seconds: a reader's fork or citation counts once in this
PAGE = 24

_LETTERS = "a-z0-9\u0621-\u063a\u0641-\u064a"
SLUG_RE = re.compile(rf"^[{_LETTERS}]+(-[{_LETTERS}]+)*$")
# vowel marks, the small high letters, superscript alef, tatweel and the mushaf's annotation marks
_MARKS = re.compile("[\u0610-\u061a\u064b-\u065f\u0670\u0640\u06d6-\u06ed]")
_FOLD = (
    {0x0671: "\u0627", 0x06CC: "\u064a", 0x06A9: "\u0643"}
    | {0x0660 + i: str(i) for i in range(10)}
    | {0x06F0 + i: str(i) for i in range(10)}
)


def _arabic(c: str) -> bool:
    return "\u0600" <= c <= "\u06ff"


def _char(c: str) -> str:
    """An Arabic letter as it is; a presentation form as its letters (lam-alef as two); a Latin letter without its
    accent (é → e); anything else a separator."""
    if _arabic(c):
        return c
    d = unicodedata.normalize("NFKD", c)
    if any(_arabic(x) for x in d):
        return "".join(x for x in d if _arabic(x))
    return d.encode("ascii", "ignore").decode() or "-"


def slugify(raw: str) -> str:
    """A slug from a title or from what the owner typed: Arabic letters kept, everything else folded or a hyphen."""
    s = "".join(_char(c) for c in unicodedata.normalize("NFC", raw or "").lower())
    # recomposed before the marks go, so a hamza a presentation form carried apart stays on its letter
    s = _MARKS.sub("", unicodedata.normalize("NFC", s)).translate(_FOLD)
    s = re.sub(rf"[^{_LETTERS}]+", "-", s).strip("-")
    return s[:60].strip("-")


# addresses the API's own routes answer at
RESERVED = {"check", "reports"}


def _slug(raw: str) -> str:
    s = slugify(raw)
    if len(s) < 3 or not SLUG_RE.match(s):
        raise Refusal(422, "bad_slug", "A map's address takes at least three letters or digits.")
    if s in RESERVED:
        raise Refusal(409, "slug_taken", "This address is taken; choose another.")
    return s


def _str(v: Any, most: int) -> str:
    return " ".join(v.split())[:most] if isinstance(v, str) else ""


def counts(doc: dict[str, Any]) -> dict[str, Any]:
    """What a list row and a byline say of a map (EDT-272, HWF-42): its cards (frames left out), roots and words,
    and the first root's letters."""
    kinds = [((n.get("data") or {}).get("kind"), (n.get("data") or {}).get("ar")) for n in doc["nodes"]]
    lead = next((ar for k, ar in kinds if k == "root" and isinstance(ar, str) and ar), None)
    return {
        "cards": sum(1 for k, _ in kinds if k != "frame"),
        "roots": sum(1 for k, _ in kinds if k == "root"),
        "words": sum(1 for k, _ in kinds if k == "lemma"),
        "lead": lead[:20] if lead else None,
    }


def _content(title: Any, description: Any, kind: Any, raw: Any) -> dict[str, Any]:
    doc, _ = checked_doc(raw)
    t = _str(title, 200)
    if not t:
        raise Refusal(422, "no_title", "A published map has a title.")
    return {
        "title": t,
        "description": _str(description, 500),
        "kind": kind if kind in KINDS else "free",
        "doc": doc,
        "counts": counts(doc),
    }


def _active(u: dict[str, Any]) -> None:
    if u.get("blocked_at"):
        raise Refusal(403, "blocked", "This account cannot publish maps.")


def _burst(conn: Connection, u: dict[str, Any]) -> None:
    n = q1(
        conn,
        """select count(*)::int as n from graphs.published_versions v join graphs.published p on p.slug = v.slug
            where p.owner_id = :u and v.published_at > now() - interval '1 hour'""",
        {"u": u["id"]},
    )
    if n and n["n"] >= BURST:
        raise Refusal(429, "too_many", "That is as many versions as can be published in an hour.")


def _insert_version(conn: Connection, slug: str, version: int, c: dict[str, Any]) -> None:
    conn.execute(
        text(
            """insert into graphs.published_versions (slug, version, title, description, kind, doc, counts)
               values (:s, :v, :t, :d, :k, cast(:doc as jsonb), cast(:c as jsonb))"""
        ),
        {
            "s": slug,
            "v": version,
            "t": c["title"],
            "d": c["description"],
            "k": c["kind"],
            "doc": json.dumps(c["doc"], ensure_ascii=False),
            "c": json.dumps(c["counts"], ensure_ascii=False),
        },
    )


def check(raw: str) -> dict[str, Any]:
    """Whether an address is free, as the dialog asks while the owner types; a free one near it when it is not."""
    s = slugify(raw)
    if len(s) < 3:
        return {"slug": s, "valid": False, "available": False, "suggestion": None}
    if s in RESERVED:
        return {"slug": s, "valid": True, "available": False, "suggestion": f"{s}-2"}
    with tx() as conn:
        taken = {
            r["slug"]
            for r in q(
                conn,
                "select slug from graphs.slugs where slug = :s or slug like :p",
                {"s": s, "p": f"{s[:56]}-%"},
            )
        }
    if s not in taken:
        return {"slug": s, "valid": True, "available": True, "suggestion": None}
    base = s[:56].strip("-")
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return {"slug": s, "valid": True, "available": False, "suggestion": f"{base}-{n}"}


def publish(
    u: dict[str, Any],
    local_id: str,
    slug_raw: str,
    title: Any,
    description: Any,
    kind: Any,
    raw: Any,
    forked_from: dict[str, Any] | None,
) -> dict[str, Any]:
    """A map published for the first time: its slug taken for ever, its first version."""
    _active(u)
    slug = _slug(slug_raw)
    c = _content(title, description, kind, raw)
    with tx() as conn:
        _burst(conn, u)
        had = q1(
            conn,
            "select slug from graphs.published where owner_id = :u and local_id = :l",
            {"u": u["id"], "l": local_id},
        )
        if had:
            raise Refusal(
                409, "already_published", f"This map is published at {had['slug']}; publish a new version."
            )
        n = q1(conn, "select count(*)::int as n from graphs.published where owner_id = :u", {"u": u["id"]})
        if n and n["n"] >= MAX_PUBLISHED:
            raise Refusal(429, "too_many_maps", "That is as many maps as one reader can publish.")
        if not q1(
            conn,
            "insert into graphs.slugs (slug) values (:s) on conflict do nothing returning slug",
            {"s": slug},
        ):
            raise Refusal(409, "slug_taken", "This address is taken; choose another.")
        origin = None
        if forked_from and isinstance(forked_from.get("slug"), str):
            fs = slugify(forked_from["slug"])
            fv = forked_from.get("version")
            if q1(conn, "select 1 as x from graphs.slugs where slug = :s", {"s": fs}) and isinstance(fv, int):
                origin = (fs, max(1, fv))
        conn.execute(
            text(
                """insert into graphs.published (slug, owner_id, local_id, forked_from, forked_from_version)
                   values (:s, :u, :l, :fs, :fv)"""
            ),
            {
                "s": slug,
                "u": u["id"],
                "l": local_id,
                "fs": origin[0] if origin else None,
                "fv": origin[1] if origin else None,
            },
        )
        _insert_version(conn, slug, 1, c)
        return _record(conn, slug, None, u)


def _owned(conn: Connection, u: dict[str, Any], slug: str) -> dict[str, Any]:
    p = q1(conn, "select * from graphs.published where slug = :s for update", {"s": slug})
    if p is None:
        raise Refusal(404, "not_found", "No map is published at this address.")
    if p["owner_id"] != u["id"]:
        raise Refusal(403, "not_owner", "Only the map's owner publishes it.")
    return p


def add_version(
    u: dict[str, Any], slug_raw: str, title: Any, description: Any, kind: Any, raw: Any
) -> dict[str, Any]:
    """The map as it is now, published as its next version; the earlier ones stay as they were."""
    _active(u)
    slug = slugify(slug_raw)
    c = _content(title, description, kind, raw)
    with tx() as conn:
        p = _owned(conn, u, slug)
        _burst(conn, u)
        if p["latest"] >= MAX_VERSIONS:
            raise Refusal(429, "too_many_versions", "This map has as many versions as one map can have.")
        version = p["latest"] + 1
        _insert_version(conn, slug, version, c)
        conn.execute(
            text("update graphs.published set latest = :v, updated_at = now() where slug = :s"),
            {"v": version, "s": slug},
        )
        return _record(conn, slug, None, u)


def _withdraw(conn: Connection, slug: str, by: str) -> None:
    conn.execute(text("delete from graphs.published where slug = :s"), {"s": slug})
    conn.execute(
        text(
            """insert into graphs.withdrawn (slug, withdrawn_by) values (:s, :b)
               on conflict (slug) do update set withdrawn_by = excluded.withdrawn_by, withdrawn_at = now()"""
        ),
        {"s": slug, "b": by},
    )
    # what was reported is gone: its reports are closed with it
    conn.execute(
        text(
            """update graphs.published_reports set resolved_at = now(), outcome = 'withdrawn'
               where slug = :s and resolved_at is null"""
        ),
        {"s": slug},
    )


def withdraw(u: dict[str, Any], slug_raw: str) -> None:
    """The owner withdraws the map: every version goes; the address stays reserved and says the map was withdrawn."""
    slug = slugify(slug_raw)
    with tx() as conn:
        _owned(conn, u, slug)
        _withdraw(conn, slug, "author")


def _record(
    conn: Connection, slug: str, version: int | None, viewer: dict[str, Any] | None
) -> dict[str, Any]:
    p = q1(
        conn,
        """select p.*, u.display_name as author from graphs.published p
             left join accounts.users u on u.id = p.owner_id where p.slug = :s""",
        {"s": slug},
    )
    if p is None:
        gone = q1(
            conn,
            """select s.slug, w.withdrawn_by, w.withdrawn_at from graphs.slugs s
                 left join graphs.withdrawn w on w.slug = s.slug where s.slug = :s""",
            {"s": slug},
        )
        if gone is None:
            raise Refusal(404, "not_found", "No map is published at this address.")
        # withdrawn by its author or the board, or gone with its account (said as its author's act)
        raise Refusal(410, f"withdrawn_{gone['withdrawn_by'] or 'author'}", "This map was withdrawn.")
    v = version or p["latest"]
    row = q1(
        conn, "select * from graphs.published_versions where slug = :s and version = :v", {"s": slug, "v": v}
    )
    if row is None:
        raise Refusal(404, "no_version", "This map has no such version.")
    versions = q(
        conn,
        """select version, title, counts, published_at from graphs.published_versions where slug = :s
           order by version desc""",
        {"s": slug},
    )
    origin = None
    if p["forked_from"]:
        o = q1(
            conn,
            """select v.title from graphs.published_versions v where v.slug = :s
                and v.version = least(:v, (select latest from graphs.published where slug = :s))""",
            {"s": p["forked_from"], "v": p["forked_from_version"] or 1},
        )
        origin = {
            "slug": p["forked_from"],
            "version": p["forked_from_version"],
            "title": o["title"] if o else None,
        }
    mine = viewer is not None and viewer["id"] == p["owner_id"]
    board = viewer is not None and viewer["role"] in BOARD
    out: dict[str, Any] = {
        "slug": slug,
        "version": v,
        "latest": p["latest"],
        "title": row["title"],
        "description": row["description"],
        "kind": row["kind"],
        "doc": row["doc"],
        "doc_version": row["doc_version"],
        "counts": row["counts"],
        "published_at": row["published_at"],
        "first_published_at": p["created_at"],
        "updated_at": p["updated_at"],
        "author": {"name": p["author"]},
        "fork_count": p["fork_count"],
        "cite_count": p["cite_count"],
        "forked_from": origin,
        "versions": versions,
        "mine": mine,
    }
    if mine:
        out["local_id"] = p["local_id"]
    if board:
        out["reports"] = q(
            conn,
            """select id, version, reason, created_at from graphs.published_reports
                where slug = :s and resolved_at is null order by created_at""",
            {"s": slug},
        )
    return out


def read(slug_raw: str, version: int | None, viewer: dict[str, Any] | None) -> dict[str, Any]:
    slug = slugify(slug_raw)
    with tx() as conn:
        return _record(conn, slug, version, viewer)


def _rows(conn: Connection, where: str, params: dict[str, Any], offset: int, limit: int) -> dict[str, Any]:
    rows = q(
        conn,
        f"""select p.slug, p.latest, p.fork_count, p.cite_count, p.updated_at, p.created_at, p.local_id, p.owner_id,
                   u.display_name as author, v.title, v.description, v.kind, v.counts
              from graphs.published p
              join graphs.published_versions v on v.slug = p.slug and v.version = p.latest
              left join accounts.users u on u.id = p.owner_id
             where {where} order by p.updated_at desc offset :o limit :l""",
        {**params, "o": offset, "l": limit},
    )
    total = q1(conn, f"select count(*)::int as n from graphs.published p where {where}", params)
    return {"rows": rows, "total": total["n"] if total else 0}


def _row(r: dict[str, Any], own: bool = False) -> dict[str, Any]:
    out = {
        "slug": r["slug"],
        "title": r["title"],
        "description": r["description"],
        "kind": r["kind"],
        "counts": r["counts"],
        "latest": r["latest"],
        "fork_count": r["fork_count"],
        "cite_count": r["cite_count"],
        "updated_at": r["updated_at"],
        "first_published_at": r["created_at"],
        "author": {"name": r["author"]},
    }
    if own:
        out["local_id"] = r["local_id"]
    return out


def gallery(offset: int, limit: int, by: str | None) -> dict[str, Any]:
    """The published maps, the latest first; with `by`, the other maps of that map's author."""
    with tx() as conn:
        if by:
            owner = q1(conn, "select owner_id from graphs.published where slug = :s", {"s": slugify(by)})
            if owner is None:
                return {"data": [], "total": 0}
            got = _rows(
                conn,
                "p.owner_id = :u and p.slug <> :s",
                {"u": owner["owner_id"], "s": slugify(by)},
                offset,
                limit,
            )
        else:
            got = _rows(conn, "true", {}, offset, limit)
    return {"data": [_row(r) for r in got["rows"]], "total": got["total"]}


def mine(u: dict[str, Any]) -> dict[str, Any]:
    with tx() as conn:
        got = _rows(conn, "p.owner_id = :u", {"u": u["id"]}, 0, MAX_PUBLISHED)
    return {"data": [_row(r, own=True) for r in got["rows"]]}


# ─── counts ──────────────────────────────────────────────────────────────────

_seen: dict[str, float] = {}
_swept = [0.0]


def _first_time(key: str) -> bool:
    """Whether this reader's fork or citation of this map is the first in the hour; the key is forgotten after."""
    now = time.monotonic()
    if now - _swept[0] > 60:
        _swept[0] = now
        for k in [k for k, at in _seen.items() if now - at > COUNT_EVERY]:
            del _seen[k]
    at = _seen.get(key)
    if at is not None and now - at <= COUNT_EVERY:
        return False
    _seen[key] = now
    return True


def count(slug_raw: str, what: str, viewer: dict[str, Any] | None, address: str) -> dict[str, Any]:
    """A fork made or a citation copied (EDT-290, EDT-332, EDT-345, EDT-346): the map's count, once per reader an
    hour; the owner's own forks and citations are not counted."""
    slug = slugify(slug_raw)
    column = {"fork": "fork_count", "cite": "cite_count"}[what]
    with tx() as conn:
        p = q1(
            conn, "select owner_id, fork_count, cite_count from graphs.published where slug = :s", {"s": slug}
        )
        if p is None:
            _record(conn, slug, None, viewer)  # says 404 or 410
            raise Refusal(404, "not_found", "No map is published at this address.")
        own = viewer is not None and viewer["id"] == p["owner_id"]
        who = f"u:{viewer['id']}" if viewer else f"a:{address}"
        if own or not _first_time(f"{what}:{slug}:{who}"):
            return {column: p[column], "counted": False}
        n = q1(
            conn,
            f"update graphs.published set {column} = {column} + 1 where slug = :s returning {column}",
            {"s": slug},
        )
        assert n is not None
        return {column: n[column], "counted": True}


# ─── reports ─────────────────────────────────────────────────────────────────


def report(u: dict[str, Any], slug_raw: str, version: int, reason: str) -> dict[str, Any]:
    """A signed-in reader reports a map to the board (one open report per reader and map)."""
    if u.get("blocked_at"):
        raise Refusal(403, "blocked", "This account can no longer report.")
    words = (reason or "").strip()
    if not words:
        raise Refusal(422, "empty", "Say what is wrong with this map.")
    slug = slugify(slug_raw)
    with tx() as conn:
        p = q1(conn, "select owner_id, latest from graphs.published where slug = :s", {"s": slug})
        if p is None:
            raise Refusal(404, "not_found", "No map is published at this address.")
        if p["owner_id"] == u["id"]:
            raise Refusal(403, "own_map", "You cannot report your own map.")
        conn.execute(
            text(
                """insert into graphs.published_reports (slug, version, reporter_id, reason)
                   values (:s, :v, :u, :r) on conflict do nothing"""
            ),
            {"s": slug, "v": min(max(1, version), p["latest"]), "u": u["id"], "r": words[:1000]},
        )
    return {"reported": True}


def _board(u: dict[str, Any]) -> None:
    if u["role"] not in BOARD or u.get("blocked_at"):
        raise Refusal(403, "not_board", "Only the editorial board reads and resolves reports on maps.")


def open_reports(u: dict[str, Any]) -> dict[str, Any]:
    _board(u)
    with tx() as conn:
        rows = q(
            conn,
            """select r.id, r.slug, r.version, r.reason, r.created_at, v.title
                 from graphs.published_reports r
                 join graphs.published p on p.slug = r.slug
                 join graphs.published_versions v on v.slug = r.slug and v.version = p.latest
                where r.resolved_at is null order by r.created_at limit 200""",
        )
    return {"data": rows}


def resolve_report(u: dict[str, Any], rid: int, outcome: str) -> dict[str, Any]:
    """The board dismisses a report, or withdraws the map it concerns (closing every open report on it)."""
    _board(u)
    if outcome not in ("dismissed", "withdrawn"):
        raise Refusal(422, "unknown_outcome", "Dismiss the report, or withdraw the map.")
    with tx() as conn:
        r = q1(
            conn,
            "select slug from graphs.published_reports where id = :id and resolved_at is null for update",
            {"id": rid},
        )
        if r is None:
            raise Refusal(409, "not_open_report", "No such report, or it is already resolved.")
        if outcome == "withdrawn":
            _withdraw(conn, r["slug"], "board")
        conn.execute(
            text(
                """update graphs.published_reports set resolved_at = coalesce(resolved_at, now()), resolved_by = :u,
                          outcome = :o where id = :id"""
            ),
            {"u": u["id"], "o": outcome, "id": rid},
        )
    return {"id": rid, "outcome": outcome}


# ─── the account ─────────────────────────────────────────────────────────────


def forget(conn: Connection, user_id: Any) -> None:
    """An account deleted: its maps are withdrawn (their slugs kept), its open reports go with it (cascade)."""
    for r in q(conn, "select slug from graphs.published where owner_id = :u", {"u": user_id}):
        _withdraw(conn, r["slug"], "author")


def export_for(u: dict[str, Any]) -> dict[str, Any]:
    with tx() as conn:
        maps = q(
            conn,
            """select p.slug, p.local_id, p.fork_count, p.cite_count, p.created_at,
                      coalesce((select json_agg(json_build_object('version', v.version, 'title', v.title,
                                  'description', v.description, 'kind', v.kind, 'doc', v.doc,
                                  'published_at', v.published_at) order by v.version)
                                from graphs.published_versions v where v.slug = p.slug), '[]') as versions
                 from graphs.published p where p.owner_id = :u order by p.created_at""",
            {"u": u["id"]},
        )
        reports = q(
            conn,
            """select slug, version, reason, created_at, resolved_at, outcome from graphs.published_reports
                where reporter_id = :u order by created_at""",
            {"u": u["id"]},
        )
    return {"published_maps": maps, "map_reports": reports}
