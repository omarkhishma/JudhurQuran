"""The classroom (P9.1a, research 16): classes made by instructors; joining by a link, having been told what the
instructor sees and agreeing to it; a member's detail shown only by their choice, never in a class for minors;
lessons as verse ranges and roots, checked against the mushaf; a lesson as a file with nothing of any learner; the
open lessons a member's reader counts for; leaving and removal taking what the class held; the export."""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from jadhr_api import accounts, contrib
from jadhr_api.classroom import CONSENT_VERSION
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
    """An instructor and two readers, each signed in and named."""
    tag = uuid.uuid4().hex[:8]
    out: dict[str, dict[str, str]] = {}
    emails = {}
    for who in ("t", "a", "b"):
        emails[who] = f"class-{who}-{tag}@example.org"
        out[who] = _sign_in(emails[who])
        client.patch("/api/v1/me", headers=out[who], json={"display_name": f"{who}-{tag}"})
    contrib.grant(None, emails["t"], "instructor", "test")
    yield out
    with accounts.tx() as conn:
        for e in emails.values():
            accounts.q(conn, "delete from accounts.users where email = :e returning id", {"e": e})
            accounts.q(conn, "delete from accounts.login_tokens where email = :e returning email", {"e": e})


def _code(r) -> str:
    return r.json()["error"]["code"]


def _class(t: dict[str, str], name: str = "حلقة الفجر", minors: bool = False) -> dict:
    r = client.post("/api/v1/classroom/classes", headers=t, json={"name": name, "minors": minors})
    assert r.status_code == 201, r.text
    return r.json()


def _join(h: dict[str, str], code: str, detail: bool = False):
    return client.post(
        f"/api/v1/classroom/join/{code}",
        headers=h,
        json={"consent": CONSENT_VERSION, "detail_opt_in": detail},
    )


def test_a_class_is_made_by_an_instructor_and_joined_by_consent(people: dict[str, dict[str, str]]) -> None:
    t, a, b = people["t"], people["a"], people["b"]
    # a reader without the role is told, not given a class
    r = client.post("/api/v1/classroom/classes", headers=a, json={"name": "x"})
    assert r.status_code == 403 and _code(r) == "not_instructor"
    assert client.get("/api/v1/classroom/classes", headers=a).json()["can_teach"] is False
    c = _class(t)
    assert len(c["join_code"]) == 10 and c["role"] == "instructor" and c["members"] == 0
    # before joining: the class, its instructor, the wording's version, the floor
    pre = client.get(f"/api/v1/classroom/join/{c['join_code']}", headers=a).json()
    assert pre["class"]["name"] == "حلقة الفجر" and pre["instructor"]["name"].startswith("t-")
    assert pre["consent_version"] == CONSENT_VERSION and pre["floor"] == 5 and pre["already"] is None
    # joining without agreeing is refused; the instructor cannot join their own class
    r = client.post(f"/api/v1/classroom/join/{c['join_code']}", headers=a, json={"consent": "old"})
    assert r.status_code == 422 and _code(r) == "consent"
    assert _code(_join(t, c["join_code"])) == "own_class"
    joined = _join(a, c["join_code"])
    assert joined.status_code == 201 and joined.json()["me"]["detail_opt_in"] is False
    assert _join(b, c["join_code"], detail=True).json()["me"]["detail_opt_in"] is True
    # the instructor's roster: who joined, and who chose to show their detail
    roster = client.get(f"/api/v1/classroom/classes/{c['id']}", headers=t).json()["roster"]
    assert [(m["name"][:2], m["detail_opt_in"]) for m in roster] == [("a-", False), ("b-", True)]
    # a member sees no roster and no join link; a reader outside the class sees nothing
    seen = client.get(f"/api/v1/classroom/classes/{c['id']}", headers=a).json()
    assert "roster" not in seen and "join_code" not in seen and seen["role"] == "member"
    out = _sign_in(f"class-x-{uuid.uuid4().hex[:6]}@example.org")
    assert client.get(f"/api/v1/classroom/classes/{c['id']}", headers=out).status_code == 404
    # the member's choice, theirs to change
    assert (
        client.patch(
            f"/api/v1/classroom/classes/{c['id']}/membership", headers=a, json={"detail_opt_in": True}
        ).json()["me"]["detail_opt_in"]
        is True
    )
    # a class for minors shows no one's detail, whatever they chose
    client.patch(f"/api/v1/classroom/classes/{c['id']}", headers=t, json={"minors": True})
    roster = client.get(f"/api/v1/classroom/classes/{c['id']}", headers=t).json()["roster"]
    assert [m["detail_opt_in"] for m in roster] == [False, False]
    # a new link: the old one opens nothing
    fresh = client.post(f"/api/v1/classroom/classes/{c['id']}/code", headers=t).json()["join_code"]
    assert (
        fresh != c["join_code"]
        and client.get(f"/api/v1/classroom/join/{c['join_code']}", headers=out).status_code == 404
    )
    assert client.get("/api/v1/classroom/classes", headers=a).json()["learning"][0]["id"] == c["id"]


