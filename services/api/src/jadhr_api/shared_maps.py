"""Maps shared for comments (PLAN P8.1-E, research 13 §3, DECISIONS 2026-10-03 and 2026-10-04).

A private map never comes here: it lives in the reader's browser and, signed in, in sealed sync records. Sharing a
map for comments is the owner's act; it puts the whole map here, in the clear, under a link only they hand out. From
then on each save of theirs sends the whole document naming the revision it was made from — a save over a newer
revision (their other device) is refused, never merged — and the map's history keeps a snapshot at most every ten
minutes of editing. Anyone with the link can read the map; to read and write comments they sign in. Comments anchor
to a card or to the whole map, take one level of replies, are resolved by the owner or their author, and mention
people who have spoken on the map. Stopping the share deletes the document, its history and its comments.

A lesson's map (P9.3) is its class's: only the class's instructor and members, signed in, read it, comment on it
and join it, and anyone in the class may be mentioned there (jadhr_api.classroom.map_gate).
"""

from __future__ import annotations

import json
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import Connection, text

from . import classroom
from .accounts import now, q, q1, tx
from .refusal import Refusal

KINDS = ("root", "topic", "meaning", "free")
MAX_DOC = 2_000_000  # bytes of the map's JSON
MAX_NODES = 3000
MAX_EDGES = 9000
MAX_SHARED = 200  # maps one reader shares at once
SNAPSHOT_EVERY = timedelta(minutes=10)
MAX_REVISIONS = 100
COMMENT_BURST = 30  # comments one reader writes in ten minutes
MAX_COMMENTS = 3000  # on one map


def _uuid(raw: Any, what: str = "map") -> str:
    try:
        return str(uuid.UUID(str(raw)))
    except (ValueError, TypeError):
        raise Refusal(404, "not_found", f"No such {what}.") from None


def _str(v: Any, most: int) -> str:
    return v.strip()[:most] if isinstance(v, str) else ""


def _doc(raw: Any) -> tuple[dict[str, Any], int]:
    """The map as the editor writes it, checked for shape and size only: the browser cleans every map it reads (lib/graph
    sanitize), a verse's text is never in it (it is drawn from its key), and nothing here interprets the cards."""
    if (
        not isinstance(raw, dict)
        or not isinstance(raw.get("nodes"), list)
        or not isinstance(raw.get("edges"), list)
    ):
        raise Refusal(422, "bad_doc", "A map holds a list of cards and a list of links.")
    nodes, edges = raw["nodes"], raw["edges"]
    if len(nodes) > MAX_NODES or len(edges) > MAX_EDGES:
        raise Refusal(413, "too_large", "This map is too large to share.")
    for n in nodes:
        if not isinstance(n, dict) or not isinstance(n.get("id"), str) or not isinstance(n.get("data"), dict):
            raise Refusal(422, "bad_doc", "Each card has an id and its data.")
    for e in edges:
        if not isinstance(e, dict) or not all(isinstance(e.get(k), str) for k in ("id", "source", "target")):
            raise Refusal(422, "bad_doc", "Each link has an id and its two ends.")
    doc = {"version": 2, "nodes": nodes, "edges": edges}
    if len(json.dumps(doc, ensure_ascii=False).encode()) > MAX_DOC:
        raise Refusal(413, "too_large", "This map is too large to share.")
    return doc, len(nodes)


def _kind(raw: Any) -> str:
    return raw if raw in KINDS else "free"


def _graph(conn: Connection, gid: str) -> dict[str, Any]:
    g = q1(conn, "select * from graphs.documents where id = :g", {"g": gid})
    if g is None:
        raise Refusal(404, "not_found", "This map is no longer shared.")
    return g


def _owned(conn: Connection, u: dict[str, Any], gid: str) -> dict[str, Any]:
    g = _graph(conn, _uuid(gid))
    if g["owner_id"] != u["id"]:
        raise Refusal(403, "not_owner", "Only the map's owner can change it.")
    return g


