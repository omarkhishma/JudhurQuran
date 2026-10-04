"""Topics (PLAN P8.3, research 06 Part 3, D29): the headings a source gives and the verses it gathers under each, with
the editorial board's taxonomy in force over them (P8.3b).

Readers see Quranpedia's Arabic tree; QSAC's model-made tags and La Beaume's chapters stay with the board. What the
board has approved changes what is served, and every answer says who named what: a Quranpedia topic renamed or placed
under another (its source's name kept beside it), one of La Beaume's chapters adopted under an Arabic name (the book
credited as its source), a topic of the board's own, and a verse a QSAC tag suggested placed under an Arabic topic
(QSAC credited, the board's placement marked). Every answer carries the credit of each source in it and the version of
Quranpedia's data, as its terms ask of a republication (D29). The board's verdict on a Quranpedia link (the verdict
layer ``topic_links``) marks it, and a link it rejected is left out.
"""

from __future__ import annotations

import time
from collections import Counter
from typing import Any

from jadhr_arabic import normalize
from sqlalchemy import Connection

from . import board
from .db import rows

LAYER = "topic_links"
PLACED = "topic_candidates"
SHOWN = "quranpedia-topics"
_SOURCES: tuple[float, dict[str, dict[str, Any]]] | None = None
_TREE: tuple[float, dict[str, dict[str, Any]]] | None = None
_COLS = "t.id, t.source_id, t.source_ref, t.name_ar, t.name_en, t.name_fr, t.parent_id, t.verse_count"


def _all_sources(conn: Connection) -> dict[str, dict[str, Any]]:
    """Every topic source with what its credit says; read once a release and kept."""
    global _SOURCES
    if _SOURCES and time.monotonic() - _SOURCES[0] < 3600:
        return _SOURCES[1]
    found = {
        s["id"]: s
        for s in rows(
            conn,
            """select id, title_ar, title_en, publisher_ar, publisher_en, version, url, licence, licence_url, shown,
                      attribution_ar, attribution_en from content.topic_sources""",
        )
    }
    _SOURCES = (time.monotonic(), found)
    return found


def sources(conn: Connection) -> dict[str, dict[str, Any]]:
    """The sources shown to readers as they are (Quranpedia's tree)."""
    return {k: v for k, v in _all_sources(conn).items() if v["shown"]}


def _credit(conn: Connection, ids: set[str]) -> dict[str, dict[str, Any]]:
    s = _all_sources(conn)
    return {i: {k: v for k, v in s[i].items() if k != "shown"} for i in sorted(ids) if i in s}


def _tree(conn: Connection) -> dict[str, dict[str, Any]]:
    """Every heading readers may see or the board may adopt, by id, with its source and where its source places it."""
    global _TREE
    if _TREE and time.monotonic() - _TREE[0] < 3600:
        return _TREE[1]
    found = {
        r["id"]: r
        for r in rows(
            conn,
            "select id, source_id, parent_id from content.topics where source_id in ('quranpedia-topics', 'labeaume')",
        )
    }
    _TREE = (time.monotonic(), found)
    return found


class _View:
    """The taxonomy as it stands with the board's work in force: who is seen, under whom, and the verses placed."""

    def __init__(self, conn: Connection) -> None:
        self.tree = _tree(conn)
        self.tax = {
            k: {**v["value"], "approved_at": v["approved_at"]} for k, v in board.every(conn, "topic").items()
        }
        self.placed: list[dict[str, Any]] = []
        for row, v in board.layer(conn, PLACED).items():
            val = v["value"]
            to = (val.get("ends") or {}).get("topic")
            if val.get("verdict") == "corrected" and to:
                self.placed.append(
                    {
                        "link": row,
                        "tag": row.rsplit("@", 1)[0],
                        "verse_key": row.rsplit("@", 1)[1],
                        "topic_id": to,
                        "approved_at": v["approved_at"],
                    }
                )
        self.placed = [p for p in self.placed if self.seen(p["topic_id"])]
        self.n_placed = Counter(p["topic_id"] for p in self.placed)
        self._parents: dict[str, str | None] = {}

    def seen(self, tid: str) -> bool:
        """Quranpedia's topics always; a La Beaume chapter once adopted; a board topic once named."""
        t = self.tree.get(tid)
        if t and t["source_id"] == SHOWN:
            return True
        return bool((self.tax.get(tid) or {}).get("name_ar")) and (tid.startswith("board:") or t is not None)

    def every(self) -> list[str]:
        return [
            *(k for k in self.tree if self.seen(k)),
            *(k for k in self.tax if k.startswith("board:") and self.seen(k)),
        ]

    def parent(self, tid: str) -> str | None:
        if tid in self._parents:
            return self._parents[tid]
        under = (self.tax.get(tid) or {}).get("under") or ""
        if under == "top":
            p = None
        elif under and self.seen(under):
            p = under
        else:
            t = self.tree.get(tid)
            p = t["parent_id"] if t and t["parent_id"] and self.seen(t["parent_id"]) else None
        self._parents[tid] = p
        return p

    def chain(self, tid: str) -> list[str]:
        """The topics above one, from the top down; a loop the board's places might make is cut where it closes."""
        out, seen, at = [], {tid}, self.parent(tid)
        while at and at not in seen:
            out.append(at)
            seen.add(at)
            at = self.parent(at)
        return out[::-1]

    def children(self) -> Counter[str | None]:
        return Counter(self.parent(k) for k in self.every())


