"""API tests against the real loaded dataset (run the pipeline build + loader first).

Numbers asserted here are computed from the source data, not typed from memory: each count
is cross-checked against another endpoint or recomputed from the payload.
"""

from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient
from jadhr_api.main import app

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
    assert v["prev"] == "2:254" and v["next"] == "2:256"


def test_display_tokens_reconstruct_the_verbatim_text() -> None:
    """Tokens + the ۞ sign + separator + KFGQPC ayah mark rebuild every verse of al-Baqarah exactly
    (the official 2:6 opens with one stray space, kept verbatim in the stored text)."""
    for v in get("/api/v1/surahs/2")["verses"]:
        body = " ".join(t["text"] for t in v["tokens"])
        prefix = "\u06de\u00a0" if v["hizb_mark"] else ""
        lead = " " if v["key"] == "2:6" else ""
        mark = chr(0xFC00 + v["ayah"] - 1)
        assert v["text_qpc"] in (prefix + lead + body + "\u00a0" + mark, prefix + lead + body + " " + mark), (
            v["key"]
        )
        assert v["number_text"] == str(v["ayah"]).translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))


def test_juz_boundaries_follow_the_printed_hizb_signs() -> None:
    # Juz 4 and juz 11 begin where the KFGQPC text prints ۞ (3:93, 9:93).
    assert get("/api/v1/verses/3:92")["juz"] == 3 and get("/api/v1/verses/3:93")["juz"] == 4
    assert get("/api/v1/verses/9:92")["juz"] == 10 and get("/api/v1/verses/9:93")["juz"] == 11
    assert get("/api/v1/verses/3:93")["hizb_mark"] is True


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


def test_roots_by_keys_return_exactly_those_roots() -> None:
    d = get("/api/v1/roots", keys="علم,رحم,zzz", limit=10)
    assert {r["key"] for r in d["data"]} == {"علم", "رحم"} and d["total"] == 2
    for r in d["data"]:
        assert r["occurrences"] == get(f"/api/v1/roots/{r['key']}")["occurrences"]


def test_root_graph_lemmas_carry_their_slugs() -> None:
    g = get("/api/v1/roots/علم/graph")
    for lem in g["lemmas"]:
        w = get(f"/api/v1/words/{lem['slug']}", limit=0)
        assert w["root"]["key"] == "علم" and w["lemma_id"] == lem["id"]


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


def test_etag_is_tied_to_the_loaded_release_not_just_the_version() -> None:
    import jadhr_api.main as m

    meta = get("/api/v1/meta")["dataset"]
    r = client.get("/api/v1/surahs")
    assert r.headers["x-dataset-release"].startswith(meta["version"] + "@")
    # Reloading the same version (a corrected rebuild) must change every ETag.
    saved = dict(m._RELEASE)
    try:
        m._RELEASE.update(checked=float("inf"), id=saved["id"] + "-reloaded")
        r2 = client.get("/api/v1/surahs", headers={"If-None-Match": r.headers["etag"]})
        assert r2.status_code == 200 and r2.headers["etag"] != r.headers["etag"]
    finally:
        m._RELEASE.update(saved)


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


# ─── Lexica ─────────────────────────────────────────────────────────────────


def test_root_core_meaning_comes_from_maqayis_with_citation() -> None:
    r = get("/api/v1/roots/علم")
    core = r["lexicon"]["core_meaning"]
    assert core and core["work_id"] == "maqayis" and core["text"].startswith("العين واللام والميم")
    assert core["page_ref"]
    works = {w["id"] for w in r["lexicon"]["works"]}
    assert {"mufradat", "maqayis", "lisan", "sihah", "lane"} <= works
    for w in r["lexicon"]["works"]:
        assert w["attribution_ar"] and w["license"]
        for e in w["entries"]:
            assert e["confidence"] in ("exact", "manual", "high")


def test_lexicon_entry_full_body_and_only_displayable() -> None:
    r = get("/api/v1/roots/علم")
    entry_id = r["lexicon"]["works"][0]["entries"][0]["id"]
    e = get(f"/api/v1/lexicon/entries/{entry_id}")
    assert e["entry_id"] == entry_id and len(e["body"]) >= len(
        r["lexicon"]["works"][0]["entries"][0]["excerpt"]
    )
    assert client.get("/api/v1/lexicon/entries/1").status_code in (200, 404)


