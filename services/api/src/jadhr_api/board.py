"""What the editorial board has put in force, read beside the content (PLAN P3.0c, research 14 §5).

The board's work lives in `editorial.*`, apart from the content a release replaces; the content API asks here for
what is in force on the things it serves and shows it beside the source, never over it: a root's English gloss
and a corrected cut of Ibn Fāris's statement, a pattern's function and plain explanation, a word's sense list,
the glossary's bodies, and the board's verdict on rows extracted from the books — reviewed, corrected (with the
correction), or rejected (left out). The public payloads name the board, not its members. The few small kinds are
read whole and kept a short while; an approval clears them (jadhr_api.editorial).
"""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy import Connection

from .db import connect, one, rows

SMALL = ("root_gloss", "root_core", "pattern_function", "pattern_plain", "glossary", "topic")
TTL = 30.0
_cache: dict[str, tuple[float, dict[str, dict[str, Any]]]] = {}


_version: tuple[float, str] | None = None


def clear() -> None:
    global _works, _version
    _cache.clear()
    _works = None
    _version = None


def version() -> str:
    """When the board last changed what is in force, and how much is: part of every content ETag, so a copy a reader
    already holds is not answered "not modified" after an approval. Other API processes see it within the TTL."""
    global _version
    if _version and time.monotonic() - _version[0] < TTL:
        return _version[1]
    with connect() as conn:
        r = one(
            conn,
            """select coalesce(max(decided_at)::text, '') as at, count(*) as n,
                      (select coalesce(max(created_at)::text, '') from editorial.reviews) as reviewed
               from editorial.entries where status = 'approved'""",
        )
    # a review of what the administration published changes what the reader is told, not what is in force (P14)
    v = f"{r['at']}#{r['n']}#{r['reviewed']}" if r else ""
    _version = (time.monotonic(), v)
    return v


def _out(r: dict[str, Any]) -> dict[str, Any]:
    return {
        "value": r["value"],
        "sources": r["sources"],
        "approved_at": r["decided_at"].isoformat() if r["decided_at"] else None,
    }


def _all(conn: Connection, kind: str) -> dict[str, dict[str, Any]]:
    hit = _cache.get(kind)
    if hit and time.monotonic() - hit[0] < TTL:
        return hit[1]
    found = {
        r["target"]: _out(r)
        for r in rows(
            conn,
            "select target, value, sources, decided_at from editorial.entries where kind = :k and status = 'approved'",
            {"k": kind},
        )
    }
    _cache[kind] = (time.monotonic(), found)
    return found


def every(conn: Connection, kind: str) -> dict[str, dict[str, Any]]:
    """Every approved entry of a small kind, by target (the topic taxonomy is read whole, P8.3b)."""
    return _all(conn, kind)


# every work a board entry may cite, by the id the sources registry and the content tables give it
_WORKS = """
    select id, title_ar, title_en from content.lexicon_works
    union all select id, title_ar, title_en from content.gharib_works
    union all select id, title_ar, title_en from content.pattern_sources
    union all select id, title_ar, title_en from content.particle_sources
    union all select id, title_ar, title_en from content.loanword_sources
    union all select id, title_ar, title_en from content.relation_sources
    union all select id, title_ar, title_en from content.knowledge_sources
    union all select id, title_ar, title_en from content.topic_sources
    union all select id, title_ar, title_en from content.sources
"""
_works: tuple[float, dict[str, dict[str, str]]] | None = None


def works(conn: Connection) -> dict[str, dict[str, str]]:
    """The works a source may name, by id, with their titles; read once a release and kept."""
    global _works
    if _works and time.monotonic() - _works[0] < 3600:
        return _works[1]
    found: dict[str, dict[str, str]] = {}
    for r in rows(conn, _WORKS):
        found.setdefault(r["id"], {"title_ar": r["title_ar"], "title_en": r["title_en"]})
    _works = (time.monotonic(), found)
    return found


