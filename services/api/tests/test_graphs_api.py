"""Maps shared for comments (P8.1-E): a private map never reaches the server in the clear — only one its owner shares;
anyone with the link reads it, only the owner saves it, each save naming the revision it was made from, a save over
a newer one refused; the history kept; comments anchored to a card or the whole map, replies one level deep,
resolved by the owner or the author, mentions only of people who have spoken; what is new counted for each reader;
stopping the share and deleting an account take what they should."""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from jadhr_api import accounts, shared_maps
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
    """The map's owner, two readers it is shared with (one without a name), each signed in."""
    tag = uuid.uuid4().hex[:8]
    out: dict[str, dict[str, str]] = {}
    emails = {}
    for who in ("o", "r", "n"):
        emails[who] = f"graphs-{who}-{tag}@example.org"
        out[who] = _sign_in(emails[who])
        if who != "n":
            client.patch("/api/v1/me", headers=out[who], json={"display_name": f"{who}-{tag}"})
    yield out
    with accounts.tx() as conn:
        for e in emails.values():
            accounts.q(conn, "delete from accounts.users where email = :e returning id", {"e": e})
            accounts.q(conn, "delete from accounts.login_tokens where email = :e returning email", {"e": e})


def _uid(h: dict[str, str]) -> str:
    return client.get("/api/v1/me", headers=h).json()["id"]


def _doc(n: int = 2) -> dict:
    nodes = [
        {
            "id": f"note:n{i}",
            "position": {"x": i * 300, "y": 0},
            "data": {"kind": "note", "ar": f"ملاحظة {i}"},
        }
        for i in range(n)
    ]
    edges = [{"id": "e1", "source": "note:n0", "target": "note:n1", "data": {}}] if n > 1 else []
    return {"version": 2, "nodes": nodes, "edges": edges}