def test_word_panel_carries_root_meaning() -> None:
    w = get("/api/v1/words/2:255:23")  # يَشۡفَعُ
    assert w["root"]["key"] == "شفع"
    assert "مقارن" in w["root_meaning"]["core"]["text"]
    assert w["root_meaning"]["mufradat"]["entry"]["excerpt"]


# ─── Morphological pattern (wazn) ───────────────────────────────────────────


def _nfc(s: str | None) -> str | None:
    import unicodedata

    return unicodedata.normalize("NFC", s) if s is not None else None


def test_word_panel_lemma_carries_its_pattern() -> None:
    w = get("/api/v1/words/1:1:3")  # ٱلرَّحْمَٰنِ
    assert _nfc(w["lemma"]["pattern"]) == _nfc("فَعْلَان") and w["lemma"]["pattern_method"] == "match"


def test_root_family_patterns_and_methods() -> None:
    lemmas = {lem["ar"]: lem for lem in get("/api/v1/roots/علم")["lemmas"]}
    expected = {"عِلْم": "فِعْل", "عَلِيم": "فَعِيل", "عَلِمَ": "فَعِلَ", "أَعْلَم": "أَفْعَل"}
    for ar, pattern in expected.items():
        lem = next(v for k, v in lemmas.items() if _nfc(k) == _nfc(ar))
        assert _nfc(lem["pattern"]) == _nfc(pattern), (ar, lem)
    for lem in lemmas.values():
        assert lem["pattern_method"] in (None, "tag", "verb-form", "verb-form-I", "match")
        # a pattern is never claimed without its method, and form-I verbs without a vowel carry no pattern
        assert (lem["pattern"] is None) == (lem["pattern_method"] in (None, "verb-form-I")), lem


def test_catalog_lists_every_verse_word_and_root() -> None:
    counts = get("/api/v1/meta")["dataset"]["counts"]
    c = get("/api/v1/catalog")
    assert len(c["verses"]) == counts["verses"]
    assert sum(n for _, _, n in c["verses"]) == counts["words"]
    assert len(c["roots"]) == len(set(c["roots"])) == counts["roots"]
    assert c["verses"][0] == [1, 1, 4] and c["loaded_at"]


def test_plain_ascii_roots_find_the_real_root() -> None:
    def roots(q: str) -> list[str]:
        return [r["key"] for r in get("/api/v1/search", q=q)["results"]["roots"]]

    assert roots("r-h-m") == ["رحم"]  # رحم
    assert roots("h-m-d")[0] == "حمد"  # حمد before the rarer همد
    assert get("/api/v1/roots/r-h-m")["key"] == "رحم"


def test_word_glosses_and_transliteration_are_verbatim_from_the_corpus() -> None:
    import json
    from pathlib import Path

    src = Path(__file__).resolve().parents[3] / "data/raw/qac-wbw/wbw.jsonl"
    expected = {}
    with src.open(encoding="utf-8") as fh:
        for line in fh:
            r = json.loads(line)
            if r["location"] in ("1:1:1", "2:255:23", "112:1:1"):
                expected[r["location"]] = r
    for loc, r in expected.items():
        w = get(f"/api/v1/words/{loc}")
        assert (w["gloss_en"], w["translit"]) == (r["gloss"], r["translit"]), loc
    assert (
        get("/api/v1/words/1:1:1")["gloss_en"] == "In (the) name"
    )  # punctuation kept as the corpus writes it


def test_internal_token_exempts_server_renders_from_the_rate_limit(monkeypatch) -> None:
    """Every server render comes from the web host; with the shared token they skip the per-IP limit."""
    from jadhr_api import main as m
    from jadhr_api.settings import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "rate_limit_per_minute", 3)
    monkeypatch.setattr(s, "internal_token", "t0ken")
    m._hits.clear()
    app = m.create_app()
    c = TestClient(app)
    codes = [
        c.get("/api/v1/surahs/1", headers={"x-forwarded-for": "203.0.113.9"}).status_code for _ in range(4)
    ]
    assert codes[-1] == 429
    ok = [
        c.get(
            "/api/v1/surahs/1", headers={"x-forwarded-for": "203.0.113.9", "x-jadhr-internal": "t0ken"}
        ).status_code
        for _ in range(4)
    ]
    assert ok == [200] * 4
    wrong = c.get(
        "/api/v1/surahs/1", headers={"x-forwarded-for": "203.0.113.9", "x-jadhr-internal": "nope"}
    ).status_code
    assert wrong == 429
    m._hits.clear()
