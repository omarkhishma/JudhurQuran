"""A word of the reader's own text read in full (P11.3: the reader's texts in the same reader as the hadith and the
books): every reading the shared rules allow, in the shape a book's word has — the same word in a book reads the same —
answered no-store and kept nowhere."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.db import connect, rows
from jadhr_api.main import app
from jadhr_api.texts import shape_forms

client = TestClient(app)


def form(token: str):
    return client.post("/api/v1/analyse/form", json={"token": token})


def test_a_word_is_read_as_the_same_word_in_a_book() -> None:
    r = form("العلم")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    f = r.json()
    assert set(f) == {"norm", "kind", "confidence", "sure", "clitics", "readings"}
    assert f["kind"] == "form" and f["sure"]
    first = f["readings"][0]
    assert first["lemma"]["slug"] == "ilm" and first["root"] == "علم" and first["dict_root"] == "علم"
    # a book's word of the same spelling, as the build read it, has the same readings
    with connect() as conn:
        stored = rows(
            conn,
            "select id, norm, kind, confidence, clitics, readings from content.text_forms where norm = :n limit 1",
            {"n": f["norm"]},
        )
        assert stored, "the word is in the books"
        book = next(iter(shape_forms(conn, stored).values()))
    assert book["kind"] == f["kind"]
    assert [x["lemma"] for x in book["readings"]] == [x["lemma"] for x in f["readings"]]


def test_a_word_read_by_a_rule_says_so_and_nothing_is_a_word_that_is_not() -> None:
    f = form("بالتعلم").json()
    assert f["kind"] in ("clitic", "pattern", "pattern-dict", "weak", "weak-dict")
    assert f["readings"] and all(x["dict_root"] for x in f["readings"][:1])
    assert form("،").status_code == 404
    assert form("x" * 81).status_code == 422
