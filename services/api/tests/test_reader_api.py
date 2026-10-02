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