def test_lessons_are_verse_ranges_and_roots_and_travel_as_a_file(people: dict[str, dict[str, str]]) -> None:
    t, a = people["t"], people["a"]
    c = _class(t)
    _join(a, c["join_code"])
    base = f"/api/v1/classroom/classes/{c['id']}/lessons"
    bad = client.post(base, headers=t, json={"title": "x", "ranges": [{"surah": 1, "from": 1, "to": 8}]})
    assert bad.status_code == 422 and _code(bad) == "bad_ranges"
    bad = client.post(
        base, headers=t, json={"title": "x", "ranges": [{"surah": 1, "from": 1, "to": 7}], "roots": ["ززز"]}
    )
    assert _code(bad) == "unknown_root"
    assert (
        client.post(
            base, headers=a, json={"title": "x", "ranges": [{"surah": 1, "from": 1, "to": 7}]}
        ).status_code
        == 403
    )
    due = (datetime.now(UTC) + timedelta(days=7)).date().isoformat()
    lesson = client.post(
        base,
        headers=t,
        json={
            "title": "الفاتحة",
            "ranges": [{"surah": 1, "from": 1, "to": 7}, {"surah": 2, "from": 1, "to": 5}],
            "roots": ["حمد", "رحم"],
            "due": due,
        },
    ).json()
    assert (
        lesson["verses"] == 12
        and [r["spaced"] for r in lesson["roots"]] == ["ح م د", "ر ح م"]
        and lesson["open"]
    )
    # the member sees it with their own progress; their reader counts for its verses until it closes
    mine = client.get(f"/api/v1/classroom/lessons/{lesson['id']}", headers=a).json()
    assert mine["mine"] == {"opened_on": None, "finished_on": None, "minutes": 0, "nudged": False}
    act = client.get("/api/v1/classroom/me/active", headers=a).json()["data"]
    assert [x["id"] for x in act] == [lesson["id"]] and act[0]["ranges"][1] == {
        "surah": 2,
        "from": 1,
        "to": 5,
    }
    # the file: verses, roots, the instructor's notes — nothing of any learner
    pack = client.get(f"/api/v1/classroom/lessons/{lesson['id']}/pack", headers=a).json()
    assert (
        pack["format"] == "jadhr-lesson-pack"
        and pack["verses"][:2] == ["1:1", "1:2"]
        and len(pack["verses"]) == 12
    )
    assert set(pack) == {
        "format",
        "version",
        "title",
        "class",
        "instructor",
        "ranges",
        "verses",
        "roots",
        "notes",
        "due_at",
        "exported_at",
    }
    # a lesson long past its due date no longer counts
    with accounts.tx() as conn:
        accounts.q(
            conn,
            "update classroom.lessons set due_at = now() - interval '20 days' where id = :l returning id",
            {"l": lesson["id"]},
        )
    assert client.get("/api/v1/classroom/me/active", headers=a).json()["data"] == []
    # changed and removed by the instructor only
    assert (
        client.patch(f"/api/v1/classroom/lessons/{lesson['id']}", headers=t, json={"due": None}).json()[
            "due_at"
        ]
        is None
    )
    assert client.delete(f"/api/v1/classroom/lessons/{lesson['id']}", headers=a).status_code == 403
    assert client.delete(f"/api/v1/classroom/lessons/{lesson['id']}", headers=t).status_code == 204


def test_leaving_takes_what_the_class_held_and_the_export_holds_it_meanwhile(
    people: dict[str, dict[str, str]],
) -> None:
    t, a, b = people["t"], people["a"], people["b"]
    c = _class(t)
    _join(a, c["join_code"])
    _join(b, c["join_code"])
    lesson = client.post(
        f"/api/v1/classroom/classes/{c['id']}/lessons",
        headers=t,
        json={"title": "ل", "ranges": [{"surah": 1, "from": 1, "to": 7}]},
    ).json()
    uid = {k: client.get("/api/v1/me", headers=h).json()["id"] for k, h in (("a", a), ("b", b))}
    with accounts.tx() as conn:
        for who in ("a", "b"):
            accounts.q(
                conn,
                """insert into classroom.counts (lesson_id, user_id, location, kind, day, n)
                   values (:l, :u, '1:2:3', 'lookup', current_date, 2) returning n""",
                {"l": lesson["id"], "u": uid[who]},
            )
            accounts.q(
                conn,
                "insert into classroom.progress (lesson_id, user_id, opened_on) values (:l, :u, current_date) returning minutes",
                {"l": lesson["id"], "u": uid[who]},
            )
    out = client.get("/api/v1/me/export", headers=a).json()["classroom"]
    assert out["joined"][0]["consent_version"] == CONSENT_VERSION and out["counts"][0]["location"] == "1:2:3"
    taught = client.get("/api/v1/me/export", headers=t).json()["classroom"]["teaching"]
    assert taught[0]["lessons"][0]["ranges"] == [{"surah": 1, "from": 1, "to": 7}]

    def held(u: str) -> int:
        with accounts.tx() as conn:
            return sum(
                accounts.q1(
                    conn, f"select count(*)::int as n from classroom.{t} where user_id = :u", {"u": u}
                )["n"]  # type: ignore[index]
                for t in ("counts", "progress", "members")
            )

    assert held(uid["a"]) == 3
    assert client.delete(f"/api/v1/classroom/classes/{c['id']}/membership", headers=a).status_code == 204
    assert held(uid["a"]) == 0
    assert (
        client.delete(f"/api/v1/classroom/classes/{c['id']}/members/{uid['b']}", headers=t).status_code == 204
    )
    assert held(uid["b"]) == 0
    assert client.get(f"/api/v1/classroom/classes/{c['id']}", headers=t).json()["members"] == 0