def _out(
    g: dict[str, Any],
    viewer: dict[str, Any] | None,
    owner_name: str | None,
    gate: dict[str, Any] | None = None,
) -> dict[str, Any]:
    mine = viewer is not None and g["owner_id"] == viewer["id"]
    return {
        "id": str(g["id"]),
        "title": g["title"],
        "kind": g["kind"],
        "doc": g["doc"],
        "doc_version": g["doc_version"],
        "revision": g["revision"],
        "cards": g["cards"],
        "updated_at": g["updated_at"],
        "owner": {"name": owner_name, "mine": mine},
        # the owner's own id for the map in their browser, so their copy and the shared one are one map
        **({"local_id": g["local_id"]} if mine else {}),
        # a lesson's map says whose it is: the class reads it, no one else
        **(
            {
                "class": {
                    "lesson_id": str(gate["lesson_id"]),
                    "lesson_title": gate["lesson_title"],
                    "class_id": str(gate["class_id"]),
                    "class_name": gate["class_name"],
                    "role": gate["role"],
                }
            }
            if gate
            else {}
        ),
    }


def _snapshot(conn: Connection, g: dict[str, Any]) -> None:
    conn.execute(
        text(
            """insert into graphs.revisions (graph_id, revision, title, doc, doc_version, cards)
               values (:g, :r, :t, cast(:d as jsonb), :v, :c) on conflict do nothing"""
        ),
        {
            "g": g["id"],
            "r": g["revision"],
            "t": g["title"],
            "d": json.dumps(g["doc"], ensure_ascii=False),
            "v": g["doc_version"],
            "c": g["cards"],
        },
    )
    conn.execute(
        text(
            """delete from graphs.revisions where graph_id = :g and revision not in (
                 select revision from graphs.revisions where graph_id = :g order by revision desc limit :n)"""
        ),
        {"g": g["id"], "n": MAX_REVISIONS},
    )


# ─── the document ────────────────────────────────────────────────────────────


def share(u: dict[str, Any], local_id: str, title: str, kind: str, raw: Any) -> dict[str, Any]:
    """Share a map for comments. Sharing the same map again (another device of the owner's) returns its document."""
    if u.get("blocked_at"):
        raise Refusal(403, "blocked", "This account cannot share maps.")
    doc, cards = _doc(raw)
    with tx() as conn:
        got = q1(
            conn,
            "select * from graphs.documents where owner_id = :u and local_id = :l",
            {"u": u["id"], "l": local_id},
        )
        if got is None:
            n = q1(
                conn, "select count(*)::int as n from graphs.documents where owner_id = :u", {"u": u["id"]}
            )
            if n and n["n"] >= MAX_SHARED:
                raise Refusal(429, "too_many", "That is as many maps as can be shared at once.")
            got = q1(
                conn,
                """insert into graphs.documents (owner_id, local_id, title, kind, doc, cards)
                   values (:u, :l, :t, :k, cast(:d as jsonb), :c) returning *""",
                {
                    "u": u["id"],
                    "l": local_id,
                    "t": _str(title, 200),
                    "k": _kind(kind),
                    "d": json.dumps(doc, ensure_ascii=False),
                    "c": cards,
                },
            )
            assert got is not None
            _snapshot(conn, got)
        return _out(got, u, u["display_name"])


def read(viewer: dict[str, Any] | None, gid: str) -> dict[str, Any]:
    """The map as its owner last saved it: anyone with the link may read it."""
    with tx() as conn:
        g = _graph(conn, _uuid(gid))
        gate = classroom.map_gate(conn, g["id"], viewer)
        owner = q1(conn, "select display_name from accounts.users where id = :u", {"u": g["owner_id"]})
        return _out(g, viewer, owner["display_name"] if owner else None, gate)


