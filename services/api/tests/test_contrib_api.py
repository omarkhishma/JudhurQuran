"""Contribution and moderation (P7, D4; RVQ, RDR §23): proposals that never touch the Quranic text, a queue anyone
can read, two distinct approvals of which one the board's to merge, no self-approve and no double-approve in the
API and in the database, sources required for wording, changes requested and resubmitted, revert, the changelog,
the earned reviewer role, and what deleting an account leaves."""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
import sqlalchemy
from fastapi.testclient import TestClient
from jadhr_api import accounts, contrib
from jadhr_api.db import connect, one
from jadhr_api.main import app

client = TestClient(app)


def _sign_in(addr: str) -> dict[str, str]:
    client.post("/api/v1/auth/email", json={"email": addr})
    link = client.get("/api/v1/auth/dev/outbox", params={"email": addr}).json()["messages"][-1]["link"]
    r = client.post("/api/v1/auth/verify", json={"token": link.split("token=")[1]})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['session']}"}


@pytest.fixture
def people() -> Iterator[dict[str, dict[str, str]]]:
    """A proposer, two reviewers and an editor, each with a session and a chosen name."""
    tag = uuid.uuid4().hex[:8]
    out: dict[str, dict[str, str]] = {}
    emails = {}
    for who, role in (("proposer", "member"), ("r1", "reviewer"), ("r2", "reviewer"), ("editor", "editor")):
        emails[who] = f"contrib-{who}-{tag}@example.org"
        h = _sign_in(emails[who])
        client.patch("/api/v1/me", headers=h, json={"display_name": f"{who}-{tag}"})
        contrib.grant(None, emails[who], role, "test")
        out[who] = h
    yield out
    with accounts.tx() as conn:
        for e in emails.values():
            u = accounts.q1(conn, "select id from accounts.users where email = :e", {"e": e})
            if u:
                # the test's own rows, merges and their changelog first
                mine = "select id from contributions.proposals where proposer_id = :u"
                accounts.q(
                    conn,
                    f"delete from contributions.changelog where merge_id in (select id from contributions.merges where proposal_id in ({mine})) returning id",
                    {"u": u["id"]},
                )
                accounts.q(
                    conn,
                    f"delete from contributions.merges where proposal_id in ({mine}) returning id",
                    {"u": u["id"]},
                )
                accounts.q(
                    conn,
                    "delete from contributions.proposals where proposer_id = :u returning id",
                    {"u": u["id"]},
                )
            accounts.q(conn, "delete from accounts.users where email = :e returning id", {"e": e})
            accounts.q(conn, "delete from accounts.login_tokens where email = :e returning email", {"e": e})


def _place(slug: str) -> str:
    with connect() as conn:
        w = one(
            conn,
            "select w.location from content.words w join content.lemmas l on l.id = w.lemma_id where l.slug = :s order by w.id limit 1",
            {"s": slug},
        )
    assert w is not None
    return w["location"]


# a gloss at a word's place: the corpus gloss there is the current text
GLOSS = {
    "kind": "gloss",
    "lemma": "ilm",
    "location": _place("ilm"),
    "text": "knowledge (of a thing as it is)",
    "why": "al-Rāghib, Mufradāt s.v. ع ل م",
    "sources": [{"work": "mufradat", "ref": "ع ل م"}],
}


def test_proposing_needs_an_account_names_a_real_target_and_never_the_quranic_text(
    people: dict[str, dict[str, str]],
) -> None:
    h = people["proposer"]
    assert client.post("/api/v1/proposals", json=GLOSS).status_code == 401
    r = client.post("/api/v1/proposals", headers=h, json=GLOSS)
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["status"] == "open" and p["has_source"] and p["current_text"] and p["proposer"]["mine"]
    assert p["sources"][0]["title_ar"]  # the lexicon named as the reader knows it
    # the same proposal sent again (a draft from a second device) is the same proposal
    assert client.post("/api/v1/proposals", headers=h, json=GLOSS).json()["id"] == p["id"]
    bad = [
        {**GLOSS, "lemma": "no-such-word"},  # not in the lexicon
        {**GLOSS, "kind": "edit"},  # an edit names its sense
        {**GLOSS, "kind": "edit", "sense_ordinal": 99},  # no such sense
        {**GLOSS, "text": p["current_text"]},  # the same wording
        {**GLOSS, "sources": [{"work": "nowhere"}]},
        {**GLOSS, "sources": [{"work": "quran", "ref": "the throne verse"}]},
        {**GLOSS, "kind": "morphology", "location": _place("ilm"), "field": "gNothing"},
        {**GLOSS, "location": _place("kitab")},  # that place holds another word
        {**GLOSS, "kind": "verse-text"},  # the Quranic text is never a target
    ]
    for b in bad:
        assert client.post("/api/v1/proposals", headers=h, json=b).status_code == 422, b


