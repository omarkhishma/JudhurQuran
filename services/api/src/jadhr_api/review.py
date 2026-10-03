"""The review deck's content (PLAN P5.3, inventory RDR §25, RDR-344…360).

What a reader reviews and when is theirs and stays in their browser (the scheduler is client-side, L6): the
API only answers what a root is — its family, and a verse that uses it with its family words to fill in. The
verse is one of the Quran's verses richest in the root, varied by ``pick`` so a root reviewed again comes
back in another verse; every root has one, so the in-context card never dead-ends (RDR-353).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Connection

from . import content, lexicon
from .db import one, rows

MAX_SLUGS = 5000
CONTEXT_CHOICES = 5
TRANSLATION = "saheeh"


def lemma_roots(conn: Connection, slugs: list[str]) -> list[dict[str, Any]]:
    """The root of each lemma the reader starred or knows; a lemma with no root (a particle) has none."""
    found = rows(
        conn,
        """select l.slug, r.key, r.spaced, r.translit from content.lemmas l
           left join content.roots r on r.id = l.root_id where l.slug = any(:s)""",
        {"s": list(dict.fromkeys(slugs))[:MAX_SLUGS]},
    )
    return [
        {
            "slug": x["slug"],
            "root": {"key": x["key"], "spaced": x["spaced"], "translit": x["translit"]} if x["key"] else None,
        }
        for x in found
    ]


def root_review(conn: Connection, raw: str, pick: int = 0) -> dict[str, Any] | None:
    r = content.resolve_root(conn, raw)
    if r is None:
        return None
    root = one(
        conn,
        """select r.id, r.key, r.spaced, r.translit, r.occurrences, r.lemma_count, r.gist_ar, r.gist_source
           from content.roots r where r.id = :id""",
        {"id": r["id"]},
    )
    assert root is not None
    family = rows(
        conn,
        f"""select {lexicon._LEMMA_COLS}, p.slug as pattern_slug, p.ar as pattern_ar, p.translit as pattern_translit,
                   (select w.gloss_en from content.words w where w.lemma_id = l.id order by w.id limit 1) as first_gloss
            from content.lemmas l left join content.patterns p on p.id = l.pattern_id
            where l.root_id = :r order by l.occurrences desc, l.id""",
        {"r": root["id"]},
    )
    members = []
    for x in family:
        lem = lexicon._lemma_out(x)
        lem["gloss_en"] = lem["gloss_en"] or x["first_gloss"]
        lem["pattern"] = (
            {"slug": x["pattern_slug"], "ar": lexicon.ar(x["pattern_ar"], x["pattern_translit"])}
            if x["pattern_slug"]
            else None
        )
        members.append(lem)
    # the verses richest in the root, one of the first few by ``pick``
    best = rows(
        conn,
        """select w.verse_id, count(*)::int as n from content.words w where w.root_id = :r
           group by w.verse_id order by count(*) desc, w.verse_id limit :k""",
        {"r": root["id"], "k": CONTEXT_CHOICES},
    )
    v_id = best[pick % len(best)]["verse_id"]
    v = one(
        conn,
        """select v.id, v.key, v.surah, v.ayah, s.name_ar, s.name_translit
           from content.verses v join content.surahs s on s.number = v.surah where v.id = :v""",
        {"v": v_id},
    )
    assert v is not None
    tokens = rows(
        conn, "select position, text from content.tokens where verse_id = :v order by position", {"v": v_id}
    )
    blanks = rows(
        conn,
        """select w.location, w.token_from, w.token_to, w.text_uthmani as surface, l.slug
           from content.words w left join content.lemmas l on l.id = w.lemma_id
           where w.verse_id = :v and w.root_id = :r order by w.position""",
        {"v": v_id, "r": root["id"]},
    )
    verse: dict[str, Any] = {"id": v_id}
    work = content.attach_translation(conn, [verse], TRANSLATION)
    gist = root["gist_source"]
    return {
        "root": {
            "key": root["key"],
            "spaced": root["spaced"],
            "translit": root["translit"],
            "occurrences": root["occurrences"],
            "lemma_count": root["lemma_count"],
            "gist_ar": root["gist_ar"],
            "gist_page": gist["page_ref"] if gist else None,
        },
        "family": members,
        "context": {
            "verse_key": v["key"],
            "surah": {"number": v["surah"], "name_ar": v["name_ar"], "name_translit": v["name_translit"]},
            "ayah": v["ayah"],
            # 1-based token positions, as everywhere in the API
            "tokens": [t["text"] for t in tokens],
            "blanks": blanks,
            "translation": verse.get("translation"),
            "translation_work": work,
            "choices": len(best),
        },
    }
