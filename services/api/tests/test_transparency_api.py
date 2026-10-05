"""What we know and what we do not yet (B17): every number on the page is the data's, counted again here by another
query; nothing is called reviewed that the board has not approved."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.db import connect, rows, scalar
from jadhr_api.main import app

client = TestClient(app)


def test_every_layer_is_counted_from_the_data() -> None:
    d = client.get("/api/v1/transparency").json()
    by = {x["id"]: x for x in d["layers"]}
    with connect() as conn:
        n = lambda sql: int(scalar(conn, sql) or 0)  # noqa: E731
        assert by["text"]["count"] == by["text"]["of"] == n("select count(*) from content.verses") == 6236
        assert by["text"]["detail"]["sha256"] == scalar(conn, "select text_sha256 from content.dataset")
        assert by["roots"]["count"] == n("select count(root_id) from content.words")
        assert by["roots"]["of"] == n("select count(*) from content.words")
        assert by["roots"]["disagree"] == len(
            {r["word_id"] for r in rows(conn, "select word_id from content.root_variants")}
        )
        assert by["patterns"]["count"] == n("select count(pattern_id) from content.lemmas")
        assert (
            sum(by["patterns"]["detail"].values())
            == by["patterns"]["of"]
            == n("select count(*) from content.lemmas")
        )
        located = {
            loc
            for r in rows(conn, "select word_locations from content.gharib_meanings")
            for loc in r["word_locations"]
        }
        assert by["gharib"]["count"] == len(located)
        # each lexicon: the Quran's roots it has an article on
        quran_roots = {r["key"] for r in rows(conn, "select key from content.roots")}
        for w in rows(conn, "select id from content.lexicon_works"):
            have = {
                r["root_key"]
                for r in rows(
                    conn, "select root_key from content.lexicon_entries where work_id = :w", {"w": w["id"]}
                )
            } & quran_roots
            if have:
                assert by[f"lexicon:{w['id']}"]["count"] == len(have) and by[f"lexicon:{w['id']}"][
                    "of"
                ] == len(quran_roots)
        for w in rows(conn, "select id, verse_coverage from content.works"):
            assert by[f"work:{w['id']}"]["count"] == w["verse_coverage"]
        hadith = rows(
            conn,
            "select p.meta from content.passages p join content.texts t on t.id = p.text_id where t.kind = 'hadith'",
        )
        assert by["hadith-split"]["of"] == len(hadith) and by["hadith-split"]["count"] == sum(
            1 for h in hadith if "split" in (h["meta"] or {})
        )
        links = rows(conn, "select narrator_id from content.narrator_links")
        assert by["narrators"]["of"] == len(links) and by["narrators"]["count"] == sum(
            1 for x in links if x["narrator_id"]
        )
        books = rows(conn, "select info from content.texts where kind = 'book'")
        assert by["book-pages"]["of"] == len(books) and by["book-pages"]["count"] == sum(
            1 for b in books if (b["info"] or {}).get("pages_trusted")
        )
        # signed is the board's approval, and nothing else
        assert d["signed"] == n("select count(*) from editorial.entries where status = 'approved'")
        assert d["review"]["board_approved"] == d["signed"]
    # every layer says whether a source gave it or our rules derived it
    assert {x["how"] for x in d["layers"]} <= {"source", "rule"}
    assert all(0 <= x["count"] <= x["of"] for x in d["layers"])
