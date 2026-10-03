"""The word of the day (P5.1/P5.2, COL-09, COL-Q01): deterministic by date in Mecca's time zone, drawn from the
Quran's rooted content words, with its root's statement and its first verse credited."""

from __future__ import annotations

import math
from collections import Counter
from datetime import date, timedelta

from fastapi.testclient import TestClient
from jadhr_api import daily
from jadhr_api.db import connect, one
from jadhr_api.main import app
from jadhr_arabic import normalize

client = TestClient(app)


def get(day: str) -> dict:
    r = client.get("/api/v1/word-of-the-day", params={"date": day})
    assert r.status_code == 200, r.text[:300]
    return r.json()


def test_same_date_same_word_and_the_payload_holds_together() -> None:
    a, b = get("2026-10-03"), get("2026-10-03")
    assert a == b and a["date"] == "2026-10-03" and a["timezone"] == "Asia/Riyadh"
    lem, root, at = a["lemma"], a["root"], a["attestation"]
    assert lem["pos"]["tag"] in daily.POS and lem["occurrences"] >= daily.MIN_OCCURRENCES and root["key"]
    # the attestation is the lemma's first occurrence in mushaf order, and its tokens are the verse's
    with connect() as conn:
        first = one(
            conn,
            "select w.location, w.text_uthmani from content.words w join content.lemmas l on l.id = w.lemma_id"
            " where l.slug = :s order by w.id limit 1",
            {"s": lem["slug"]},
        )
    assert first is not None and at["location"] == first["location"]
    v = client.get(f"/api/v1/verses/{at['verse_key']}").json()
    assert at["tokens"] == [t["text"] for t in v["tokens"]]
    # token_from/token_to are 1-based positions, as everywhere in the API: they pick out the word itself
    # (the mushaf's token and the corpus spelling differ in their marks, not their letters)
    picked = " ".join(at["tokens"][at["token_from"] - 1 : at["token_to"]])
    assert normalize(picked) == normalize(first["text_uthmani"])
    assert at["translation"]["text"] and at["translation_work"]["id"] == daily.TRANSLATION
    if a["gist"]:
        assert a["gist"]["text_ar"] == root["gist_ar"] and a["gist"]["work"]["title_ar"]


def test_the_pool_and_the_weights_over_a_year() -> None:
    with connect() as conn:
        pool = daily.pool(conn)
    expect = len(pool)
    days = [date(2026, 1, 1) + timedelta(days=i) for i in range(365)]
    picks = Counter(daily.pick(d, [math.sqrt(p["occurrences"]) for p in pool]) for d in days)
    assert get("2026-01-01")["pool"] == expect > 500
    # a year of days lands on many words, and no word comes round more than a handful of times
    assert len(picks) > 300 and max(picks.values()) <= 5


def test_neighbouring_days_differ_and_bad_dates_are_refused() -> None:
    words = [get(f"2026-10-{d:02d}")["lemma"]["slug"] for d in range(1, 8)]
    assert len(set(words)) >= 6
    assert client.get("/api/v1/word-of-the-day", params={"date": "2026-13-01"}).status_code == 422
    assert client.get("/api/v1/word-of-the-day", params={"date": "1900-01-01"}).status_code == 422


def test_today_is_mecca_today_and_cached_only_until_its_midnight() -> None:
    r = client.get("/api/v1/word-of-the-day")
    assert r.status_code == 200 and r.json()["date"] == daily.today().isoformat()
    age = int(r.headers["cache-control"].split("max-age=")[1])
    assert 60 <= age <= 3600
