"""The lexica's articles as citable things (P1.7a): every article the dictionary or the reader shows carries its
identifier, ``dict:<work>:<root>``; the identifier opens the same article as its row id, and nothing else opens."""

from __future__ import annotations

from urllib.parse import quote

from fastapi.testclient import TestClient
from jadhr_api.db import connect, one
from jadhr_api.main import app

client = TestClient(app)


def test_every_article_shown_has_its_identifier_and_opens_by_it() -> None:
    r = client.get(f"/api/v1/dictionary/roots/{quote('علم')}").json()
    arts = [(w["id"], a) for w in r["works"] for a in w["articles"]]
    assert len(arts) >= 9
    assert all(a["uri"].startswith(f"dict:{work}:") for work, a in arts)
    assert len({a["uri"] for _, a in arts}) == len(arts)
    lane = next(a for work, a in arts if work == "lane")
    assert lane["uri"] == "dict:lane:علم"
    by_uri = client.get(f"/api/v1/dictionary/entries/{quote(lane['uri'])}")
    assert by_uri.status_code == 200
    by_id = client.get(f"/api/v1/dictionary/entries/{lane['id']}").json()
    assert by_uri.json() == by_id and by_id["uri"] == lane["uri"]


def test_an_identifier_no_article_holds_is_not_found() -> None:
    for bad in ("dict:lane:" + quote("ءءء"), "lane:" + quote("علم"), "12abc", quote("علم")):
        assert client.get(f"/api/v1/dictionary/entries/{bad}").status_code == 404, bad


def test_the_readers_panel_carries_each_articles_identifier() -> None:
    w = client.get("/api/v1/words/ilm", params={"limit": 0}).json()
    entries = [e for d in w["dict_articles"] for e in d["entries"]]
    assert entries and all(e["uri"].startswith("dict:") for e in entries)
    with connect() as conn:
        missing = one(
            conn,
            """select count(*) as n from content.lexicon_entries
               where (displayable or cardinality(dict_roots) > 0) and uri is null""",
        )
    assert missing and missing["n"] == 0
