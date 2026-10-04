"""A Quranic word in one hadith collection or book (P1.3 ``?in_text=``, the panel's "In this text", RDR-268…271): the
passages where the rules surely read the word as that lemma, in the text's order, each with the word in its line; and,
where the text has none, its places in the texts that hold it."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.db import connect, one, rows
from jadhr_api.main import app

client = TestClient(app)


def lemma_of(word: str) -> str | None:
    f = client.post("/api/v1/analyse/form", json={"token": word}).json()
    return f["readings"][0]["lemma"]["slug"] if f.get("readings") and f["readings"][0]["lemma"] else None


def test_a_words_places_in_a_collection_are_read_as_that_word() -> None:
    d = client.get("/api/v1/texts/bukhari/words/ilm").json()
    assert d["text"]["slug"] == "bukhari" and d["lemma"]["slug"] == "ilm"
    assert d["total"] > len(d["data"]) == 5 and d["siblings"] == []
    # each line's marked word, read on its own by the shared rules, is the same word
    for h in d["data"]:
        assert h["text"]["slug"] == "bukhari" and h["kwic"] is not None
        assert lemma_of(h["kwic"]["word"]) == "ilm", h["kwic"]["word"]
    # in the collection's order
    with connect() as conn:
        order = {
            r["uri"]: (r["chapter_id"], r["ordinal"])
            for r in rows(
                conn,
                "select uri, chapter_id, ordinal from content.passages where uri = any(:u)",
                {"u": [h["uri"] for h in d["data"]]},
            )
        }
    keys = [order[h["uri"]] for h in d["data"]]
    assert keys == sorted(keys)
    # the word payload carries the same under ?in_text=
    w = client.get("/api/v1/words/ilm", params={"limit": 0, "in_text": "bukhari"}).json()
    assert w["in_text"]["total"] == d["total"]


def test_a_text_without_the_word_leads_to_the_texts_that_hold_it() -> None:
    with connect() as conn:
        found = one(
            conn,
            """select l.slug from content.text_lemmas x join content.lemmas l on l.id = x.lemma_id
                where x.text_id = (select id from content.texts where slug = 'bukhari')
                  and not exists (select 1 from content.text_lemmas y where y.lemma_id = x.lemma_id
                                   and y.text_id = (select id from content.texts where slug = 'zaydibncali-musnad'))
                order by l.occurrences desc limit 1""",
        )
    assert found
    d = client.get(f"/api/v1/texts/zaydibncali-musnad/words/{found['slug']}").json()
    assert d["total"] == 0 and d["data"] == []
    assert d["siblings"] and all(h["text"]["slug"] != "zaydibncali-musnad" for h in d["siblings"])
    assert all(lemma_of(h["kwic"]["word"]) == found["slug"] for h in d["siblings"] if h["kwic"])


def test_the_quran_and_unknown_texts_or_words_are_not_found() -> None:
    assert client.get("/api/v1/texts/quran/words/ilm").status_code == 404
    assert client.get("/api/v1/texts/nosuchtext/words/ilm").status_code == 404
    assert client.get("/api/v1/texts/bukhari/words/nosuchword").status_code == 404
    assert client.get("/api/v1/words/ilm", params={"in_text": "Bad Slug"}).status_code == 422
