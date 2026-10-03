"""Endpoints behind Reader v5 (PLAN P2): the rail's roots of a sūra, related verses, a root's family.

Every expectation is recomputed from other endpoints (the sūra's words, each root's own record),
never typed in."""

from __future__ import annotations

import math
from collections import Counter

from fastapi.testclient import TestClient
from jadhr_api.main import app

client = TestClient(app)


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def test_surah_roots_count_every_rooted_word_of_the_surah() -> None:
    for n in (1, 20, 112):
        words = [w for v in get(f"/api/v1/surahs/{n}")["verses"] for w in v["words"]]
        expected = Counter(w["root"] for w in words if w["root"])
        got = get(f"/api/v1/surahs/{n}/roots")["data"]
        assert {r["key"]: r["here"] for r in got} == dict(expected), n
        heres = [r["here"] for r in got]
        assert heres == sorted(heres, reverse=True), "ordered by count in the sūra"
        for r in got:
            assert r["spaced"] == " ".join(r["key"])


def test_surah_roots_reject_a_surah_out_of_range() -> None:
    assert client.get("/api/v1/surahs/115/roots").status_code == 404
    assert client.get("/api/v1/surahs/0/roots").status_code == 404


def test_related_verses_share_roots_and_rank_by_rarity() -> None:
    key = "2:255"
    mine = {w["root"] for w in get(f"/api/v1/verses/{key}")["words"] if w["root"]}
    d = get(f"/api/v1/verses/{key}/related", limit=8)
    assert d["key"] == key and "ln(6236" in d["method"]
    rows = d["data"]
    assert len(rows) == 8
    assert all(r["verse"]["key"] != key for r in rows), "never the verse itself"
    scores = [r["score"] for r in rows]
    assert scores == sorted(scores, reverse=True)
    verse_count = {}
    for r in rows:
        theirs = {w["root"] for w in get(f"/api/v1/verses/{r['verse']['key']}")["words"] if w["root"]}
        assert set(r["roots"]) == mine & theirs, r["verse"]["key"]
        assert r["shared"] == len(r["roots"])
        for k in r["roots"]:
            if k not in verse_count:
                verse_count[k] = get(f"/api/v1/roots/{k}")["verse_count"]
        assert math.isclose(
            r["score"], sum(math.log(6236 / verse_count[k]) for k in r["roots"]), abs_tol=0.002
        )
        assert r["verse"]["name_ar"]


def test_related_verses_unknown_verse_is_404() -> None:
    assert client.get("/api/v1/verses/2:999/related").status_code == 404


def test_root_family_holds_every_lemma_of_the_root() -> None:
    for root in ("علم", "رحم", "كتب"):
        rec = get(f"/api/v1/roots/{root}")
        fam = get(f"/api/v1/roots/{root}/family")
        assert fam["root"]["key"] == root
        members = [m for g in fam["family"] for m in g["members"]]
        assert len(members) == rec["lemma_count"] == len({m["slug"] for m in members})
        assert sum(m["occurrences"] for m in members) == rec["occurrences"]
    assert client.get("/api/v1/roots/zzz/family").status_code == 404


def test_divisions_start_every_juz_and_hizb_at_its_first_verse() -> None:
    d = get("/api/v1/divisions")
    assert [j["number"] for j in d["juz"]] == list(range(1, 31))
    assert [h["number"] for h in d["hizb"]] == list(range(1, 61))
    # a juzʾ is two aḥzāb: juzʾ k begins where ḥizb 2k−1 begins
    for j in d["juz"]:
        assert j["key"] == d["hizb"][2 * j["number"] - 2]["key"], j
    for a, b in zip(d["hizb"], d["hizb"][1:], strict=False):
        assert (a["surah"], a["ayah"]) < (b["surah"], b["ayah"])
        assert a["page"] <= b["page"]
    assert d["juz"][0]["key"] == "1:1"
    # each start agrees with the verse record itself
    for j in d["juz"][::7]:
        v = get(f"/api/v1/verses/{j['key']}")
        assert v["juz"] == j["number"] and v["page"] == j["page"]


def test_surah_lemma_sets_are_the_distinct_words_of_each_surah() -> None:
    sets = get("/api/v1/surahs/lemma-sets")["data"]
    assert len(sets) == 114
    for n in (1, 112):
        words = [w for v in get(f"/api/v1/surahs/{n}")["verses"] for w in v["words"]]
        assert sets[str(n)] == sorted({w["lemma_slug"] for w in words if w["lemma_slug"]})


def test_search_understands_juz_hizb_and_page_numbers() -> None:
    div = get("/api/v1/divisions")
    cases = [
        ("الجزء 3", "juz", div["juz"][2]["key"]),
        ("جزء ٣٠", "juz", div["juz"][29]["key"]),
        ("حزب ١٠", "hizb", div["hizb"][9]["key"]),
        ("juz 4", "juz", div["juz"][3]["key"]),
        ("hizb 2", "hizb", div["hizb"][1]["key"]),
    ]
    for q, kind, key in cases:
        d = get("/api/v1/search", q=q, limit=2)
        assert d["detected"]["kind"] == kind and [v["key"] for v in d["results"]["verses"]] == [key], q
    page = get("/api/v1/pages/50")["verses"][0]["key"]
    for q in ("صفحة 50", "الصفحة ٥٠", "page 50"):
        d = get("/api/v1/search", q=q, limit=2)
        assert d["detected"]["kind"] == "page" and d["results"]["verses"][0]["key"] == page, q
    # out of range is not a division; «ص 50» stays sūrat Ṣād, verse 50
    assert get("/api/v1/search", q="juz 31", limit=2)["detected"]["kind"] != "juz"
    assert get("/api/v1/search", q="ص 50", limit=2)["results"]["verses"][0]["key"] == "38:50"


def test_surah_lines_match_the_surah_payload() -> None:
    d = get("/api/v1/surahs/1")
    imlaei = get("/api/v1/surahs/1/lines", kind="imlaei")["data"]
    translit = get("/api/v1/surahs/1/lines", kind="translit")["data"]
    for v in d["verses"]:
        assert imlaei[str(v["ayah"])] == v["text_imlaei"]
        assert translit[str(v["ayah"])] == " ".join(w["translit"] or "" for w in v["words"])
    assert client.get("/api/v1/surahs/1/lines", params={"kind": "other"}).status_code == 422
