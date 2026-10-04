"""A verse's commentary in the books (B55): the tafsir books' sections whose own headings name the verse, each with
the opening of its first paragraph verbatim and that paragraph's citation, with the books' source and licence; the
verse's tafsir route beside it still answers."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.db import connect, one
from jadhr_api.main import app

client = TestClient(app)


def test_a_verse_opens_the_sections_that_name_it_in_each_book() -> None:
    d = client.get("/api/v1/verses/2:3/books").json()
    books = {b["text"]["slug"]: b for b in d["data"]}
    assert set(books) == {
        "hudhawwari-tafsir",
        "tabari-jamicbayan",
        "jarallahzamakhshari-kashshaf",
        "ibncatiyyaandalusi-muharrarwajiz",
        "ibnkathir-tafsirquran",
    }
    assert books["jarallahzamakhshari-kashshaf"]["sections"][0]["heading"].startswith("البقرة : ( 3 )")
    assert books["hudhawwari-tafsir"]["sections"][0]["heading"] == "[2.2-3]"
    for b in d["data"]:
        assert b["source"]["license_url"] and len(b["sections"]) <= 3 and b["total"] >= len(b["sections"])
        for s in b["sections"]:
            first = s["first"]
            # the section's opening is its first paragraph's own words
            with connect() as conn:
                p = one(
                    conn,
                    """select p.ar_full from content.passages p join content.texts t on t.id = p.text_id
                        where t.slug = :s and p.ref = :r""",
                    {"s": b["text"]["slug"], "r": first["ref"]},
                )
            assert p and " ".join(p["ar_full"].split()).startswith(first["excerpt"].removesuffix(" …"))
            assert first["cite"]["ar"] and first["cite"]["key"].startswith("urn:cts:arabicLit:")


def test_no_verse_no_books_and_the_tafsir_route_still_answers() -> None:
    assert client.get("/api/v1/verses/2:999/books").status_code == 404
    t = client.get("/api/v1/verses/2:3/commentary", params={"works": "muyassar"}).json()
    assert t["data"][0]["work"]["id"] == "muyassar"
