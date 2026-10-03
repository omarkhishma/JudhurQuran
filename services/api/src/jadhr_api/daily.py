"""The word of the day (PLAN P5.1/P5.2, COL-09, COL-Q01, HUB-Q02): one Quranic word per date, the same for
everyone, chosen deterministically so it can be cached and shared.

The day is the date in one declared time zone, Mecca's (Asia/Riyadh, UTC+3), for both the choice and the
label (COL-10: the prototype chose by UTC and labelled by local date). The pool is the Quran's content words
(nouns, verbs and adjectives with a root, at least five occurrences), weighted by the square root of their
frequency, so common words come round more often without crowding out the rest. The word comes with its root's
statement (Ibn Fāris, P3.4) credited to its work and page, and the first verse that uses it, in the mushaf's
text, with a credited translation.
"""

from __future__ import annotations

import hashlib
import math
from bisect import bisect_right
from datetime import date, datetime
from itertools import accumulate
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import Connection

from . import content, lexicon
from .db import one, rows

TZ = ZoneInfo("Asia/Riyadh")
POS = ["N", "V", "ADJ"]
MIN_OCCURRENCES = 5
TRANSLATION = "saheeh"


def today() -> date:
    return datetime.now(TZ).date()


def pick(day: date, weights: list[float]) -> int:
    """A fixed point in [0, 1) from the date, mapped onto the cumulative weights."""
    h = int(hashlib.sha256(f"jadhr-word-of-the-day:{day.isoformat()}".encode()).hexdigest()[:13], 16) / 16**13
    cum = list(accumulate(weights))
    return min(bisect_right(cum, h * cum[-1]), len(weights) - 1)


def pool(conn: Connection) -> list[dict[str, Any]]:
    return rows(
        conn,
        """select id, occurrences from content.lemmas
           where root_id is not null and pos = any(:p) and occurrences >= :m order by id""",
        {"p": POS, "m": MIN_OCCURRENCES},
    )


def word_of_the_day(conn: Connection, day: date) -> dict[str, Any]:
    candidates = pool(conn)
    chosen = candidates[pick(day, [math.sqrt(p["occurrences"]) for p in candidates])]
    lem = one(
        conn, f"select {lexicon._LEMMA_COLS} from content.lemmas l where l.id = :id", {"id": chosen["id"]}
    )
    assert lem is not None
    root = one(conn, "select * from content.roots where id = :id", {"id": lem["root_id"]})
    assert root is not None
    pattern = (
        one(conn, "select * from content.patterns where id = :id", {"id": lem["pattern_id"]})
        if lem["pattern_id"]
        else None
    )
    first = one(
        conn,
        """select w.location, w.verse_id, w.token_from, w.token_to, w.gloss_en, v.key, v.surah, v.ayah,
                  s.name_ar, s.name_translit
           from content.words w join content.verses v on v.id = w.verse_id join content.surahs s on s.number = v.surah
           where w.lemma_id = :l order by w.id limit 1""",
        {"l": lem["id"]},
    )
    assert first is not None
    verse: dict[str, Any] = {"id": first["verse_id"]}
    work = content.attach_translation(conn, [verse], TRANSLATION)
    tokens = rows(
        conn,
        "select text from content.tokens where verse_id = :v order by position",
        {"v": first["verse_id"]},
    )
    gist = root["gist_source"]
    gist_work = (
        one(
            conn,
            """select id, title_ar, title_en, author_ar, author_en, death_hijri, death_ce
               from content.lexicon_works where id = :w""",
            {"w": gist["work_id"]},
        )
        if root["gist_ar"] and gist
        else None
    )
    lemma = lexicon._lemma_out(lem)
    lemma["gloss_en"] = lemma["gloss_en"] or first["gloss_en"]
    return {
        "date": day.isoformat(),
        "timezone": "Asia/Riyadh",
        "lemma": lemma,
        "pattern": lexicon._pattern_out(pattern),
        "root": lexicon._root_out(root),
        "gist": {"text_ar": root["gist_ar"], "page_ref": gist["page_ref"], "work": gist_work}
        if gist_work
        else None,
        "attestation": {
            "location": first["location"],
            "verse_key": first["key"],
            "surah": {
                "number": first["surah"],
                "name_ar": first["name_ar"],
                "name_translit": first["name_translit"],
            },
            "ayah": first["ayah"],
            # the verse's tokens in order; token_from/token_to are 1-based positions, as everywhere in the API
            "tokens": [t["text"] for t in tokens],
            "token_from": first["token_from"],
            "token_to": first["token_to"],
            "translation": verse.get("translation"),
            "translation_work": work,
        },
        "pool": len(candidates),
    }
