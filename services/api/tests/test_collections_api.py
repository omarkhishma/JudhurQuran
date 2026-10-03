"""Curated sets and the reader's coverage (P5.2, COL with COL-Q03/Q04): the sets as the build computed them,
each item with its root, pattern and first place; coverage from the reader's words, POSTed and never kept."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.main import app

client = TestClient(app)


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def test_the_sets_list_their_members_and_open_with_each_words_root_pattern_and_first_place() -> None:
    sets = get("/api/v1/collections")["data"]
    assert [s["id"] for s in sets] == ["ilm", "doers", "places", "frequent", "particles", "loanwords"]
    for s in sets:
        d = get(f"/api/v1/collections/{s['id']}")
        assert len(d["items"]) == s["item_count"] == len(s["slugs"])
        assert [x["slug"] for x in d["items"]] == s["slugs"]
        for x in d["items"]:
            assert x["first"] and x["first"]["verse_key"] == ":".join(x["first"]["location"].split(":")[:2])
            # the first place is the lemma's first occurrence in mushaf order
            occ = get(f"/api/v1/words/{x['slug']}/attestations", limit=1)
            assert occ["data"][0]["location"] == x["first"]["location"], x["slug"]
    ilm = get("/api/v1/collections/ilm")
    assert {x["root"]["key"] for x in ilm["items"]} == {"علم"} and len(ilm["items"]) == get(
        "/api/v1/roots/علم"
    )["lemma_count"]
    particles = get("/api/v1/collections/particles")
    assert all(x["root"] is None for x in particles["items"])  # no root, never a pseudo-root
    places = get("/api/v1/collections/places")
    assert {x["pattern"]["slug"] for x in places["items"]} <= {"maf3al", "maf3il"}
    assert (
        places["quote"]["text_ar"].startswith("أسماء الزمان")
        and "الشافية" in places["quote"]["attribution_ar"]
    )
    assert (
        "rahman" not in get("/api/v1/collections/loanwords")["items"]
    )  # flagged exclusion (data/collections.yaml)
    assert client.get("/api/v1/collections/nope").status_code == 404


def test_coverage_counts_the_readers_words_and_keeps_nothing() -> None:
    frequent = get("/api/v1/collections/frequent")
    r = client.post(
        "/api/v1/lemmas/coverage", json={"slugs": [x["slug"] for x in frequent["items"]] + ["no-such-word"]}
    )
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    d = r.json()
    assert d["lemmas"] == len(frequent["items"]) and d["occurrences"] == frequent["occurrences"]
    assert d["coverage"] == round(frequent["occurrences"] / d["total_words"], 4)
    assert client.post("/api/v1/lemmas/coverage", json={"slugs": []}).json()["lemmas"] == 0