def test_the_queue_is_public_and_two_approvals_one_the_boards_merge_into_the_changelog(
    people: dict[str, dict[str, str]],
) -> None:
    p = client.post("/api/v1/proposals", headers=people["proposer"], json=GLOSS).json()
    pid = p["id"]
    # anyone reads the queue; only a signed-in reader has a "mine"
    anon = client.get("/api/v1/proposals", params={"filter": "open"}).json()
    assert any(x["id"] == pid for x in anon["data"]) and anon["viewer"] is None
    assert client.get("/api/v1/proposals", params={"filter": "mine"}).status_code == 401
    # members do not decide; nor does a proposer on their own proposal — in the API and in the database
    assert (
        client.post(
            f"/api/v1/proposals/{pid}/decisions", headers=people["proposer"], json={"decision": "approve"}
        ).status_code
        == 403
    )
    with pytest.raises(sqlalchemy.exc.DBAPIError), accounts.tx() as conn:
        conn.execute(
            sqlalchemy.text(
                """insert into contributions.decisions (proposal_id, revision, reviewer_id, reviewer_role, decision)
                   select id, 1, proposer_id, 'reviewer', 'approve' from contributions.proposals where id = cast(:id as uuid)"""
            ),
            {"id": pid},
        )
    one_ = client.post(
        f"/api/v1/proposals/{pid}/decisions",
        headers=people["r1"],
        json={"decision": "approve", "note": "matches al-Rāghib"},
    )
    assert one_.json()["status"] == "open" and one_.json()["approvals"] == 1 and one_.json()["approved_by_me"]
    # no double-approve: 409 from the API, and the database refuses the row too
    assert (
        client.post(
            f"/api/v1/proposals/{pid}/decisions", headers=people["r1"], json={"decision": "approve"}
        ).status_code
        == 409
    )
    with pytest.raises(sqlalchemy.exc.IntegrityError), accounts.tx() as conn:
        conn.execute(
            sqlalchemy.text(
                """insert into contributions.decisions (proposal_id, revision, reviewer_id, reviewer_role, decision)
                   select proposal_id, revision, reviewer_id, reviewer_role, decision from contributions.decisions
                   where proposal_id = cast(:id as uuid) and decision = 'approve'"""
            ),
            {"id": pid},
        )
    # two reviewers without the board: approved, waiting for an editor
    two = client.post(
        f"/api/v1/proposals/{pid}/decisions", headers=people["r2"], json={"decision": "approve"}
    ).json()
    assert two["status"] == "approved" and two["approvals"] == 2
    merged = client.post(
        f"/api/v1/proposals/{pid}/decisions", headers=people["editor"], json={"decision": "approve"}
    ).json()
    assert merged["status"] == "merged" and merged["merge"] and not merged["can"]["approve"]
    # the reader sees it beside the source, credited; the changelog has it
    words = client.get("/api/v1/lemmas/ilm/contributions").json()["data"]
    m = next(x for x in words if x["proposal_id"] == pid)
    assert (
        m["text"] == GLOSS["text"]
        and m["previous_text"] == p["current_text"]
        and m["contributor"].startswith("proposer-")
    )
    assert len(m["reviewers"]) == 3 and any(r["board"] for r in m["reviewers"])
    assert m["sources"][0]["title_ar"]  # the lexicon by its name, never its id (RVQ-78)
    log = client.get("/api/v1/changelog").json()["data"]
    assert log[0]["event"] == "merged" and log[0]["merge"]["proposal_id"] == pid
    assert (
        client.post(
            f"/api/v1/proposals/{pid}/decisions", headers=people["r1"], json={"decision": "decline"}
        ).status_code
        == 409
    )
    # the board takes it back; the history stays and the changelog says so
    assert (
        client.post(f"/api/v1/merges/{m['id']}/revert", headers=people["r1"], json={"note": "x"}).status_code
        == 403
    )
    back = client.post(
        f"/api/v1/merges/{m['id']}/revert",
        headers=people["editor"],
        json={"note": "the gloss belongs to the place, not the lemma"},
    )
    assert back.status_code == 200 and back.json()["merge"]["reverted_at"]
    assert all(x["proposal_id"] != pid for x in client.get("/api/v1/lemmas/ilm/contributions").json()["data"])
    assert client.get("/api/v1/changelog").json()["data"][0]["event"] == "reverted"


