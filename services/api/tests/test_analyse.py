"""The Analyser (PLAN P4.3, ANA): gold corpus analysis for Quranic text, ranked candidates otherwise."""

from __future__ import annotations

from fastapi.testclient import TestClient

from jadhr_api.main import app

client = TestClient(app)


def analyse(q: str) -> dict:
    r = client.get("/api/v1/analyse", params={"q": q})
    assert r.status_code == 200, r.text[:300]
    return r.json()


def test_a_verse_reference_is_read_from_the_corpus_at_confidence_one() -> None:
    a = analyse("2:255")
    assert a["source"] == {"kind": "quran", "verse_key": "2:255", "whole_verse": True}
    assert all(t["confidence"] == 1.0 and t["kind"] in ("gold", "particle") for t in a["tokens"])
    allah = a["tokens"][0]
    assert allah["kind"] == "gold" and allah["candidates"][0]["root"]["key"] == "أله"
    assert allah["location"] == "2:255:1"


def test_a_phrase_found_in_one_verse_is_analysed_at_its_place() -> None:
    a = analyse("ذلك الكتاب لا ريب فيه")
    assert a["source"]["verse_key"] == "2:2" and a["source"]["whole_verse"] is False
    kitab = a["tokens"][1]
    assert kitab["kind"] == "gold" and kitab["candidates"][0]["lemma"]["slug"] == "kitab"
    assert [t["kind"] for t in a["tokens"]].count("particle") == 3  # ذلك، لا، فيه


def test_free_text_is_read_against_the_qurans_words_with_how_sure_each_reading_is() -> None:
    a = analyse("إن العلم لا يدرك إلا بالتعلم")
    assert a["source"]["kind"] == "free"
    by = {t["surface"]: t for t in a["tokens"]}
    assert by["إن"]["kind"] == "particle" and by["إن"]["candidates"] == []
    assert by["العلم"]["kind"] == "form" and by["العلم"]["candidates"][0]["root"]["key"] == "علم"
    assert by["يدرك"]["candidates"][0]["root"]["key"] == "درك"  # not د ر س (the prototype's ANA-24)
    t = by["بالتعلم"]
    assert t["kind"] == "clitic" and t["clitics"] == ["بال"] and t["confidence"] < 0.8
    assert a["counts"] == {"tokens": 6, "roots": 2, "to_review": 1}


def test_a_word_no_quranic_word_spells_gets_root_candidates_from_the_patterns() -> None:
    t = analyse("مستكتبون")["tokens"][0]
    assert t["kind"] == "pattern" and t["confidence"] <= 0.35
    assert t["candidates"][0]["root"]["key"] == "كتب" and t["candidates"][0]["pattern"]["ar"]


def test_candidates_are_ranked_deduped_by_root_and_at_most_three() -> None:
    for t in analyse("قال الذين كفروا")["tokens"]:
        roots = [c["root"]["key"] for c in t["candidates"] if c["root"]]
        assert len(roots) == len(set(roots)) and len(t["candidates"]) <= 3
        assert [c["confidence"] for c in t["candidates"]] == sorted(
            (c["confidence"] for c in t["candidates"]), reverse=True
        )


def test_a_range_is_read_verse_by_verse_up_to_ten_verses() -> None:
    a = analyse("1:1-7")
    assert a["source"] == {"kind": "quran", "verse_key": "1:1-7", "whole_verse": True}
    assert sorted({t["verse_key"] for t in a["tokens"]}) == [f"1:{i}" for i in range(1, 8)]
    long = analyse("2:1-20")
    assert long["truncated"] is True and len({t["verse_key"] for t in long["tokens"]}) == 10
