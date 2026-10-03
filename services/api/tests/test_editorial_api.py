"""The editorial workbench (P3.0, research 14): the board only; a draft in force only once an editor other than its
author approves its revision — refused to the author by the API and by the database; changes asked, revised and
approved; a newer approval retiring the older; candidates only from cited sources; verdicts on extracted rows in
batches; and everything kept apart from the content, read back beside it."""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
import sqlalchemy
from fastapi.testclient import TestClient
from jadhr_api import accounts, contrib, editorial
from jadhr_api.main import app

client = TestClient(app)


def _sign_in(addr: str) -> dict[str, str]:
    client.post("/api/v1/auth/email", json={"email": addr})
    link = client.get("/api/v1/auth/dev/outbox", params={"email": addr}).json()["messages"][-1]["link"]
    r = client.post("/api/v1/auth/verify", json={"token": link.split("token=")[1]})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['session']}"}


@pytest.fixture
def board() -> Iterator[dict[str, dict[str, str]]]:
    """Two editors of the board and a member, each signed in."""
    tag = uuid.uuid4().hex[:8]
    out: dict[str, dict[str, str]] = {}
    emails = {}
    for who, role in (("a", "editor"), ("b", "editor"), ("m", "member")):
        emails[who] = f"editorial-{who}-{tag}@example.org"
        h = _sign_in(emails[who])
        client.patch("/api/v1/me", headers=h, json={"display_name": f"{who}-{tag}"})
        contrib.grant(None, emails[who], role, "test")
        out[who] = h
    yield out
    with accounts.tx() as conn:
        for e in emails.values():
            u = accounts.q1(conn, "select id from accounts.users where email = :e", {"e": e})
            if u:
                accounts.q(
                    conn, "delete from editorial.entries where author_id = :u returning id", {"u": u["id"]}
                )
            accounts.q(conn, "delete from accounts.users where email = :e returning id", {"e": e})
            accounts.q(conn, "delete from accounts.login_tokens where email = :e returning email", {"e": e})


def _uid(h: dict[str, str]) -> str:
    return client.get("/api/v1/me", headers=h).json()["id"]


GLOSS = {"value": {"en": "knowledge; to know"}, "sources": [{"work": "lane", "ref": "ع ل م, 5:2138"}]}


def test_the_workbench_is_the_boards(board: dict[str, dict[str, str]]) -> None:
    assert client.get("/api/v1/editorial/worklists").status_code == 401
    r = client.get("/api/v1/editorial/worklists", headers=board["m"])
    assert r.status_code == 403 and r.json()["error"]["code"] == "not_board"
    assert client.put("/api/v1/editorial/root_gloss/علم", headers=board["m"], json=GLOSS).status_code == 403
    assert client.get("/api/v1/editorial/works", headers=board["m"]).status_code == 403
    w = client.get("/api/v1/editorial/worklists", headers=board["a"]).json()
    kinds = {k["kind"]: k for k in w["kinds"]}
    with accounts.tx() as conn:
        roots = accounts.q1(conn, "select count(*)::int as n from content.roots")
    assert roots and kinds["root_gloss"]["total"] == roots["n"]
    assert {x["layer"] for x in w["layers"]} == set(editorial.LAYERS)