def named(conn: Connection, sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sources with the titles of the works they name; a work the registry does not know keeps its id alone."""
    w = works(conn)
    return [{**s, **w.get(s.get("work", ""), {})} for s in sources]


def forced(conn: Connection, kind: str, targets: list[str]) -> dict[str, dict[str, Any]]:
    """The approved entries of a kind on these targets."""
    if not targets:
        return {}
    if kind in SMALL:
        every = _all(conn, kind)
        return {t: every[t] for t in targets if t in every}
    return {
        r["target"]: _out(r)
        for r in rows(
            conn,
            "select target, value, sources, decided_at from editorial.entries where kind = :k and status = 'approved' and target = any(:t)",
            {"k": kind, "t": targets},
        )
    }


def layer(conn: Connection, name: str) -> dict[str, dict[str, Any]]:
    """Every verdict in force on one layer's rows, by row id (for a layer read by what its rows touch, not by id:
    the relations, P8.4). Kept as the small kinds are, and cleared by an approval."""
    hit = _cache.get(f"layer:{name}")
    if hit and time.monotonic() - hit[0] < TTL:
        return hit[1]
    found = {
        r["target"].split(":", 1)[1]: _out(r)
        for r in rows(
            conn,
            """select target, value, sources, decided_at from editorial.entries
               where kind = 'verdict' and status = 'approved' and target like :p""",
            {"p": f"{name}:%"},
        )
    }
    _cache[f"layer:{name}"] = (time.monotonic(), found)
    return found


def root(conn: Connection, r: dict[str, Any] | None) -> dict[str, Any] | None:
    """A root with the board's English gloss, and its correction of Ibn Fāris's statement as cut, when in force."""
    if not r or not r.get("key"):
        return r
    g = forced(conn, "root_gloss", [r["key"]]).get(r["key"])
    if g:
        r["gloss_en"] = g["value"]["en"]
        r["gloss_board"] = {"approved_at": g["approved_at"], "sources": named(conn, g["sources"])}
    c = forced(conn, "root_core", [r["key"]]).get(r["key"])
    if c:
        if c["value"]["kept"] == "corrected":
            r["gist_ar"] = c["value"]["ar"]
        r["gist_board"] = {"kept": c["value"]["kept"], "approved_at": c["approved_at"]}
    return r


def patterns(conn: Connection, ps: list[dict[str, Any] | None]) -> None:
    """Patterns with the board's function — quoted from the sarf books — and its plain explanation, in place."""
    slugs = [p["slug"] for p in ps if p and p.get("slug")]
    fn = forced(conn, "pattern_function", slugs)
    plain = forced(conn, "pattern_plain", slugs)
    for p in ps:
        if not p:
            continue
        f = fn.get(p["slug"])
        if f:
            p["function_ar"] = f["value"]["ar"] or p.get("function_ar")
            p["function_en"] = f["value"]["en"] or p.get("function_en")
            p["function_board"] = {"approved_at": f["approved_at"], "sources": named(conn, f["sources"])}
        q = plain.get(p["slug"])
        if q:
            p["plain_ar"] = q["value"]["ar"] or p.get("plain_ar")
            p["plain_en"] = q["value"]["en"] or p.get("plain_en")
            p["plain_board"] = {"approved_at": q["approved_at"]}


def senses(conn: Connection, slug: str) -> tuple[list[dict[str, Any]], dict[str, Any]] | None:
    """A word's sense list as the board assembled it, numbered, each sense with its sources."""
    s = forced(conn, "sense_list", [slug]).get(slug)
    if not s:
        return None
    # a sense taken from a reader's suggestion (B38) credits the reader, as the suggestion was credited
    from .contrib import credits

    taken = credits([x["from"] for x in s["value"]["senses"] if x.get("from")])
    out = [
        {
            "id": -(i + 1),
            "ordinal": i + 1,
            "text_ar": x["ar"] or None,
            "text_en": x["en"] or None,
            "sources": named(conn, x["sources"]),
            "status": "board",
        }
        | ({"suggested": taken[x["from"]]} if x.get("from") in taken else {})
        for i, x in enumerate(s["value"]["senses"])
    ]
    return out, {"approved_at": s["approved_at"]}


def marked(
    conn: Connection, layer: str, items: list[dict[str, Any]], key: str = "id"
) -> list[dict[str, Any]]:
    """Rows a book gave, each with the board's verdict on it; a row the board rejected is left out."""
    ids = [str(x[key]) for x in items if x.get(key) is not None]
    v = {t.split(":", 1)[1]: x for t, x in forced(conn, "verdict", [f"{layer}:{i}" for i in ids]).items()}
    out = []
    for x in items:
        d = v.get(str(x.get(key)))
        if d and d["value"]["verdict"] == "rejected":
            continue
        if d:
            x["review"] = {
                "verdict": d["value"]["verdict"],
                "note": d["value"].get("note") or None,
                "correction": d["value"].get("correction"),
                "approved_at": d["approved_at"],
            }
            # a relation's end the board mapped to another root (P8.4)
            for end, col in (("root", "root_key"), ("target_root", "target_root_key")):
                if (d["value"].get("ends") or {}).get(end) and col in x:
                    x[col] = d["value"]["ends"][end]
        out.append(x)
    return out


def glossary(conn: Connection, terms: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Glossary terms with the bodies the board reviewed or rewrote."""
    g = forced(conn, "glossary", [t["key"] for t in terms])
    for t in terms:
        x = g.get(t["key"])
        if x:
            t["body_ar"] = x["value"]["body_ar"] or t["body_ar"]
            t["body_en"] = x["value"]["body_en"] or t["body_en"]
            t["reviewed_at"] = x["approved_at"]
    return terms