def may_join(gid: str, viewer: dict[str, Any] | None) -> str:
    """Who owns a map a window joins (presence, P8.6) — refused when it is a class's map and the window is not."""
    with tx() as conn:
        g = _graph(conn, _uuid(gid))
        classroom.map_gate(conn, g["id"], viewer)
        return str(g["owner_id"])


def save(
    u: dict[str, Any], gid: str, title: str | None, kind: str | None, raw: Any, base: int
) -> dict[str, Any]:
    """The owner's save, the whole map, made from revision `base`; refused when a newer revision is there."""
    doc, cards = _doc(raw)
    with tx() as conn:
        g = _owned(conn, u, gid)
        conn.execute(text("select pg_advisory_xact_lock(hashtext(cast(:g as text)))"), {"g": g["id"]})
        g = _graph(conn, str(g["id"]))
        if base != g["revision"]:
            raise Refusal(409, "newer", f"This map was saved elsewhere since (revision {g['revision']}).")
        before = g
        last = q1(
            conn,
            "select max(saved_at) as at from graphs.revisions where graph_id = :g",
            {"g": g["id"]},
        )
        new = q1(
            conn,
            """update graphs.documents set title = :t, kind = :k, doc = cast(:d as jsonb), cards = :c,
                 revision = revision + 1, updated_at = now() where id = :g returning *""",
            {
                "g": g["id"],
                "t": _str(title, 200) if title is not None else g["title"],
                "k": _kind(kind) if kind is not None else g["kind"],
                "d": json.dumps(doc, ensure_ascii=False),
                "c": cards,
            },
        )
        assert new is not None
        if not last or last["at"] is None or now() - last["at"] >= SNAPSHOT_EVERY:
            _snapshot(conn, new)
        # a lesson's map: what this save changed goes into the lesson's activity
        classroom.map_saved(conn, before, new, u)
        return {"id": str(new["id"]), "revision": new["revision"], "updated_at": new["updated_at"]}


def stop(u: dict[str, Any], gid: str) -> None:
    """Stop sharing: the document, its history and its comments go. The owner's own copy stays in their browser."""
    with tx() as conn:
        g = _owned(conn, u, gid)
        conn.execute(text("delete from graphs.documents where id = :g"), {"g": g["id"]})


def revisions(u: dict[str, Any], gid: str) -> list[dict[str, Any]]:
    with tx() as conn:
        g = _owned(conn, u, gid)
        return q(
            conn,
            """select revision, title, cards, saved_at from graphs.revisions where graph_id = :g
               order by revision desc""",
            {"g": g["id"]},
        )


def revision(u: dict[str, Any], gid: str, rev: int) -> dict[str, Any]:
    with tx() as conn:
        g = _owned(conn, u, gid)
        r = q1(
            conn,
            "select * from graphs.revisions where graph_id = :g and revision = :r",
            {"g": g["id"], "r": rev},
        )
        if r is None:
            raise Refusal(404, "not_found", "No such version of this map.")
        return {k: r[k] for k in ("revision", "title", "doc", "doc_version", "cards", "saved_at")}