def test_wording_needs_a_source_to_be_approved_and_changes_requested_come_back_as_a_new_revision(
    people: dict[str, dict[str, str]],
) -> None:
    p = client.post(
        "/api/v1/proposals",
        headers=people["proposer"],
        json={
            "kind": "sense",
            "lemma": "ilm",
            "text": "the human microcosm",
            "why": "Sufi usage",
            "sources": [],
        },
    ).json()
    pid = p["id"]
    assert not p["has_source"]
    r = client.post(
        f"/api/v1/proposals/{pid}/decisions", headers=people["editor"], json={"decision": "approve"}
    )
    assert r.status_code == 422
    ch = client.post(
        f"/api/v1/proposals/{pid}/decisions",
        headers=people["editor"],
        json={"decision": "changes", "note": "cite a source"},
    ).json()
    assert ch["status"] == "changes" and ch["note"] == "cite a source"
    assert (
        client.post(
            f"/api/v1/proposals/{pid}/revise", headers=people["r1"], json={"text": "x", "why": "y"}
        ).status_code
        == 409
    )
    rev = client.post(
        f"/api/v1/proposals/{pid}/revise",
        headers=people["proposer"],
        json={
            "text": "the knowing of a thing as it is",
            "why": "Lisān s.v.",
            "sources": [{"work": "lisan", "ref": "ع ل م"}],
        },
    ).json()
    assert rev["status"] == "open" and rev["revision"] == 2 and rev["approvals"] == 0 and rev["has_source"]
    # a new sense, merged, is numbered after the sourced senses
    for who in ("r1", "editor"):
        client.post(f"/api/v1/proposals/{pid}/decisions", headers=people[who], json={"decision": "approve"})
    m = next(
        x for x in client.get("/api/v1/lemmas/ilm/contributions").json()["data"] if x["proposal_id"] == pid
    )
    assert m["kind"] == "sense" and m["sense_ordinal"] >= 1
    # withdrawing and reporting
    q = client.post("/api/v1/proposals", headers=people["proposer"], json=GLOSS).json()
    assert client.post(
        f"/api/v1/proposals/{q['id']}/report", headers=people["r2"], json={"reason": "spam"}
    ).json() == {"reported": True}
    assert client.post(f"/api/v1/proposals/{q['id']}/withdraw", headers=people["r2"]).status_code == 409
    assert (
        client.post(f"/api/v1/proposals/{q['id']}/withdraw", headers=people["proposer"]).json()["status"]
        == "withdrawn"
    )
    mine = client.get("/api/v1/me/proposals", headers=people["proposer"]).json()["data"]
    assert {x["status"] for x in mine} >= {"merged", "withdrawn"}


def test_the_board_is_appointed_the_reviewer_role_is_earned_and_a_blocked_account_does_nothing(
    people: dict[str, dict[str, str]], monkeypatch: pytest.MonkeyPatch
) -> None:
    me = client.get("/api/v1/me", headers=people["proposer"]).json()
    assert (
        client.post(
            "/api/v1/admin/roles", headers=people["editor"], json={"email": me["email"], "role": "editor"}
        ).status_code
        == 403
    )
    monkeypatch.setattr(contrib, "REVIEWER_AFTER", 1)
    p = client.post("/api/v1/proposals", headers=people["proposer"], json=GLOSS).json()
    for who in ("r1", "editor"):
        client.post(
            f"/api/v1/proposals/{p['id']}/decisions", headers=people[who], json={"decision": "approve"}
        )
    assert client.get("/api/v1/me", headers=people["proposer"]).json()["role"] == "reviewer"
    with accounts.tx() as conn:
        accounts.q(
            conn,
            "update accounts.users set blocked_at = now() where email = :e returning id",
            {"e": me["email"]},
        )
    assert client.post("/api/v1/proposals", headers=people["proposer"], json=GLOSS).status_code == 403
    monkeypatch.setattr(contrib, "PER_DAY", 0)
    assert client.post("/api/v1/proposals", headers=people["r1"], json=GLOSS).status_code == 429


