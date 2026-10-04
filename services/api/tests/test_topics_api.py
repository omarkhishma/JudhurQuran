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
