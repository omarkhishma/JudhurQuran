"""P3.6: the lexical profile is a fixed function of lemma frequency, and the build applies it exactly."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import pytest
from jadhr_pipeline.lexical_profile import band, level, surah_profile, verse_profiles

BUILD = Path(__file__).resolve().parents[2] / "data/build/2026.10.0"


def test_bands_and_levels_at_their_thresholds() -> None:
    assert [band(n) for n in (500, 100, 99, 20, 19, 5, 4, 2, 1)] == [
        "c100",
        "c100",
        "c20",
        "c20",
        "c5",
        "c5",
        "c2",
        "c2",
        "c1",
    ]
    assert [level(x) for x in (0.0, 0.01, 0.15, 0.151, 0.30, 0.31, 0.50, 0.51, 1.0)] == [
        1,
        2,
        2,
        3,
        3,
        4,
        4,
        5,
        5,
    ]


def test_a_verse_counts_its_words_by_band_and_takes_its_level_from_the_rare_share() -> None:
    # lemma 1 occurs 120 times, lemma 2 25 times, lemma 3 once; verse 7 holds 1, 2, 3 and a word without a lemma
    words = [{"verse_id": 1, "lemma_id": 1}] * 117 + [{"verse_id": 2, "lemma_id": 2}] * 24
    words += [
        {"verse_id": 7, "lemma_id": 1},
        {"verse_id": 7, "lemma_id": 2},
        {"verse_id": 7, "lemma_id": 3},
        {"verse_id": 7, "lemma_id": None},
    ]
    words += [{"verse_id": 1, "lemma_id": 1}] * 2
    p = verse_profiles(words)[7]
    assert p == {
        "words": 3,
        "c100": 1,
        "c20": 1,
        "c5": 0,
        "c2": 0,
        "c1": 1,
        "level": 4,
    }  # 1 of 3 rare: 33% → 4
    s = surah_profile([p, verse_profiles(words)[1]])
    assert s["words"] == 3 + 119 and s["verse_levels"] == {"1": 1, "2": 0, "3": 0, "4": 1, "5": 0}


@pytest.mark.skipif(not (BUILD / "verses.jsonl").exists(), reason="no built dataset")
def test_the_build_matches_a_recount_from_the_words() -> None:
    words = [json.loads(line) for line in (BUILD / "words.jsonl").read_text(encoding="utf-8").splitlines()]
    occ = Counter(w["lemma_id"] for w in words if w["lemma_id"])
    verses = {
        v["id"]: v for v in map(json.loads, (BUILD / "verses.jsonl").read_text(encoding="utf-8").splitlines())
    }
    per: dict[int, list[int]] = {}
    for w in words:
        if w["lemma_id"]:
            per.setdefault(w["verse_id"], []).append(occ[w["lemma_id"]])
    for vid, counts in per.items():
        rare = sum(1 for c in counts if c < 20) / len(counts)
        expect = 1 if rare == 0 else 2 if rare <= 0.15 else 3 if rare <= 0.30 else 4 if rare <= 0.50 else 5
        assert verses[vid]["lexical_level"] == expect, verses[vid]["key"]
        assert verses[vid]["lexical_profile"]["c1"] == sum(1 for c in counts if c == 1)
    assert {v["lexical_level"] for v in verses.values() if v["id"] in per} == {1, 2, 3, 4, 5}
    # no level where no word has a lemma: verses of the disjointed letters alone («الم»، «حم»، «طه»)
    bare = sorted(v["key"] for v in verses.values() if v["id"] not in per)
    assert all(verses[vid]["lexical_level"] is None for vid in verses if vid not in per)
    assert {"2:1", "20:1", "36:1", "40:1"} <= set(bare) and all(k.endswith(":1") or k == "42:2" for k in bare)
