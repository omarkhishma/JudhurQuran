"""The narrators (P11.2b): search by name, a profile that is Ibn Ḥajar's entry with what is read from it and his own
definitions beside it, the records each is linked in, and a hadith's text told into its parts with its narrators."""

from __future__ import annotations

from collections import defaultdict

from fastapi.testclient import TestClient
from jadhr_api.db import connect, rows
from jadhr_api.main import app
from jadhr_api.narrators import SIGLA
from jadhr_api.texts import mark, segments

client = TestClient(app)


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def _zuhri() -> dict:
    found = get("/api/v1/narrators", q="الزهري")["data"]
    # the most linked bearer of the nisba first among those that hold it: Ibn Shihāb
    return get(f"/api/v1/narrators/{max(found, key=lambda x: x['links'])['id']}")


def test_search_finds_a_narrator_by_the_name_a_chain_gives() -> None:
    found = get("/api/v1/narrators", q="سفيان", limit=5)["data"]
    assert found and all(x["name"].startswith("سفيان") for x in found)
    assert max(found, key=lambda x: x["links"])["name"].startswith(("سفيان بن عيينة", "سفيان بن سعيد"))
    assert get("/api/v1/narrators", q="xyz")["data"] == []


def test_a_profile_is_his_entry_and_what_his_own_rules_read_from_it() -> None:
    z = _zuhri()
    assert "شهاب" in z["name"] and z["text"].startswith(z["name"])
    # his ṭabaqa, and Ibn Ḥajar's own words for it — which name al-Zuhrī as its example
    assert z["read"]["tabaqa"] == 4 and "كالزهري" in z["read"]["tabaqa_def"]
    # his year by the rule the introduction states, the rule quoted beside it
    assert z["read"]["death_rule"] == "century-by-tabaqa" and z["death_ah"] == 125
    assert "بعد المائة" in z["read"]["death_def"]
    assert all(s["book_ar"] for s in z["sigla"]) and z["source"]["id"] == "openiti-taqrib"
    # whom he narrates from and who from him, as the linked chains show
    assert any(x["name"].startswith("عروة بن الزبير") for x in z["narrates_from"])
    assert any(x["name"].startswith("مالك بن أنس") for x in z["narrated_by"])
    # his records counted per collection, and paged
    total = sum(r["records"] for r in z["records"])
    first = get(f"/api/v1/narrators/{z['id']}/hadith", limit=5)
    assert first["total"] == total > 2000 and len(first["data"]) == 5
    assert all(h["link"]["status"] == "auto" and 0 < h["link"]["confidence"] <= 1 for h in first["data"])
    second = get(f"/api/v1/narrators/{z['id']}/hadith", offset=5, limit=5)
    assert not {h["uri"] for h in first["data"]} & {h["uri"] for h in second["data"]}


def test_the_sigla_are_his_introductions() -> None:
    from jadhr_pipeline.ecosystem.taqrib import SIGLA as listed

    assert listed == SIGLA


def test_a_missing_or_cross_reference_entry_is_not_a_narrator() -> None:
    assert client.get("/api/v1/narrators/999999").status_code == 404
    with connect() as conn:
        see = rows(conn, "select id from content.narrators where kind = 'see' limit 1")[0]["id"]
    assert client.get(f"/api/v1/narrators/{see}").status_code == 404


def test_a_hadith_is_told_into_its_parts_with_its_narrators() -> None:
    p = get("/api/v1/texts/bukhari/passages/1")
    parts = p["parts"]
    assert (
        parts["rule"] == "prophet-speech"
        and parts["status"] == "auto"
        and parts["isnad"][1] == parts["matn"][0]
    )
    assert "".join(s["t"] for s in p["segments"]) == p["ar_full"]
    at = 0
    for s in p["segments"]:
        assert s["p"] == ("matn" if at >= parts["matn"][0] else "isnad"), (at, s)
        at += len(s["t"])
    names = {n["ordinal"]: n for n in p["narrators"]}
    assert names[2]["narrator"]["name"].startswith("سفيان بن عيينة") and names[2]["rule"] == "context"
    assert [s["t"] for s in p["segments"] if s.get("n") == 2] == [names[2]["text"]]
    assert names[6]["narrator"]["name"].startswith("عمر بن الخطاب")


def test_every_hadith_keeps_its_text_when_told_into_parts() -> None:
    with connect() as conn:
        found = rows(
            conn,
            """select p.id, p.ar_full, p.form_ids, p.meta->'split' as split from content.passages p
                 join content.texts t on t.id = p.text_id where t.kind = 'hadith'""",
        )
        links = defaultdict(list)
        for x in rows(conn, "select passage_id, ordinal, span_start, span_end from content.narrator_links"):
            links[x["passage_id"]].append(x)
    for r in found:
        segs, _ = segments(r["ar_full"] or "", r["form_ids"] or [])
        mark(segs, r["split"], links[r["id"]])
        assert "".join(s["t"] for s in segs) == (r["ar_full"] or ""), r["id"]
        if r["split"]:
            assert all(s["p"] in ("isnad", "matn", "comment") for s in segs)
