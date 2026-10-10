"""The administration's tools (P14, D31, D32): a sūra's passages, a word's own context and a word's near, related and
opposite words — published directly by an administrator, refused to anyone else and for any other kind by the API and
by the database, reviewed by the board afterwards; a word's context resolved (its own range, else its sūra's passage,
else none with the sources' groupings); a link shown on both of its words. Expectations are read from the database's
own tables, never typed in."""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
import sqlalchemy
from fastapi.testclient import TestClient
from jadhr_api import accounts, contrib
from jadhr_api import board as board_
from jadhr_api.main import app

client = TestClient(app)
E = "/api/v1/editorial"


def _sign_in(addr: str) -> dict[str, str]:
    client.post("/api/v1/auth/email", json={"email": addr})
    link = client.get("/api/v1/auth/dev/outbox", params={"email": addr}).json()["messages"][-1]["link"]
    r = client.post("/api/v1/auth/verify", json={"token": link.split("token=")[1]})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['session']}"}


@pytest.fixture
def people() -> Iterator[dict[str, dict[str, str]]]:
    """An administrator, an editor of the board and a member, each signed in."""
    tag = uuid.uuid4().hex[:8]
    out: dict[str, dict[str, str]] = {}
    emails = {}
    for who, role in (("admin", "admin"), ("editor", "editor"), ("member", "member")):
        emails[who] = f"context-{who}-{tag}@example.org"
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
            accounts.q(
                conn,
                "delete from contributions.role_grants where user_id = (select id from accounts.users where email = :e) returning id",
                {"e": e},
            )
            accounts.q(conn, "delete from accounts.users where email = :e returning id", {"e": e})
            accounts.q(conn, "delete from accounts.login_tokens where email = :e returning email", {"e": e})
    board_.clear()


def _publish(h: dict[str, str], kind: str, target: str, value: dict, sources: list | None = None) -> dict:
    r = client.put(f"{E}/{kind}/{target}", headers=h, json={"value": value, "sources": sources or []})
    assert r.status_code == 200, r.text
    p = client.post(f"{E}/entries/{r.json()['id']}/publish", headers=h)
    assert p.status_code == 200, p.text
    assert p.json()["status"] == "approved"
    return p.json()


def _one(sql: str, **params: object) -> dict:
    with accounts.tx() as conn:
        r = accounts.q1(conn, sql, params)
    assert r is not None
    return r


def test_the_administration_publishes_its_own_kinds_and_no_other(people: dict[str, dict[str, str]]) -> None:
    admin, editor = people["admin"], people["editor"]
    # an editor writes a sūra's passages but does not publish them: they go to the board's two-person review
    d = client.put(
        f"{E}/context_passages/112", headers=editor, json={"value": {"passages": [{"from": 1, "to": 4}]}}
    ).json()
    r = client.post(f"{E}/entries/{d['id']}/publish", headers=editor)
    assert r.status_code == 403 and r.json()["error"]["code"] == "not_admin"
    client.delete(f"{E}/entries/{d['id']}", headers=editor)
    # an administrator does not publish a kind that needs another editor's approval
    g = client.put(
        f"{E}/root_gloss/علم",
        headers=admin,
        json={"value": {"en": "knowledge"}, "sources": [{"work": "lane", "ref": "5:2138"}]},
    ).json()
    r = client.post(f"{E}/entries/{g['id']}/publish", headers=admin)
    assert r.status_code == 409 and r.json()["error"]["code"] == "needs_review"
    # … and the database refuses it too, whatever the API does
    with pytest.raises(sqlalchemy.exc.DBAPIError), accounts.tx() as conn:
        accounts.q(
            conn,
            "update editorial.entries set status = 'approved' where id = :e returning id",
            {"e": g["id"]},
        )
    # an editor's context entry cannot be put in force by an update either: only an administrator's
    e2 = client.put(
        f"{E}/context_passages/113", headers=editor, json={"value": {"passages": [{"from": 1, "to": 5}]}}
    ).json()
    with pytest.raises(sqlalchemy.exc.DBAPIError), accounts.tx() as conn:
        accounts.q(
            conn,
            "update editorial.entries set status = 'approved' where id = :e returning id",
            {"e": e2["id"]},
        )
    # the administration's own: in force at once, said so, and the board's later review said too
    held = client.get("/api/v1/words/112:3:1/context").headers["etag"]
    pub = _publish(
        admin,
        "context_passages",
        "112",
        {"passages": [{"from": 1, "to": 2, "title_ar": "التوحيد"}, {"from": 3, "to": 4}]},
    )
    ctx = client.get("/api/v1/words/112:3:1/context").json()["context"]
    assert (ctx["level"], ctx["from"], ctx["to"], ctx["by"], ctx["reviewed"]) == (
        "passage",
        "112:3",
        "112:4",
        "administration",
        False,
    )
    assert client.get("/api/v1/words/112:3:1/context").headers["etag"] != held
    assert client.post(f"{E}/entries/{pub['id']}/review", headers=admin, json={}).status_code == 403
    assert (
        client.post(f"{E}/entries/{pub['id']}/review", headers=people["member"], json={}).status_code == 403
    )
    assert client.post(f"{E}/entries/{pub['id']}/review", headers=editor, json={}).status_code == 200
    board_.clear()
    assert client.get("/api/v1/words/112:3:1/context").json()["context"]["reviewed"] is True
    assert client.post(f"{E}/entries/{pub['id']}/review", headers=editor, json={}).status_code == 409
    hist = client.get(f"{E}/context_passages/112", headers=editor).json()["history"]
    assert [h["action"] for h in hist][:3] == ["reviewed", "published", "saved"]


