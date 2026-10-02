"""API tests against the real loaded dataset (run the pipeline build + loader first).

Numbers asserted here are computed from the source data, not typed from memory: each count
is cross-checked against another endpoint or recomputed from the payload.
"""

from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient

from judhur_api.main import app

client = TestClient(app)


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def test_surahs_cover_the_whole_mushaf() -> None:
    data = get("/api/v1/surahs")["data"]
    assert len(data) == 114
    assert sum(s["verse_count"] for s in data) == 6236
    assert data[8]["has_basmala"] is False  # at-Tawba
    assert {s["revelation_place"] for s in data} == {"meccan", "medinan"}


def test_meta_lists_licensed_sources() -> None:
    d = get("/api/v1/meta")
    assert d["dataset"]["counts"]["verses"] == 6236
    assert d["dataset"]["counts"]["words"] == 77429
    for src in d["sources"]:
        assert src["license"] and src["attribution_ar"] and src["attribution_en"]


def test_verse_text_is_byte_identical_to_its_recorded_hash() -> None:
    v = get("/api/v1/verses/2:255")
    full = get("/api/v1/surahs/2", start=255, end=255)["verses"][0]
    assert v["text_qpc"] == full["text_qpc"]
    # tokens + separator + number reconstruct the verse exactly (lossless split)
    rebuilt = " ".join(t["text"] for t in v["tokens"])
    assert v["text_qpc"].startswith(rebuilt) and v["text_qpc"].endswith(v["number_text"])
    assert v["prev"] == "2:254" and v["next"] == "2:256"


def test_every_token_maps_to_words_and_back() -> None:
    s = get("/api/v1/surahs/2")
    assert len(s["verses"]) == 286
    for v in s["verses"]:
        positions = {w["position"] for w in v["words"]}
        for t in v["tokens"]:
            assert set(range(t["word_from"], t["word_to"] + 1)) <= positions
        for w in v["words"]:
            assert 1 <= w["token_from"] <= w["token_to"] <= len(v["tokens"])


def test_known_fusions_are_exposed_not_hidden() -> None:
    v = get("/api/v1/verses/15:7")  # لَّوۡمَا is one mushaf word, two corpus words
    first = v["tokens"][0]
    assert (first["word_from"], first["word_to"]) == (1, 2)
    v = get("/api/v1/verses/2:181")  # بَعۡدَ مَا are two mushaf words, one corpus word
    word3 = next(w for w in v["words"] if w["position"] == 3)
    assert (word3["token_from"], word3["token_to"]) == (3, 4)


def test_word_panel_payload() -> None:
    w = get("/api/v1/words/1:1:1")
    assert w["root"]["key"] == "سمو"
    assert w["lemma"]["ar"] == "ٱسْم"  # ٱسْم
    assert w["segments"][0]["kind"] == "prefix"
    assert w["verse"]["key"] == "1:1"
    lemma_total = sum(lem["occurrences"] for lem in w["root"]["lemmas"])
    assert lemma_total == w["root"]["occurrences"]


def test_particles_have_no_root() -> None:
    w = get("/api/v1/words/1:7:7")  # عَلَيۡهِمۡ — preposition + pronoun
    assert w["root"] is None and w["pos"] == "P"


def test_root_family_counts_are_consistent() -> None:
    r = get("/api/v1/roots/علم")
    assert r["spaced"] == "ع ل م"
    assert r["lemma_count"] == len(r["lemmas"])
    assert sum(lem["occurrences"] for lem in r["lemmas"]) == r["occurrences"]
    assert sum(f["occurrences"] for lem in r["lemmas"] for f in lem["forms"]) == r["occurrences"]
    assert sum(d["occurrences"] for d in r["distribution"]) == r["occurrences"]
    assert len(r["distribution"]) == r["surah_count"]


@pytest.mark.parametrize("spelling", ["علم", "ع ل م", "ʿ-l-m", "ع-ل-م", "عَلِمَ"])
def test_root_input_spellings_resolve(spelling: str) -> None:
    assert get(f"/api/v1/roots/{spelling}")["key"] == "علم"


