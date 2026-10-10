"""Knowledge layers (P3.9) and relation seeds (P3.1/P8.4) as the API serves them.

Every expectation is recomputed from the build's own JSONL files, never typed in."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jadhr_api.db import connect, rows
from jadhr_api.main import app

client = TestClient(app)
REPO = Path(__file__).resolve().parents[3]
BUILD = REPO / "data/build/2026.10.0"

if not (BUILD / "asbab.jsonl").exists():
    if os.environ.get("JADHR_REQUIRE_DATA"):
        raise RuntimeError(f"knowledge layers missing from {BUILD} (run `uv run jadhr-pipeline build`)")
    pytest.skip("no dataset build with knowledge layers", allow_module_level=True)


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def jsonl(name: str) -> list[dict]:
    with (BUILD / f"{name}.jsonl").open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


VERSE_ID = {v["key"]: v["id"] for v in jsonl("verses")}


def test_verse_knowledge_returns_every_occasion_and_citation_of_the_verse() -> None:
    asbab = jsonl("asbab")
    crossrefs = jsonl("verse_crossrefs")
    for key in ("2:6", "2:255", "33:37"):
        vid = VERSE_ID[key]
        d = get(f"/api/v1/verses/{key}/knowledge")
        want = sorted(
            a["id"] for a in asbab if a["verse_from"] is not None and a["verse_from"] <= vid <= a["verse_to"]
        )
        assert sorted(a["id"] for a in d["asbab"]) == want, key
        assert len(d["cites"]) == sum(1 for c in crossrefs if c["from_verse"] == vid), key
        for c in d["cites"]:
            assert c["to"]["id"] <= c["to_end"]["id"]
        for a in d["asbab"]:
            assert a["source_id"] in d["sources"], "every row names its source"
        assert d["status"] == "extracted"
    assert any(get("/api/v1/verses/2:6/knowledge")["asbab"]), "2:6 has a recorded occasion"


def test_verse_knowledge_never_serves_evaluation_only_sources() -> None:
    d = get("/api/v1/verses/2:255/knowledge")
    assert "qursim" not in d["sources"]
    assert all(s["use"] != "evaluation-only" for s in d["sources"].values())
    assert client.get("/api/v1/verses/2:999/knowledge").status_code == 404


def test_surah_card_is_the_built_card_verbatim() -> None:
    cards = {c["surah"]: c for c in jsonl("surah_cards")}
    for n in (1, 36, 114):
        d = get(f"/api/v1/surahs/{n}/card")
        assert d["card"]["names"] == cards[n]["names"]
        assert d["card"]["aims"] == cards[n]["aims"]
        # the card's own sources, and those of the verses said to have come down elsewhere listed with it (B6)
        with connect() as conn:
            noted = {
                r["source_id"]
                for r in rows(
                    conn,
                    "select source_id from content.verse_places where surah = :s and scope = 'verses'",
                    {"s": n},
                )
                if r["source_id"]
            }
        assert {x["source_id"] for x in d["places"]} == noted
        assert set(d["sources"]) == set(cards[n]["source_ids"]) | noted
    assert client.get("/api/v1/surahs/115/card").status_code == 404


def test_word_relations_hold_every_wujuh_chapter_and_furuq_row_of_the_root() -> None:
    lemmas = {x["id"]: x for x in jsonl("lemmas")}
    roots = {r["id"]: r["key"] for r in jsonl("roots")}
    lem = next(x for x in lemmas.values() if x.get("slug") == "ilm")
    root = roots[lem["root_id"]]
    entries = {
        e["id"]: e for e in jsonl("relation_entries") if e["root_key"] == root or e["lemma_key"] == lem["key"]
    }
    cands = jsonl("relation_candidates")
    senses_by_entry: dict[str, int] = {}
    for c in cands:
        if c["type"] == "wujuh_sense" and c["entry_id"] in entries:
            senses_by_entry[c["entry_id"]] = senses_by_entry.get(c["entry_id"], 0) + 1
    furuq = [
        c for c in cands if c["type"] == "furuq_contrast" and root in (c["root_key"], c["target_root_key"])
    ]

    d = get("/api/v1/words/ilm/relations")
    assert d["root"] == root
    assert {e["id"]: len(e["senses"]) for e in d["wujuh"]} == senses_by_entry
    assert len(d["furuq"]) == len(furuq)
    for e in d["wujuh"]:
        assert e["source_id"] in d["sources"]
        assert [s["sense_index"] for s in e["senses"]] == sorted(s["sense_index"] for s in e["senses"])


def test_word_relations_mark_the_senses_whose_verses_hold_this_occurrence() -> None:
    d = get("/api/v1/words/ilm/relations")
    sense = next(s for e in d["wujuh"] for s in e["senses"] if s["verses"])
    verse = sense["verses"][0]
    marked = get("/api/v1/words/ilm/relations", at=f"{verse}:1")
    here = [s for e in marked["wujuh"] for s in e["senses"] if s["cites_here"]]
    assert sense["id"] in {s["id"] for s in here}
    assert all(verse in s["verses"] for s in here)
    assert not any(s["cites_here"] for e in d["wujuh"] for s in e["senses"]), "nothing is marked without ?at="
    assert client.get("/api/v1/words/no-such-word/relations").status_code == 404


# ── the Tafsir Center's per-word layers (P13, D33) ────────────────────────────────────────────────
def _word_layers(verse_key: str, position: int) -> dict[str, list[str]]:
    by: dict[str, list[str]] = {}
    for r in jsonl("word_layers"):
        if r["verse_id"] == VERSE_ID[verse_key] and r["position"] == position:
            by.setdefault(r["kind"], []).append(r["text"])
    return by


def _slug_at(location: str) -> str:
    lemma_id = next(w["lemma_id"] for w in jsonl("words") if w["location"] == location)
    return next(lm["slug"] for lm in jsonl("lemmas") if lm["id"] == lemma_id)


def test_a_words_occurrence_carries_the_centers_layers_verbatim() -> None:
    # «كُرۡسِيُّهُ» in Ayat al-Kursi: the lemma by the API, the expected texts read from the build's own file
    slug = _slug_at("2:255:42")
    payload = get(f"/api/v1/words/{slug}", at="2:255:42")
    tc = payload["occurrence"]["tc"]
    want = _word_layers("2:255", payload["occurrence"]["token_from"])
    assert tc["meaning"] == want["meaning"] and tc["sarf"] == want["sarf"] and tc["irab"] == want["irab"]
    assert tc["source"]["id"] == "tafsircenter-quran-db" and "CC BY 4.0" in tc["source"]["attribution_en"]


def test_the_readers_difference_is_split_on_the_centers_own_marks() -> None:
    # «مَٰلِكِ» in 1:4: the Center lists who reads it with the alif and who without, and what the two mean
    slug = _slug_at("1:4:1")
    tc = get(f"/api/v1/words/{slug}", at="1:4:1")["occurrence"]["tc"]
    assert tc["qiraat_same"] is False
    alone = tc["qiraat"][0]["alone"]
    assert alone["same"] is False and len(alone["items"]) == 2
    raw = _word_layers("1:4", 1)["qiraat"][0]
    for item in alone["items"]:  # every piece is a slice of the Center's text
        assert item["readers"] in raw and item["reading"] in raw
    assert tc["qiraat"][0]["joined"]["same"] is True
    assert tc["qiraat_note"] == _word_layers("1:4", 1)["qiraat_note"]


def test_a_word_whose_readers_agree_says_so_without_a_row() -> None:
    slug = _slug_at("1:2:1")
    tc = get(f"/api/v1/words/{slug}", at="1:2:1")["occurrence"]["tc"]
    assert "qiraat" not in _word_layers("1:2", 1)
    assert tc["qiraat"] == [] and tc["qiraat_same"] is True


def test_a_verses_irab_is_the_centers_text() -> None:
    out = get("/api/v1/verses/112:1/irab")
    want = next(r["text"] for r in jsonl("verse_irab") if r["verse_id"] == VERSE_ID["112:1"])
    assert out["text"] == want and out["source"]["id"] == "tafsircenter-quran-db"
    assert client.get("/api/v1/verses/115:1/irab").status_code == 404


def test_a_word_without_a_lemma_carries_them_too() -> None:
    loc = next(w["location"] for w in jsonl("words") if w["lemma_id"] is None)
    out = get(f"/api/v1/words/{loc}")
    want = _word_layers(f"{out['surah']}:{out['ayah']}", out["token_from"])
    assert out["tc"]["meaning"] == want["meaning"]
