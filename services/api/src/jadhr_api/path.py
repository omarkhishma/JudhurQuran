"""A path through the Quran's words by frequency (PLAN §8 B5, placed in P5): the roots in lessons of ten, ordered
by how many of the Quran's words each one's family makes up, so each lesson says how much more of the text the
reader can recognise. Computed from the data, never chosen; its words are each root's most frequent ones, studied
with the same deck as the sets, and kept words go to the review. The order is arithmetic, not a curriculum: a
teacher's review of it is invited (DECISIONS).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Connection

from . import lexicon
from .collections import item_out
from .db import rows, scalar

LESSON = 10  # roots per lesson
PER_ROOT = 2  # each root's most frequent words, studied in its lesson


def _roots(conn: Connection) -> list[dict[str, Any]]:
    return rows(
        conn,
        "select id, key, spaced, translit, occurrences from content.roots order by occurrences desc, id",
    )


def lessons(conn: Connection) -> dict[str, Any]:
    total = int(scalar(conn, "select count(*) from content.words") or 1)
    roots = _roots(conn)
    out, cum = [], 0
    for i in range(0, len(roots), LESSON):
        chunk = roots[i : i + LESSON]
        occ = sum(r["occurrences"] for r in chunk)
        cum += occ
        out.append(
            {
                "n": i // LESSON + 1,
                "roots": [{k: r[k] for k in ("key", "spaced", "translit", "occurrences")} for r in chunk],
                "occurrences": occ,
                "coverage": round(occ / total, 4),
                "cumulative": round(cum / total, 4),
            }
        )
    return {"lesson_size": LESSON, "total_words": total, "rooted_words": cum, "lessons": out}


def lesson(conn: Connection, n: int) -> dict[str, Any] | None:
    roots = _roots(conn)
    chunk = roots[(n - 1) * LESSON : n * LESSON]
    if n < 1 or not chunk:
        return None
    total = int(scalar(conn, "select count(*) from content.words") or 1)
    before = sum(r["occurrences"] for r in roots[: (n - 1) * LESSON])
    rank = {r["id"]: i for i, r in enumerate(chunk)}
    found = rows(
        conn,
        f"""select * from (
                select {lexicon._LEMMA_COLS},
                       r.key as root_key, r.spaced as root_spaced, r.translit as root_translit,
                       p.slug as pattern_slug, p.ar as pattern_ar, p.translit as pattern_translit,
                       fw.location as first_location, fw.gloss_en as first_gloss, fv.key as first_verse,
                       row_number() over (partition by l.root_id order by l.occurrences desc, l.id) as k
                from content.lemmas l join content.roots r on r.id = l.root_id
                left join content.patterns p on p.id = l.pattern_id
                left join lateral (select w.location, w.gloss_en, w.verse_id from content.words w
                                   where w.lemma_id = l.id order by w.id limit 1) fw on true
                left join content.verses fv on fv.id = fw.verse_id
                where l.root_id = any(:ids)
            ) x where k <= :per""",
        {"ids": list(rank), "per": PER_ROOT},
    )
    found.sort(key=lambda x: (rank[x["root_id"]], x["k"]))
    items = [item_out({**x, "ordinal": i + 1}) for i, x in enumerate(found)]
    occ = sum(r["occurrences"] for r in chunk)
    return {
        "n": n,
        "of": -(-len(roots) // LESSON),
        "items": items,
        "roots": [{"key": r["key"], "spaced": r["spaced"], "translit": r["translit"]} for r in chunk],
        "occurrences": occ,
        "coverage": round(occ / total, 4),
        "cumulative": round((before + occ) / total, 4),
    }
