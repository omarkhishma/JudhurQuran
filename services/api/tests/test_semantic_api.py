"""Semantic search (P17, D34): the verses' vectors as loaded, their nearest verses as computed, the search fused with
the sources' words and paged, what happens when the embedding service is away or speaks another model, and the
evaluation's floor (research 25) held as a test on the two yardsticks in the database — Quranpedia's topics for
Arabic, QSAC's tags for English.

The model runs in this process (``jadhr_embed``'s encoder, the pinned files) in place of the service, so the tests
need the model's files and no running service; the service's own tests are in services/embed.
"""

from __future__ import annotations

import os
import time

import numpy as np
import pytest
from fastapi.testclient import TestClient
from jadhr_api import semantic
from jadhr_api.db import connect, rows, scalar
from jadhr_api.main import app
from jadhr_api.settings import get_settings
from jadhr_embed.models import chosen, folder

client = TestClient(app)

HAVE_MODEL = all((folder(chosen()) / rel).exists() for rel in chosen().files)
needs_model = pytest.mark.skipif(
    not HAVE_MODEL and os.environ.get("JADHR_REQUIRE_DATA") != "1",
    reason="the chosen model's files are not here (uv run python -m jadhr_embed fetch)",
)


def q(sql: str, **params: object) -> list[dict]:
    with connect() as conn:
        return rows(conn, sql, params)


@pytest.fixture(scope="module")
def local_embed():
    """The service's answer, computed here by the same pinned model."""
    from jadhr_embed.encoder import Encoder

    enc = Encoder.load()

    def embed(text: str):
        return enc.encode([text[:2000]], "query")[0], enc.spec.tag

    return embed


@pytest.fixture
def embedded(monkeypatch, local_embed):
    monkeypatch.setattr(semantic, "embed", local_embed)


def search(text: str, **params: object) -> dict:
    r = client.get("/api/v1/search", params={"q": text, **params})
    assert r.status_code == 200, r.text[:300]
    return r.json()


def test_every_verse_has_its_two_vectors_of_one_model_and_ten_neighbours_outside_its_context() -> None:
    verses = int(q("select count(*)::int as n from content.verses")[0]["n"])
    v = q(
        """select lang, count(*)::int as n, count(distinct model)::int as models, min(length(vec)) as lo,
                  max(length(vec)) as hi, min(source) as src from content.verse_vectors group by lang order by lang"""
    )
    assert [(r["lang"], r["n"], r["models"], r["src"]) for r in v] == [
        ("ar", verses, 1, "muyassar"),
        ("en", verses, 1, "saheeh"),
    ]
    assert all(r["lo"] == r["hi"] == 4 * chosen().dim for r in v)
    models = {r["model"] for r in q("select distinct model from content.verse_vectors union select distinct model from content.verse_neighbours")}
    assert models == {chosen().tag}
    n = q("select count(*)::int as n, count(distinct verse_id)::int as v from content.verse_neighbours")[0]
    assert n == {"n": 10 * verses, "v": verses}
    # none is the verse itself or within five verses of it in its own sūra (its context, shown apart)
    close = q(
        """select count(*)::int as n from content.verse_neighbours x join content.verses a on a.id = x.verse_id
            join content.verses b on b.id = x.neighbour_id
           where a.id = b.id or (a.surah = b.surah and abs(a.ayah - b.ayah) <= 5)"""
    )
    assert close[0]["n"] == 0
    # ranks run 1…10 in falling score
    bad = q(
        """select count(*)::int as n from content.verse_neighbours x join content.verse_neighbours y
             on y.verse_id = x.verse_id and y.rank = x.rank + 1 where y.score > x.score"""
    )
    assert bad[0]["n"] == 0


