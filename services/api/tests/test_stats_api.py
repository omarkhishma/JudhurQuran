"""The Quran in numbers (P16, law L4): every number the statistics serve is recounted here from the content tables by
SQL of the test's own, and the association measures are recomputed from their definitions — none is typed in."""

from __future__ import annotations

import math

from fastapi.testclient import TestClient
from jadhr_api.concordance import _FUNCTION_TAGS
from jadhr_api.db import connect, rows
from jadhr_api.main import app

client = TestClient(app)


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def q(sql: str, **params: object) -> list[dict]:
    with connect() as conn:
        return rows(conn, sql, params)


def test_the_overview_is_the_tables_counts() -> None:
    o = get("/api/v1/stats/overview")
    assert o["words"] == q("select count(*)::int as n from content.words")[0]["n"]
    assert o["verses"] == q("select count(*)::int as n from content.verses")[0]["n"] == 6236
    assert o["surahs"] == 114
    assert o["roots"] == q("select count(distinct root_id)::int as n from content.words where root_id is not null")[0]["n"]
    hapax = q("select count(*)::int as n from (select lemma_id from content.words where lemma_id is not null group by 1 having count(*) = 1) x")
    assert o["hapax_lemmas"] == hapax[0]["n"]
    longest = q("select v.key, count(*)::int as n from content.words w join content.verses v on v.id = w.verse_id group by v.key order by n desc limit 1")[0]
    assert o["longest_verse"] == {"key": longest["key"], "words": longest["n"]}
    assert o["place"]["meccan"]["surahs"] + o["place"]["medinan"]["surahs"] == 114
    assert "unit" in o["method"] and o["method"]["counted"]


def test_frequency_is_a_group_by_of_the_words() -> None:
    f = get("/api/v1/stats/frequency", kind="root", limit=10)
    want = q(
        """select r.key, count(*)::int as n from content.words w join content.roots r on r.id = w.root_id
           where not (w.pos = any(:tags)) group by r.key order by n desc, r.key limit 10""",
        tags=sorted(_FUNCTION_TAGS),
    )
    assert [(i["key"], i["count"]) for i in f["items"]][:5] == [(w["key"], w["n"]) for w in want][:5]
    total = q("select count(*)::int as n from content.words where not (pos = any(:tags))", tags=sorted(_FUNCTION_TAGS))[0]["n"]
    assert f["total_words"] == total and f["items"][0]["share"] == round(f["items"][0]["count"] / total, 5)
    medinan = get("/api/v1/stats/frequency", kind="lemma", place="medinan", content=False, limit=3)
    want = q(
        """select l.slug, count(*)::int as n from content.words w join content.lemmas l on l.id = w.lemma_id
           join content.surahs s on s.number = w.surah where s.revelation_place = 'medinan' group by l.slug order by n desc limit 3""",
    )
    assert [(i["slug"], i["count"]) for i in medinan["items"]] == [(w["slug"], w["n"]) for w in want]
    assert client.get("/api/v1/stats/frequency", params={"kind": "verse"}).status_code == 422


def test_a_roots_distribution_counts_each_of_its_words_once() -> None:
    d = get("/api/v1/stats/distribution", root="علم")
    by = {r["surah"]: r["n"] for r in q("select w.surah, count(*)::int as n from content.words w join content.roots r on r.id = w.root_id where r.key = 'علم' group by w.surah")}
    assert d["total"] == sum(by.values()) == sum(d["pages"]) == sum(d["juz"])
    assert {s["surah"]: s["count"] for s in d["surahs"] if s["count"]} == by
    assert len(d["pages"]) == 604 and len(d["surahs"]) == 114
    assert client.get("/api/v1/stats/distribution", params={"root": "ززز"}).status_code == 404


def test_collocations_are_the_shared_verses_and_their_measures() -> None:
    c = get("/api/v1/stats/collocations", root="علم", limit=5)
    top = c["items"][0]
    shared = q(
        """select count(distinct a.verse_id)::int as n from content.words a join content.roots ra on ra.id = a.root_id
           join content.words b on b.verse_id = a.verse_id join content.roots rb on rb.id = b.root_id
           where ra.key = 'علم' and rb.key = :k""",
        k=top["key"],
    )[0]["n"]
    assert top["verses"] == shared
    v1 = q("select count(distinct verse_id)::int as n from content.words w join content.roots r on r.id = w.root_id where r.key = 'علم'")[0]["n"]
    v2 = q("select count(distinct verse_id)::int as n from content.words w join content.roots r on r.id = w.root_id where r.key = :k", k=top["key"])[0]["n"]
    assert c["verses"] == v1 and top["verses_of_root"] == v2
    assert top["pmi"] == round(math.log2(shared * 6236 / (v1 * v2)), 3)
    assert all(i["verses"] >= c["min_shared"] for i in c["items"])
    assert [i["g2"] for i in c["items"]] == sorted((i["g2"] for i in c["items"]), reverse=True)


def test_the_sūras_similarity_is_symmetric_and_ordered() -> None:
    s = get("/api/v1/stats/similarity")
    assert sorted(s["order"]) == list(range(1, 115))
    m = s["matrix"]
    assert all(m[i][j] == m[j][i] for i in range(114) for j in range(114))
    assert all(m[i][i] == 1.0 for i in range(114))
    assert all(0 <= x <= 1 for row in m for x in row)


def test_a_sūras_own_roots_occur_in_no_other() -> None:
    d = get("/api/v1/stats/surahs/112")
    own = {r["key"] for r in d["unique_roots"]}
    want = {
        r["key"]
        for r in q(
            """select r.key from content.words w join content.roots r on r.id = w.root_id group by r.key
               having bool_and(w.surah = 112)""",
        )
    }
    assert own == want
    assert d["words"] == q("select count(*)::int as n from content.words where surah = 112")[0]["n"]
    assert len(d["neighbours"]) == 6 and all(n["surah"] != 112 for n in d["neighbours"])
    assert client.get("/api/v1/stats/surahs/115").status_code == 404


def test_the_network_keeps_only_reported_associations() -> None:
    n = get("/api/v1/stats/network", top=40, per_node=3)
    keys = {x["key"] for x in n["nodes"]}
    assert len(keys) == 40
    assert n["edges"] and all(e["a"] in keys and e["b"] in keys and e["verses"] >= 3 and e["pmi"] > 0 for e in n["edges"])


def test_rank_frequency_sums_to_every_word_with_a_lemma() -> None:
    r = get("/api/v1/stats/rank-frequency")
    assert sum(r["counts"]) == q("select count(*)::int as n from content.words where lemma_id is not null")[0]["n"]
    assert r["counts"] == sorted(r["counts"], reverse=True) and r["cumulative"][-1] == 1.0