def _rows(conn: Connection, v: _View, ids: list[str]) -> dict[str, dict[str, Any]]:
    """Headings by id, each as readers see it: the name in force and whose it is, its place and its verses."""
    found = {
        r["id"]: r
        for r in rows(conn, f"select {_COLS} from content.topics t where t.id = any(:i)", {"i": ids})
    }
    out = {}
    for tid in ids:
        t = found.get(tid) or {
            "id": tid,
            "source_id": "board",
            "source_ref": None,
            "name_ar": None,
            "name_en": None,
            "name_fr": None,
            "parent_id": None,
            "verse_count": 0,
        }
        b = v.tax.get(tid) or {}
        own = t["name_ar"] or t["name_en"] or t["name_fr"]
        x: dict[str, Any] = {
            "id": tid,
            "source_id": t["source_id"],
            "name": b.get("name_ar") or own,
            "parent_id": v.parent(tid),
            "verses": (t["verse_count"] if t["source_id"] == SHOWN else 0) + v.n_placed.get(tid, 0),
        }
        if b.get("name_en"):
            x["name_en"] = b["name_en"]
        if b.get("name_ar") or b.get("under"):
            # the board's work on this heading: what it named, where it placed it, and when it came into force
            x["board"] = {
                "named": bool(b.get("name_ar")),
                "placed": bool(b.get("under")),
                "approved_at": b["approved_at"],
            }
            if b.get("name_ar") and t["source_id"] == SHOWN:
                x["source_name"] = own
        if t["source_id"] == "labeaume":
            x["after"] = {"source_id": "labeaume", "ref": t["source_ref"], "title_fr": t["name_fr"]}
        out[tid] = x
    return out


def _listed(conn: Connection, v: _View, ids: list[str], limit: int, offset: int) -> dict[str, Any]:
    """A page of headings — the taxonomy's own top level first, then those gathering the most verses."""
    every = _rows(conn, v, ids)
    kids = v.children()
    ordered = sorted(
        every.values(),
        key=lambda x: (x["source_id"] == SHOWN, -x["verses"], x["name"] or "", x["id"]),
    )
    page = ordered[offset : offset + limit]
    for x in page:
        x["children"] = kids.get(x["id"], 0)
        x["level"] = len(v.chain(x["id"]))
    return {"total": len(ordered), "data": page, "sources": _credit(conn, _sources_of(page) or {SHOWN})}


def _sources_of(xs: list[dict[str, Any]]) -> set[str]:
    return {x["source_id"] for x in xs if x["source_id"] != "board"}


def browse(
    conn: Connection, parent: str | None, query: str | None, limit: int, offset: int
) -> dict[str, Any]:
    """A level of the tree (the top, or a topic's sub-topics), or the topics whose names match a search."""
    v = _View(conn)
    if query:
        q = normalize(query).lower()  # a French or English name is matched without its case
        hits = {
            r["id"]
            for r in rows(
                conn,
                "select id from content.topics where source_id in ('quranpedia-topics', 'labeaume') and name_norm like :q",
                {"q": f"%{q}%"},
            )
        }
        hits |= {k for k, b in v.tax.items() if b.get("name_ar") and q in normalize(b["name_ar"]).lower()}
        ids = [k for k in hits if v.seen(k)]
    else:
        ids = [k for k in v.every() if v.parent(k) == (parent or None)]
    return _listed(conn, v, ids, limit, offset)


def _key(k: str) -> tuple[int, int]:
    s, a = k.split(":")
    return int(s), int(a)