def mine(u: dict[str, Any]) -> dict[str, Any]:
    """The maps this reader shares, and those others shared where they have spoken or read the comments — each with
    what is new to them in its comments and how much of that names them."""
    with tx() as conn:
        rows = q(
            conn,
            """with seen as (
                 select d.id from graphs.documents d where d.owner_id = :u
                 union select r.graph_id from graphs.reads r where r.user_id = :u
                 union select c.graph_id from graphs.comments c where c.author_id = :u)
               select d.id, d.local_id, d.owner_id, d.title, d.kind, d.cards, d.revision, d.updated_at,
                      o.display_name as owner_name,
                      (select count(*)::int from graphs.comments c where c.graph_id = d.id and c.parent_id is null
                         and c.resolved_at is null and c.deleted_at is null) as open,
                      (select count(*)::int from graphs.comments c where c.graph_id = d.id and c.deleted_at is null
                         and c.author_id is distinct from :u
                         and c.created_at > coalesce((select read_at from graphs.reads r where r.graph_id = d.id
                                                       and r.user_id = :u), '-infinity')) as unread,
                      (select count(*)::int from graphs.comments c where c.graph_id = d.id and c.deleted_at is null
                         and :u = any(c.mentions)
                         and c.created_at > coalesce((select read_at from graphs.reads r where r.graph_id = d.id
                                                       and r.user_id = :u), '-infinity')) as mentions
               from graphs.documents d join seen on seen.id = d.id
               left join accounts.users o on o.id = d.owner_id
               order by d.updated_at desc""",
            {"u": u["id"]},
        )
    out = []
    for r in rows:
        own = r["owner_id"] == u["id"]
        out.append(
            {
                "id": str(r["id"]),
                **({"local_id": r["local_id"]} if own else {}),
                "title": r["title"],
                "kind": r["kind"],
                "cards": r["cards"],
                "revision": r["revision"],
                "updated_at": r["updated_at"],
                "owner": {"name": r["owner_name"], "mine": own},
                "open": r["open"],
                "unread": r["unread"],
                "mentions": r["mentions"],
            }
        )
    return {"data": out}


# ─── comments ────────────────────────────────────────────────────────────────


def _tell(conn: Connection, gid: Any) -> None:
    """The windows on the map are told its comments changed, once this is committed (B47)."""
    from . import presence

    presence.tell_changed(conn, gid)


def _people(conn: Connection, g: dict[str, Any]) -> dict[str, str | None]:
    """Who has spoken on the map — its owner and everyone who commented — by id, with their names; on a lesson's
    map, everyone in the class."""
    if q1(conn, "select 1 as x from classroom.lessons where graph_id = :g", {"g": g["id"]}):
        return classroom.map_people(conn, g["id"])
    return {
        str(r["id"]): r["display_name"]
        for r in q(
            conn,
            """select u.id, u.display_name from accounts.users u where u.id = :o
               or u.id in (select author_id from graphs.comments where graph_id = :g and author_id is not null)""",
            {"o": g["owner_id"], "g": g["id"]},
        )
    }


def _comment_out(
    c: dict[str, Any], g: dict[str, Any], u: dict[str, Any], names: dict[str, str | None]
) -> dict[str, Any]:
    author = str(c["author_id"]) if c["author_id"] else None
    gone = c["deleted_at"] is not None
    owner = g["owner_id"] == u["id"]
    return {
        "id": str(c["id"]),
        "parent_id": str(c["parent_id"]) if c["parent_id"] else None,
        "node_id": c["node_id"],
        "anchor": c["anchor"],
        "body": "" if gone else c["body"],
        "deleted": gone,
        "author": None
        if gone or author is None
        else {"id": author, "name": names.get(author), "owner": c["author_id"] == g["owner_id"]},
        "mine": author == str(u["id"]) and not gone,
        "mentions": [] if gone else [{"id": str(m), "name": names.get(str(m))} for m in c["mentions"]],
        "mentions_me": not gone and u["id"] in c["mentions"],
        "resolved_at": c["resolved_at"],
        "created_at": c["created_at"],
        "can_resolve": not gone and c["parent_id"] is None and (owner or author == str(u["id"])),
        "can_delete": not gone and (owner or author == str(u["id"])),
    }


def comments(u: dict[str, Any], gid: str) -> dict[str, Any]:
    """A map's comments for a signed-in reader, oldest first (the screen orders them), with the people who may be
    mentioned; reading them marks them read."""
    with tx() as conn:
        g = _graph(conn, _uuid(gid))
        classroom.map_gate(conn, g["id"], u)
        rows = q(
            conn, "select * from graphs.comments where graph_id = :g order by created_at", {"g": g["id"]}
        )
        names = _people(conn, g)
        extra = {str(m) for c in rows for m in c["mentions"]} - names.keys()
        if extra:
            names |= {
                str(r["id"]): r["display_name"]
                for r in q(
                    conn,
                    "select id, display_name from accounts.users where id = any(cast(:ids as uuid[]))",
                    {"ids": list(extra)},
                )
            }
        conn.execute(
            text(
                """insert into graphs.reads (graph_id, user_id) values (:g, :u)
                   on conflict (graph_id, user_id) do update set read_at = now()"""
            ),
            {"g": g["id"], "u": u["id"]},
        )
        people = _people(conn, g)
    return {
        "data": [_comment_out(c, g, u, names) for c in rows],
        # mentionable: everyone who has spoken here and has a name, never the reader themself
        "people": [{"id": k, "name": v} for k, v in people.items() if v and k != str(u["id"])],
        "owner": g["owner_id"] == u["id"],
    }


