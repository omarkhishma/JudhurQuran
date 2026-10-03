"""The search assertions (design 09 §9.6, adapted to the Quran) on the OpenSearch engine.

The five design assertions catch nearly every analyser regression:
a vocalised query finds the unvocalised word; a Latin query without diacritics finds the transliterated
form; hamza variants match; a tashkīl-marked query ranks its exact form first; a root query returns the
whole family. Plus Quran ones: mushaf (Uthmani) text pasted as a query, a verse phrase, English meaning.
Requires a reachable OpenSearch with a built index (skips otherwise, fails with JADHR_REQUIRE_DATA=1)."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from jadhr_api import searchindex
from jadhr_api.main import app

client = TestClient(app)

if not searchindex.available(searchindex.client()):
    if os.environ.get("JADHR_REQUIRE_DATA") == "1":
        raise RuntimeError("JADHR_REQUIRE_DATA=1 but OpenSearch is not reachable")
    pytest.skip("OpenSearch not reachable", allow_module_level=True)


def search(q: str, limit: int = 10) -> dict:
    r = client.get("/api/v1/search", params={"q": q, "limit": limit})
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d["engine"] == "opensearch"
    return d


def slugs(d: dict) -> list[str]:
    return [x["slug"] for x in d["results"]["lemmas"]]


def test_vocalised_query_finds_the_unvocalised_word() -> None:
    assert slugs(search("كِتَاب"))[0] == "kitab"  # كِتَاب
    assert slugs(search("كتاب"))[0] == "kitab"


def test_latin_without_diacritics_finds_the_transliteration() -> None:
    assert slugs(search("kitab"))[0] == "kitab"
    assert "ilm" in slugs(search("ilm"))[:3]


def test_hamza_variants_match() -> None:
    plain = slugs(search("امر"))
    hamza = slugs(search("أمر"))
    assert "amr" in plain[:2] and "amr" in hamza[:2]


def test_tashkil_marked_query_ranks_its_exact_form_first() -> None:
    assert slugs(search("عَلِمَ"))[0] == "alima"  # عَلِمَ the verb
    assert slugs(search("عِلْم"))[0] == "ilm"  # عِلْم the noun


def test_root_query_returns_the_whole_family() -> None:
    d = search("ع ل م", limit=50)
    assert d["detected"]["kind"] == "root"
    root = client.get("/api/v1/roots/علم").json()
    assert sorted(slugs(d)) == sorted(lem_slug for lem_slug in _family_slugs())
    assert len(slugs(d)) == root["lemma_count"]


def _family_slugs() -> list[str]:
    d = client.get("/api/v1/words/ilm").json()
    return [m["slug"] for g in d["family"] for m in g["members"]]


def test_mushaf_text_pasted_as_a_query() -> None:
    d = search("ٱلرَّحْمَٰنِ")  # ٱلرَّحْمَٰنِ
    assert "rahman" in slugs(d)[:2]


def test_a_verse_phrase_finds_its_verse_first() -> None:
    d = search("الحمد لله رب العالمين")
    assert d["results"]["verses"][0]["key"] == "1:2"


def test_english_meaning_finds_the_word() -> None:
    assert "ilm" in slugs(search("knowledge"))[:2]
    assert "rahma" in slugs(search("mercy"))[:3]


def test_patterns_are_searchable() -> None:
    d = search("فَاعِل")  # فَاعِل
    assert d["results"]["patterns"][0]["slug"] == "faa3il"


def test_index_counts_match_postgres() -> None:
    st = searchindex.status()
    meta = client.get("/api/v1/meta").json()["dataset"]["counts"]
    assert st["indices"]["words"]["documents"] == meta["lemmas"]
    assert st["indices"]["roots"]["documents"] == meta["roots"]
    assert st["indices"]["passages"]["documents"] == meta["verses"]
    assert st["indices"]["occurrences"]["documents"] == meta["words"]


def test_chat_alphabet_finds_the_word() -> None:
    """Arabic typed with digits and doubled vowels, as in chat (RDR-602)."""
    from jadhr_api.search import chat_alphabet

    assert chat_alphabet("3ilm") == "ʿilm"
    assert chat_alphabet("ra7ma") == "raḥma"
    assert chat_alphabet("3'afoor") == "ghafūr"
    assert chat_alphabet("Saabir") == "sābir"
    assert chat_alphabet("qalb") == "qalb"
    for q, slug in (("Saabir", "sabir"), ("3ilm", "ilm"), ("ra7ma", "rahma"), ("7amd", "hamd")):
        d = client.get("/api/v1/search", params={"q": q, "limit": 3}).json()
        assert slug in [x["slug"] for x in d["results"]["lemmas"]], q


def test_nouns_come_before_verbs_among_the_words_a_query_names() -> None:
    from jadhr_api.search import rank_lemmas

    lem = client.get("/api/v1/search", params={"q": "علم", "limit": 6}).json()["results"]["lemmas"]
    assert lem[0]["slug"] == "ilm", [x["slug"] for x in lem]
    exact = [x for x in lem if x["slug"] in ("ilm", "alima")]
    assert [x["pos"] for x in exact] == ["N", "V"]
    # the rule itself: exact letters first, then non-verbs, then frequency
    rows = [
        {"ar": "عَلِمَ", "pos": "V", "occurrences": 300},
        {"ar": "عَالَمِين", "pos": "N", "occurrences": 70},
        {"ar": "عِلْم", "pos": "N", "occurrences": 100},
        {"ar": "عُلِّمَ", "pos": "V", "occurrences": 5},
    ]
    assert [r["ar"] for r in rank_lemmas(rows, "علم")] == ["عِلْم", "عَلِمَ", "عُلِّمَ", "عَالَمِين"]