def test_the_vectors_are_unit_length_and_a_verse_is_nearest_its_own_explanation() -> None:
    with connect() as conn:
        idx = semantic.index(conn)
    assert idx is not None and idx.model == chosen().tag
    for m in idx.mats.values():
        assert np.allclose(np.linalg.norm(m, axis=1), 1, atol=1e-3)
    # a verse's Arabic reading and its English one agree more with each other than with a verse chosen at random
    ar, en = idx.mats["ar"], idx.mats["en"]
    rng = np.random.default_rng(7)
    i = rng.choice(len(ar), 200, replace=False)
    j = (i + 1000) % len(ar)
    assert float(np.mean(np.sum(ar[i] * en[i], axis=1))) > float(np.mean(np.sum(ar[i] * en[j], axis=1))) + 0.02


def test_a_verses_nearest_verses_are_served_as_built() -> None:
    built = q(
        """select w.key from content.verse_neighbours n join content.verses v on v.id = n.verse_id
             join content.verses w on w.id = n.neighbour_id where v.key = '2:153' order by n.rank"""
    )
    r = client.get("/api/v1/verses/2:153/similar")
    assert r.status_code == 200
    body = r.json()
    assert [x["verse"]["key"] for x in body["items"]] == [b["key"] for b in built]
    assert body["model"] == chosen().tag
    assert len(client.get("/api/v1/verses/2:153/similar", params={"limit": 3}).json()["items"]) == 3
    assert client.get("/api/v1/verses/2:999/similar").status_code == 404


def test_fusion_puts_first_what_both_rankings_find() -> None:
    fused = semantic.fuse(["a", "b", "c"], ["c", "d", "a"])
    assert [k for k, _ in fused] == ["a", "c", "b", "d"]
    # a list alone keeps its order
    assert [k for k, _ in semantic.fuse(["x", "y"])] == ["x", "y"]


@needs_model
def test_an_arabic_search_finds_verses_by_meaning_fused_with_the_sources_words_and_pages(embedded) -> None:
    d = search("اليتيم", limit=10)
    s = d["semantic"]
    assert s["status"] == "ok" and s["lang"] == "ar" and s["fused_with_words"] and s["model"] == chosen().tag
    hits = d["results"]["semantic"]
    keys = [h["verse"]["key"] for h in hits]
    assert {"93:9", "107:2"} <= set(keys), keys
    assert d["totals"]["semantic"] == s["total"] >= len(hits) == 10
    # each hit says how it was found and carries al-Muyassar's explanation of its verse, verbatim
    assert all(h["by_meaning"] or h["by_words"] for h in hits)
    assert any(h["by_meaning"] and h["by_words"] for h in hits)
    first = hits[0]
    stored = q(
        """select p.text from content.work_passages p join content.verses v on v.id = p.verse_from
           where p.work_id = 'muyassar' and v.key = :k""",
        k=first["verse"]["key"],
    )[0]["text"]
    assert first["source"]["text"] == stored and first["source"]["work"]["id"] == "muyassar"
    # the next page continues the same ranking
    page2 = search("اليتيم", limit=5, offset=5, only="semantic")
    assert [h["verse"]["key"] for h in page2["results"]["semantic"]] == keys[5:10]
    assert set(page2["results"]) == {"semantic"}


@needs_model
def test_an_english_search_reads_the_translation_without_its_verse_number(embedded) -> None:
    d = search("orphans and their property", limit=10)
    assert d["semantic"]["status"] == "ok" and d["semantic"]["lang"] == "en"
    hits = d["results"]["semantic"]
    assert hits[0]["source"]["work"]["id"] == "saheeh"
    assert all(not h["source"]["text"].startswith("(") for h in hits)
    assert {"4:2", "4:10", "6:152", "17:34"} & {h["verse"]["key"] for h in hits}


@needs_model
def test_words_the_quran_never_speaks_of_get_no_group_and_real_ones_do(embedded) -> None:
    # the model always has a nearest verse; the group needs the words' hits or a verse standing out (MIN_GAP)
    for text in ("zzqqxx", "pizza", "smartphone", "بيتزا", "هاتف ذكي", "زززق"):
        d = search(text)
        assert d["semantic"]["status"] == "weak" and d["results"]["semantic"] == [], (text, d["semantic"])
        assert d["semantic"]["gap"] < semantic.MIN_GAP
    for text in ("gratitude", "repentance", "الشكر", "قصة موسى"):
        assert search(text)["semantic"]["status"] == "ok", text


