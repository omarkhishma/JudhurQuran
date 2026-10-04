"""The public API (P10.2a): each answer in its envelope — the dataset's version, the recorded release when there is
one, and the source and licence of every layer in it; only the layers whose terms allow it (no dictionary text, no
word-by-word glosses); a value this project derived saying how."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from jadhr_api import releases, routes_public
from jadhr_api.main import app

client = TestClient(app)
BASE = "/api/v1/public"


def _get(path: str) -> dict:
    r = client.get(f"{BASE}{path}")
    assert r.status_code == 200, r.text
    return r.json()


def _layers(body: dict) -> list[tuple[str, str]]:
    return [(x["layer"], x["source"]) for x in body["meta"]["layers"]]


def test_every_answer_carries_its_provenance() -> None:
    version = client.get("/api/v1/meta").json()["dataset"]["version"]
    for path, layers in (
        ("/quran/lookup?q=علم", [("morphology", "qac"), ("patterns", "jadhr"), ("text_qpc", "qpc-hafs")]),
        ("/quran/roots/علم", [("morphology", "qac"), ("patterns", "jadhr")]),
        ("/quran/words/1:2:3", [("text_corpus", "qac-tanzil"), ("morphology", "qac"), ("patterns", "jadhr")]),
        (
            "/quran/verses/1:2",
            [("text_qpc", "qpc-hafs"), ("text_corpus", "qac-tanzil"), ("morphology", "qac")],
        ),
        ("/quran/patterns/fi3l?limit=3", [("morphology", "qac"), ("patterns", "jadhr")]),
        ("/quran/concordance?root=علم&limit=3", [("text_corpus", "qac-tanzil"), ("morphology", "qac")]),
    ):
        body = _get(path)
        meta = body["meta"]
        assert meta["dataset"] == "jadhr-quran" and meta["dataset_version"] == version, path
        assert _layers(body) == layers, path
        assert all(x["license"] and x["attribution"] for x in meta["layers"]), path
        assert set(body) == {"meta", "data"}
    # the corpus's text is said to be Tanzil's 1.0.2 as the corpus carries it, not the KFGQPC text
    corpus = next(x for x in _get("/quran/words/1:2:3")["meta"]["layers"] if x["layer"] == "text_corpus")
    assert "1.0.2" in corpus["title"] and "KFGQPC" not in corpus["title"] and "BY-ND" in corpus["license"]
    ours = next(x for x in _get("/quran/roots/علم")["meta"]["layers"] if x["layer"] == "patterns")
    assert ours["license"].startswith("CC BY-SA 4.0")


def test_only_the_layers_whose_terms_allow_it() -> None:
    root = _get("/quran/roots/علم")["data"]
    assert root["key"] == "علم" and root["spaced"] == "ع ل م" and root["lemmas"] and root["distribution"]
    # Ibn Fāris's words, the dictionaries and the English glosses are the site's to show, not the API's to hand out
    assert not {"gist_ar", "lexicon", "gloss_en", "usul", "variants"} & set(root)
    assert all("gloss_en" not in x and x["pattern_method"] for x in root["lemmas"] if x["pattern"])
    word = _get("/quran/words/1:2:3")["data"]
    assert word["lemma"] == {
        "slug": "rabb",
        "ar": word["lemma"]["ar"],
        "pattern": "فَعْل",
        "pattern_method": "match",
    }
    assert word["root"] == {"key": "ربب", "spaced": "ر ب ب"} and not {"gloss_en", "translit"} & set(word)
    look = _get("/quran/lookup?q=علم")["data"]
    assert look["detected"] == "arabic_word" and look["results"]["roots"][0]["key"] == "علم"
    assert not {"dictionary", "passages"} & set(look["results"])
    assert all("gist_ar" not in x for x in look["results"]["roots"])
    assert all("senses_en" not in x and "gloss_en" not in x for x in look["results"]["lemmas"])


def test_the_verse_text_is_the_sites_and_the_concordance_pages() -> None:
    site = client.get("/api/v1/verses/2:255").json()
    v = _get("/quran/verses/2:255")["data"]
    assert v["text_qpc"] == site["text_qpc"] and len(v["words"]) == site["word_count"]
    first = _get("/quran/concordance?root=علم&limit=5")["data"]
    assert first["total"] == 854 and len(first["lines"]) == 5 and first["next_cursor"]
    second = _get(f"/quran/concordance?root=علم&limit=5&cursor={first['next_cursor']}")["data"]
    assert {x["location"] for x in first["lines"]}.isdisjoint({x["location"] for x in second["lines"]})


def test_not_found_and_a_recorded_release_named(monkeypatch: pytest.MonkeyPatch) -> None:
    for path in ("/quran/words/9:999:1", "/quran/roots/xyz", "/quran/verses/200:1", "/quran/patterns/nope"):
        r = client.get(f"{BASE}{path}")
        assert r.status_code == 404 and r.json()["error"]["code"] == "not_found", path
    assert _get("/quran/roots/علم")["meta"]["release"] is None  # nothing recorded for this version yet
    named = {
        "version": "2026.10.0",
        "manifest_sha256": "0" * 64,
        "published": False,
        "doi": None,
        "url": "/api/v1/releases/2026.10.0",
    }
    monkeypatch.setattr(releases, "recorded", lambda version: named)
    monkeypatch.setattr(routes_public.releases, "recorded", lambda version: named)
    assert client.get(f"{BASE}/quran/roots/علم?x=1").json()["meta"]["release"] == named
