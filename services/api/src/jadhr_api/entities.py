"""Proper names (PLAN P3.9, P8.3b): the names the Quranic Arabic Corpus tags as proper nouns — people, nations, places
and others — each with the verses it is named in, for topic maps (research 13, QAN-09: "people and places from the
P3.9 registry").

A name and its verses are the corpus's tagging; the Wikidata item matched to it is a candidate until the editorial
board reviews it, and is said to be one. The board's verdict on a row (verdict layer ``entity_candidates``) marks it,
and a row it rejected is left out. Verses are named by the word itself, not by a pronoun referring to it.
"""

from __future__ import annotations

from typing import Any

from jadhr_arabic import normalize
from sqlalchemy import Connection

from . import board
from .db import one, rows
from .knowledge import _knowledge_sources

LAYER = "entity_candidates"
_COLS = """e.id, e.name_ar, e.name_plain, e.occurrences, e.verse_count, e.verses, e.wikidata_id, e.wikidata_label_ar,
           e.wikidata_label_en, e.wikidata_description, e.status, l.slug as lemma_slug"""


def _out(r: dict[str, Any]) -> dict[str, Any]:
    x: dict[str, Any] = {
        "id": r["id"],
        "name": r["name_ar"],
        "lemma_slug": r["lemma_slug"],
        "occurrences": r["occurrences"],
        "verses": r["verse_count"],
        "status": "reviewed" if r.get("review") else r["status"],
        "wikidata": {
            "id": r["wikidata_id"],
            "label_ar": r["wikidata_label_ar"],
            "label_en": r["wikidata_label_en"],
            "description": r["wikidata_description"],
        }
        if r["wikidata_id"]
        else None,
    }
    if r.get("review"):
        x["review"] = r["review"]
    return x


def _credit(conn: Connection) -> dict[str, dict[str, Any]]:
    return _knowledge_sources(conn, {"qac-proper-nouns", "wikidata"})


def _all(conn: Connection) -> list[dict[str, Any]]:
    found = rows(
        conn,
        f"""select {_COLS} from content.entity_candidates e join content.lemmas l on l.id = e.lemma_id
            order by e.occurrences desc, e.id""",
    )
    return board.marked(conn, LAYER, [dict(r) for r in found])


def browse(conn: Connection, query: str | None, limit: int, offset: int) -> dict[str, Any]:
    """The names, the most often named first; a search folds the Arabic as every search does and also matches the
    Wikidata label."""
    found = _all(conn)
    if query:
        q = normalize(query)
        found = [
            r
            for r in found
            if q in normalize(r["name_ar"])
            or q in normalize(r["name_plain"])
            or q in normalize(r["wikidata_label_ar"] or "")
        ]
    return {
        "total": len(found),
        "data": [_out(r) for r in found[offset : offset + limit]],
        "sources": _credit(conn),
    }


def entity(conn: Connection, eid: int, limit: int, offset: int) -> dict[str, Any] | None:
    """A name with the verses it is named in, a page of them in the mushaf's order."""
    found = [r for r in _all(conn) if r["id"] == eid]
    if not found:
        return None
    r = found[0]
    keys = [
        x["key"]
        for x in rows(
            conn, "select key from content.verses where id = any(:v) order by id", {"v": list(r["verses"])}
        )
    ]
    return {
        **_out(r),
        "total": len(keys),
        "data": [{"verse_key": k} for k in keys[offset : offset + limit]],
        "sources": _credit(conn),
    }


def of_verse(conn: Connection, key: str) -> dict[str, Any]:
    """The names a verse names."""
    v = one(conn, "select id from content.verses where key = :k", {"k": key})
    found = [r for r in _all(conn) if v and v["id"] in r["verses"]]
    return {"verse_key": key, "data": [_out(r) for r in found], "sources": _credit(conn)}