def test_deleting_an_account_removes_its_unmerged_proposals_and_every_name_and_keeps_what_was_merged(
    people: dict[str, dict[str, str]],
) -> None:
    merged = client.post("/api/v1/proposals", headers=people["proposer"], json=GLOSS).json()
    for who in ("r1", "editor"):
        client.post(
            f"/api/v1/proposals/{merged['id']}/decisions", headers=people[who], json={"decision": "approve"}
        )
    open_ = client.post(
        "/api/v1/proposals", headers=people["proposer"], json={**GLOSS, "text": "another wording"}
    ).json()
    for who in ("proposer", "r1"):
        token = client.post("/api/v1/me/delete", headers=people[who]).json()["confirm"]
        assert (
            client.post("/api/v1/me/delete/confirm", headers=people[who], json={"confirm": token}).status_code
            == 200
        )
    assert client.get(f"/api/v1/proposals/{open_['id']}").status_code == 404
    m = next(
        x
        for x in client.get("/api/v1/lemmas/ilm/contributions").json()["data"]
        if x["proposal_id"] == merged["id"]
    )
    assert m["contributor"] is None and m["former"] is True
    assert [r["name"] for r in m["reviewers"]].count(
        None
    ) == 1  # the deleted reviewer's name is gone, the editor's stays
    with accounts.tx() as conn:  # the merge kept by design, removed from the test database
        accounts.q(
            conn,
            "delete from contributions.changelog where merge_id = cast(:m as uuid) returning id",
            {"m": m["id"]},
        )
        accounts.q(
            conn, "delete from contributions.merges where id = cast(:m as uuid) returning id", {"m": m["id"]}
        )
        accounts.q(
            conn,
            "delete from contributions.proposals where id = cast(:p as uuid) returning id",
            {"p": merged["id"]},
        )


def _approve(pid: str, people: dict[str, dict[str, str]], *who: str) -> dict:
    out: dict = {}
    for w in who:
        out = client.post(
            f"/api/v1/proposals/{pid}/decisions", headers=people[w], json={"decision": "approve"}
        ).json()
    return out


