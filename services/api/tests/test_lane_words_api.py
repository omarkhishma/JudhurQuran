"""Lane's paragraph on each Quranic word (P3.1): the word's entry carries, in Lane's article of its root, the paragraph
that treats the word — the article's own paragraph, cut from it, with Lane's headword and the page it starts on —
and nothing for a word Lane's article does not key."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient
from jadhr_api.db import connect, rows
from jadhr_api.main import app

client = TestClient(app)


def lane_of(slug: str) -> list[dict]:
    w = client.get(f"/api/v1/words/{slug}", params={"limit": 0}).json()
    lane = next((d for d in w["dict_articles"] if d["id"] == "lane"), None)
    return [p | {"entry": e["id"]} for e in (lane or {"entries": []})["entries"] for p in e.get("word", [])]


def test_the_noun_and_the_verb_each_have_their_own_paragraph_of_the_article() -> None:
    noun, verb = lane_of("ilm"), lane_of("alima")
    assert len(noun) == 1 and len(verb) == 1
    assert noun[0]["para"] != verb[0]["para"] and noun[0]["entry"] == verb[0]["entry"]
    assert noun[0]["rule"] == "vocalised" and verb[0]["rule"] == "vocalised"
    # Lane's English, his headword keyed as he keys it
    assert "knowledge" in noun[0]["text"].lower()
    with connect() as conn:
        body = rows(conn, "select body from content.lexicon_entries where id = :i", {"i": noun[0]["entry"]})[
            0
        ]["body"]
    # the paragraph shown is the article's own paragraph, word for word
    assert body.split("\n\n")[noun[0]["para"]] == noun[0]["text"]


def test_every_row_points_at_a_paragraph_of_a_shown_lane_article_and_a_plural_lane_keys_singular_has_none() -> (
    None
):
    with connect() as conn:
        bad = rows(
            conn,
            """select lw.lemma_id from content.lane_words lw join content.lexicon_entries e on e.id = lw.entry_id
                where e.work_id <> 'lane' or not e.displayable
                   or lw.para >= array_length(string_to_array(e.body, E'\\n\\n'), 1)""",
        )
        n = rows(
            conn, "select count(*)::int as n, count(distinct lemma_id)::int as lemmas from content.lane_words"
        )[0]
    assert bad == []
    # what was loaded is what the build matched, as its report counts it
    report = json.loads(
        (Path(__file__).resolve().parents[3] / "data/build/2026.10.0/report.json").read_text(encoding="utf-8")
    )["lane_words"]
    assert n["n"] == report["rows"] and n["lemmas"] == report["lemmas_matched"] and n["lemmas"] > 0
    # «مَّعْلُومَٰت» is a plural Lane keys only in the singular: no paragraph is guessed for it
    assert lane_of("malumat") == []
