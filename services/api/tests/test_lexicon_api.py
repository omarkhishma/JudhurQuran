"""The lexeme-centred API (PLAN P1.3): envelope, word payload, patterns, glossary, texts.

Expected numbers are recomputed from other endpoints or the source files, never typed in."""

from __future__ import annotations

import json
from pathlib import Path

import yaml
from fastapi.testclient import TestClient
from jadhr_api.main import app
from jadhr_arabic import display_bare

client = TestClient(app)
REPO = Path(__file__).resolve().parents[3]


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def envelopes(obj: object) -> list[dict]:
    """Every {full, bare, translit} envelope anywhere in a payload."""
    found: list[dict] = []
    if isinstance(obj, dict):
        if set(obj) == {"full", "bare", "translit"}:
            found.append(obj)
        for v in obj.values():
            found += envelopes(v)
    elif isinstance(obj, list):
        for v in obj:
            found += envelopes(v)
    return found


def test_every_arabic_string_in_the_word_payload_is_an_envelope() -> None:
    d = get("/api/v1/words/ilm", at="2:32:4")
    envs = envelopes(d)
    assert len(envs) > 20
    for e in envs:
        assert e["bare"] == display_bare(e["full"])
        assert e["translit"]


def test_word_payload_ties_out_with_the_root_and_the_occurrence() -> None:
    d = get("/api/v1/words/ilm", at="2:32:4")
    assert d["ar"]["full"] == "عِلْم"  # عِلْم
    assert d["root"]["key"] == "علم"
    root = get("/api/v1/roots/علم")
    assert d["root"]["occurrences"] == root["occurrences"]
    assert sum(len(g["members"]) for g in d["family"]) == root["lemma_count"]
    # every family member's occurrences add up to the root's
    assert sum(m["occurrences"] for g in d["family"] for m in g["members"]) == root["occurrences"]
    assert d["occurrence"]["location"] == "2:32:4"
    assert d["attestations"]["total"] == d["corpus_freq"]
    assert d["attestations"]["meccan"] + d["attestations"]["medinan"] == d["corpus_freq"]
    assert sum(c["occurrences"] for c in d["attestations"]["by_chapter"]) == d["corpus_freq"]
    assert [s["kind"] for s in d["next_steps"]] == ["cousin", "verse", "pattern"]
    assert d["senses_status"] in ("pending", "linked")


def test_next_steps_are_deterministic() -> None:
    a = get("/api/v1/words/ilm")["next_steps"]
    b = get("/api/v1/words/ilm")["next_steps"]
    assert a == b


def test_occurrence_must_belong_to_the_word() -> None:
    # 1:1:1 is بِسْمِ, not عِلْم: the payload comes back without an occurrence
    d = get("/api/v1/words/ilm", at="1:1:1")
    assert d["occurrence"] is None
    assert client.get("/api/v1/words/ilm", params={"at": "nonsense"}).status_code == 400


def test_location_resolves_to_its_lemma_slug() -> None:
    assert get("/api/v1/locations/2:32:4/word")["slug"] == "ilm"
    assert get("/api/v1/locations/1:1:2/word")["slug"] == "allah"


def test_attestations_page_through_every_occurrence() -> None:
    total = get("/api/v1/words/ilm")["corpus_freq"]
    seen, cursor = 0, None
    while True:
        page = get("/api/v1/words/ilm/attestations", limit=40, **({"cursor": cursor} if cursor else {}))
        seen += len(page["data"])
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert seen == total


def test_pattern_lists_its_lemmas() -> None:
    p = get("/api/v1/patterns/faa3il")
    assert p["ar"]["full"] == "فَاعِل"  # فَاعِل
    assert len(p["members"]) == min(p["lemma_count"], 200)
    all_patterns = get("/api/v1/patterns")["data"]
    assert len({x["slug"] for x in all_patterns}) == len(all_patterns)
    # every lemma with a pattern is counted exactly once across the catalogue (recomputed from the build)
    version = get("/api/v1/meta")["dataset"]["version"]
    lemmas = [json.loads(x) for x in (REPO / "data/build" / version / "lemmas.jsonl").open(encoding="utf-8")]
    assert sum(x["lemma_count"] for x in all_patterns) == sum(1 for x in lemmas if x["pattern"])
    assert len(all_patterns) == len({x["pattern"] for x in lemmas if x["pattern"]})


def test_glossary_serves_every_term_in_the_data_file() -> None:
    expected = yaml.safe_load((REPO / "data/glossary.yaml").read_text(encoding="utf-8"))["terms"]
    terms = get("/api/v1/glossary")["terms"]
    assert [t["key"] for t in terms] == [t["key"] for t in expected]
    assert all(t["label_ar"] and t["label_en"] and t["body_ar"] and t["body_en"] for t in terms)


def test_quran_is_a_text_with_114_chapters() -> None:
    shelf = get("/api/v1/texts")["data"]
    quran = next(t for t in shelf if t["slug"] == "quran")
    surahs = get("/api/v1/surahs")["data"]
    assert quran["passage_count"] == sum(s["verse_count"] for s in surahs)
    detail = get("/api/v1/texts/quran")
    assert [c["ordinal"] for c in detail["chapters"]] == list(range(1, 115))
    assert [c["passage_count"] for c in detail["chapters"]] == [s["verse_count"] for s in surahs]


def test_dictionaries_carry_licences() -> None:
    for d in get("/api/v1/dictionaries")["data"]:
        assert d["license"] and d["attribution_ar"] and d["attribution_en"]