def test_a_reverted_merge_counts_as_merged_nowhere(
    people: dict[str, dict[str, str]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Audit 12 F5: taken back, a merge leaves the Merged filter and its count, is counted with the settled ones,
    and no longer counts towards the merges that earn the reviewer role."""
    p = client.post("/api/v1/proposals", headers=people["proposer"], json=GLOSS).json()
    merged = _approve(p["id"], people, "r1", "editor")
    before = client.get("/api/v1/proposals", params={"filter": "merged"}).json()["counts"]["merged"]
    back = client.post(
        f"/api/v1/merges/{merged['merge']['id']}/revert", headers=people["editor"], json={"note": "x"}
    ).json()
    assert back["status"] == "reverted"
    q = client.get("/api/v1/proposals", params={"filter": "merged"}).json()
    assert q["counts"]["merged"] == before - 1 and all(x["id"] != p["id"] for x in q["data"])
    assert any(
        x["id"] == p["id"]
        for x in client.get("/api/v1/proposals", params={"filter": "declined"}).json()["data"]
    )
    mine = client.get("/api/v1/me/proposals", headers=people["proposer"]).json()["data"]
    assert next(x for x in mine if x["id"] == p["id"])["status"] == "reverted"
    # another merge with the threshold at one: the reverted one does not count towards it
    monkeypatch.setattr(contrib, "REVIEWER_AFTER", 2)
    q2 = client.post(
        "/api/v1/proposals", headers=people["proposer"], json={**GLOSS, "text": "knowing"}
    ).json()
    _approve(q2["id"], people, "r1", "editor")
    assert client.get("/api/v1/me", headers=people["proposer"]).json()["role"] == "member"


def test_the_before_of_every_kind_is_read_from_the_dataset_not_the_request(
    people: dict[str, dict[str, str]],
) -> None:
    """Audit 12 F7 and F13: a morphology correction's and an error report's "before" come from the dataset."""
    h = people["proposer"]
    m = client.post(
        "/api/v1/proposals",
        headers=h,
        json={**GLOSS, "kind": "morphology", "field": "gCase", "current_text": "made up", "text": "مرفوع"},
    ).json()
    with connect() as conn:
        case = one(
            conn,
            "select features->'case'->>'ar' as ar from content.words where location = :l",
            {"l": GLOSS["location"]},
        )
    assert m["current_text"] == (case["ar"] if case else "") and m["current_text"] != "made up"
    e = client.post(
        "/api/v1/proposals",
        headers=h,
        json={
            "kind": "error",
            "lemma": "ilm",
            "current_text": "عِلْم — knowledge",
            "text": "x",
            "why": "y",
            "sources": [],
        },
    ).json()
    assert e["current_text"] and "knowledge" not in e["current_text"]


def test_malformed_ids_and_cursors_answer_the_error_envelope_with_a_code() -> None:
    """Audit 12 F26 and F19: never a bare 500, and every refusal names its reason for the reader's language."""
    for path in ("/api/v1/proposals/not-a-uuid", "/api/v1/proposals?filter=open&before=garbage"):
        r = client.get(path)
        assert r.status_code in (404, 422), path
        assert r.json()["error"]["code"] in ("not_found", "bad_cursor"), path
    assert (
        client.get("/api/v1/changelog", params={"since": "garbage"}).json()["error"]["code"] == "bad_cursor"
    )


def test_a_lexicon_counts_as_a_source_only_with_its_entry_and_a_verse_may_be_typed_in_arabic_digits(
    people: dict[str, dict[str, str]],
) -> None:
    """Audit 12 F9, F18; RVQ-Q05."""
    h = people["proposer"]
    p = client.post(
        "/api/v1/proposals",
        headers=h,
        json={**GLOSS, "text": "a title alone", "sources": [{"work": "lisan", "ref": ""}]},
    ).json()
    assert not p["has_source"]
    r = client.post(
        f"/api/v1/proposals/{p['id']}/decisions", headers=people["editor"], json={"decision": "approve"}
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "needs_source"
    v = client.post(
        "/api/v1/proposals",
        headers=h,
        json={**GLOSS, "text": "by a verse", "sources": [{"work": "quran", "ref": "٢:٣٢"}]},
    ).json()
    assert v["has_source"] and v["sources"][0]["ref"] == "2:32"


def test_a_third_reviewer_is_not_offered_an_approval_that_changes_nothing(
    people: dict[str, dict[str, str]],
) -> None:
    """Audit 12 F22: approved by two reviewers, it waits for the board."""
    p = client.post("/api/v1/proposals", headers=people["proposer"], json={**GLOSS, "text": "third"}).json()
    _approve(p["id"], people, "r1", "r2")
    tag = uuid.uuid4().hex[:6]
    h3 = _sign_in(f"contrib-r3-{tag}@example.org")
    contrib.grant(None, f"contrib-r3-{tag}@example.org", "reviewer", "test")
    try:
        d = client.get(f"/api/v1/proposals/{p['id']}", headers=h3).json()
        assert d["status"] == "approved" and d["waiting_board"] and not d["can"]["approve"]
        r = client.post(f"/api/v1/proposals/{p['id']}/decisions", headers=h3, json={"decision": "approve"})
        assert r.status_code == 409 and r.json()["error"]["code"] == "waiting_board"
    finally:
        with accounts.tx() as conn:
            accounts.q(
                conn,
                "delete from accounts.users where email = :e returning id",
                {"e": f"contrib-r3-{tag}@example.org"},
            )


def test_reports_reach_the_board_and_an_administrator_blocks_from_a_proposal(
    people: dict[str, dict[str, str]],
) -> None:
    """Audit 12 F4; RVQ-74: the board reads and resolves reports; no one reports their own proposal; an
    administrator blocks an account from a proposal of theirs, and a blocked account can do nothing, reporting
    included."""
    p = client.post(
        "/api/v1/proposals", headers=people["proposer"], json={**GLOSS, "text": "reported"}
    ).json()
    own = client.post(f"/api/v1/proposals/{p['id']}/report", headers=people["proposer"], json={"reason": "x"})
    assert own.status_code == 403 and own.json()["error"]["code"] == "own_proposal"
    client.post(f"/api/v1/proposals/{p['id']}/report", headers=people["r2"], json={"reason": "spam"})
    assert client.get(f"/api/v1/proposals/{p['id']}", headers=people["r1"]).json()["reports"] == []
    board = client.get(f"/api/v1/proposals/{p['id']}", headers=people["editor"]).json()
    rep = board["reports"][0]
    assert rep["reason"] == "spam" and rep["resolved_at"] is None
    assert any(
        x["proposal"]["id"] == p["id"]
        for x in client.get("/api/v1/reports", headers=people["editor"]).json()["data"]
    )
    assert client.get("/api/v1/reports", headers=people["r1"]).status_code == 403
    done = client.post(
        f"/api/v1/reports/{rep['id']}/resolve",
        headers=people["editor"],
        json={"outcome": "acted", "note": "declined"},
    ).json()
    assert done["reports"][0]["outcome"] == "acted"
    # an administrator, from the proposal
    tag = uuid.uuid4().hex[:6]
    admin = f"contrib-admin-{tag}@example.org"
    ha = _sign_in(admin)
    contrib.grant(None, admin, "admin", "test")
    try:
        assert client.get(f"/api/v1/proposals/{p['id']}", headers=ha).json()["can"]["block"]
        assert (
            client.post("/api/v1/admin/block", headers=people["editor"], json={"target": p["id"]}).status_code
            == 403
        )
        assert client.post(
            "/api/v1/admin/block", headers=ha, json={"target": p["id"], "reason": "spam"}
        ).json() == {"blocked": True}
        for path, body in (
            ("/api/v1/proposals", GLOSS),
            (f"/api/v1/proposals/{p['id']}/report", {"reason": "x"}),
        ):
            r = client.post(path, headers=people["proposer"], json=body)
            assert r.status_code == 403 and r.json()["error"]["code"] == "blocked", path
        assert client.post(
            "/api/v1/admin/block", headers=ha, json={"target": p["id"], "blocked": False}
        ).json() == {"blocked": False}
    finally:
        with accounts.tx() as conn:
            accounts.q(conn, "delete from accounts.users where email = :e returning id", {"e": admin})


def test_credit_names_follow_the_account_and_names_cannot_pass_for_the_board(
    people: dict[str, dict[str, str]],
) -> None:
    """Audit 12 F14, F16: a name changed or cleared reaches every merged credit; the board's title and direction
    controls are refused or removed."""
    p = client.post(
        "/api/v1/proposals", headers=people["proposer"], json={**GLOSS, "text": "credited"}
    ).json()
    _approve(p["id"], people, "r1", "editor")

    def credit() -> dict:
        return next(
            x
            for x in client.get("/api/v1/lemmas/ilm/contributions").json()["data"]
            if x["proposal_id"] == p["id"]
        )

    client.patch("/api/v1/me", headers=people["proposer"], json={"display_name": "اسم جديد"})
    assert credit()["contributor"] == "اسم جديد"
    client.patch("/api/v1/me", headers=people["proposer"], json={"display_name": ""})
    assert credit()["contributor"] is None and credit()["former"] is False
    for name in ("هيئة التحرير", "Editorial Board", "admin"):
        r = client.patch("/api/v1/me", headers=people["proposer"], json={"display_name": name})
        assert r.status_code == 422 and r.json()["error"]["code"] == "name_reserved", name
    rlo = client.patch("/api/v1/me", headers=people["proposer"], json={"display_name": "a‮b"}).json()
    assert rlo["display_name"] == "ab"


def test_the_account_export_holds_its_contributions(people: dict[str, dict[str, str]]) -> None:
    """Audit 12 F15: proposals, decisions taken, reports sent, role grants and merges credited."""
    p = client.post(
        "/api/v1/proposals", headers=people["proposer"], json={**GLOSS, "text": "exported"}
    ).json()
    _approve(p["id"], people, "r1")
    mine = client.get("/api/v1/me/export", headers=people["proposer"]).json()["contributions"]
    assert any(x["id"] == p["id"] for x in mine["proposals"])
    theirs = client.get("/api/v1/me/export", headers=people["r1"]).json()["contributions"]
    assert any(x["proposal_id"] == p["id"] and x["decision"] == "approve" for x in theirs["decisions"])
    assert any(g["role"] == "reviewer" for g in theirs["role_grants"])


def test_a_correction_to_a_layer_the_build_made_goes_through_the_same_queue(
    people: dict[str, dict[str, str]],
) -> None:
    """B58 (RVQ-Q11): a hadith's split, a name in its isnād, a dictionary article's filing and a book paragraph's page
    are corrected through the same two approvals, their items named by their own addresses; what they hold now is
    read here; once merged a correction stands beside what the build made, which stays as it was."""
    h = people["proposer"]
    split = {
        "kind": "correction",
        "lemma": "hadith:bukhari:1",
        "field": "split",
        "text": "يبدأ المتن عند «إنما الأعمال بالنيات»",
        "why": "التقسيم الآلي أدخل في الإسناد كلمة من المتن",
    }
    p = client.post("/api/v1/proposals", headers=h, json=split)
    assert p.status_code == 201, p.text
    p = p.json()
    assert p["lemma_ar"] == "صحيح البخاري، الحديث ١" and p["target_href"] == "/hadith/bukhari/1"
    assert "\n—\n" in p["current_text"]  # the isnād and the matn as the build split them
    narrator = client.post(
        "/api/v1/proposals",
        headers=h,
        json={**split, "field": "narrator", "location": "2", "text": "سفيان الثوري", "why": "تمييز سفيان"},
    ).json()
    assert narrator["current_text"].startswith("سُفْيَانُ ← سفيان بن عيينة")
    with connect() as conn:
        article = one(
            conn, "select uri, dict_roots from content.lexicon_entries where uri like 'dict:lisan:%' limit 1"
        )
        para = one(
            conn,
            "select p.uri from content.passages p join content.texts t on t.id = p.text_id where t.kind = 'book' limit 1",
        )
    filing = client.post(
        "/api/v1/proposals",
        headers=h,
        json={
            "kind": "correction",
            "lemma": article["uri"],
            "field": "filing",
            "text": "علم",
            "why": "الأصل",
        },  # type: ignore[index]
    ).json()
    assert filing["current_text"] == " · ".join(article["dict_roots"])  # type: ignore[index]
    assert filing["target_href"].startswith("/dictionary/") and filing["target_href"].endswith(article["uri"])  # type: ignore[index]
    page = client.post(
        "/api/v1/proposals",
        headers=h,
        json={"kind": "correction", "lemma": para["uri"], "field": "page", "text": "1/50", "why": "الصفحة"},  # type: ignore[index]
    ).json()
    assert page["target_href"].startswith("/books/") and "/p/" in page["target_href"]
    for bad in (
        {**split, "field": "filing"},  # a hadith has no filing
        {**split, "field": "nothing"},
        {**split, "lemma": "hadith:bukhari:999999"},
        {**split, "field": "narrator", "location": "99"},
        {**split, "lemma": "quran:2:255"},  # never the Quranic text
    ):
        assert client.post("/api/v1/proposals", headers=h, json=bad).status_code == 422, bad
    # two reviewers and the board: in force beside the build's split
    for who in ("r1", "r2", "editor"):
        client.post(
            f"/api/v1/proposals/{p['id']}/decisions", headers=people[who], json={"decision": "approve"}
        )
    shown = client.get("/api/v1/corrections", params={"target": "hadith:bukhari:1"}).json()
    mine = [m for m in shown["data"] if m["proposal_id"] == p["id"]]
    assert len(mine) == 1 and mine[0]["text"] == split["text"] and mine[0]["field"] == "split"
    assert (
        shown["label"] == "صحيح البخاري، الحديث ١" and shown["waiting"] >= 1
    )  # the narrator one still waits
    assert client.get("/api/v1/corrections", params={"target": "quran:1:1"}).status_code == 422