def test_a_sūras_passages_and_a_words_range_are_checked_against_the_text(
    people: dict[str, dict[str, str]],
) -> None:
    admin = people["admin"]

    def refused(kind: str, target: str, value: dict, code: str, sources: list | None = None) -> None:
        r = client.put(f"{E}/{kind}/{target}", headers=admin, json={"value": value, "sources": sources or []})
        assert r.status_code == 422 and r.json()["error"]["code"] == code, r.text

    refused(
        "context_passages",
        "112",
        {"passages": [{"from": 1, "to": 3}, {"from": 3, "to": 4}]},
        "passages_overlap",
    )
    refused("context_passages", "112", {"passages": [{"from": 1, "to": 5}]}, "outside_surah")
    refused("context_passages", "112", {"passages": [{"from": 3, "to": 2}]}, "bad_value")
    assert (
        client.put(f"{E}/context_passages/115", headers=admin, json={"value": {"passages": []}}).status_code
        == 404
    )
    refused("context_word", "2:255:1", {"from": "2:256", "to": "2:257"}, "context_without_word")
    refused("context_word", "2:255:1", {"from": "2:1", "to": "3:100"}, "context_too_long")
    refused("context_word", "2:255:1", {"from": "2:255", "to": "2:999"}, "unknown_verse")
    # a statement of the word's meaning here rests on a source (L2); a range alone does not need one
    refused(
        "context_word", "2:255:1", {"from": "2:254", "to": "2:257", "meaning_ar": "…"}, "sources_required"
    )
    assert (
        client.put(
            f"{E}/context_word/9:999:1", headers=admin, json={"value": {"from": "9:1", "to": "9:2"}}
        ).status_code
        == 404
    )


def test_a_words_own_range_overrides_its_passage(people: dict[str, dict[str, str]]) -> None:
    admin = people["admin"]
    _publish(admin, "context_passages", "112", {"passages": [{"from": 1, "to": 4}]})
    _publish(
        admin,
        "context_word",
        "112:2:1",
        {"from": "112:1", "to": "112:2", "meaning_ar": "نص تجريبي", "note_ar": ""},
        [{"work": "muyassar", "ref": "112:2"}],
    )
    own = client.get("/api/v1/words/112:2:1/context").json()
    assert (own["context"]["level"], own["context"]["from"], own["context"]["to"]) == (
        "word",
        "112:1",
        "112:2",
    )
    assert own["context"]["statement"]["meaning_ar"] == "نص تجريبي"
    assert [v["key"] for v in own["verses"]] == ["112:1", "112:2"]
    other = client.get("/api/v1/words/112:4:1/context").json()["context"]
    assert (other["level"], other["from"], other["to"]) == ("passage", "112:1", "112:4")
    # the dashboard counts every word of the sūra once
    ov = client.get(f"{E}/overview", headers=admin).json()
    row = next(s for s in ov["by_surah"] if s["surah"] == 112)
    assert (
        row["words_with_context"]
        == _one("select count(*)::int as n from content.words where surah = 112")["n"]
    )
    assert row["verses_in_passages"] == 4
    assert client.get(f"{E}/overview", headers=people["member"]).status_code == 403


