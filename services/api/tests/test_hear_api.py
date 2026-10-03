"""Hear the root (B4, in P5): every occurrence of a root or a word as the same slice the reader plays one by one,
in the order of the mushaf, the untimed ones counted rather than dropped silently."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.main import app

client = TestClient(app)


def test_a_roots_playlist_is_every_occurrence_in_order_each_the_words_own_slice() -> None:
    d = client.get("/api/v1/hear", params={"root": "علم"}).json()
    root = client.get("/api/v1/roots/علم").json()
    assert d["total"] == root["occurrences"] and len(d["items"]) + d["untimed"] == d["total"]
    assert d["reciter"] and len(d["items"]) > 0.9 * d["total"]
    locs = [tuple(map(int, x["location"].split(":"))) for x in d["items"]]
    assert locs == sorted(locs)
    # a slice in the list is the slice the word's own page plays, flags included
    for x in d["items"][:: max(1, len(d["items"]) // 12)]:
        w = client.get(f"/api/v1/words/{x['location']}").json()
        assert w["audio"] == x["audio"], x["location"]


def test_a_words_playlist_and_the_answers_for_nothing() -> None:
    root = {x["location"] for x in client.get("/api/v1/hear", params={"root": "علم"}).json()["items"]}
    d = client.get("/api/v1/hear", params={"lemma": "ilm"}).json()
    assert d["subject"]["slug"] == "ilm" and {x["location"] for x in d["items"]} <= root
    assert all(x["lemma"]["slug"] == "ilm" for x in d["items"])
    assert client.get("/api/v1/hear", params={"root": "zzz"}).status_code == 404
    assert client.get("/api/v1/hear").status_code == 400
    assert client.get("/api/v1/hear", params={"root": "علم", "lemma": "ilm"}).status_code == 400