def comment(
    u: dict[str, Any],
    gid: str,
    body: str,
    node_id: str | None,
    anchor: str,
    parent_id: str | None,
    mentions: list[str],
) -> dict[str, Any]:
    if u.get("blocked_at"):
        raise Refusal(403, "blocked", "This account cannot comment.")
    words = body.strip() if isinstance(body, str) else ""
    if not words:
        raise Refusal(422, "empty", "Write the comment first.")
    if len(words) > 2000:
        raise Refusal(422, "too_long", "A comment is at most 2,000 characters.")
    with tx() as conn:
        g = _graph(conn, _uuid(gid))
        classroom.map_gate(conn, g["id"], u)
        recent = q1(
            conn,
            "select count(*)::int as n from graphs.comments where author_id = :u and created_at > now() - interval '10 minutes'",
            {"u": u["id"]},
        )
        if recent and recent["n"] >= COMMENT_BURST:
            raise Refusal(
                429, "too_many", "That is as many comments as can be written for now. Try again shortly."
            )
        total = q1(conn, "select count(*)::int as n from graphs.comments where graph_id = :g", {"g": g["id"]})
        if total and total["n"] >= MAX_COMMENTS:
            raise Refusal(429, "too_many_here", "This map has as many comments as it can hold.")
        parent = None
        if parent_id:
            parent = q1(
                conn,
                "select * from graphs.comments where id = :p and graph_id = :g",
                {"p": _uuid(parent_id, "comment"), "g": g["id"]},
            )
            if parent is None or parent["parent_id"] is not None:
                raise Refusal(422, "bad_parent", "A reply answers a comment on this map.")
        people = _people(conn, g)
        named = [m for m in dict.fromkeys(mentions) if m in people and m != str(u["id"])]
        if len(named) != len({m for m in mentions if m != str(u["id"])}):
            raise Refusal(422, "bad_mention", "Only people who have spoken on this map can be mentioned.")
        c = q1(
            conn,
            """insert into graphs.comments (graph_id, parent_id, author_id, node_id, anchor, body, mentions)
               values (:g, :p, :u, :n, :a, :b, cast(:m as uuid[])) returning *""",
            {
                "g": g["id"],
                # a reply sits on its comment's card
                "p": parent["id"] if parent else None,
                "u": u["id"],
                "n": parent["node_id"] if parent else (_str(node_id, 200) or None),
                "a": parent["anchor"] if parent else _str(anchor, 200),
                "b": words,
                "m": named,
            },
        )
        assert c is not None
        _tell(conn, g["id"])
        # writing is reading: what came before is no longer new to the writer
        conn.execute(
            text(
                """insert into graphs.reads (graph_id, user_id) values (:g, :u)
                   on conflict (graph_id, user_id) do update set read_at = now()"""
            ),
            {"g": g["id"], "u": u["id"]},
        )
        names = _people(conn, g)
        return _comment_out(c, g, u, names)


def _comment(conn: Connection, cid: str) -> tuple[dict[str, Any], dict[str, Any]]:
    c = q1(conn, "select * from graphs.comments where id = :c", {"c": _uuid(cid, "comment")})
    if c is None or c["deleted_at"] is not None:
        raise Refusal(404, "not_found", "No such comment.")
    return c, _graph(conn, str(c["graph_id"]))