def test_a_members_reader_sends_counts_only_for_an_open_lessons_verses(
    people: dict[str, dict[str, str]],
) -> None:
    """P9.2a: counts per word's place, kind and day, kept only inside the lesson's verses, only from a member, only
    while the lesson is open, only for today; progress opened, finished by the member's word, minutes added."""
    t, a, b = people["t"], people["a"], people["b"]
    c = _class(t)
    _join(a, c["join_code"])
    lesson = client.post(
        f"/api/v1/classroom/classes/{c['id']}/lessons",
        headers=t,
        json={"title": "ل", "ranges": [{"surah": 1, "from": 2, "to": 4}]},
    ).json()
    today = datetime.now(UTC).date().isoformat()
    url = f"/api/v1/classroom/lessons/{lesson['id']}"
    sent = client.post(
        f"{url}/counts",
        headers=a,
        json={
            "day": today,
            "items": [
                {"location": "1:2:3", "kind": "lookup", "n": 2},
                {"location": "1:2:3", "kind": "lookup"},
                {"location": "1:3:0", "kind": "note"},
                {"location": "1:5:1", "kind": "lookup"},  # outside the lesson: not kept
                {"location": "1:2:3", "kind": "time"},  # no such kind
            ],
        },
    ).json()
    assert sent == {"kept": 4, "refused": 2}
    client.post(
        f"{url}/counts", headers=a, json={"day": today, "items": [{"location": "1:2:3", "kind": "lookup"}]}
    )
    with accounts.tx() as conn:
        rows = accounts.q(
            conn,
            "select location, kind, n from classroom.counts where lesson_id = :l order by location, kind",
            {"l": lesson["id"]},
        )
    assert rows == [
        {"location": "1:2:3", "kind": "lookup", "n": 4},
        {"location": "1:3:0", "kind": "note", "n": 1},
    ]
    # not a member, the instructor, another day, a closed lesson: refused, nothing kept
    assert (
        client.post(
            f"{url}/counts",
            headers=b,
            json={"day": today, "items": [{"location": "1:2:3", "kind": "lookup"}]},
        ).status_code
        == 404
    )
    assert (
        _code(
            client.post(
                f"{url}/counts",
                headers=t,
                json={"day": today, "items": [{"location": "1:2:3", "kind": "lookup"}]},
            )
        )
        == "not_member"
    )
    old = (datetime.now(UTC) - timedelta(days=3)).date().isoformat()
    assert (
        _code(
            client.post(
                f"{url}/counts",
                headers=a,
                json={"day": old, "items": [{"location": "1:2:3", "kind": "lookup"}]},
            )
        )
        == "bad_day"
    )
    # progress: opened today, minutes added, finished and unfinished by the member's word
    p = client.post(f"{url}/progress", headers=a, json={"day": today, "minutes": 3}).json()
    assert (p["opened_on"], p["minutes"], p["finished_on"]) == (today, 3, None)
    p = client.post(f"{url}/progress", headers=a, json={"day": today, "minutes": 2, "finished": True}).json()
    assert (p["minutes"], p["finished_on"]) == (5, today)
    assert (
        client.post(f"{url}/progress", headers=a, json={"day": today, "finished": False}).json()[
            "finished_on"
        ]
        is None
    )
    assert (
        _code(client.post(f"{url}/progress", headers=a, json={"day": today, "minutes": 90})) == "bad_minutes"
    )
    with accounts.tx() as conn:
        accounts.q(
            conn,
            "update classroom.lessons set due_at = now() - interval '15 days' where id = :l returning id",
            {"l": lesson["id"]},
        )
    assert (
        _code(
            client.post(
                f"{url}/counts",
                headers=a,
                json={"day": today, "items": [{"location": "1:2:3", "kind": "lookup"}]},
            )
        )
        == "closed"
    )
