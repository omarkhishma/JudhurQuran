"""Hear the root (PLAN §8 B4, placed in P5): every occurrence of a root, or of one word, as its slice of the word
recitation (D10, the same slices the reader plays one by one), in the order of the mushaf. A family heard across
the Quran is a memory aid; each slice keeps the flags that say what keeps it from being clean. Computed in one
pass — the verses' timings and tokens are read together, not once per occurrence.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Connection

from . import content
from .db import one, rows

MAX_ITEMS = 2500


def playlist(conn: Connection, root: str | None = None, lemma: str | None = None) -> dict[str, Any] | None:
    if root is not None:
        r = content.resolve_root(conn, root)
        if r is None:
            return None
        subject = one(
            conn,
            "select key, spaced, translit, occurrences from content.roots where id = :id",
            {"id": r["id"]},
        )
        where, key = "w.root_id = :id", r["id"]
    else:
        lem = one(
            conn,
            "select id, slug, ar, translit, occurrences from content.lemmas where slug = :s",
            {"s": lemma},
        )
        if lem is None:
            return None
        subject, where, key = lem, "w.lemma_id = :id", lem["id"]
    assert subject is not None
    found = rows(
        conn,
        f"""select w.location, w.token_from, w.token_to, w.text_uthmani as surface, w.verse_id, v.key as verse_key,
                   v.surah, v.ayah, s.name_ar, s.name_translit, l.slug, l.ar as lemma_ar
            from content.words w join content.verses v on v.id = w.verse_id
            join content.surahs s on s.number = v.surah
            left join content.lemmas l on l.id = w.lemma_id
            where {where} order by w.id limit :n""",
        {"id": key, "n": MAX_ITEMS},
    )
    verse_ids = list({x["verse_id"] for x in found})
    timings = {
        t["verse_id"]: t
        for t in rows(
            conn,
            """select t.verse_id, v.surah, v.ayah, r.id as reciter_id, r.name_ar, r.name_en, r.audio_url, t.segments,
                      t.quality
               from content.recitation_timings t join content.reciters r on r.id = t.reciter_id and r.word_audio
               join content.verses v on v.id = t.verse_id
               where t.verse_id = any(:ids)""",
            {"ids": verse_ids},
        )
    }
    tokens: dict[int, dict[int, str]] = {}
    for t in rows(
        conn,
        "select verse_id, position, text from content.tokens where verse_id = any(:ids)",
        {"ids": verse_ids},
    ):
        tokens.setdefault(t["verse_id"], {})[t["position"]] = t["text"]
    items, untimed = [], 0
    for x in found:
        v = timings.get(x["verse_id"])
        audio = (
            content.audio_slice(v, tokens.get(x["verse_id"], {}), x["token_from"], x["token_to"])
            if v
            else None
        )
        if audio is None:
            untimed += 1
            continue
        items.append(
            {
                "location": x["location"],
                "verse_key": x["verse_key"],
                "surah": {"number": x["surah"], "name_ar": x["name_ar"], "name_translit": x["name_translit"]},
                "ayah": x["ayah"],
                "surface": x["surface"],
                "lemma": {"slug": x["slug"], "ar": content.lemma_display(x["lemma_ar"])}
                if x["slug"]
                else None,
                "audio": audio,
            }
        )
    first = items[0]["audio"] if items else None
    return {
        "subject": {"kind": "root" if root is not None else "lemma", **subject},
        "reciter": {"id": first["reciter_id"], "name_ar": first["name_ar"], "name_en": first["name_en"]}
        if first
        else None,
        "items": items,
        "untimed": untimed,
        "total": len(found),
    }