@needs_model
def test_references_roots_and_patterns_are_not_searched_by_meaning(embedded) -> None:
    for text in ("2:255", "ك ت ب", "مَفْعُول", "البقرة"):
        d = search(text)
        assert "semantic" not in d["results"] and "semantic" not in d, text


def test_without_the_embedding_service_the_search_says_so_and_is_not_cached(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "embed_url", "http://127.0.0.1:9")  # nothing listens there
    r = client.get("/api/v1/search", params={"q": "الصبر"})
    assert r.status_code == 200
    d = r.json()
    assert d["semantic"]["status"] == "unavailable" and d["results"]["semantic"] == []
    assert r.headers["cache-control"] == "no-store"
    # the rest of the search is there
    assert d["results"]["lemmas"]


def test_a_query_from_another_model_is_never_compared(monkeypatch) -> None:
    monkeypatch.setattr(semantic, "embed", lambda text: (np.ones(chosen().dim, dtype="<f4"), "other-model@0"))
    d = search("الصبر")
    assert d["semantic"]["status"] == "model_mismatch" and d["results"]["semantic"] == []


@needs_model
def test_the_semantic_part_answers_within_its_budget(local_embed) -> None:
    with connect() as conn:
        semantic.index(conn)  # loaded once per release
        local_embed("warm")
        t = time.perf_counter()
        for text in ("الصبر على البلاء", "بر الوالدين", "the day of judgement", "الرزق"):
            kind = "latin" if text.isascii() else "arabic_phrase"
            orig = semantic.embed
            semantic.embed = local_embed
            try:
                out = semantic.search(conn, text, kind, 20, 0)
            finally:
                semantic.embed = orig
            assert out["status"] == "ok"
        per = (time.perf_counter() - t) / 4
    assert per < 0.25, f"{per * 1000:.0f} ms a search"


def _recall(conn, topics: list[dict], latin: bool, embed) -> tuple[float, float]:
    """recall@20 of the fused ranking and of the sources' words alone, as research 25 measured them."""
    fused, words = [], []
    for t in topics:
        rel = {r["verse_key"] for r in rows(conn, "select verse_key from content.topic_links where topic_id = :t", {"t": t["id"]})}
        vec, _ = embed(t["q"])
        idx = semantic.index(conn)
        sem = [r for r, _ in semantic.nearest(idx, vec, "en" if latin else "ar")]
        keys = {r["id"]: r["key"] for r in rows(conn, "select id, key from content.verses where id = any(:i)", {"i": sem})}
        lex = semantic._lexical(t["q"], latin) or []
        top = [k for k, _ in semantic.fuse([keys[i] for i in sem], lex)][:20]
        fused.append(len(rel & set(top)) / min(len(rel), 20))
        words.append(len(rel & set(lex[:20])) / min(len(rel), 20))
    return float(np.mean(fused)), float(np.mean(words))


@needs_model
def test_the_evaluations_floor_holds_on_both_yardsticks(local_embed) -> None:
    """Research 25: fused, the Arabic yardstick's recall@20 was 0.289 and the English 0.259 (over 300 and 211
    queries); here every fifth topic of 3–40 verses, with a floor below the measure and above the words alone."""
    with connect() as conn:
        if scalar(conn, "select count(*) from content.topic_links") == 0:
            pytest.skip("no topics loaded")
        ar = rows(
            conn,
            """select id, name_ar as q from content.topics where source_id = 'quranpedia-topics' and name_ar is not null
                 and verse_count between 3 and 40 order by id""",
        )[::5][:60]
        en = rows(
            conn,
            """select id, name_en as q from content.topics where source_id = 'qsac' and name_en is not null
                 and verse_count between 3 and 40 order by id""",
        )[::5][:60]
        ar_fused, ar_words = _recall(conn, ar, False, local_embed)
        en_fused, en_words = _recall(conn, en, True, local_embed)
    assert ar_fused >= 0.22 and ar_fused > ar_words + 0.05, (ar_fused, ar_words)
    assert en_fused >= 0.18 and en_fused > en_words + 0.05, (en_fused, en_words)
