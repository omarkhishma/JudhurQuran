"""A path through the Quran's words by frequency (B5, in P5): every root once, in lessons of ten, ordered by how
much of the text each family makes up; each lesson's words are its roots' most frequent ones."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.main import app

client = TestClient(app)


def test_every_root_once_in_lessons_ordered_by_how_much_of_the_quran_it_covers() -> None:
    d = client.get("/api/v1/path").json()
    roots = [r for lesson in d["lessons"] for r in lesson["roots"]]
    meta = client.get("/api/v1/meta").json()["dataset"]["counts"]
    assert len(roots) == len({r["key"] for r in roots}) == meta["roots"]
    occ = [r["occurrences"] for r in roots]
    assert occ == sorted(occ, reverse=True)
    assert all(len(lesson["roots"]) == d["lesson_size"] for lesson in d["lessons"][:-1])
    cum = [lesson["cumulative"] for lesson in d["lessons"]]
    assert cum == sorted(cum) and abs(cum[-1] - d["rooted_words"] / d["total_words"]) < 1e-4
    assert d["total_words"] == meta["words"]


def test_a_lesson_is_its_roots_most_frequent_words_studied_like_a_set() -> None:
    d = client.get("/api/v1/path").json()
    one = client.get("/api/v1/path/1").json()
    keys = [r["key"] for r in d["lessons"][0]["roots"]]
    assert [r["key"] for r in one["roots"]] == keys and one["of"] == len(d["lessons"])
    assert all(x["root"]["key"] in keys for x in one["items"])
    for k in keys:
        mine = [x for x in one["items"] if x["root"]["key"] == k]
        assert 1 <= len(mine) <= 2
        family = client.get(f"/api/v1/roots/{k}").json()["lemmas"]
        top = sorted(family, key=lambda m: -m["occurrences"])[: len(mine)]
        assert [m["occurrences"] for m in mine] == [m["occurrences"] for m in top]
    assert one["cumulative"] == d["lessons"][0]["cumulative"]
    assert client.get("/api/v1/path/0").status_code == 404
    assert client.get(f"/api/v1/path/{len(d['lessons']) + 1}").status_code == 404