def test_without_a_context_the_sources_groupings_are_shown_and_none_is_called_the_context() -> None:
    out = client.get("/api/v1/words/2:255:3/context")
    assert out.status_code == 200
    body = out.json()
    assert body["context"] is None or body["context"]["by"] in ("administration", "board")
    v = _one("select id, ruku from content.verses where key = '2:255'")
    ruku = _one(
        "select min(id)::int as a, max(id)::int as b from content.verses where ruku = :r", r=v["ruku"]
    )
    spans = {(g["from_id"], g["to_id"]): g for g in body["groupings"]}
    assert (ruku["a"], ruku["b"]) in spans
    assert any(s["kind"] == "ruku" for s in spans[(ruku["a"], ruku["b"])]["sources"])
    with accounts.tx() as conn:
        tafsir = accounts.q(
            conn,
            """select work_id, verse_from, verse_to from content.work_passages where work_id in
               ('saadi', 'baghawi', 'ibn-kathir', 'qurtubi', 'tabari') and verse_from <= :v and verse_to >= :v
               and verse_to > verse_from""",
            {"v": v["id"]},
        )
    for t in tafsir:
        assert t["work_id"] in {s["source"] for s in spans[(t["verse_from"], t["verse_to"])]["sources"]}
    # the word and its root's other words inside what is shown
    assert body["word"]["location"] == "2:255:3"
    assert all(w["location"] != "2:255:3" for w in body["same_root"])
    assert client.get("/api/v1/words/2:255:999/context").status_code == 404


def test_a_words_relations_show_on_both_words(people: dict[str, dict[str, str]]) -> None:
    admin = people["admin"]
    with accounts.tx() as conn:
        words = accounts.q(
            conn,
            "select slug from content.lemmas where root_id is not null order by occurrences desc limit 3",
        )
    a, b, c = (w["slug"] for w in words)

    def refused(value: dict, code: str) -> None:
        r = client.put(f"{E}/word_relations/{a}", headers=admin, json={"value": value})
        assert r.status_code == 422 and r.json()["error"]["code"] == code, r.text

    refused({"links": [{"to": a, "rel": "near"}]}, "self_link")
    refused({"links": [{"to": "no-such-word", "rel": "near"}]}, "unknown_word")
    refused({"links": [{"to": b, "rel": "near"}, {"to": b, "rel": "near"}]}, "duplicate_link")
    refused({"links": [{"to": b, "rel": "synonym"}]}, "bad_value")
    _publish(
        admin,
        "word_relations",
        a,
        {"links": [{"to": b, "rel": "near", "note_ar": "فرق"}, {"to": c, "rel": "opposite"}]},
    )
    here = client.get(f"/api/v1/words/{a}/relations").json()["defined"]
    assert [x["slug"] for x in here["near"]] == [b] and here["near"][0]["defined_on"] == "here"
    assert [x["slug"] for x in here["opposite"]] == [c] and here["related"] == []
    there = client.get(f"/api/v1/words/{b}/relations").json()["defined"]
    assert [x["slug"] for x in there["near"]] == [a] and there["near"][0]["defined_on"] == "there"
    assert there["near"][0]["by"] == "administration" and there["near"][0]["word"]["occurrences"] > 0


def test_roles_are_listed_for_administrators_only(people: dict[str, dict[str, str]]) -> None:
    r = client.get("/api/v1/admin/people", headers=people["editor"])
    assert r.status_code == 403
    listed = client.get("/api/v1/admin/people", headers=people["admin"]).json()["data"]
    roles = {p["role"] for p in listed}
    assert {"admin", "editor"} <= roles and "member" not in roles
    found = client.get(
        "/api/v1/admin/people", headers=people["admin"], params={"q": "context-member"}
    ).json()["data"]
    assert found and all(p["role"] == "member" for p in found if "context-member" in p["email"])