def _comment_in_reach(conn: Connection, u: dict[str, Any], cid: str) -> tuple[dict[str, Any], dict[str, Any]]:
    c, g = _comment(conn, cid)
    classroom.map_gate(conn, g["id"], u)
    return c, g


def resolve(u: dict[str, Any], cid: str, resolved: bool) -> dict[str, Any]:
    """Resolve a thread, or open it again: the map's owner or the comment's author."""
    with tx() as conn:
        c, g = _comment_in_reach(conn, u, cid)
        if c["parent_id"] is not None:
            raise Refusal(422, "reply", "A thread is resolved by its first comment.")
        if u["id"] not in (g["owner_id"], c["author_id"]):
            raise Refusal(403, "not_allowed", "The map's owner or the comment's author resolves it.")
        done = q1(
            conn,
            f"""update graphs.comments set resolved_at = {"now()" if resolved else "null"},
                  resolved_by = {":u" if resolved else "null"} where id = :c returning *""",
            {"c": c["id"], "u": u["id"]},
        )
        assert done is not None
        _tell(conn, g["id"])
        return _comment_out(done, g, u, _people(conn, g))


def _drop(conn: Connection, ids: list[Any]) -> None:
    """Comments taken away: one others replied to stays as a mark so the thread reads; the rest go."""
    conn.execute(
        text(
            """update graphs.comments c set body = '', mentions = '{}', deleted_at = now(), author_id = null
               where c.id = any(:ids) and exists (select 1 from graphs.comments r where r.parent_id = c.id)"""
        ),
        {"ids": ids},
    )
    conn.execute(
        text("delete from graphs.comments where id = any(:ids) and deleted_at is null"),
        {"ids": ids},
    )


def delete_comment(u: dict[str, Any], cid: str) -> None:
    with tx() as conn:
        c, g = _comment_in_reach(conn, u, cid)
        if u["id"] not in (g["owner_id"], c["author_id"]):
            raise Refusal(403, "not_allowed", "The map's owner or the comment's author deletes it.")
        _drop(conn, [c["id"]])
        _tell(conn, g["id"])
        # a mark with no replies left under it has nothing left to hold
        if c["parent_id"]:
            conn.execute(
                text(
                    """delete from graphs.comments p where p.id = :p and p.deleted_at is not null
                       and not exists (select 1 from graphs.comments r where r.parent_id = p.id)"""
                ),
                {"p": c["parent_id"]},
            )


# ─── the account ─────────────────────────────────────────────────────────────


def forget(conn: Connection, user_id: Any) -> None:
    """Deleting an account: its shared maps go with it (cascade); its comments on others' maps go, a comment others
    replied to standing as a mark; mentions of it are taken out."""
    ids = [r["id"] for r in q(conn, "select id from graphs.comments where author_id = :u", {"u": user_id})]
    if ids:
        _drop(conn, ids)
    conn.execute(
        text(
            """update graphs.comments set mentions = array_remove(mentions, cast(:u as uuid))
               where cast(:u as uuid) = any(mentions)"""
        ),
        {"u": str(user_id)},
    )


def export_for(u: dict[str, Any]) -> dict[str, Any]:
    """What the account holds here, for its export: the maps it shares and the comments it wrote."""
    with tx() as conn:
        maps = q(
            conn,
            """select id, title, kind, doc, doc_version, revision, created_at, updated_at from graphs.documents
               where owner_id = :u order by created_at""",
            {"u": u["id"]},
        )
        said = q(
            conn,
            """select c.id, c.graph_id, d.title as map_title, c.parent_id, c.node_id, c.anchor, c.body,
                      c.resolved_at, c.created_at
               from graphs.comments c join graphs.documents d on d.id = c.graph_id
               where c.author_id = :u and c.deleted_at is null order by c.created_at""",
            {"u": u["id"]},
        )
    return {"shared_maps": maps, "map_comments": said}