def test_an_entry_comes_into_force_only_by_another_editors_approval(board: dict[str, dict[str, str]]) -> None:
    a, b = board["a"], board["b"]
    # a gloss of meaning names its source
    r = client.put(
        "/api/v1/editorial/root_gloss/علم", headers=a, json={"value": GLOSS["value"], "sources": []}
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "sources_required"
    assert client.put("/api/v1/editorial/root_gloss/no-such-root", headers=a, json=GLOSS).status_code == 404
    draft = client.put("/api/v1/editorial/root_gloss/علم", headers=a, json=GLOSS).json()
    assert draft["status"] == "draft" and draft["revision"] == 1
    # another editor does not write over it
    assert client.put("/api/v1/editorial/root_gloss/علم", headers=b, json=GLOSS).status_code == 409
    eid = draft["id"]
    assert client.post(f"/api/v1/editorial/entries/{eid}/submit", headers=b).status_code == 403
    assert client.post(f"/api/v1/editorial/entries/{eid}/submit", headers=a).json()["status"] == "review"
    # the author never decides on their own work: the API refuses, and so does the database
    r = client.post(f"/api/v1/editorial/entries/{eid}/decide", headers=a, json={"decision": "approve"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "self_review"
    with pytest.raises(sqlalchemy.exc.DBAPIError), accounts.tx() as conn:
        accounts.q(
            conn,
            "insert into editorial.reviews (entry_id, revision, reviewer_id, decision) values (:e, 1, :u, 'approve') returning id",
            {"e": eid, "u": _uid(a)},
        )
    # it waits on the other editor
    assert eid in [x["id"] for x in client.get("/api/v1/editorial/awaiting", headers=b).json()["data"]]
    assert eid not in [x["id"] for x in client.get("/api/v1/editorial/awaiting", headers=a).json()["data"]]
    # changes are asked with a note, the author revises, and the new revision is approved
    assert (
        client.post(
            f"/api/v1/editorial/entries/{eid}/decide", headers=b, json={"decision": "changes"}
        ).status_code
        == 422
    )
    ch = client.post(
        f"/api/v1/editorial/entries/{eid}/decide",
        headers=b,
        json={"decision": "changes", "note": "cite Lane's page"},
    ).json()
    assert ch["status"] == "changes"
    assert editorial.in_force("root_gloss", ["علم"]) == {}
    client.put(
        "/api/v1/editorial/root_gloss/علم", headers=a, json={**GLOSS, "value": {"en": "to know; knowledge"}}
    )
    re = client.post(f"/api/v1/editorial/entries/{eid}/submit", headers=a).json()
    assert re["status"] == "review" and re["revision"] == 2
    ok = client.post(
        f"/api/v1/editorial/entries/{eid}/decide", headers=b, json={"decision": "approve"}
    ).json()
    assert ok["status"] == "approved"
    force = editorial.in_force("root_gloss", ["علم"])["علم"]
    assert force["value"] == {"en": "to know; knowledge"} and force["approved_by"] and force["by"]
    # one approval of a revision per editor: deciding again is refused
    assert (
        client.post(
            f"/api/v1/editorial/entries/{eid}/decide", headers=b, json={"decision": "approve"}
        ).status_code
        == 409
    )
    # the target's page: in force, the decisions and the history
    page = client.get("/api/v1/editorial/root_gloss/علم", headers=b).json()
    assert page["in_force"]["value"] == {"en": "to know; knowledge"} and page["open"] is None
    assert [h["action"] for h in page["history"]][:4] == ["approved", "submitted", "saved", "changes"]
    # a newer approval retires the older
    n2 = client.put(
        "/api/v1/editorial/root_gloss/علم", headers=b, json={**GLOSS, "value": {"en": "knowing, knowledge"}}
    ).json()
    client.post(f"/api/v1/editorial/entries/{n2['id']}/submit", headers=b)
    client.post(f"/api/v1/editorial/entries/{n2['id']}/decide", headers=a, json={"decision": "approve"})
    assert editorial.in_force("root_gloss", ["علم"])["علم"]["value"] == {"en": "knowing, knowledge"}
    with accounts.tx() as conn:
        older = accounts.q1(conn, "select status from editorial.entries where id = :e", {"e": eid})
    assert older and older["status"] == "retired"


def test_candidates_come_from_the_sources_only(board: dict[str, dict[str, str]]) -> None:
    a = board["a"]
    root = client.get("/api/v1/editorial/root_gloss/علم", headers=a).json()["candidates"]
    assert root["word_glosses"] and all(w["gloss_en"] for w in root["word_glosses"])
    assert root["core"]["ar"] and root["core"]["source"]["work_id"] == "maqayis"
    assert root["maqayis"]["body"]
    lemma = client.get("/api/v1/editorial/sense_list/ilm", headers=a).json()
    assert lemma["target"]["key"] == "ilm"
    assert lemma["candidates"]["mufradat"] or lemma["candidates"]["muyassar"]
    pattern = client.get("/api/v1/editorial/pattern_function/fa3l", headers=a).json()
    assert "rows" in pattern["candidates"]["classical"]
    # a sense list: every sense names its source
    bad = {"value": {"senses": [{"ar": "إدراك الشيء بحقيقته", "sources": []}]}, "sources": []}
    assert client.put("/api/v1/editorial/sense_list/ilm", headers=a, json=bad).status_code == 422


def test_verdicts_on_extracted_rows_in_batches(board: dict[str, dict[str, str]]) -> None:
    a, b = board["a"], board["b"]
    rows = client.get(
        "/api/v1/editorial/verdict", headers=a, params={"layer": "pattern_functions", "limit": 3}
    ).json()["data"]
    assert len(rows) == 3 and all(r["key"].startswith("pattern_functions:") for r in rows)
    ids = [r["key"].split(":", 1)[1] for r in rows]
    # a rejection says why; a correction gives the correction
    bad = client.post(
        "/api/v1/editorial/verdicts",
        headers=a,
        json={"layer": "pattern_functions", "items": [{"row": ids[0], "verdict": "rejected"}]},
    )
    assert bad.status_code == 422
    made = client.post(
        "/api/v1/editorial/verdicts",
        headers=a,
        json={
            "layer": "pattern_functions",
            "submit": True,
            "items": [
                {"row": ids[0], "verdict": "reviewed"},
                {
                    "row": ids[1],
                    "verdict": "corrected",
                    "note": "the example belongs to the next pattern",
                    "correction": "فَعْل",
                },
                {"row": ids[2], "verdict": "rejected", "note": "a heading, not a statement"},
            ],
        },
    ).json()["data"]
    assert [m["status"] for m in made] == ["review"] * 3
    decided = client.post(
        "/api/v1/editorial/decide", headers=b, json={"ids": [m["id"] for m in made], "decision": "approve"}
    ).json()["data"]
    assert [d["status"] for d in decided] == ["approved"] * 3
    v = editorial.verdicts("pattern_functions", ids)
    assert {k: x["value"]["verdict"] for k, x in v.items()} == {
        ids[0]: "reviewed",
        ids[1]: "corrected",
        ids[2]: "rejected",
    }
    # the worklist says so
    approved = client.get(
        "/api/v1/editorial/verdict",
        headers=a,
        params={"layer": "pattern_functions", "state": "approved", "limit": 200},
    ).json()
    assert {r["key"] for r in approved["data"]} >= {f"pattern_functions:{i}" for i in ids}
    assert client.get("/api/v1/editorial/verdict/pattern_functions:no-such-row", headers=a).status_code == 404


def _approve(
    board_: dict[str, dict[str, str]], kind: str, target: str, value: dict, sources: list | None = None
) -> None:
    a, b = board_["a"], board_["b"]
    e = client.put(
        f"/api/v1/editorial/{kind}/{target}", headers=a, json={"value": value, "sources": sources or []}
    )
    assert e.status_code == 200, e.text
    client.post(f"/api/v1/editorial/entries/{e.json()['id']}/submit", headers=a)
    r = client.post(
        f"/api/v1/editorial/entries/{e.json()['id']}/decide", headers=b, json={"decision": "approve"}
    )
    assert r.json()["status"] == "approved", r.text


def test_what_is_in_force_is_read_beside_the_content(board: dict[str, dict[str, str]]) -> None:
    """P3.0c: the reader is served the board's root gloss, pattern function and plain words, sense list and glossary
    body beside the sources, and its verdicts on the books' rows — a rejected row left out."""
    src = [{"work": "lane", "ref": "5:2138"}]
    held = client.get("/api/v1/words/ilm", params={"limit": 0}).headers["etag"]
    _approve(board, "root_gloss", "علم", {"en": "knowing, knowledge"}, src)
    # a copy a reader already holds is not answered "not modified" once the board has put something in force
    fresh = client.get("/api/v1/words/ilm", params={"limit": 0}, headers={"If-None-Match": held})
    assert fresh.status_code == 200 and fresh.headers["etag"] != held
    word = client.get("/api/v1/words/ilm", params={"limit": 0}).json()
    # the cited work by its title in the sources registry, so the reader names the book, not an id
    lane = {**src[0], "title_ar": "معجم لين العربي الإنجليزي", "title_en": "An Arabic-English Lexicon"}
    assert word["root"]["gloss_en"] == "knowing, knowledge" and word["root"]["gloss_board"]["sources"] == [
        lane
    ]
    assert client.get("/api/v1/roots/علم").json()["gloss_en"] == "knowing, knowledge"
    assert client.get("/api/v1/roots/علم/family").json()["root"]["gloss_en"] == "knowing, knowledge"
    # a sense list in place of "not yet assembled", each sense with its sources
    senses = {
        "senses": [{"ar": "إدراك الشيء بحقيقته", "en": "", "sources": [{"work": "mufradat", "ref": "580"}]}]
    }
    _approve(board, "sense_list", "ilm", senses)
    word = client.get("/api/v1/words/ilm", params={"limit": 0}).json()
    assert word["senses_status"] == "linked" and word["senses"][0]["text_ar"] == "إدراك الشيء بحقيقته"
    assert (
        word["senses"][0]["sources"][0]["title_ar"] == "المفردات في غريب القرآن"
        and word["senses_board"]["approved_at"]
    )
    # a pattern's function, quoted, and its plain explanation in the board's words
    _approve(
        board,
        "pattern_function",
        "fa3l",
        {"ar": "مصدر الثلاثي", "en": "", "rows": []},
        [{"work": "shafiya", "ref": "1/151"}],
    )
    _approve(board, "pattern_plain", "fa3l", {"ar": "", "en": "a verbal noun of a three-letter verb"})
    pat = client.get("/api/v1/patterns/fa3l").json()
    assert pat["function_ar"] == "مصدر الثلاثي" and pat["function_board"]["sources"][0]["work"] == "shafiya"
    assert pat["plain_en"] == "a verbal noun of a three-letter verb" and pat["plain_board"]
    # a verdict on a book's row: reviewed, corrected or rejected — a rejected row is left out
    rows = pat["classical"]["rows"]
    if len(rows) >= 2:
        keep, drop = rows[0]["id"], rows[1]["id"]
        _approve(board, "verdict", f"pattern_functions:{keep}", {"verdict": "reviewed"})
        _approve(board, "verdict", f"pattern_functions:{drop}", {"verdict": "rejected", "note": "a heading"})
        after = client.get("/api/v1/patterns/fa3l").json()["classical"]["rows"]
        ids = [r["id"] for r in after]
        assert keep in ids and drop not in ids
        assert next(r for r in after if r["id"] == keep)["review"]["verdict"] == "reviewed"
    # a work the registry does not know keeps its id alone; the editors are offered the ones it knows
    _approve(board, "root_gloss", "علم", {"en": "knowing"}, [{"work": "no-such-work", "ref": "1"}])
    word = client.get("/api/v1/words/ilm", params={"limit": 0}).json()
    assert word["root"]["gloss_board"]["sources"] == [{"work": "no-such-work", "ref": "1"}]
    works = {w["id"]: w for w in client.get("/api/v1/editorial/works", headers=board["a"]).json()["data"]}
    assert (
        works["lane"]["title_en"] == "An Arabic-English Lexicon"
        and "kfgqpc-muyassar-gharib" in works
        and "qac-wbw" in works
    )
    # the glossary's reviewed body
    key = client.get("/api/v1/glossary").json()["terms"][0]["key"]
    _approve(board, "glossary", key, {"body_ar": "شرح راجعته الهيئة", "body_en": ""})
    term = next(t for t in client.get("/api/v1/glossary").json()["terms"] if t["key"] == key)
    assert term["body_ar"] == "شرح راجعته الهيئة" and term["reviewed_at"]
