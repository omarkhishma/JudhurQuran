"""Topics (PLAN P8.3, research 06 Part 3, D29): the headings a source gives and the verses it gathers under each.

Only a source shown to readers is served here (Quranpedia's Arabic tree); QSAC's model-made tags stay with the
editorial board. Every answer carries the source's credit and the version of its data, as Quranpedia's terms ask of
a republication (D29). The board's verdict on a link (the verdict layer ``topic_links``) marks it, and a link it
rejected is left out.
"""

from __future__ import annotations

import time
from typing import Any

from jadhr_arabic import normalize
from sqlalchemy import Connection

from . import board
from .db import rows

LAYER = "topic_links"
_SOURCES: tuple[float, dict[str, dict[str, Any]]] | None = None
_COLS = "t.id, t.source_id, t.name_ar, t.name_en, t.parent_id, t.level, t.verse_count"


def sources(conn: Connection) -> dict[str, dict[str, Any]]:
    """The sources shown to readers, with what their credit says; read once a release and kept."""
    global _SOURCES
    if _SOURCES and time.monotonic() - _SOURCES[0] < 3600:
        return _SOURCES[1]
    found = {
        s["id"]: s
        for s in rows(
            conn,
            """select id, title_ar, title_en, publisher_ar, publisher_en, version, url, licence, licence_url,
                      attribution_ar, attribution_en from content.topic_sources where shown""",
        )
    }
    _SOURCES = (time.monotonic(), found)
    return found


def _credit(conn: Connection, ids: set[str]) -> dict[str, dict[str, Any]]:
    s = sources(conn)
    return {i: s[i] for i in sorted(ids) if i in s}


def _rejected(conn: Connection) -> set[str]:
    return {k for k, v in board.layer(conn, LAYER).items() if v["value"]["verdict"] == "rejected"}


def _counts(conn: Connection, ids: list[str]) -> dict[str, int]:
    """How many sub-topics each topic has."""
    if not ids:
        return {}
    return {
        r["parent_id"]: r["n"]
        for r in rows(
            conn,
            "select parent_id, count(*)::int as n from content.topics where parent_id = any(:ids) group by parent_id",
            {"ids": ids},
        )
    }


def _out(t: dict[str, Any], children: dict[str, int]) -> dict[str, Any]:
    return {
        "id": t["id"],
        "source_id": t["source_id"],
        "name": t["name_ar"] or t["name_en"],
        "parent_id": t["parent_id"],
        "level": t["level"],
        "verses": t["verse_count"],
        "children": children.get(t["id"], 0),
    }


def browse(conn: Connection, parent: str | None, query: str | None, limit: int, offset: int) -> dict[str, Any]:
    """A level of the tree (the top, or a topic's sub-topics), or the topics whose names match a search — the ones
    gathering the most verses first."""
    shown = list(sources(conn))
    if query:
        q = normalize(query)
        where, args = "t.name_norm like :q", {"q": f"%{q}%"}
    elif parent:
        where, args = "t.parent_id = :p", {"p": parent}
    else:
        where, args = "t.parent_id is null", {}
    found = rows(
        conn,
        f"""select {_COLS}, count(*) over ()::int as total from content.topics t
            where t.source_id = any(:s) and {where}
            order by t.verse_count desc, t.name_ar, t.id limit :n offset :o""",
        {**args, "s": shown, "n": limit, "o": offset},
    )
    children = _counts(conn, [t["id"] for t in found])
    return {
        "total": found[0]["total"] if found else 0,
        "data": [_out(t, children) for t in found],
        "sources": _credit(conn, {t["source_id"] for t in found} or set(shown)),
    }


def topic(conn: Connection, tid: str, limit: int, offset: int) -> dict[str, Any] | None:
    """A topic: the chain above it, its sub-topics, and the verses it gathers (a page of them, in the mushaf's order),
    each link with the board's verdict when it has one."""
    found = rows(
        conn,
        f"select {_COLS} from content.topics t where t.id = :id and t.source_id = any(:s)",
        {"id": tid, "s": list(sources(conn))},
    )
    if not found:
        return None
    t = found[0]
    chain = rows(
        conn,
        f"""with recursive up as (
              select {_COLS}, 0 as d from content.topics t where t.id = :p
              union all select {_COLS}, up.d + 1 from content.topics t join up on t.id = up.parent_id)
            select * from up order by d desc""",
        {"p": t["parent_id"]},
    ) if t["parent_id"] else []
    kids = rows(
        conn,
        f"select {_COLS} from content.topics t where t.parent_id = :id order by t.verse_count desc, t.name_ar",
        {"id": tid},
    )
    rejected = _rejected(conn)
    links = [
        x
        for x in rows(
            conn,
            """select id, verse_key, version from content.topic_links where topic_id = :id
               order by split_part(verse_key, ':', 1)::int, split_part(verse_key, ':', 2)::int""",
            {"id": tid},
        )
        if x["id"] not in rejected
    ]
    page = board.marked(conn, LAYER, [dict(x) for x in links[offset : offset + limit]])
    children = _counts(conn, [tid, *[k["id"] for k in kids]])
    return {
        **_out(t, children),
        "chain": [_out(c, {}) for c in chain],
        "subtopics": [_out(k, children) for k in kids],
        "total": len(links),
        "data": [
            {"verse_key": x["verse_key"], "link": x["id"], **({"review": x["review"]} if x.get("review") else {})}
            for x in page
        ],
        "sources": _credit(conn, {t["source_id"]}),
    }


def of_verse(conn: Connection, key: str) -> dict[str, Any]:
    """The topics a verse is gathered under, each with the topic above it."""
    shown = list(sources(conn))
    found = rows(
        conn,
        f"""select {_COLS}, l.id as link, p.name_ar as parent_name, p.id as parent
            from content.topic_links l join content.topics t on t.id = l.topic_id
            left join content.topics p on p.id = t.parent_id
            where l.verse_key = :k and l.source_id = any(:s)
            order by t.verse_count, t.name_ar""",
        {"k": key, "s": shown},
    )
    rejected = _rejected(conn)
    found = board.marked(conn, LAYER, [dict(r) for r in found if r["link"] not in rejected], key="link")
    return {
        "verse_key": key,
        "data": [
            {
                **_out(r, {}),
                "parent_name": r["parent_name"],
                **({"review": r["review"]} if r.get("review") else {}),
            }
            for r in found
        ],
        "sources": _credit(conn, {r["source_id"] for r in found} or set(shown)),
    }


def coverage(conn: Connection) -> dict[str, Any]:
    """How many verses of each sūra a shown source gathers under a topic (research 06: almost none after sūra 39)."""
    shown = list(sources(conn))
    per = rows(
        conn,
        """select v.surah, count(distinct v.ayah)::int as verses, count(distinct l.verse_key)::int as covered
           from content.verses v left join content.topic_links l
             on l.verse_key = v.surah || ':' || v.ayah and l.source_id = any(:s)
           group by v.surah order by v.surah""",
        {"s": shown},
    )
    return {
        "surahs": per,
        "verses": sum(r["verses"] for r in per),
        "covered": sum(r["covered"] for r in per),
        "sources": _credit(conn, set(shown)),
    }
