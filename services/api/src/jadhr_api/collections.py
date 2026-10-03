"""Curated sets of Quranic words and the reader's progress over them (PLAN P5.2, inventory COL).

The sets come from the build (pipeline ``collections.py``): editorial copy, items computed by rule. Progress
is counted from the reader's own word states, which stay in their browser: the client sends the slugs in a
POST body (never a URL, a log line or a cache) and gets back how much of the Quran those words cover.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Connection

from . import content, lexicon
from .db import one, rows, scalar

MAX_SLUGS = 5000


def collections_list(conn: Connection) -> list[dict[str, Any]]:
    sets = rows(
        conn,
        """select id, ordinal, colour, title_ar, title_en, intro_ar, intro_en, item_count, root_count, occurrences,
                  coverage::float as coverage
           from content.collections order by ordinal""",
    )
    items = rows(
        conn,
        """select ci.collection_id, l.slug, l.ar from content.collection_items ci
           join content.lemmas l on l.id = ci.lemma_id order by ci.collection_id, ci.ordinal""",
    )
    by: dict[str, list[dict[str, Any]]] = {}
    for it in items:
        by.setdefault(it["collection_id"], []).append(it)
    for s in sets:
        members = by.get(s["id"], [])
        # every slug, so the reader's card can say how many of the set they have met (COL-16)
        s["slugs"] = [m["slug"] for m in members]
        s["sample"] = [content.lemma_display(m["ar"]) for m in members[:3]]
    return sets


def collection(conn: Connection, set_id: str) -> dict[str, Any] | None:
    s = one(
        conn,
        """select id, ordinal, colour, title_ar, title_en, intro_ar, intro_en, why_ar, why_en, item_count, root_count,
                  occurrences, coverage::float as coverage, quote, source
           from content.collections where id = :id""",
        {"id": set_id},
    )
    if s is None:
        return None
    items = rows(
        conn,
        f"""select ci.ordinal, ci.first_location, {lexicon._LEMMA_COLS},
                   r.key as root_key, r.spaced as root_spaced, r.translit as root_translit,
                   p.slug as pattern_slug, p.ar as pattern_ar, p.translit as pattern_translit,
                   w.gloss_en as first_gloss, v.key as first_verse
            from content.collection_items ci join content.lemmas l on l.id = ci.lemma_id
            left join content.roots r on r.id = l.root_id
            left join content.patterns p on p.id = l.pattern_id
            left join content.words w on w.location = ci.first_location
            left join content.verses v on v.id = w.verse_id
            where ci.collection_id = :id order by ci.ordinal""",
        {"id": set_id},
    )
    out = [item_out(x) for x in items]
    roots: dict[str, dict[str, Any]] = {}
    for it in out:
        if it["root"] and it["root"]["key"] not in roots:
            roots[it["root"]["key"]] = it["root"]
    return {**s, "items": out, "roots": list(roots.values())}


def item_out(x: dict[str, Any]) -> dict[str, Any]:
    """One word of a set as the screens show it: the lemma, its root and pattern, its first place."""
    lem = lexicon._lemma_out(x)
    # the corpus's word-by-word gloss at the first place, where the lemma has none of its own
    lem["gloss_en"] = lem["gloss_en"] or x["first_gloss"]
    return {
        "ordinal": x["ordinal"],
        **lem,
        "derivation": x["derivation"],
        "root": {"key": x["root_key"], "spaced": x["root_spaced"], "translit": x["root_translit"]}
        if x["root_key"]
        else None,
        "pattern": {"slug": x["pattern_slug"], "ar": lexicon.ar(x["pattern_ar"], x["pattern_translit"])}
        if x["pattern_slug"]
        else None,
        "first": {"location": x["first_location"], "verse_key": x["first_verse"]}
        if x["first_location"]
        else None,
    }


def coverage(conn: Connection, slugs: list[str]) -> dict[str, Any]:
    """How much of the Quran the reader's words cover (COL-Q04): distinct lemmas found, the roots they touch,
    their occurrences and that share of all the Quran's words. No streak, no time — words met, and how far
    they reach."""
    slugs = list(dict.fromkeys(slugs))[:MAX_SLUGS]
    found = one(
        conn,
        """select count(*)::int as lemmas, count(distinct root_id)::int as roots,
                  coalesce(sum(occurrences), 0)::int as occurrences
           from content.lemmas where slug = any(:s)""",
        {"s": slugs},
    )
    assert found is not None
    total = int(scalar(conn, "select count(*) from content.words") or 1)
    return {**found, "total_words": total, "coverage": round(found["occurrences"] / total, 4)}
