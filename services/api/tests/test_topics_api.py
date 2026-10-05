"""Topics (P8.3, research 06 Part 3, D29): Quranpedia's Arabic tree served with its credit and version; QSAC's model-made
tags never served to readers; a topic with its chain, sub-topics and verses in the mushaf's order; a verse's topics;
coverage per sūra; the board's verdict on a link marking it, or leaving it out."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api import accounts
from jadhr_api.main import app
from test_editorial_api import _approve, board  # noqa: F401  (the two-editor fixture)

client = TestClient(app)


def _q(sql: str, args: dict | None = None) -> list[dict]:
    with accounts.tx() as conn:
        return accounts.q(conn, sql, args or {})


def test_the_tree_is_quranpedias_credited_with_its_version() -> None:
    top = client.get("/api/v1/topics", params={"limit": 5}).json()
    n_top = _q(
        "select count(*)::int as n from content.topics where source_id = 'quranpedia-topics' and parent_id is null"
    )[0]["n"]
    assert top["total"] == n_top == 1516
    assert [x["verses"] for x in top["data"]] == sorted((x["verses"] for x in top["data"]), reverse=True)
    credit = top["sources"]["quranpedia-topics"]
    assert credit["version"] == "2026-10-03" and "quranpedia.net" in credit["attribution_en"].lower()
    # QSAC's tags are the board's: not in a search, not by id
    assert client.get("/api/v1/topics", params={"q": "tawheed"}).json()["total"] == 0
    assert client.get("/api/v1/topics/qsac:aqeedah-islamic-creed").status_code == 404
    # a search folds the Arabic as every search does
    found = client.get("/api/v1/topics", params={"q": "الصلاه"}).json()
    assert found["total"] > 0 and all("صلا" in x["name"] for x in found["data"])


def test_a_topic_and_a_verses_topics() -> None:
    t = client.get("/api/v1/topics/qp:29").json()
    links = _q("select verse_key from content.topic_links where topic_id = 'qp:29'")
    assert t["total"] == len(links) == t["verses"]
    keys = [x["verse_key"] for x in t["data"]]
    assert keys == sorted(keys, key=lambda k: tuple(int(p) for p in k.split(":")))
    assert t["sources"]["quranpedia-topics"]["version"] == "2026-10-03"
    # a sub-topic's chain runs from the top down
    child = _q(
        "select id, parent_id from content.topics where level = 2 and source_id = 'quranpedia-topics' limit 1"
    )[0]
    c = client.get(f"/api/v1/topics/{child['id']}").json()
    assert c["chain"][-1]["id"] == child["parent_id"] and c["chain"][0]["level"] == 0
    parent = client.get(f"/api/v1/topics/{child['parent_id']}").json()
    assert child["id"] in [s["id"] for s in parent["subtopics"]]
    v = client.get("/api/v1/verses/2:255/topics").json()
    assert "الحي القيوم" in [x["name"] for x in v["data"]] and v["sources"]["quranpedia-topics"]
    assert client.get("/api/v1/verses/2:999/topics").json()["data"] == []
    assert client.get("/api/v1/topics/qp:0").status_code == 404


def test_coverage_says_where_the_topics_stop() -> None:
    c = client.get("/api/v1/topics/coverage").json()
    assert (c["covered"], c["verses"]) == (3673, 6236)
    by = {r["surah"]: r for r in c["surahs"]}
    assert by[2]["covered"] == 280 and by[40]["covered"] == 0
    assert sum(r["covered"] for r in c["surahs"] if r["surah"] >= 40) == 4


def test_the_boards_verdict_on_a_link(board: dict[str, dict[str, str]]) -> None:  # noqa: F811
    link = _q(
        "select l.id, l.topic_id from content.topic_links l join content.topics t on t.id = l.topic_id where l.verse_key = '2:255' and t.name_ar = 'الحي القيوم'"
    )[0]
    other = _q(
        "select id, topic_id, verse_key from content.topic_links where topic_id = :t and verse_key <> '2:255' limit 1",
        {"t": link["topic_id"]},
    )[0]
    before = client.get(f"/api/v1/topics/{link['topic_id']}").json()["total"]
    _approve(board, "verdict", f"topic_links:{link['id']}", {"verdict": "rejected", "note": "test"})
    assert "الحي القيوم" not in [x["name"] for x in client.get("/api/v1/verses/2:255/topics").json()["data"]]
    assert client.get(f"/api/v1/topics/{link['topic_id']}").json()["total"] == before - 1
    _approve(board, "verdict", f"topic_links:{other['id']}", {"verdict": "reviewed"})
    marked = [
        x
        for x in client.get(f"/api/v1/verses/{other['verse_key']}/topics").json()["data"]
        if x["id"] == other["topic_id"]
    ]
    assert marked and marked[0]["review"]["verdict"] == "reviewed"
    # the workbench lists the layer with the topic's name and the verse
    rows = client.get(
        "/api/v1/editorial/verdict",
        headers=board["a"],
        params={"layer": "topic_links", "state": "approved", "limit": 200},
    ).json()["data"]
    assert {f"topic_links:{link['id']}", f"topic_links:{other['id']}"} <= {r["key"] for r in rows}


# ─── P8.3b: the taxonomy the board builds, QSAC's suggestions placed, proper names ─────────────────────────────


def _put(h: dict[str, str], kind: str, target: str, value: dict, sources: list | None = None):
    return client.put(
        f"/api/v1/editorial/{kind}/{target}", headers=h, json={"value": value, "sources": sources or []}
    )


LB3 = [{"work": "labeaume", "ref": "chapitre 3, p. 62"}]


def test_la_beaumes_chapters_are_the_boards_to_adopt_and_quranpedias_topics_to_place(
    board: dict[str, dict[str, str]],  # noqa: F811
) -> None:
    a = board["a"]
    # held back until the board adopts them: not at the top, not by id, not in a search
    assert client.get("/api/v1/topics/lb:3").status_code == 404
    assert client.get("/api/v1/topics", params={"q": "Prédication"}).json()["total"] == 0
    # adopting one needs an Arabic name and a source
    assert _put(a, "topic", "lb:3", {"name_ar": "", "under": ""}, LB3).json()["error"]["code"] == "empty"
    assert (
        _put(a, "topic", "lb:3", {"name_ar": "الدعوة (تجربة)", "under": ""}).json()["error"]["code"]
        == "sources_required"
    )
    _approve(board, "topic", "lb:3", {"name_ar": "الدعوة (تجربة)", "name_en": "Preaching", "under": ""}, LB3)
    top = client.get("/api/v1/topics", params={"limit": 3}).json()
    assert top["total"] == 1517 and top["data"][0]["id"] == "lb:3"
    lb = top["data"][0]
    assert (lb["name"], lb["name_en"], lb["after"]["title_fr"], lb["board"]["named"]) == (
        "الدعوة (تجربة)",
        "Preaching",
        "Prédication",
        True,
    )
    assert "labeaume" in top["sources"] and "1878" in top["sources"]["labeaume"]["attribution_en"]
    # found now, by the board's name and by the book's
    for q in ("الدعوه", "Prédication"):
        assert "lb:3" in [x["id"] for x in client.get("/api/v1/topics", params={"q": q}).json()["data"]]
    # a Quranpedia root placed under it leaves the top and stands beneath it, its own topics with it
    _approve(board, "topic", "qp:1", {"name_ar": "", "under": "lb:3"})
    assert client.get("/api/v1/topics", params={"limit": 1}).json()["total"] == 1516
    assert "qp:1" in [s["id"] for s in client.get("/api/v1/topics/lb:3").json()["subtopics"]]
    leaf = client.get("/api/v1/topics/qp:3").json()
    assert [c["id"] for c in leaf["chain"]] == ["lb:3", "qp:1"] and leaf["level"] == 2
    # never under itself or under a topic beneath it
    assert (
        _put(a, "topic", "lb:3", {"name_ar": "الدعوة (تجربة)", "under": "qp:3"}, LB3).json()["error"]["code"]
        == "topic_cycle"
    )
    assert (
        _put(a, "topic", "qp:3", {"name_ar": "", "under": "qp:404404"}).json()["error"]["code"]
        == "unknown_topic"
    )
    # renamed: the board's name served, the source's kept beside it and still found
    _approve(board, "topic", "qp:3", {"name_ar": "الرحيم (اسم مجرب)", "under": ""})
    t = client.get("/api/v1/topics/qp:3").json()
    assert (t["name"], t["source_name"], t["board"]["named"]) == ("الرحيم (اسم مجرب)", "الرحيم", True)
    assert "qp:3" in [x["id"] for x in client.get("/api/v1/topics", params={"q": "اسم مجرب"}).json()["data"]]
    # a topic of the board's own, on its source, under the chapter
    _approve(board, "topic", "board:t3st0001", {"name_ar": "موضوع للتجربة", "under": "lb:3"}, LB3)
    subs = client.get("/api/v1/topics/lb:3").json()["subtopics"]
    assert {"qp:1", "board:t3st0001"} <= {s["id"] for s in subs}
    own = client.get("/api/v1/topics/board:t3st0001").json()
    assert own["source_id"] == "board" and own["chain"][0]["id"] == "lb:3" and own["total"] == 0
    # the workbench's list: the board's own first, then La Beaume's chapters in order, then Quranpedia's
    rows = client.get("/api/v1/editorial/topic", headers=a, params={"state": "all", "limit": 25}).json()[
        "data"
    ]
    assert rows[0]["key"] == "board:t3st0001" and [r["key"] for r in rows[1:19]] == [
        f"lb:{n}" for n in range(1, 19)
    ]
    assert rows[19]["key"].startswith("qp:")
    # found in the workbench by the board's name, which it shows, the book's beside it
    by_name = client.get("/api/v1/editorial/topic", headers=a, params={"q": "الدعوه", "limit": 5}).json()[
        "data"
    ]
    assert (
        by_name[0]["key"] == "lb:3"
        and by_name[0]["label"] == "الدعوة (تجربة)"
        and "Prédication" in by_name[0]["sub"]
    )
    page = client.get("/api/v1/editorial/topic/lb:3", headers=a).json()
    assert page["candidates"]["chapter"] == {
        "work": "labeaume",
        "ref": "chapitre 3, p. 62",
        "title_fr": "Prédication",
    }
    assert {"qp:1", "board:t3st0001"} <= {x["id"] for x in page["candidates"]["placed_here"]}
    works = {w["id"]: w for w in client.get("/api/v1/editorial/works", headers=a).json()["data"]}
    assert "Koran analysé" in works["labeaume"]["title_en"]


def test_a_qsac_tag_is_the_boards_to_place_under_an_arabic_topic(
    board: dict[str, dict[str, str]],  # noqa: F811
) -> None:
    a = board["a"]
    row = _q(
        """select l.id, l.verse_key from content.topic_links l where l.source_id = 'qsac' and l.verse_key = '40:1'
           and not exists (select 1 from content.topic_links p where p.verse_key = l.verse_key
                           and p.source_id = 'quranpedia-topics') limit 1"""
    )[0]
    key = row["verse_key"]
    # the workbench lists it with the verse in the mushaf's text and the tag where QSAC places it
    listed = client.get(
        "/api/v1/editorial/verdict",
        headers=a,
        params={"layer": "topic_candidates", "state": "all", "limit": 1},
    ).json()
    assert listed["total"] == 6041
    # a sūra's suggestions (B43: the coverage strip leads the board to them): «40:» is sūra 40's alone, never 140's or
    # «6:»'s inside «36:»
    for s in (40, 6):
        expected = _q(
            """select count(*) as n from content.topic_links l where l.source_id = 'qsac'
                and split_part(l.verse_key, ':', 1)::int = :s and not exists (select 1 from content.topic_links p
                    where p.verse_key = l.verse_key and p.source_id = 'quranpedia-topics')""",
            {"s": s},
        )[0]["n"]
        got = client.get(
            "/api/v1/editorial/verdict",
            headers=a,
            params={"layer": "topic_candidates", "state": "all", "q": f"{s}:", "limit": 100},
        ).json()
        assert got["total"] == expected and all(r["sub"].startswith(f"{s}:") for r in got["data"])
    near = client.get(
        "/api/v1/editorial/verdict", headers=a, params={"layer": "topic_candidates", "state": "all", "q": key}
    ).json()["data"]
    it = next(r for r in near if r["key"] == f"topic_candidates:{row['id']}")
    text = _q("select text_qpc from content.verses where key = :k", {"k": key})[0]["text_qpc"]
    assert it["topic"]["verse_text"] == text and it["topic"]["verse_key"] == key and it["topic"]["parent_en"]
    # accepted as is, it would serve QSAC's English tag: refused; placed under an Arabic topic, or rejected
    target = f"topic_candidates:{row['id']}"
    assert _put(a, "verdict", target, {"verdict": "reviewed"}).json()["error"]["code"] == "place_or_reject"
    bad = _put(
        a, "verdict", target, {"verdict": "corrected", "ends": {"topic": "qsac:aqeedah-islamic-creed"}}
    )
    assert bad.json()["error"]["code"] == "unknown_topic"
    before = client.get("/api/v1/topics/qp:29").json()["total"]
    assert client.get("/api/v1/topics/coverage").json()["placed"] == 0
    _approve(board, "verdict", target, {"verdict": "corrected", "ends": {"topic": "qp:29"}})
    t = client.get("/api/v1/topics/qp:29", params={"limit": 500}).json()
    assert t["total"] == before + 1 and t["placed"] == 1
    placed = [x for x in t["data"] if x["verse_key"] == key]
    assert placed and placed[0]["source_id"] == "qsac" and placed[0]["review"]["verdict"] == "placed"
    assert "qsac" in t["sources"] and "CC BY 4.0" in t["sources"]["qsac"]["attribution_en"]
    v = client.get(f"/api/v1/verses/{key}/topics").json()
    mine = [x for x in v["data"] if x["id"] == "qp:29"]
    assert mine and mine[0]["via"] == "qsac" and "qsac" in v["sources"]
    c = client.get("/api/v1/topics/coverage").json()
    assert c["placed"] == 1 and {r["surah"]: r for r in c["surahs"]}[40]["placed"] == 1
    # QSAC's own tags are still never served
    assert client.get("/api/v1/topics", params={"q": "tawheed"}).json()["total"] == 0


def test_proper_names_with_the_verses_they_are_named_in(board: dict[str, dict[str, str]]) -> None:  # noqa: F811
    top = client.get("/api/v1/entities", params={"limit": 5}).json()
    assert top["total"] == 107 and [x["occurrences"] for x in top["data"]] == sorted(
        (x["occurrences"] for x in top["data"]), reverse=True
    )
    assert {"qac-proper-nouns", "wikidata"} <= set(top["sources"])
    musa = client.get("/api/v1/entities", params={"q": "موسى"}).json()["data"]
    assert len(musa) == 1 and musa[0]["wikidata"]["id"] == "Q1990155" and musa[0]["status"] == "candidate"
    e = client.get(f"/api/v1/entities/{musa[0]['id']}", params={"limit": 500}).json()
    keys = [x["verse_key"] for x in e["data"]]
    assert e["total"] == len(keys) == musa[0]["verses"] == 131
    assert keys == sorted(keys, key=lambda k: tuple(int(p) for p in k.split(":")))
    assert musa[0]["id"] in [x["id"] for x in client.get("/api/v1/verses/2:51/entities").json()["data"]]
    # a name the board rejected is left out; one it reviewed is said to be reviewed
    pharaoh = client.get("/api/v1/entities", params={"q": "فرعون"}).json()["data"][0]
    _approve(board, "verdict", f"entity_candidates:{pharaoh['id']}", {"verdict": "rejected", "note": "test"})
    assert client.get(f"/api/v1/entities/{pharaoh['id']}").status_code == 404
    assert client.get("/api/v1/entities").json()["total"] == 106
    _approve(board, "verdict", f"entity_candidates:{musa[0]['id']}", {"verdict": "reviewed"})
    assert client.get(f"/api/v1/entities/{musa[0]['id']}").json()["status"] == "reviewed"
