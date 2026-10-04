"""Published maps (P8.5): a signed-in owner publishes a map under an address of its own that keeps Arabic letters;
anyone reads it; each publish is a version that never changes and is read by its number; the address is never
given to another map, even after its map is withdrawn; forks and citations are counted once per reader; a reader
reports a map and the board withdraws it or dismisses the report; deleting an account withdraws its maps; the
export carries them."""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from jadhr_api import accounts, contrib, published
from jadhr_api.main import app
from sqlalchemy.exc import DBAPIError

client = TestClient(app)


def _sign_in(addr: str) -> dict[str, str]:
    client.post("/api/v1/auth/email", json={"email": addr})
    link = client.get("/api/v1/auth/dev/outbox", params={"email": addr}).json()["messages"][-1]["link"]
    r = client.post("/api/v1/auth/verify", json={"token": link.split("token=")[1]})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['session']}"}


@pytest.fixture
def tag() -> str:
    return uuid.uuid4().hex[:8]


@pytest.fixture
def people(tag: str) -> Iterator[dict[str, dict[str, str]]]:
    """The map's author, a reader and an editor of the board, each signed in with a name."""
    out: dict[str, dict[str, str]] = {}
    emails = {}
    for who in ("a", "r", "e"):
        emails[who] = f"pub-{who}-{tag}@example.org"
        out[who] = _sign_in(emails[who])
        client.patch("/api/v1/me", headers=out[who], json={"display_name": f"{who}-{tag}"})
    contrib.grant(None, emails["e"], "editor", "test")
    yield out
    with accounts.tx() as conn:
        for t in ("published_reports", "withdrawn", "published"):
            accounts.q(conn, f"delete from graphs.{t} where slug like :p returning slug", {"p": f"%{tag}%"})
        accounts.q(conn, "delete from graphs.slugs where slug like :p returning slug", {"p": f"%{tag}%"})
        for e in emails.values():
            accounts.q(conn, "delete from accounts.users where email = :e returning id", {"e": e})
            accounts.q(conn, "delete from accounts.login_tokens where email = :e returning email", {"e": e})


def _vowelled(letters: str) -> str:
    """Letters with a fatha after each, made from its code point (a typed mark is never trusted)."""
    return "".join(c + chr(0x064E) for c in letters)


def _doc(roots: int = 1, words: int = 2) -> dict:
    nodes = [
        {"id": f"root:r{i}", "position": {"x": 0, "y": i * 300}, "data": {"kind": "root", "ar": "ع ل م"}}
        for i in range(roots)
    ]
    nodes += [
        {"id": f"lemma:w{i}", "position": {"x": 400, "y": i * 300}, "data": {"kind": "lemma", "ar": "عِلْم"}}
        for i in range(words)
    ]
    nodes.append(
        {"id": "frame:f", "position": {"x": -40, "y": -40}, "data": {"kind": "frame", "title": "مجموعة"}}
    )
    edges = [
        {"id": f"e{i}", "source": "root:r0", "target": f"lemma:w{i}", "data": {"rel": "derives"}}
        for i in range(words)
    ]
    return {"version": 2, "nodes": nodes, "edges": edges}