def topic(conn: Connection, tid: str, limit: int, offset: int) -> dict[str, Any] | None:
    """A topic: the chain above it, its sub-topics, and the verses it gathers (a page of them, in the mushaf's order),
    each link with its source and the board's verdict or placement."""
    v = _View(conn)
    if not v.seen(tid):
        return None
    chain = v.chain(tid)
    kids = [k for k in v.every() if v.parent(k) == tid]
    every = _rows(conn, v, [tid, *chain, *kids])
    counts = v.children()
    links = board.marked(
        conn,
        LAYER,
        [
            {"verse_key": x["verse_key"], "link": x["id"], "source_id": x["source_id"]}
            for x in rows(
                conn,
                "select id, verse_key, source_id from content.topic_links where topic_id = :id",
                {"id": tid},
            )
            if x["source_id"] == SHOWN
        ],
        key="link",
    )
    have = {x["verse_key"] for x in links}
    links += [
        {
            "verse_key": p["verse_key"],
            "link": p["link"],
            "source_id": "qsac",
            "review": {"verdict": "placed", "approved_at": p["approved_at"]},
        }
        for p in v.placed
        if p["topic_id"] == tid and p["verse_key"] not in have
    ]
    links.sort(key=lambda x: _key(x["verse_key"]))
    me = every[tid] | {"children": counts.get(tid, 0), "level": len(chain)}
    subs = sorted(
        (every[k] | {"children": counts.get(k, 0)} for k in kids),
        key=lambda x: (-x["verses"], x["name"] or ""),
    )
    used = {me["source_id"], *(x["source_id"] for x in links)} - {"board"}
    return {
        **me,
        "chain": [every[c] | {"level": i} for i, c in enumerate(chain)],
        "subtopics": subs,
        "total": len(links),
        "data": [
            {k: x[k] for k in ("verse_key", "link", "source_id", "review") if k in x}
            for x in links[offset : offset + limit]
        ],
        "sources": _credit(conn, used or {SHOWN}),
    }


def of_verse(conn: Connection, key: str) -> dict[str, Any]:
    """The topics a verse is gathered under, each with the topic above it — Quranpedia's links and the board's
    placements from QSAC's suggestions, each said to be what it is."""
    v = _View(conn)
    found = board.marked(
        conn,
        LAYER,
        [
            dict(r)
            for r in rows(
                conn,
                "select id as link, topic_id from content.topic_links where verse_key = :k and source_id = :s",
                {"k": key, "s": SHOWN},
            )
        ],
        key="link",
    )
    linked = [
        (r["topic_id"], {"via": SHOWN, **({"review": r["review"]} if r.get("review") else {})}) for r in found
    ]
    have = {t for t, _ in linked}
    linked += [
        (p["topic_id"], {"via": "qsac", "review": {"verdict": "placed", "approved_at": p["approved_at"]}})
        for p in v.placed
        if p["verse_key"] == key and p["topic_id"] not in have
    ]
    ids = [t for t, _ in linked]
    every = _rows(conn, v, list({*ids, *(p for t in ids if (p := v.parent(t)))}))
    data = []
    for tid, extra in linked:
        x = every[tid] | extra | {"level": len(v.chain(tid))}
        p = x["parent_id"]
        x["parent_name"] = every[p]["name"] if p else None
        data.append(x)
    data.sort(key=lambda x: (x["verses"], x["name"] or ""))
    used = {x["via"] for x in data} | _sources_of(data)
    return {"verse_key": key, "data": data, "sources": _credit(conn, used or {SHOWN})}


def coverage(conn: Connection) -> dict[str, Any]:
    """How many verses of each sūra a topic gathers: Quranpedia's links (research 06: almost none after sūra 39) and
    the verses the board has placed since."""
    v = _View(conn)
    per = rows(
        conn,
        """select v.surah, count(distinct v.ayah)::int as verses, count(distinct l.verse_key)::int as covered
           from content.verses v left join content.topic_links l
             on l.verse_key = v.surah || ':' || v.ayah and l.source_id = :s
           group by v.surah order by v.surah""",
        {"s": SHOWN},
    )
    placed = Counter(_key(k)[0] for k in {p["verse_key"] for p in v.placed})
    for r in per:
        r["placed"] = placed.get(r["surah"], 0)
    return {
        "surahs": per,
        "verses": sum(r["verses"] for r in per),
        "covered": sum(r["covered"] for r in per),
        "placed": sum(placed.values()),
        "sources": _credit(conn, {SHOWN}),
    }