def test_hamza_root_spellings_resolve() -> None:
    for spelling in ("أمن", "امن", "ء م ن", "'-m-n"):
        assert get(f"/api/v1/roots/{spelling}")["key"] == "أمن"


def test_concordance_pages_through_every_occurrence_once() -> None:
    root = get("/api/v1/roots/قرأ")
    seen: list[str] = []
    cursor = None
    while True:
        params: dict[str, object] = {"limit": 25}
        if cursor:
            params["cursor"] = cursor
        page = get("/api/v1/roots/قرأ/occurrences", **params)
        assert page["total"] == root["occurrences"]
        seen += [row["location"] for row in page["data"]]
        for row in page["data"]:
            assert row["keyword"]
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert len(seen) == len(set(seen)) == root["occurrences"]


def test_root_builder_filters_by_position() -> None:
    d = get("/api/v1/roots", l1="ك", l2="ت", limit=100)
    assert d["total"] >= 1 and all(r["letters"][:2] == ["ك", "ت"] for r in d["data"])


# ─── The Arabic search assertions (handoff §9.6, adapted) ───────────────────


def _word_forms(q: str) -> set[str]:
    return {w["form"] for w in get("/api/v1/search", q=q)["results"]["words"]}


def test_search_is_diacritic_insensitive() -> None:
    assert _word_forms("ٱلْكِتَٰبُ") == _word_forms("الكتاب") != set()


def test_search_folds_hamza_and_alef_variants() -> None:
    assert _word_forms("أمر") == _word_forms("امر") != set()
    assert _word_forms("الله") == _word_forms("ٱللَّه") != set()


def test_search_finds_uthmani_rasm_by_standard_spelling() -> None:
    # Uthmani ٱلصَّلَوٰةَ / ٱلْعَٰلَمِينَ are found by the everyday spellings
    assert "الصلاه" in _word_forms("الصلاة")
    assert "العالمين" in _word_forms("العالمين")


def test_search_root_letters_return_the_root() -> None:
    for q in ("ك ت ب", "k-t-b"):
        d = get("/api/v1/search", q=q)
        assert d["detected"]["kind"] == "root"
        assert d["results"]["roots"][0]["key"] == "كتب"


def test_search_verse_references() -> None:
    for q in ("2:255", "٢:٢٥٥", "البقرة 255"):
        d = get("/api/v1/search", q=q)
        assert d["detected"]["kind"] == "verse_ref", q
        assert d["results"]["verses"][0]["key"] == "2:255"


def test_search_surah_name_also_searches_the_word() -> None:
    d = get("/api/v1/search", q="النور")
    assert d["results"]["surahs"][0]["number"] == 24
    assert d["results"]["words"], "النور is also a Quranic word"


def test_search_phrase_finds_verses() -> None:
    d = get("/api/v1/search", q="الله لا إله إلا هو الحي القيوم")
    assert {"2:255", "3:2"} <= {v["key"] for v in d["results"]["verses"]}


# ─── HTTP behaviour ─────────────────────────────────────────────────────────


def test_etag_round_trip_returns_304() -> None:
    r = client.get("/api/v1/surahs")
    etag = r.headers["etag"]
    assert "max-age" in r.headers["cache-control"]
    r2 = client.get("/api/v1/surahs", headers={"If-None-Match": etag})
    assert r2.status_code == 304


def test_errors_use_the_envelope() -> None:
    r = client.get("/api/v1/words/999:1:1")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"
    r = client.get("/api/v1/verses/abc")
    assert r.status_code == 400 and r.json()["error"]["code"] == "bad_request"


def test_text_hash_matches_dataset_record() -> None:
    meta = get("/api/v1/meta")["dataset"]
    texts = []
    for n in range(1, 115):
        texts += [v["text_qpc"] for v in get(f"/api/v1/surahs/{n}")["verses"]]
    assert len(texts) == 6236
    assert hashlib.sha256("\n".join(texts).encode()).hexdigest() == meta["text_sha256"]
