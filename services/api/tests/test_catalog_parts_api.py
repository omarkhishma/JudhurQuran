"""The sitemaps beyond the Quran (P12, SEO for every surface): each part of the site — the dictionary, the hadith and
their chapters, the narrators, the books — listed whole, as the paths its pages take, each part under the 50,000
addresses a sitemap may hold; counts recounted from the tables, never typed in."""

from __future__ import annotations

from urllib.parse import unquote

from fastapi.testclient import TestClient
from jadhr_api.db import connect, scalar
from jadhr_api.dictionary import ALPHABET
from jadhr_api.main import app

client = TestClient(app)


def paths(part: str) -> list[str]:
    r = client.get(f"/api/v1/catalog/{part}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["part"] == part and d["loaded_at"]
    return d["paths"]


def test_each_part_lists_every_page_once_and_fits_a_sitemap() -> None:
    with connect() as conn:
        n = {
            "dict": scalar(conn, "select count(*) from content.dict_roots"),
            "hadith": scalar(
                conn,
                "select count(*) from content.passages p join content.texts t on t.id = p.text_id where t.kind = 'hadith'",
            ),
            "collections": scalar(conn, "select count(*) from content.texts where kind = 'hadith'"),
            "hchapters": scalar(
                conn,
                "select count(*) from content.chapters c join content.texts t on t.id = c.text_id where t.kind = 'hadith'",
            ),
            "entries": scalar(conn, "select count(*) from content.narrators where kind = 'entry'"),
            "books": scalar(conn, "select count(*) from content.texts where kind = 'book'"),
            "bchapters": scalar(
                conn,
                "select count(*) from content.chapters c join content.texts t on t.id = c.text_id where t.kind = 'book'",
            ),
        }
    expected = {
        "dictionary": 1 + len(ALPHABET) + n["dict"],
        "hadith": 1 + n["collections"] + n["hadith"],
        "hadith-chapters": n["hchapters"],
        "narrators": 1 + n["entries"],
        "books": 2 + n["books"] + n["bchapters"],
    }
    for part, count in expected.items():
        got = paths(part)
        assert len(got) == count, (part, len(got), count)
        assert len(set(got)) == len(got), part
        assert len(got) <= 50_000, part
        # a path as its page's address takes it: absolute, one encoded segment per part, no language prefix
        assert all(p.startswith("/") and " " not in p and not p.startswith("/en/") for p in got), part
    # an Arabic key percent-encoded, read back whole
    assert "/dictionary/" + "علم" in {unquote(p) for p in paths("dictionary")}


def test_an_unknown_part_is_refused() -> None:
    r = client.get("/api/v1/catalog/everything")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