def _share(h: dict[str, str], local: str = "abc123") -> dict:
    r = client.post(
        "/api/v1/graphs",
        headers=h,
        json={"local_id": local, "title": "خريطتي", "kind": "free", "doc": _doc()},
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_a_shared_map_is_read_by_the_link_and_saved_by_its_owner_only(
    people: dict[str, dict[str, str]],
) -> None:
    o, r = people["o"], people["r"]
    assert client.post("/api/v1/graphs", json={"local_id": "x", "doc": _doc()}).status_code == 401
    g = _share(o)
    assert g["revision"] == 1 and g["cards"] == 2 and g["owner"]["mine"] and g["local_id"] == "abc123"
    # sharing the same map again (the owner's other device) is the same document
    assert _share(o)["id"] == g["id"]
    # anyone with the link reads it — signed out too — and is not told the owner's id for it
    seen = client.get(f"/api/v1/graphs/{g['id']}").json()
    assert seen["title"] == "خريطتي" and seen["doc"]["nodes"][0]["id"] == "note:n0"
    assert not seen["owner"]["mine"] and "local_id" not in seen and seen["owner"]["name"].startswith("o-")
    assert client.get(f"/api/v1/graphs/{g['id']}", headers=r).json()["owner"]["mine"] is False
    assert client.get(f"/api/v1/graphs/{uuid.uuid4()}").status_code == 404
    assert client.get("/api/v1/graphs/not-a-map").status_code == 404
    # only the owner saves; read-only is enforced here, not only on the screen
    body = {"title": "خريطتي", "doc": _doc(3), "base": 1}
    assert client.put(f"/api/v1/graphs/{g['id']}", headers=r, json=body).status_code == 403
    assert client.put(f"/api/v1/graphs/{g['id']}", json=body).status_code == 401
    s = client.put(f"/api/v1/graphs/{g['id']}", headers=o, json=body)
    assert s.status_code == 200 and s.json()["revision"] == 2
    assert client.get(f"/api/v1/graphs/{g['id']}").json()["cards"] == 3
    # a save made from an older revision (the other device) is refused, never merged
    late = client.put(f"/api/v1/graphs/{g['id']}", headers=o, json={**body, "doc": _doc(1), "base": 1})
    assert late.status_code == 409 and late.json()["error"]["code"] == "newer"
    assert client.get(f"/api/v1/graphs/{g['id']}").json()["cards"] == 3
    # a map's shape and size are checked
    bad = client.put(f"/api/v1/graphs/{g['id']}", headers=o, json={**body, "doc": {"nodes": "x"}, "base": 2})
    assert bad.status_code == 422
    huge = {
        "version": 2,
        "nodes": [{"id": str(i), "data": {}} for i in range(shared_maps.MAX_NODES + 1)],
        "edges": [],
    }
    assert (
        client.put(f"/api/v1/graphs/{g['id']}", headers=o, json={**body, "doc": huge, "base": 2}).status_code
        == 413
    )


def test_the_history_keeps_a_version_every_ten_minutes_of_editing(people: dict[str, dict[str, str]]) -> None:
    o, r = people["o"], people["r"]
    g = _share(o)
    for base in (1, 2, 3):
        assert (
            client.put(
                f"/api/v1/graphs/{g['id']}", headers=o, json={"doc": _doc(base + 1), "base": base}
            ).status_code
            == 200
        )
    # saves close together are one version in the history; the document itself is always the latest
    hist = client.get(f"/api/v1/graphs/{g['id']}/revisions", headers=o).json()["data"]
    assert [h["revision"] for h in hist] == [1]
    # ten minutes on, the next save is kept as a version of its own
    with accounts.tx() as conn:
        accounts.q(
            conn,
            "update graphs.revisions set saved_at = saved_at - :d where graph_id = :g returning revision",
            {"d": shared_maps.SNAPSHOT_EVERY + timedelta(seconds=1), "g": g["id"]},
        )
    assert (
        client.put(f"/api/v1/graphs/{g['id']}", headers=o, json={"doc": _doc(5), "base": 4}).status_code
        == 200
    )
    hist = client.get(f"/api/v1/graphs/{g['id']}/revisions", headers=o).json()["data"]
    assert [h["revision"] for h in hist] == [5, 1] and hist[0]["cards"] == 5
    old = client.get(f"/api/v1/graphs/{g['id']}/revisions/1", headers=o).json()
    assert old["cards"] == 2 and len(old["doc"]["nodes"]) == 2
    # the history is the owner's
    assert client.get(f"/api/v1/graphs/{g['id']}/revisions", headers=r).status_code == 403
    assert client.get(f"/api/v1/graphs/{g['id']}/revisions/99", headers=o).status_code == 404


def test_comments_anchor_reply_resolve_and_mention(people: dict[str, dict[str, str]]) -> None:
    o, r, n = people["o"], people["r"], people["n"]
    g = _share(o)
    url = f"/api/v1/graphs/{g['id']}/comments"
    # comments are for signed-in readers
    assert client.get(url).status_code == 401
    assert client.post(url, json={"body": "x"}).status_code == 401
    # on a card, by its id and its Arabic as written then; and on the whole map
    c1 = client.post(
        url, headers=r, json={"body": "ما الفرق هنا؟", "node_id": "note:n0", "anchor": "ملاحظة 0"}
    ).json()
    assert c1["node_id"] == "note:n0" and c1["anchor"] == "ملاحظة 0" and c1["mine"] and c1["can_resolve"]
    c2 = client.post(url, headers=n, json={"body": "خريطة نافعة"}).json()
    assert c2["node_id"] is None and c2["author"]["name"] is None
    assert client.post(url, headers=r, json={"body": "   "}).status_code in (422,)
    # a reply sits on its comment's card; a reply to a reply is refused
    rep = client.post(
        url, headers=o, json={"body": "@r الفرق في الاستعمال", "parent_id": c1["id"], "mentions": [_uid(r)]}
    ).json()
    assert rep["parent_id"] == c1["id"] and rep["node_id"] == "note:n0" and rep["author"]["owner"]
    assert rep["mentions"][0]["name"].startswith("r-")
    deep = client.post(url, headers=r, json={"body": "x", "parent_id": rep["id"]})
    assert deep.status_code == 422
    # only people who have spoken on the map can be mentioned
    stranger = str(uuid.uuid4())
    assert client.post(url, headers=r, json={"body": "@x", "mentions": [stranger]}).status_code == 422
    # what is new, and what names the reader, until they read the comments
    mine = {m["id"]: m for m in client.get("/api/v1/graphs", headers=r).json()["data"]}
    assert (
        mine[g["id"]]["unread"] == 2 and mine[g["id"]]["mentions"] == 1 and not mine[g["id"]]["owner"]["mine"]
    )
    page = client.get(url, headers=r).json()
    assert [c["id"] for c in page["data"]] == [c1["id"], c2["id"], rep["id"]]
    assert next(c for c in page["data"] if c["id"] == rep["id"])["mentions_me"]
    # mentionable: those who have spoken and have a name, never the reader themself
    names = {p["name"] for p in page["people"]}
    assert all(x and not x.startswith("r-") for x in names) and any(x.startswith("o-") for x in names)
    mine = {m["id"]: m for m in client.get("/api/v1/graphs", headers=r).json()["data"]}
    assert mine[g["id"]]["unread"] == 0 and mine[g["id"]]["mentions"] == 0
    owner_list = {m["id"]: m for m in client.get("/api/v1/graphs", headers=o).json()["data"]}
    assert owner_list[g["id"]]["owner"]["mine"] and owner_list[g["id"]]["open"] == 2
    # resolved by the owner or the author, a thread by its first comment; others cannot
    assert client.patch(f"/api/v1/comments/{c1['id']}", headers=n, json={"resolved": True}).status_code == 403
    assert (
        client.patch(f"/api/v1/comments/{rep['id']}", headers=o, json={"resolved": True}).status_code == 422
    )
    done = client.patch(f"/api/v1/comments/{c1['id']}", headers=o, json={"resolved": True}).json()
    assert done["resolved_at"]
    again = client.patch(f"/api/v1/comments/{c1['id']}", headers=r, json={"resolved": False}).json()
    assert again["resolved_at"] is None
    # deleted by the author or the owner: a comment others replied to stands as a mark, the thread still reads
    assert client.delete(f"/api/v1/comments/{c1['id']}", headers=n).status_code == 403
    assert client.delete(f"/api/v1/comments/{c1['id']}", headers=r).status_code == 204
    page = client.get(url, headers=o).json()["data"]
    mark = next(c for c in page if c["id"] == c1["id"])
    assert mark["deleted"] and mark["body"] == "" and mark["author"] is None and not mark["can_delete"]
    # the last reply gone, the mark goes with it
    assert client.delete(f"/api/v1/comments/{rep['id']}", headers=o).status_code == 204
    assert [c["id"] for c in client.get(url, headers=o).json()["data"]] == [c2["id"]]


def test_stopping_the_share_and_deleting_an_account(people: dict[str, dict[str, str]]) -> None:
    o, r = people["o"], people["r"]
    g = _share(o)
    url = f"/api/v1/graphs/{g['id']}/comments"
    c = client.post(url, headers=r, json={"body": "سؤال"}).json()
    client.post(url, headers=o, json={"body": "جواب", "parent_id": c["id"]})
    alone = client.post(url, headers=r, json={"body": "ملاحظة"}).json()
    # the export carries the maps an account shares and the comments it wrote
    exp = client.get("/api/v1/me/export", headers=r).json()
    assert {x["body"] for x in exp["map_comments"]} == {"سؤال", "ملاحظة"}
    assert [m["title"] for m in client.get("/api/v1/me/export", headers=o).json()["shared_maps"]] == [
        "خريطتي"
    ]
    # deleting the reader's account: their comment with a reply stands as a mark, the other goes
    confirm = client.post("/api/v1/me/delete", headers=r).json()["confirm"]
    assert client.post("/api/v1/me/delete/confirm", headers=r, json={"confirm": confirm}).status_code == 200
    left = client.get(url, headers=o).json()["data"]
    assert [x["id"] for x in left if x["deleted"]] == [c["id"]] and alone["id"] not in [x["id"] for x in left]
    # stopping the share: the link no longer opens, and the history and comments are gone with it
    assert client.delete(f"/api/v1/graphs/{g['id']}", headers=r).status_code == 401
    assert client.delete(f"/api/v1/graphs/{g['id']}", headers=o).status_code == 204
    assert client.get(f"/api/v1/graphs/{g['id']}").status_code == 404
    with accounts.tx() as conn:
        left_rows = accounts.q1(
            conn,
            """select (select count(*) from graphs.comments where graph_id = :g)
                    + (select count(*) from graphs.revisions where graph_id = :g) as n""",
            {"g": g["id"]},
        )
    assert left_rows is not None and left_rows["n"] == 0
