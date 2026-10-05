"""Word by word (B2): every word of a sūra with its gharīb meaning at its place (under the first word of the phrase
it explains, verbatim), its English gloss, its root's letters and its lemma's pattern — recounted here from the
tables."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.db import connect, one, rows
from jadhr_api.main import app

client = TestClient(app)


def test_every_word_of_a_sura_with_what_stands_under_it() -> None:
    d = client.get("/api/v1/surahs/2/interlinear").json()
    with connect() as conn:
        n = one(conn, "select count(*) as n from content.words where surah = 2")["n"]  # type: ignore[index]
        first = rows(
            conn,
            "select word_locations[1] as at, meaning_ar from content.gharib_meanings where surah = 2 order by seq limit 3",
        )
        w = one(
            conn,
            """select w.gloss_en, r.spaced, l.pattern from content.words w left join content.roots r on r.id = w.root_id
                 left join content.lemmas l on l.id = w.lemma_id where w.location = '2:255:1'""",
        )
    assert len(d["words"]) == n
    for m in first:
        assert d["words"][m["at"]][0] == m["meaning_ar"]
    assert d["words"]["2:255:1"][1:] == [w["gloss_en"], w["spaced"], w["pattern"]]  # type: ignore[index]
    assert d["meanings_from"]["id"] == "kfgqpc-muyassar-gharib"
    assert client.get("/api/v1/surahs/115/interlinear").status_code == 404