def _publish(h: dict[str, str], slug: str, local: str = "m1", **kw: object) -> dict:
    r = client.post(
        "/api/v1/published",
        headers=h,
        json={"local_id": local, "slug": slug, "title": "عائلة علم", "kind": "root", "doc": _doc(), **kw},
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_a_map_is_published_under_an_arabic_address_and_read_by_anyone(people: dict, tag: str) -> None:
    a, r = people["a"], people["r"]
    assert (
        client.post(
            "/api/v1/published", json={"local_id": "x", "slug": "abc", "title": "t", "doc": _doc()}
        ).status_code
        == 401
    )
    # the address as the owner typed it, vowelled and spaced: its letters kept, the marks dropped
    typed = f"{_vowelled('عائلة')} {chr(0x0671)}{_vowelled('لعلم')} {tag}"
    want = f"عائلة-العلم-{tag}"
    assert client.get("/api/v1/published/check", params={"slug": typed}).json() == {
        "slug": want,
        "valid": True,
        "available": True,
        "suggestion": None,
    }
    m = _publish(a, typed)
    assert (
        m["slug"] == want and m["version"] == 1 and m["latest"] == 1 and m["mine"] and m["local_id"] == "m1"
    )
    # the counts leave the frame out and name the first root
    assert m["counts"] == {"cards": 3, "roots": 1, "words": 2, "lead": "ع ل م"}
    # anyone reads it, by its address percent-encoded; no one else is told the owner's id for it
    seen = client.get(f"/api/v1/published/{want}").json()
    assert seen["title"] == "عائلة علم" and not seen["mine"] and "local_id" not in seen
    assert seen["author"]["name"] == f"a-{tag}" and seen["doc"]["nodes"][0]["id"] == "root:r0"
    assert client.get(f"/api/v1/published/{want}", headers=r).json()["mine"] is False
    # the address is now taken, and a free one is offered beside it
    taken = client.get("/api/v1/published/check", params={"slug": want}).json()
    assert taken["available"] is False and taken["suggestion"] == f"{want}-2"
    assert (
        client.post(
            "/api/v1/published", headers=r, json={"local_id": "z", "slug": want, "title": "x", "doc": _doc()}
        ).json()["error"]["code"]
        == "slug_taken"
    )
    # a map already published takes a new version, not a second address
    again = client.post(
        "/api/v1/published",
        headers=a,
        json={"local_id": "m1", "slug": f"other-{tag}", "title": "x", "doc": _doc()},
    )
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_published"
    # an address too short, or one the API's routes answer at, is refused
    assert (
        client.post(
            "/api/v1/published", headers=a, json={"local_id": "m2", "slug": "؟!", "title": "x", "doc": _doc()}
        ).json()["error"]["code"]
        == "bad_slug"
    )
    assert (
        client.post(
            "/api/v1/published",
            headers=a,
            json={"local_id": "m2", "slug": "check", "title": "x", "doc": _doc()},
        ).json()["error"]["code"]
        == "slug_taken"
    )
    assert (
        client.post(
            "/api/v1/published",
            headers=a,
            json={"local_id": "m2", "slug": f"t-{tag}", "title": "  ", "doc": _doc()},
        ).json()["error"]["code"]
        == "no_title"
    )
    assert client.get("/api/v1/published/no-such-map-ever").status_code == 404


def test_each_publish_is_a_version_that_never_changes(people: dict, tag: str) -> None:
    a, r = people["a"], people["r"]
    slug = f"versions-{tag}"
    _publish(a, slug)
    assert (
        client.post(
            f"/api/v1/published/{slug}/versions", headers=r, json={"title": "x", "doc": _doc()}
        ).status_code
        == 403
    )
    v2 = client.post(
        f"/api/v1/published/{slug}/versions",
        headers=a,
        json={"title": "عائلة علم، ثانية", "description": "أوسع", "kind": "root", "doc": _doc(words=3)},
    )
    assert v2.status_code == 201 and v2.json()["version"] == 2 and v2.json()["counts"]["words"] == 3
    # the latest is shown; the first is read by its number, as it was
    assert client.get(f"/api/v1/published/{slug}").json()["version"] == 2
    one = client.get(f"/api/v1/published/{slug}", params={"v": 1}).json()
    assert (
        one["version"] == 1
        and one["latest"] == 2
        and one["counts"]["words"] == 2
        and one["title"] == "عائلة علم"
    )
    assert [v["version"] for v in one["versions"]] == [2, 1]
    assert client.get(f"/api/v1/published/{slug}", params={"v": 3}).json()["error"]["code"] == "no_version"
    # the database itself refuses to change a version
    with pytest.raises(DBAPIError), accounts.tx() as conn:
        accounts.q(
            conn,
            "update graphs.published_versions set title = 'changed' where slug = :s returning slug",
            {"s": slug},
        )


def test_a_withdrawn_map_keeps_its_address_for_ever(people: dict, tag: str) -> None:
    a, r = people["a"], people["r"]
    slug = f"withdrawn-{tag}"
    _publish(a, slug)
    assert client.delete(f"/api/v1/published/{slug}", headers=r).status_code == 403
    assert client.delete(f"/api/v1/published/{slug}", headers=a).status_code == 204
    gone = client.get(f"/api/v1/published/{slug}")
    assert gone.status_code == 410 and gone.json()["error"]["code"] == "withdrawn_author"
    with accounts.tx() as conn:
        assert not accounts.q(
            conn, "select 1 as x from graphs.published_versions where slug = :s", {"s": slug}
        )
    # no one, the author included, publishes another map there
    assert client.get("/api/v1/published/check", params={"slug": slug}).json()["available"] is False
    assert (
        client.post(
            "/api/v1/published", headers=r, json={"local_id": "q", "slug": slug, "title": "x", "doc": _doc()}
        ).json()["error"]["code"]
        == "slug_taken"
    )
    # the author may publish the same map again, under another address
    assert _publish(a, f"again-{tag}")["version"] == 1


def test_forks_and_citations_are_counted_once_per_reader(people: dict, tag: str) -> None:
    a, r, e = people["a"], people["r"], people["e"]
    slug = f"counts-{tag}"
    _publish(a, slug)
    assert client.post(f"/api/v1/published/{slug}/fork", headers=r).json() == {
        "fork_count": 1,
        "counted": True,
    }
    # the same reader again within the hour: not counted twice
    assert client.post(f"/api/v1/published/{slug}/fork", headers=r).json() == {
        "fork_count": 1,
        "counted": False,
    }
    assert client.post(f"/api/v1/published/{slug}/fork", headers=e).json()["fork_count"] == 2
    # the author's own fork is not a fork of someone else's map
    assert client.post(f"/api/v1/published/{slug}/fork", headers=a).json() == {
        "fork_count": 2,
        "counted": False,
    }
    assert client.post(f"/api/v1/published/{slug}/cite", headers=r).json() == {
        "cite_count": 1,
        "counted": True,
    }
    # a reader without an account is counted by their address, once
    first = client.post(f"/api/v1/published/{slug}/cite").json()
    assert (
        first["counted"] is True and client.post(f"/api/v1/published/{slug}/cite").json()["counted"] is False
    )
    m = client.get(f"/api/v1/published/{slug}").json()
    assert m["fork_count"] == 2 and m["cite_count"] == 2
    # nothing about who forked or cited is in the database
    with accounts.tx() as conn:
        cols = {
            c["column_name"]
            for c in accounts.q(
                conn,
                "select column_name from information_schema.columns where table_schema = 'graphs' and table_name = 'published'",
            )
        }
    assert not cols & {"forked_by", "cited_by", "reader_id"}
    assert client.post("/api/v1/published/no-such-map-ever/fork").status_code == 404
    # a fork, published, names the map it was copied from
    f = _publish(r, f"fork-{tag}", forked_from={"slug": slug, "version": 1})
    assert f["forked_from"] == {"slug": slug, "version": 1, "title": "عائلة علم"}


def test_a_report_reaches_the_board_who_withdraw_the_map_or_dismiss_it(people: dict, tag: str) -> None:
    a, r, e = people["a"], people["r"], people["e"]
    slug = f"reported-{tag}"
    _publish(a, slug)
    assert client.post(f"/api/v1/published/{slug}/report", json={"reason": "spam"}).status_code == 401
    assert (
        client.post(f"/api/v1/published/{slug}/report", headers=a, json={"reason": "x"}).json()["error"][
            "code"
        ]
        == "own_map"
    )
    assert (
        client.post(
            f"/api/v1/published/{slug}/report", headers=r, json={"reason": "روابط دعائية"}
        ).status_code
        == 201
    )
    # a reader of the board sees it on the map and in the board's list; no one else does
    assert "reports" not in client.get(f"/api/v1/published/{slug}", headers=r).json()
    assert client.get("/api/v1/published/reports", headers=r).status_code == 403
    on_map = client.get(f"/api/v1/published/{slug}", headers=e).json()["reports"]
    assert [x["reason"] for x in on_map] == ["روابط دعائية"]
    listed = [
        x for x in client.get("/api/v1/published/reports", headers=e).json()["data"] if x["slug"] == slug
    ]
    assert len(listed) == 1 and listed[0]["title"] == "عائلة علم"
    # dismissed: the map stays
    rid = listed[0]["id"]
    assert (
        client.post(
            f"/api/v1/published/reports/{rid}/resolve", headers=r, json={"outcome": "dismissed"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/published/reports/{rid}/resolve", headers=e, json={"outcome": "dismissed"}
        ).json()["outcome"]
        == "dismissed"
    )
    assert client.get(f"/api/v1/published/{slug}").status_code == 200
    # reported again and withdrawn by the board: said as the board's act
    client.post(f"/api/v1/published/{slug}/report", headers=r, json={"reason": "مرة أخرى"})
    rid = next(
        x["id"]
        for x in client.get("/api/v1/published/reports", headers=e).json()["data"]
        if x["slug"] == slug
    )
    assert (
        client.post(
            f"/api/v1/published/reports/{rid}/resolve", headers=e, json={"outcome": "withdrawn"}
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/published/{slug}").json()["error"]["code"] == "withdrawn_board"


def test_the_gallery_the_authors_other_maps_and_the_owners_list(people: dict, tag: str) -> None:
    a, r = people["a"], people["r"]
    _publish(a, f"g1-{tag}", local="g1")
    _publish(a, f"g2-{tag}", local="g2")
    _publish(r, f"g3-{tag}", local="g3")
    top = client.get("/api/v1/published", params={"limit": 3}).json()
    assert [m["slug"] for m in top["data"]] == [f"g3-{tag}", f"g2-{tag}", f"g1-{tag}"] and top["total"] >= 3
    assert all("local_id" not in m for m in top["data"])
    others = client.get("/api/v1/published", params={"by": f"g1-{tag}"}).json()
    assert [m["slug"] for m in others["data"]] == [f"g2-{tag}"]
    mine = client.get("/api/v1/me/published", headers=a).json()["data"]
    assert {m["slug"]: m["local_id"] for m in mine} == {f"g2-{tag}": "g2", f"g1-{tag}": "g1"}


def test_an_account_deleted_withdraws_its_maps_and_the_export_carries_them(people: dict, tag: str) -> None:
    a = people["a"]
    slug = f"account-{tag}"
    _publish(a, slug)
    client.post(f"/api/v1/published/{slug}/versions", headers=a, json={"title": "ثانية", "doc": _doc()})
    out = client.get("/api/v1/me/export", headers=a).json()
    mine = [m for m in out["published_maps"] if m["slug"] == slug]
    assert len(mine) == 1 and [v["version"] for v in mine[0]["versions"]] == [1, 2]
    with accounts.tx() as conn:
        uid = accounts.q(
            conn, "select id from accounts.users where email = :e", {"e": f"pub-a-{tag}@example.org"}
        )[0]["id"]
        published.forget(conn, uid)
        accounts.q(conn, "delete from accounts.users where id = :u returning id", {"u": uid})
    assert client.get(f"/api/v1/published/{slug}").status_code == 410
    assert client.get("/api/v1/published/check", params={"slug": slug}).json()["available"] is False
