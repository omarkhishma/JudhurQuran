"""The classroom (PLAN P9, research 16): an instructor's classes and lessons, and what a learner who joined sends
for a lesson that is open.

The privacy model (research 16 §2) is enforced here, not only on screen: a reader joins a class by their own act,
having been told what the instructor sees (`CONSENT_VERSION` names the wording); the counts and progress a member's
reader sends are refused outside an open lesson's verses; an instructor sees totals, per-word numbers only once a
class has `FLOOR` members, and a member's own detail only when that member chose to show it — never in a class
marked for minors. Leaving a class, or being removed from it, deletes what it held of the member.
"""

from __future__ import annotations

import json
import re
import secrets
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import Connection

from .accounts import q, q1, tx
from .db import connect, rows
from .refusal import Refusal

CONSENT_VERSION = "2026-10-04"
TEACH = {"instructor", "admin"}
FLOOR = 5
FEW = 3
OPEN_AFTER_DUE = timedelta(days=14)
OPEN_WITHOUT_DUE = timedelta(days=60)
KEEP_AFTER_DUE = timedelta(days=90)
_CODE = "abcdefghjkmnpqrstuvwxyz23456789"


def _uuid(raw: str, what: str = "class") -> str:
    import uuid

    try:
        return str(uuid.UUID(str(raw)))
    except (ValueError, AttributeError, TypeError):
        raise Refusal(404, "not_found", f"No such {what}.") from None


def _str(v: Any, most: int, *, need: bool = False, field: str = "text") -> str:
    s = v.strip() if isinstance(v, str) else ""
    if need and not s:
        raise Refusal(422, "empty", f"The {field} cannot be empty.")
    if len(s) > most:
        raise Refusal(422, "too_long", f"At most {most} characters.")
    return s


def _iso(v: Any) -> str | None:
    return v.isoformat() if isinstance(v, (datetime, date)) else None


def _class(conn: Connection, cid: str) -> dict[str, Any]:
    c = q1(conn, "select * from classroom.classes where id = :c", {"c": _uuid(cid)})
    if c is None:
        raise Refusal(404, "not_found", "No such class.")
    return c


def _own(conn: Connection, u: dict[str, Any], cid: str) -> dict[str, Any]:
    c = _class(conn, cid)
    if str(c["instructor_id"]) != str(u["id"]):
        raise Refusal(403, "not_instructor", "Only the class's instructor can do this.")
    return c


def _membership(conn: Connection, u: dict[str, Any], cid: str) -> dict[str, Any] | None:
    return q1(
        conn, "select * from classroom.members where class_id = :c and user_id = :u", {"c": cid, "u": u["id"]}
    )


def _lesson(conn: Connection, lid: str) -> dict[str, Any]:
    lesson = q1(conn, "select * from classroom.lessons where id = :l", {"l": _uuid(lid, "lesson")})
    if lesson is None:
        raise Refusal(404, "not_found", "No such lesson.")
    return lesson


def _role_in(conn: Connection, u: dict[str, Any], c: dict[str, Any]) -> str:
    """The reader's place in a class: its instructor, a member, or neither (refused)."""
    if str(c["instructor_id"]) == str(u["id"]):
        return "instructor"
    if _membership(conn, u, str(c["id"])):
        return "member"
    raise Refusal(404, "not_found", "No such class.")


def open_until(lesson: dict[str, Any]) -> datetime:
    """Until when a member's reader sends what it counts for a lesson: two weeks after its due date, or two months
    after it was assigned when it has none."""
    if lesson["due_at"]:
        return lesson["due_at"] + OPEN_AFTER_DUE
    return lesson["assigned_at"] + OPEN_WITHOUT_DUE


# ─── classes ──────────────────────────────────────────────────────────────────


def _code(conn: Connection) -> str:
    while True:
        code = "".join(secrets.choice(_CODE) for _ in range(10))
        if not q1(conn, "select 1 as x from classroom.classes where join_code = :k", {"k": code}):
            return code


def _class_out(conn: Connection, c: dict[str, Any], role: str, u: dict[str, Any]) -> dict[str, Any]:
    instructor = q1(conn, "select display_name from accounts.users where id = :u", {"u": c["instructor_id"]})
    members = q1(
        conn, "select count(*)::int as n from classroom.members where class_id = :c", {"c": c["id"]}
    )["n"]  # type: ignore[index]
    out: dict[str, Any] = {
        "id": str(c["id"]),
        "name": c["name"],
        "minors": c["minors"],
        "role": role,
        "instructor": {"name": instructor["display_name"] if instructor else None},
        "members": members,
        "created_at": _iso(c["created_at"]),
        "archived_at": _iso(c["archived_at"]),
    }
    if role == "instructor":
        out["join_code"] = c["join_code"]
    else:
        m = _membership(conn, u, str(c["id"]))
        out["me"] = {
            "detail_opt_in": bool(m and m["detail_opt_in"]) and not c["minors"],
            "joined_at": _iso(m["joined_at"]) if m else None,
        }
    return out


def classes(u: dict[str, Any]) -> dict[str, Any]:
    """The classes this reader teaches and those they joined."""
    with tx() as conn:
        teaching = q(
            conn,
            "select * from classroom.classes where instructor_id = :u order by archived_at nulls first, created_at desc",
            {"u": u["id"]},
        )
        learning = q(
            conn,
            """select c.* from classroom.classes c join classroom.members m on m.class_id = c.id
               where m.user_id = :u order by m.joined_at desc""",
            {"u": u["id"]},
        )
        return {
            "can_teach": u["role"] in TEACH,
            "teaching": [_class_out(conn, c, "instructor", u) for c in teaching],
            "learning": [_class_out(conn, c, "member", u) for c in learning],
        }


def create(u: dict[str, Any], name: Any, minors: Any) -> dict[str, Any]:
    if u["role"] not in TEACH or u.get("blocked_at"):
        raise Refusal(403, "not_instructor", "Classes are made by accounts given the instructor role.")
    with tx() as conn:
        c = q1(
            conn,
            """insert into classroom.classes (instructor_id, name, minors, join_code)
               values (:u, :n, :m, :k) returning *""",
            {
                "u": u["id"],
                "n": _str(name, 120, need=True, field="class's name"),
                "m": bool(minors),
                "k": _code(conn),
            },
        )
        assert c is not None
        return _class_out(conn, c, "instructor", u)


def get_class(u: dict[str, Any], cid: str) -> dict[str, Any]:
    with tx() as conn:
        c = _class(conn, cid)
        role = _role_in(conn, u, c)
        out = _class_out(conn, c, role, u)
        if role == "instructor":
            # the roster: who joined, and who chose to show their detail (never in a class for minors)
            out["roster"] = [
                {
                    "id": str(m["user_id"]),
                    "name": m["display_name"],
                    "joined_at": _iso(m["joined_at"]),
                    "detail_opt_in": bool(m["detail_opt_in"]) and not c["minors"],
                }
                for m in q(
                    conn,
                    """select m.*, u.display_name from classroom.members m join accounts.users u on u.id = m.user_id
                       where m.class_id = :c order by m.joined_at""",
                    {"c": c["id"]},
                )
            ]
        out["lessons"] = _lessons_of(conn, c, role, u)
        return out


def update(
    u: dict[str, Any], cid: str, name: Any = None, minors: Any = None, archived: Any = None
) -> dict[str, Any]:
    with tx() as conn:
        c = _own(conn, u, cid)
        sets: dict[str, Any] = {}
        if name is not None:
            sets["name"] = _str(name, 120, need=True, field="class's name")
        if minors is not None:
            sets["minors"] = bool(minors)
        if archived is not None:
            sets["archived_at"] = datetime.now(UTC) if archived else None
        if sets:
            c = q1(
                conn,
                f"update classroom.classes set {', '.join(f'{k} = :{k}' for k in sets)} where id = :id returning *",
                {**sets, "id": c["id"]},
            )
            assert c is not None
        return _class_out(conn, c, "instructor", u)


def delete(u: dict[str, Any], cid: str) -> None:
    """A class deleted takes its lessons, notes, members and everything counted with it — and its lessons' maps'
    shared copies, which were the class's to read (the instructor's own copies stay in their browser)."""
    with tx() as conn:
        c = _own(conn, u, cid)
        q(
            conn,
            """delete from graphs.documents where id in
                 (select graph_id from classroom.lessons where class_id = :c and graph_id is not null) returning id""",
            {"c": c["id"]},
        )
        q(conn, "delete from classroom.classes where id = :c returning id", {"c": c["id"]})


def new_code(u: dict[str, Any], cid: str) -> dict[str, Any]:
    """A new join link: the old one stops working; members stay."""
    with tx() as conn:
        c = _own(conn, u, cid)
        c = q1(
            conn,
            "update classroom.classes set join_code = :k where id = :c returning *",
            {"k": _code(conn), "c": c["id"]},
        )
        assert c is not None
        return _class_out(conn, c, "instructor", u)


# ─── joining, with consent ──────────────────────────────────────────────────────


def _by_code(conn: Connection, code: str) -> dict[str, Any]:
    c = q1(
        conn,
        "select * from classroom.classes where join_code = :k and archived_at is null",
        {"k": _str(code, 20).lower()},
    )
    if c is None:
        raise Refusal(404, "not_found", "This join link does not open a class.")
    return c


def preview(u: dict[str, Any], code: str) -> dict[str, Any]:
    """What a reader is shown before joining: the class, its instructor, whether it is for minors, and the consent
    wording's version they would agree to."""
    with tx() as conn:
        c = _by_code(conn, code)
        instructor = q1(
            conn, "select display_name from accounts.users where id = :u", {"u": c["instructor_id"]}
        )
        return {
            "class": {"id": str(c["id"]), "name": c["name"], "minors": c["minors"]},
            "instructor": {"name": instructor["display_name"] if instructor else None},
            "consent_version": CONSENT_VERSION,
            "floor": FLOOR,
            "already": "instructor"
            if str(c["instructor_id"]) == str(u["id"])
            else "member"
            if _membership(conn, u, str(c["id"]))
            else None,
        }


def join(u: dict[str, Any], code: str, consent: Any, detail_opt_in: Any) -> dict[str, Any]:
    if consent != CONSENT_VERSION:
        raise Refusal(422, "consent", "Read what the instructor will see, and agree to it, to join.")
    with tx() as conn:
        c = _by_code(conn, code)
        if str(c["instructor_id"]) == str(u["id"]):
            raise Refusal(409, "own_class", "You teach this class.")
        q(
            conn,
            """insert into classroom.members (class_id, user_id, detail_opt_in, consent_version)
               values (:c, :u, :d, :v)
               on conflict (class_id, user_id) do update set consent_version = excluded.consent_version
               returning class_id""",
            {"c": c["id"], "u": u["id"], "d": bool(detail_opt_in) and not c["minors"], "v": CONSENT_VERSION},
        )
        return _class_out(conn, c, "member", u)


def set_detail(u: dict[str, Any], cid: str, on: Any) -> dict[str, Any]:
    """A member shows their own detail to the instructor, or stops: theirs to change at any time."""
    with tx() as conn:
        c = _class(conn, cid)
        if not _membership(conn, u, str(c["id"])):
            raise Refusal(404, "not_found", "No such class.")
        q(
            conn,
            "update classroom.members set detail_opt_in = :d where class_id = :c and user_id = :u returning class_id",
            {"d": bool(on) and not c["minors"], "c": c["id"], "u": u["id"]},
        )
        return _class_out(conn, c, "member", u)


def _forget_member(conn: Connection, cid: Any, uid: Any) -> None:
    from . import shared_maps

    lessons = "select id from classroom.lessons where class_id = :c"
    for t in ("counts", "progress", "nudges", "proposals"):
        q(
            conn,
            f"delete from classroom.{t} where user_id = :u and lesson_id in ({lessons}) returning user_id",
            {"c": cid, "u": uid},
        )
    q(
        conn,
        f"delete from classroom.activity where who = :u and lesson_id in ({lessons}) returning id",
        {"c": cid, "u": uid},
    )
    # their comments on the class's maps go (one others answered stays as a mark), and mentions of them
    maps = "select graph_id from classroom.lessons where class_id = :c and graph_id is not null"
    said = [
        r["id"]
        for r in q(
            conn,
            f"select id from graphs.comments where author_id = :u and graph_id in ({maps})",
            {"c": cid, "u": uid},
        )
    ]
    if said:
        shared_maps._drop(conn, said)
    q(
        conn,
        f"""update graphs.comments set mentions = array_remove(mentions, cast(:u as uuid))
            where cast(:u as uuid) = any(mentions) and graph_id in ({maps}) returning id""",
        {"c": cid, "u": str(uid)},
    )
    q(
        conn,
        "delete from classroom.members where class_id = :c and user_id = :u returning user_id",
        {"c": cid, "u": uid},
    )


def leave(u: dict[str, Any], cid: str) -> None:
    """A member leaves: what the class held of them goes with them."""
    with tx() as conn:
        c = _class(conn, cid)
        if not _membership(conn, u, str(c["id"])):
            raise Refusal(404, "not_found", "No such class.")
        _forget_member(conn, c["id"], u["id"])


def remove(u: dict[str, Any], cid: str, member: str) -> None:
    """The instructor removes a member: what the class held of them goes too."""
    with tx() as conn:
        c = _own(conn, u, cid)
        _forget_member(conn, c["id"], _uuid(member, "member"))


# ─── lessons ──────────────────────────────────────────────────────────────────


def _ranges(raw: Any) -> list[dict[str, int]]:
    """Verse ranges of the mushaf (CLS-Q03): one to ten, each within its sūra, three hundred verses at most."""
    if not isinstance(raw, list) or not 1 <= len(raw) <= 10:
        raise Refusal(422, "bad_ranges", "A lesson is one to ten ranges of verses.")
    out, total = [], 0
    with connect() as c:
        counts = {
            r["number"]: r["verse_count"] for r in rows(c, "select number, verse_count from content.surahs")
        }
    for r in raw:
        try:
            s, a, b = int(r["surah"]), int(r["from"]), int(r["to"])
        except (KeyError, TypeError, ValueError):
            raise Refusal(422, "bad_ranges", "A range names a sūra and its first and last verse.") from None
        if s not in counts or not 1 <= a <= b <= counts[s]:
            raise Refusal(422, "bad_ranges", f"Sūra {s} has no verses {a}–{b}.")
        total += b - a + 1
        out.append({"surah": s, "from": a, "to": b})
    if total > 300:
        raise Refusal(422, "bad_ranges", "A lesson holds three hundred verses at most.")
    return out


def _roots(raw: Any) -> list[str]:
    if raw is None:
        return []
    if (
        not isinstance(raw, list)
        or len(raw) > 30
        or not all(isinstance(x, str) and 1 <= len(x) <= 8 for x in raw)
    ):
        raise Refusal(422, "bad_roots", "A lesson names thirty roots at most.")
    keys = list(dict.fromkeys(x.replace(" ", "") for x in raw))
    with connect() as c:
        known = {r["key"] for r in rows(c, "select key from content.roots where key = any(:k)", {"k": keys})}
    unknown = [k for k in keys if k not in known]
    if unknown:
        raise Refusal(422, "unknown_root", f"No root {unknown[0]} in the corpus.")
    return keys


def _due(raw: Any) -> datetime | None:
    if raw in (None, ""):
        return None
    try:
        d = date.fromisoformat(str(raw))
    except ValueError:
        raise Refusal(422, "bad_due", "A due date is a day (YYYY-MM-DD).") from None
    return datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=UTC)


def _verse_count(ranges: list[dict[str, Any]]) -> int:
    return sum(r["to"] - r["from"] + 1 for r in ranges)


def _lesson_out(conn: Connection, lesson: dict[str, Any], role: str, u: dict[str, Any]) -> dict[str, Any]:
    with connect() as c:
        spaced = {
            r["key"]: r["spaced"]
            for r in rows(
                c, "select key, spaced from content.roots where key = any(:k)", {"k": list(lesson["roots"])}
            )
        }
    out: dict[str, Any] = {
        "id": str(lesson["id"]),
        "class_id": str(lesson["class_id"]),
        "title": lesson["title"],
        "ranges": lesson["ranges"],
        "verses": _verse_count(lesson["ranges"]),
        "roots": [{"key": k, "spaced": spaced.get(k, k)} for k in lesson["roots"]],
        "assigned_at": _iso(lesson["assigned_at"]),
        "due_at": _iso(lesson["due_at"]),
        "open_until": _iso(open_until(lesson)),
        "open": datetime.now(UTC) <= open_until(lesson),
        "map": _map_out(conn, lesson, role),
        "pending": q1(
            conn,
            "select count(*)::int as n from classroom.proposals where lesson_id = :l and status = 'pending'",
            {"l": lesson["id"]},
        )["n"],  # type: ignore[index]
    }
    if role == "member":
        p = q1(
            conn,
            "select opened_on, finished_on, minutes from classroom.progress where lesson_id = :l and user_id = :u",
            {"l": lesson["id"], "u": u["id"]},
        )
        n = q1(
            conn,
            "select sent_at, seen_at from classroom.nudges where lesson_id = :l and user_id = :u",
            {"l": lesson["id"], "u": u["id"]},
        )
        out["mine"] = {
            "opened_on": _iso(p["opened_on"]) if p else None,
            "finished_on": _iso(p["finished_on"]) if p else None,
            "minutes": p["minutes"] if p else 0,
            "nudged": bool(n and not n["seen_at"]),
        }
    return out


def _lessons_of(conn: Connection, c: dict[str, Any], role: str, u: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        _lesson_out(conn, x, role, u)
        for x in q(
            conn,
            "select * from classroom.lessons where class_id = :c order by assigned_at desc",
            {"c": c["id"]},
        )
    ]


def lessons(u: dict[str, Any], cid: str) -> dict[str, Any]:
    with tx() as conn:
        c = _class(conn, cid)
        return {"data": _lessons_of(conn, c, _role_in(conn, u, c), u)}


def _open_class(c: dict[str, Any]) -> None:
    if c["archived_at"]:
        raise Refusal(409, "archived", "An archived class takes no new lesson.")


def add_lesson(u: dict[str, Any], cid: str, title: Any, ranges: Any, roots: Any, due: Any) -> dict[str, Any]:
    with tx() as conn:
        c = _own(conn, u, cid)
        _open_class(c)
        lesson = q1(
            conn,
            """insert into classroom.lessons (class_id, title, ranges, roots, due_at)
               values (:c, :t, cast(:r as jsonb), :k, :d) returning *""",
            {
                "c": c["id"],
                "t": _str(title, 160, need=True, field="lesson's title"),
                "r": json.dumps(_ranges(ranges)),
                "k": _roots(roots),
                "d": _due(due),
            },
        )
        assert lesson is not None
        return _lesson_out(conn, lesson, "instructor", u)


def copy_lesson(u: dict[str, Any], lid: str, cid: str) -> dict[str, Any]:
    """An instructor teaching several classes copies a lesson into another of theirs (B46): its title, verses, roots,
    due date and lesson notes — nothing of any member, and not its map, which is the first class's."""
    with tx() as conn:
        lesson = _lesson(conn, lid)
        _own(conn, u, str(lesson["class_id"]))
        c = _own(conn, u, cid)
        _open_class(c)
        if c["id"] == lesson["class_id"]:
            raise Refusal(409, "same_class", "The lesson is in this class already.")
        new = q1(
            conn,
            """insert into classroom.lessons (class_id, title, ranges, roots, due_at)
               values (:c, :t, cast(:r as jsonb), :k, :d) returning *""",
            {
                "c": c["id"],
                "t": lesson["title"],
                "r": json.dumps(lesson["ranges"]),
                "k": list(lesson["roots"]),
                "d": lesson["due_at"],
            },
        )
        assert new is not None
        q(
            conn,
            """insert into classroom.notes (lesson_id, location, root, text, position)
               select :n, location, root, text, position from classroom.notes where lesson_id = :l returning id""",
            {"n": new["id"], "l": lesson["id"]},
        )
        out = _lesson_out(conn, new, "instructor", u)
        out["class"] = {"id": str(c["id"]), "name": c["name"], "minors": c["minors"], "role": "instructor"}
        return out


def _lesson_role(conn: Connection, u: dict[str, Any], lid: str) -> tuple[dict[str, Any], dict[str, Any], str]:
    lesson = _lesson(conn, lid)
    c = _class(conn, str(lesson["class_id"]))
    return lesson, c, _role_in(conn, u, c)


def get_lesson(u: dict[str, Any], lid: str) -> dict[str, Any]:
    with tx() as conn:
        lesson, c, role = _lesson_role(conn, u, lid)
        out = _lesson_out(conn, lesson, role, u)
        out["class"] = {"id": str(c["id"]), "name": c["name"], "minors": c["minors"], "role": role}
        if role == "member":
            # opening a lesson marks a reminder for it seen
            q(
                conn,
                "update classroom.nudges set seen_at = now() where lesson_id = :l and user_id = :u and seen_at is null returning lesson_id",
                {"l": lesson["id"], "u": u["id"]},
            )
        return out


def update_lesson(
    u: dict[str, Any], lid: str, title: Any = None, ranges: Any = None, roots: Any = None, due: Any = ...
) -> dict[str, Any]:
    with tx() as conn:
        lesson = _lesson(conn, lid)
        _own(conn, u, str(lesson["class_id"]))
        sets: dict[str, Any] = {}
        if title is not None:
            sets["title"] = _str(title, 160, need=True, field="lesson's title")
        if ranges is not None:
            sets["ranges"] = json.dumps(_ranges(ranges))
        if roots is not None:
            sets["roots"] = _roots(roots)
        if due is not ...:
            sets["due_at"] = _due(due)
        if sets:
            cols = ", ".join(f"{k} = cast(:{k} as jsonb)" if k == "ranges" else f"{k} = :{k}" for k in sets)
            lesson = q1(
                conn,
                f"update classroom.lessons set {cols} where id = :id returning *",
                {**sets, "id": lesson["id"]},
            )
            assert lesson is not None
        return _lesson_out(conn, lesson, "instructor", u)


def delete_lesson(u: dict[str, Any], lid: str) -> None:
    """A lesson deleted takes what it counted, its notes and proposals, and its map's shared copy."""
    with tx() as conn:
        lesson = _lesson(conn, lid)
        _own(conn, u, str(lesson["class_id"]))
        if lesson["graph_id"]:
            q(conn, "delete from graphs.documents where id = :g returning id", {"g": lesson["graph_id"]})
        q(conn, "delete from classroom.lessons where id = :l returning id", {"l": lesson["id"]})


def pack(u: dict[str, Any], lid: str) -> dict[str, Any]:
    """A lesson as a file a learner opens with no account (CLS-Q07): its verses, roots and the instructor's lesson
    notes — nothing of any learner."""
    with tx() as conn:
        lesson, c, _ = _lesson_role(conn, u, lid)
        instructor = q1(
            conn, "select display_name from accounts.users where id = :u", {"u": c["instructor_id"]}
        )
        notes = q(
            conn,
            "select location, root, text from classroom.notes where lesson_id = :l order by position",
            {"l": lesson["id"]},
        )
        # a note on a word carries the word as the mushaf writes it, so the file reads without the site
        with connect() as cc:
            written = {
                w["location"]: w["text_uthmani"]
                for w in rows(
                    cc,
                    "select location, text_uthmani from content.words where location = any(:l)",
                    {"l": [n["location"] for n in notes if n["location"]]},
                )
            }
        notes = [{**n, "word": written.get(n["location"]) if n["location"] else None} for n in notes]
        out = _lesson_out(conn, lesson, "instructor", u)
        return {
            "format": "jadhr-lesson-pack",
            "version": 1,
            "title": lesson["title"],
            "class": c["name"],
            "instructor": instructor["display_name"] if instructor else None,
            "ranges": lesson["ranges"],
            "verses": [f"{r['surah']}:{a}" for r in lesson["ranges"] for a in range(r["from"], r["to"] + 1)],
            "roots": out["roots"],
            "notes": notes,
            "due_at": out["due_at"],
            "exported_at": datetime.now(UTC).isoformat(),
        }


def active(u: dict[str, Any]) -> dict[str, Any]:
    """The open lessons of the classes this reader joined: the verses for which their reader sends what it counts,
    and until when."""
    now = datetime.now(UTC)
    with tx() as conn:
        found = q(
            conn,
            """select l.*, c.name as class_name from classroom.lessons l
               join classroom.classes c on c.id = l.class_id and c.archived_at is null
               join classroom.members m on m.class_id = c.id and m.user_id = :u
               where l.assigned_at <= now()
               order by l.assigned_at desc""",
            {"u": u["id"]},
        )
        return {
            "data": [
                {
                    "id": str(x["id"]),
                    "class": x["class_name"],
                    "title": x["title"],
                    "ranges": x["ranges"],
                    "roots": list(x["roots"]),
                    "due_at": _iso(x["due_at"]),
                    "open_until": _iso(open_until(x)),
                }
                for x in found
                if now <= open_until(x)
            ]
        }


def purge() -> dict[str, int]:
    """What a lesson counted goes 90 days after its due date (or after it closed, with none)."""
    with tx() as conn:
        out = {}
        for t in ("counts", "progress", "nudges"):
            out[t] = len(
                q(
                    conn,
                    f"""delete from classroom.{t} x using classroom.lessons l where l.id = x.lesson_id
                        and coalesce(l.due_at + interval '{OPEN_AFTER_DUE.days} days', l.assigned_at + interval '{OPEN_WITHOUT_DUE.days} days')
                            < now() - interval '{(KEEP_AFTER_DUE - OPEN_AFTER_DUE).days} days'
                        returning x.lesson_id""",
                )
            )
        return out


def export_for(u: dict[str, Any]) -> dict[str, Any]:
    """What the classroom holds of the reader, in the account's export (P6): the classes they teach with their
    lessons and notes, the classes they joined with what they agreed to, and what their reader counted there."""
    with tx() as conn:
        taught = q(
            conn,
            "select * from classroom.classes where instructor_id = :u order by created_at",
            {"u": u["id"]},
        )
        out_taught = []
        for c in taught:
            ls = q(
                conn,
                "select * from classroom.lessons where class_id = :c order by assigned_at",
                {"c": c["id"]},
            )
            out_taught.append(
                {
                    "name": c["name"],
                    "minors": c["minors"],
                    "created_at": _iso(c["created_at"]),
                    "lessons": [
                        {
                            "title": x["title"],
                            "ranges": x["ranges"],
                            "roots": list(x["roots"]),
                            "due_at": _iso(x["due_at"]),
                            "notes": q(
                                conn,
                                "select location, root, text from classroom.notes where lesson_id = :l order by position",
                                {"l": x["id"]},
                            ),
                        }
                        for x in ls
                    ],
                }
            )
        joined = q(
            conn,
            """select c.name, m.joined_at, m.consent_version, m.detail_opt_in from classroom.members m
               join classroom.classes c on c.id = m.class_id where m.user_id = :u order by m.joined_at""",
            {"u": u["id"]},
        )
        counted = q(
            conn,
            """select l.title as lesson, x.location, x.kind, x.day, x.n from classroom.counts x
               join classroom.lessons l on l.id = x.lesson_id where x.user_id = :u order by x.day, x.location""",
            {"u": u["id"]},
        )
        progress = q(
            conn,
            """select l.title as lesson, p.opened_on, p.finished_on, p.minutes from classroom.progress p
               join classroom.lessons l on l.id = p.lesson_id where p.user_id = :u order by p.opened_on""",
            {"u": u["id"]},
        )
        nudged = q(
            conn,
            """select l.title as lesson, n.sent_at, n.seen_at from classroom.nudges n
               join classroom.lessons l on l.id = n.lesson_id where n.user_id = :u order by n.sent_at""",
            {"u": u["id"]},
        )
        proposed = q(
            conn,
            """select l.title as lesson, p.cards, p.links, p.note, p.status, p.created_at, p.decided_at
               from classroom.proposals p join classroom.lessons l on l.id = p.lesson_id
               where p.user_id = :u order by p.created_at""",
            {"u": u["id"]},
        )
        did = q(
            conn,
            """select l.title as lesson, a.kind, a.detail, a.at from classroom.activity a
               join classroom.lessons l on l.id = a.lesson_id where a.who = :u order by a.at""",
            {"u": u["id"]},
        )
    return {
        "classroom": {
            "proposals": [
                {**p, "created_at": _iso(p["created_at"]), "decided_at": _iso(p["decided_at"])}
                for p in proposed
            ],
            "activity": [{**a, "at": _iso(a["at"])} for a in did],
            "nudges": [
                {"lesson": n["lesson"], "sent_at": _iso(n["sent_at"]), "seen_at": _iso(n["seen_at"])}
                for n in nudged
            ],
            "teaching": out_taught,
            "joined": [
                {
                    "class": j["name"],
                    "joined_at": _iso(j["joined_at"]),
                    "consent_version": j["consent_version"],
                    "detail_opt_in": j["detail_opt_in"],
                }
                for j in joined
            ],
            "counts": [{**c, "day": _iso(c["day"])} for c in counted],
            "progress": [
                {**p, "opened_on": _iso(p["opened_on"]), "finished_on": _iso(p["finished_on"])}
                for p in progress
            ],
        }
    }


# ─── what a member's reader sends for an open lesson (P9.2a) ─────────────────────

KINDS = ("lookup", "note", "confirm", "struggle")
_PLACE = re.compile(r"^(\d{1,3}):(\d{1,3}):(\d{1,3})$")


def _in(location: str, ranges: list[dict[str, Any]]) -> bool:
    m = _PLACE.match(location)
    if not m:
        return False
    s, a = int(m.group(1)), int(m.group(2))
    return any(r["surah"] == s and r["from"] <= a <= r["to"] for r in ranges)


def _open_for(conn: Connection, u: dict[str, Any], lid: str) -> dict[str, Any]:
    """A lesson this reader is a member for, open now: anything else is refused, never kept."""
    lesson, c, role = _lesson_role(conn, u, lid)
    if role != "member":
        raise Refusal(403, "not_member", "Only a member's reader sends what it counts.")
    now = datetime.now(UTC)
    if c["archived_at"] or not lesson["assigned_at"] <= now <= open_until(lesson):
        raise Refusal(409, "closed", "This lesson is not open.")
    return lesson


def _day(raw: Any) -> date:
    """The reader's own day, within a day of the server's either way (time zones), never an earlier one."""
    try:
        d = date.fromisoformat(str(raw))
    except ValueError:
        raise Refusal(422, "bad_day", "A day is YYYY-MM-DD.") from None
    if abs((d - datetime.now(UTC).date()).days) > 1:
        raise Refusal(422, "bad_day", "Counts are sent for the day they were made.")
    return d


def add_counts(u: dict[str, Any], lid: str, day: Any, items: Any) -> dict[str, Any]:
    """A batch of counts: per word's place (a verse's own place is its word 0), kind and day; a place outside the
    lesson's verses is not kept."""
    if not isinstance(items, list) or not 1 <= len(items) <= 500:
        raise Refusal(422, "bad_batch", "One to five hundred counts at a time.")
    d = _day(day)
    with tx() as conn:
        lesson = _open_for(conn, u, lid)
        summed: dict[tuple[str, str], int] = {}
        refused = 0
        for it in items:
            loc, kind, n = (it or {}).get("location"), (it or {}).get("kind"), (it or {}).get("n", 1)
            if (
                not isinstance(loc, str)
                or kind not in KINDS
                or not isinstance(n, int)
                or not 1 <= n <= 100
                or not _in(loc, lesson["ranges"])
            ):
                refused += 1
                continue
            summed[(loc, kind)] = summed.get((loc, kind), 0) + n
        for (loc, kind), n in summed.items():
            q(
                conn,
                """insert into classroom.counts (lesson_id, user_id, location, kind, day, n) values (:l, :u, :loc, :k, :d, :n)
                   on conflict (lesson_id, user_id, location, kind, day)
                   do update set n = least(classroom.counts.n + excluded.n, 10000) returning n""",
                {"l": lesson["id"], "u": u["id"], "loc": loc, "k": kind, "d": d, "n": n},
            )
        return {"kept": sum(summed.values()), "refused": refused}


def progress(u: dict[str, Any], lid: str, day: Any, finished: Any = None, minutes: Any = 0) -> dict[str, Any]:
    """The member's lesson: opened (the first day it was read), finished by their word or not, the active minutes
    their reader counted (at most an hour per message)."""
    d = _day(day)
    if not isinstance(minutes, int) or not 0 <= minutes <= 60:
        raise Refusal(422, "bad_minutes", "Zero to sixty minutes at a time.")
    with tx() as conn:
        lesson = _open_for(conn, u, lid)
        q(
            conn,
            """insert into classroom.progress (lesson_id, user_id, opened_on, minutes) values (:l, :u, :d, :m)
               on conflict (lesson_id, user_id) do update set minutes = least(classroom.progress.minutes + excluded.minutes, 100000)
               returning minutes""",
            {"l": lesson["id"], "u": u["id"], "d": d, "m": minutes},
        )
        if finished is not None:
            q(
                conn,
                "update classroom.progress set finished_on = :f where lesson_id = :l and user_id = :u returning lesson_id",
                {"f": d if finished else None, "l": lesson["id"], "u": u["id"]},
            )
        return _lesson_out(conn, lesson, "member", u)["mine"]


# ─── what the instructor sees (P9.2b) ───────────────────────────────────────────


def _teaching(conn: Connection, u: dict[str, Any], lid: str) -> tuple[dict[str, Any], dict[str, Any]]:
    lesson, c, role = _lesson_role(conn, u, lid)
    if role != "instructor":
        raise Refusal(403, "not_instructor", "Only the class's instructor sees this.")
    return lesson, c


def _members(conn: Connection, c: dict[str, Any]) -> list[dict[str, Any]]:
    """The class's members, each with whether their own detail may be shown (their choice; never for minors)."""
    return [
        {**m, "shows": bool(m["detail_opt_in"]) and not c["minors"]}
        for m in q(
            conn,
            """select m.user_id, m.detail_opt_in, u.display_name from classroom.members m
               join accounts.users u on u.id = m.user_id where m.class_id = :c order by m.joined_at""",
            {"c": c["id"]},
        )
    ]


def _cell(learners: int, total: int) -> dict[str, Any]:
    """A number about a word or a root: counted from FEW learners or more, else said to be few."""
    return {"learners": learners, "total": total} if learners >= FEW else {"few": True}


def heat(u: dict[str, Any], lid: str) -> dict[str, Any]:
    """A lesson as its instructor sees it: the class's totals — opened, finished, the median minutes — and who needs a
    reminder (by name only for those who chose it); per word and kind, how many learners and how often, once the class
    has FLOOR members and from FEW learners up; the roots most looked up. Never a learner's own row."""
    with tx() as conn:
        lesson, c = _teaching(conn, u, lid)
        members = _members(conn, c)
        shows = {str(m["user_id"]): (m["display_name"] or None) for m in members if m["shows"]}
        progress = {
            str(p["user_id"]): p
            for p in q(conn, "select * from classroom.progress where lesson_id = :l", {"l": lesson["id"]})
        }
        ids = [str(m["user_id"]) for m in members]
        opened = [i for i in ids if i in progress]
        finished = [i for i in opened if progress[i]["finished_on"]]
        quick = [i for i in finished if progress[i]["minutes"] < 3]
        minutes = sorted(progress[i]["minutes"] for i in opened if progress[i]["minutes"] > 0)
        median = (
            minutes[len(minutes) // 2]
            if len(minutes) % 2
            else (sum(minutes[len(minutes) // 2 - 1 : len(minutes) // 2 + 1]) / 2 if minutes else None)
        )
        floor_met = len(ids) >= FLOOR
        words: dict[str, dict[str, Any]] = {}
        roots: list[dict[str, Any]] = []
        if floor_met:
            for r in q(
                conn,
                """select location, kind, count(distinct user_id)::int as learners, sum(n)::int as total
                   from classroom.counts where lesson_id = :l and user_id = any(cast(:u as uuid[])) group by location, kind""",
                {"l": lesson["id"], "u": ids},
            ):
                words.setdefault(r["location"], {})[r["kind"]] = _cell(r["learners"], r["total"])
            with connect() as cc:
                found = rows(
                    cc,
                    "select w.location, r.key, r.spaced from content.words w join content.roots r on r.id = w.root_id where w.location = any(:l)",
                    {"l": [k for k in words]},
                )
            root_of = {f["location"]: (f["key"], f["spaced"]) for f in found}
            by: dict[tuple[str, str], tuple[set[str], int]] = {}
            for r in q(
                conn,
                """select location, user_id, sum(n)::int as n from classroom.counts
                   where lesson_id = :l and kind = 'lookup' and user_id = any(cast(:u as uuid[])) group by location, user_id""",
                {"l": lesson["id"], "u": ids},
            ):
                k = root_of.get(r["location"])
                if k:
                    who, total = by.get(k, (set(), 0))
                    by[k] = (who | {str(r["user_id"])}, total + r["n"])
            roots = [
                {"key": k[0], "spaced": k[1], **_cell(len(who), total)}
                for k, (who, total) in sorted(by.items(), key=lambda x: -x[1][1])[:4]
            ]
        nudges = q1(
            conn,
            "select count(*)::int as sent, count(seen_at)::int as seen from classroom.nudges where lesson_id = :l",
            {"l": lesson["id"]},
        )

        def named(group: list[str]) -> list[str | None]:
            return [shows[i] for i in group if i in shows]

        return {
            "members": len(ids),
            "floor": FLOOR,
            "few": FEW,
            "floor_met": floor_met,
            "minors": c["minors"],
            "opened": len(opened),
            "finished": len(finished),
            "median_minutes": median,
            "not_started": {
                "count": len(ids) - len(opened),
                "named": named([i for i in ids if i not in progress]),
            },
            "quick": {"count": len(quick), "named": named(quick)},
            "words": words,
            "roots": roots,
            "nudges": nudges,
        }


def matrix(u: dict[str, Any], lid: str, layer: str) -> dict[str, Any]:
    """The class's learners by the lesson's roots (D13's matrix): a row for each learner who chose to show their
    detail, the others together in one row when there are FEW of them or more; cells summed for one kind."""
    if layer not in KINDS:
        raise Refusal(422, "bad_layer", "No such layer.")
    with tx() as conn:
        lesson, c = _teaching(conn, u, lid)
        members = _members(conn, c)
        ids = [str(m["user_id"]) for m in members]
        counted = q(
            conn,
            """select location, user_id, sum(n)::int as n from classroom.counts
               where lesson_id = :l and kind = :k and user_id = any(cast(:u as uuid[])) group by location, user_id""",
            {"l": lesson["id"], "k": layer, "u": ids},
        )
        with connect() as cc:
            found = rows(
                cc,
                "select w.location, r.key from content.words w join content.roots r on r.id = w.root_id where w.location = any(:l)",
                {"l": list({x["location"] for x in counted})},
            )
            root_of = {f["location"]: f["key"] for f in found}
            sums: dict[str, int] = {}
            for x in counted:
                if root_of.get(x["location"]):
                    sums[root_of[x["location"]]] = sums.get(root_of[x["location"]], 0) + x["n"]
            keys = list(dict.fromkeys([*lesson["roots"], *sorted(sums, key=lambda k: -sums[k])]))[:12]
            spaced = {
                r["key"]: r["spaced"]
                for r in rows(cc, "select key, spaced from content.roots where key = any(:k)", {"k": keys})
            }
        columns = [{"key": k, "spaced": spaced.get(k, k)} for k in keys]
        if len(ids) < FLOOR:
            return {
                "floor_met": False,
                "floor": FLOOR,
                "members": len(ids),
                "columns": columns,
                "rows": [],
                "others": None,
            }
        cells: dict[str, dict[str, int]] = {}
        for x in counted:
            k = root_of.get(x["location"])
            if k is not None and k in keys:
                row = cells.setdefault(str(x["user_id"]), {})
                row[k] = row.get(k, 0) + x["n"]
        shown = [m for m in members if m["shows"]]
        rest = [str(m["user_id"]) for m in members if not m["shows"]]
        others = None
        if len(rest) >= FEW:
            agg: dict[str, int] = {}
            for i in rest:
                for k, n in cells.get(i, {}).items():
                    agg[k] = agg.get(k, 0) + n
            others = {"count": len(rest), "cells": agg}
        return {
            "floor_met": True,
            "floor": FLOOR,
            "members": len(ids),
            "columns": columns,
            "rows": [{"name": m["display_name"], "cells": cells.get(str(m["user_id"]), {})} for m in shown],
            "others": others,
            "others_few": 0 < len(rest) < FEW,
        }


def mine(u: dict[str, Any], lid: str) -> dict[str, Any]:
    """What this member's reader sent for a lesson, as the server keeps it: the member may always see it."""
    with tx() as conn:
        lesson, _, role = _lesson_role(conn, u, lid)
        if role != "member":
            raise Refusal(403, "not_member", "This is a member's own.")
        return {
            "counts": q(
                conn,
                """select location, kind, sum(n)::int as n from classroom.counts where lesson_id = :l and user_id = :u
                   group by location, kind order by location, kind""",
                {"l": lesson["id"], "u": u["id"]},
            )
        }


# the instructor's lesson notes (CLS-19, 20): saved, reordered, removed


def notes(u: dict[str, Any], lid: str) -> dict[str, Any]:
    with tx() as conn:
        lesson, _ = _teaching(conn, u, lid)
        return {"data": _notes_of(conn, lesson["id"])}


def _notes_of(conn: Connection, lid: Any) -> list[dict[str, Any]]:
    return [
        {"id": str(n["id"]), "location": n["location"], "root": n["root"], "text": n["text"]}
        for n in q(
            conn,
            "select * from classroom.notes where lesson_id = :l order by position, created_at",
            {"l": lid},
        )
    ]


def add_note(u: dict[str, Any], lid: str, location: Any, root: Any, text: Any) -> dict[str, Any]:
    with tx() as conn:
        lesson, _ = _teaching(conn, u, lid)
        loc = (
            location
            if isinstance(location, str) and _PLACE.match(location) and _in(location, lesson["ranges"])
            else None
        )
        rk = _str(root, 8) or None
        body = _str(text, 1000)
        if not loc and not rk and not body:
            raise Refusal(422, "empty", "A note names a word, a root, or says something.")
        n = q1(
            conn, "select count(*)::int as n from classroom.notes where lesson_id = :l", {"l": lesson["id"]}
        )["n"]  # type: ignore[index]
        if n >= 100:
            raise Refusal(422, "too_many", "A lesson keeps a hundred notes at most.")
        if loc and q1(
            conn,
            "select 1 as x from classroom.notes where lesson_id = :l and location = :loc",
            {"l": lesson["id"], "loc": loc},
        ):
            raise Refusal(409, "already", "This word is in the lesson notes already.")
        q(
            conn,
            "insert into classroom.notes (lesson_id, location, root, text, position) values (:l, :loc, :r, :t, :p) returning id",
            {"l": lesson["id"], "loc": loc, "r": rk, "t": body, "p": n},
        )
        return {"data": _notes_of(conn, lesson["id"])}


def edit_note(u: dict[str, Any], nid: str, text: Any = None, move: Any = None) -> dict[str, Any]:
    with tx() as conn:
        n = q1(conn, "select * from classroom.notes where id = :n", {"n": _uuid(nid, "note")})
        if n is None:
            raise Refusal(404, "not_found", "No such note.")
        lesson, _ = _teaching(conn, u, str(n["lesson_id"]))
        if text is not None:
            q(
                conn,
                "update classroom.notes set text = :t where id = :n returning id",
                {"t": _str(text, 1000), "n": n["id"]},
            )
        if move in (-1, 1):
            order = [
                x["id"]
                for x in q(
                    conn,
                    "select id from classroom.notes where lesson_id = :l order by position, created_at",
                    {"l": lesson["id"]},
                )
            ]
            i = order.index(n["id"])
            j = i + move
            if 0 <= j < len(order):
                order[i], order[j] = order[j], order[i]
                for p, x in enumerate(order):
                    q(
                        conn,
                        "update classroom.notes set position = :p where id = :n returning id",
                        {"p": p, "n": x},
                    )
        return {"data": _notes_of(conn, lesson["id"])}


def delete_note(u: dict[str, Any], nid: str) -> dict[str, Any]:
    with tx() as conn:
        n = q1(conn, "select * from classroom.notes where id = :n", {"n": _uuid(nid, "note")})
        if n is None:
            raise Refusal(404, "not_found", "No such note.")
        lesson, _ = _teaching(conn, u, str(n["lesson_id"]))
        q(conn, "delete from classroom.notes where id = :n returning id", {"n": n["id"]})
        return {"data": _notes_of(conn, lesson["id"])}


def nudge(u: dict[str, Any], lid: str) -> dict[str, Any]:
    """A reminder, gently, to every member who has not opened the lesson: a notice on their own classroom page, never
    a message sent anywhere. The instructor learns how many, not who (unless they chose to be shown)."""
    with tx() as conn:
        lesson, c = _teaching(conn, u, lid)
        if datetime.now(UTC) > open_until(lesson):
            raise Refusal(409, "closed", "This lesson is not open.")
        sent = q(
            conn,
            """insert into classroom.nudges (lesson_id, user_id)
               select :l, m.user_id from classroom.members m
               where m.class_id = :c and not exists (select 1 from classroom.progress p where p.lesson_id = :l and p.user_id = m.user_id)
               on conflict (lesson_id, user_id) do update set sent_at = now(), seen_at = null
               returning user_id""",
            {"l": lesson["id"], "c": c["id"]},
        )
        return {"sent": len(sent)}


# ─── the lesson's map (P9.3) ───────────────────────────────────────────────────

CARD_KINDS = ("root", "pattern", "lemma", "verse", "note", "frame")
MAX_PROPOSAL_CARDS = 40
MAX_PROPOSAL_LINKS = 80
MAX_PROPOSAL_BYTES = 200_000
MAX_PENDING = 20  # one member's proposals waiting on one lesson
EDIT_RUN = timedelta(minutes=10)  # the instructor's saves within this read as one entry
FEED_MOST = 50


def _graph_of(conn: Connection, lesson: dict[str, Any]) -> dict[str, Any] | None:
    if not lesson["graph_id"]:
        return None
    return q1(conn, "select * from graphs.documents where id = :g", {"g": lesson["graph_id"]})


def _map_out(conn: Connection, lesson: dict[str, Any], role: str) -> dict[str, Any] | None:
    g = _graph_of(conn, lesson)
    if g is None:
        return None
    return {
        "id": str(g["id"]),
        "revision": g["revision"],
        "cards": g["cards"],
        "title": g["title"],
        # the instructor's own id for it in their browser: their copy and the class's are one map
        **({"local_id": g["local_id"]} if role == "instructor" else {}),
    }


def _card(n: Any) -> dict[str, Any]:
    """What a feed or a proposal says of a card: its id, its kind and its name — the root's letters, the word, the
    verse's key, a note's first words, a group's title."""
    d = n.get("data") if isinstance(n, dict) and isinstance(n.get("data"), dict) else {}
    kind = d.get("kind") if d.get("kind") in CARD_KINDS else "note"
    verse = d.get("verse") if isinstance(d.get("verse"), dict) else {}
    label = d.get("ar") or verse.get("key") or d.get("title") or d.get("text") or ""
    return {"id": str(n.get("id", ""))[:200], "kind": kind, "label": str(label).strip()[:80]}


def map_gate(conn: Connection, graph_id: Any, viewer: dict[str, Any] | None) -> dict[str, Any] | None:
    """A lesson's map is its class's: None when the map is no lesson's; else the lesson, its class and the viewer's
    place in it — and anyone outside the class (or signed out) is refused as if the map were not there."""
    row = q1(
        conn,
        """select l.id as lesson_id, l.title as lesson_title, l.class_id, c.name as class_name, c.instructor_id
           from classroom.lessons l join classroom.classes c on c.id = l.class_id where l.graph_id = :g""",
        {"g": graph_id},
    )
    if row is None:
        return None
    if viewer is not None and str(row["instructor_id"]) == str(viewer["id"]):
        role = "instructor"
    elif viewer is not None and _membership(conn, viewer, str(row["class_id"])):
        role = "member"
    else:
        raise Refusal(404, "class_only", "This map is a class's: its members read it, signed in.")
    return {**row, "role": role}


def map_people(conn: Connection, graph_id: Any) -> dict[str, str | None]:
    """On a lesson's map anyone in the class may be mentioned: its instructor and its members, by name."""
    return {
        str(r["id"]): r["display_name"]
        for r in q(
            conn,
            """select u.id, u.display_name from classroom.lessons l join classroom.classes c on c.id = l.class_id
               join accounts.users u on u.id = c.instructor_id
                 or u.id in (select m.user_id from classroom.members m where m.class_id = c.id)
               where l.graph_id = :g""",
            {"g": graph_id},
        )
    }


def _waiting_ids(conn: Connection, lesson_id: Any) -> tuple[set[str], set[str]]:
    """The cards and links proposed on a lesson, waiting or confirmed: the instructor's save that merges them is the
    proposal's, not an edit of theirs."""
    rows = q(
        conn,
        "select cards, links from classroom.proposals where lesson_id = :l and status in ('pending', 'confirmed')",
        {"l": lesson_id},
    )
    cards = {str(c.get("id")) for r in rows for c in r["cards"] if isinstance(c, dict)}
    links = {str(e.get("id")) for r in rows for e in r["links"] if isinstance(e, dict)}
    return cards, links


def map_saved(conn: Connection, before: dict[str, Any], after: dict[str, Any], u: dict[str, Any]) -> None:
    """The instructor saved a lesson's map: what it added, removed and linked goes into the lesson's activity, a run
    of saves within ten minutes gathered into one entry."""
    lesson = q1(conn, "select id from classroom.lessons where graph_id = :g", {"g": after["id"]})
    if lesson is None:
        return
    old = {n.get("id"): n for n in before["doc"].get("nodes", []) if isinstance(n, dict)}
    new = {n.get("id"): n for n in after["doc"].get("nodes", []) if isinstance(n, dict)}
    proposed, proposed_links = _waiting_ids(conn, lesson["id"])
    added = [_card(new[i]) for i in new if i not in old and str(i) not in proposed]
    removed = [_card(old[i]) for i in old if i not in new]
    old_links = {e.get("id") for e in before["doc"].get("edges", []) if isinstance(e, dict)}
    new_links = {e.get("id") for e in after["doc"].get("edges", []) if isinstance(e, dict)}
    linked = len({i for i in new_links - old_links if str(i) not in proposed_links})
    unlinked = len(old_links - new_links)
    if not (added or removed or linked or unlinked):
        return
    last = q1(
        conn,
        "select * from classroom.activity where lesson_id = :l order by at desc, id desc limit 1",
        {"l": lesson["id"]},
    )
    if (
        last
        and last["kind"] == "edited"
        and last["who"] == u["id"]
        and datetime.now(UTC) - last["at"] < EDIT_RUN
    ):
        d = last["detail"]
        was_added = {c["id"]: c for c in d.get("added", [])}
        was_removed = {c["id"]: c for c in d.get("removed", [])}
        for c in removed:
            # a card added in this run and taken off again was never there
            if c["id"] in was_added:
                del was_added[c["id"]]
            else:
                was_removed[c["id"]] = c
        for c in added:
            if c["id"] in was_removed:
                del was_removed[c["id"]]
            else:
                was_added[c["id"]] = c
        detail = {
            "added": list(was_added.values())[:200],
            "removed": list(was_removed.values())[:200],
            "linked": d.get("linked", 0) + linked,
            "unlinked": d.get("unlinked", 0) + unlinked,
        }
        if not (detail["added"] or detail["removed"] or detail["linked"] or detail["unlinked"]):
            q(conn, "delete from classroom.activity where id = :a returning id", {"a": last["id"]})
            return
        q(
            conn,
            "update classroom.activity set detail = cast(:d as jsonb), at = now() where id = :a returning id",
            {"d": json.dumps(detail, ensure_ascii=False), "a": last["id"]},
        )
        return
    _log(
        conn,
        lesson["id"],
        u["id"],
        "edited",
        {"added": added[:200], "removed": removed[:200], "linked": linked, "unlinked": unlinked},
    )


def _log(conn: Connection, lesson_id: Any, who: Any, kind: str, detail: dict[str, Any]) -> None:
    q(
        conn,
        """insert into classroom.activity (lesson_id, who, kind, detail) values (:l, :w, :k, cast(:d as jsonb))
           returning id""",
        {"l": lesson_id, "w": who, "k": kind, "d": json.dumps(detail, ensure_ascii=False)},
    )
    # the feed keeps its last thousand entries
    q(
        conn,
        """delete from classroom.activity where lesson_id = :l and id not in
             (select id from classroom.activity where lesson_id = :l order by at desc, id desc limit 1000)
           returning id""",
        {"l": lesson_id},
    )


def set_map(u: dict[str, Any], lid: str, graph_id: Any) -> dict[str, Any]:
    """The instructor names one of the maps they share as the lesson's map: from then on the class reads it, and only
    the class."""
    with tx() as conn:
        lesson, c = _teaching(conn, u, lid)
        if lesson["graph_id"]:
            raise Refusal(409, "has_map", "This lesson has its map already.")
        g = q1(conn, "select * from graphs.documents where id = :g", {"g": _uuid(graph_id, "map")})
        if g is None or g["owner_id"] != u["id"]:
            raise Refusal(404, "not_found", "No such map of yours shared.")
        if q1(conn, "select 1 as x from classroom.lessons where graph_id = :g", {"g": g["id"]}):
            raise Refusal(409, "taken", "This map is another lesson's.")
        lesson = q1(
            conn,
            "update classroom.lessons set graph_id = :g where id = :l returning *",
            {"g": g["id"], "l": lesson["id"]},
        )
        assert lesson is not None
        out = _lesson_out(conn, lesson, "instructor", u)
        out["class"] = {"id": str(c["id"]), "name": c["name"], "minors": c["minors"], "role": "instructor"}
        return out


def _names(conn: Connection, ids: set[Any]) -> dict[str, str | None]:
    if not ids:
        return {}
    return {
        str(r["id"]): r["display_name"]
        for r in q(
            conn,
            "select id, display_name from accounts.users where id = any(cast(:ids as uuid[]))",
            {"ids": [str(i) for i in ids]},
        )
    }


def _proposal_out(p: dict[str, Any], names: dict[str, str | None], u: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(p["id"]),
        "by": {"name": names.get(str(p["user_id"])), "me": p["user_id"] == u["id"]},
        "cards": p["cards"],
        "links": p["links"],
        "note": p["note"],
        "status": p["status"],
        "base_revision": p["base_revision"],
        "created_at": _iso(p["created_at"]),
        "decided_at": _iso(p["decided_at"]),
    }


def proposals(u: dict[str, Any], lid: str) -> dict[str, Any]:
    """A lesson's proposals: the instructor sees them all; a member sees everyone's waiting and their own decided."""
    with tx() as conn:
        lesson, _, role = _lesson_role(conn, u, lid)
        rows = q(
            conn,
            """select * from classroom.proposals where lesson_id = :l and status <> 'withdrawn'
                 and (:all or status = 'pending' or user_id = :u)
               order by (status = 'pending') desc, created_at desc limit 200""",
            {"l": lesson["id"], "all": role == "instructor", "u": u["id"]},
        )
        names = _names(conn, {r["user_id"] for r in rows})
        return {"data": [_proposal_out(r, names, u) for r in rows]}


def _proposed(
    raw_cards: Any, raw_links: Any, doc: dict[str, Any]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """What a member adds to the map as it is now: cards of the editor's kinds that are not on it, and links whose two
    ends are on it or among those cards. The instructor's editor cleans each card again when it takes it in."""
    if not isinstance(raw_cards, list) or not isinstance(raw_links, list):
        raise Refusal(422, "bad_proposal", "A proposal holds cards and links.")
    if len(raw_cards) > MAX_PROPOSAL_CARDS or len(raw_links) > MAX_PROPOSAL_LINKS:
        raise Refusal(413, "too_large", "A proposal holds at most 40 cards and 80 links.")
    if len(json.dumps([raw_cards, raw_links], ensure_ascii=False).encode()) > MAX_PROPOSAL_BYTES:
        raise Refusal(413, "too_large", "This proposal is too large.")
    on_map = {n.get("id") for n in doc.get("nodes", []) if isinstance(n, dict)}
    links_on_map = {e.get("id") for e in doc.get("edges", []) if isinstance(e, dict)}
    cards: list[dict[str, Any]] = []
    for n in raw_cards:
        if not isinstance(n, dict) or not isinstance(n.get("id"), str) or not isinstance(n.get("data"), dict):
            raise Refusal(422, "bad_proposal", "Each card has an id and its data.")
        if n["data"].get("kind") not in CARD_KINDS or len(n["id"]) > 200:
            raise Refusal(422, "bad_proposal", "A card of a kind the editor knows.")
        if n["id"] in on_map or any(c["id"] == n["id"] for c in cards):
            continue
        pos = n.get("position") if isinstance(n.get("position"), dict) else {}
        x, y = pos.get("x", 0), pos.get("y", 0)
        cards.append(
            {
                "id": n["id"],
                "position": {
                    "x": x if isinstance(x, (int, float)) else 0,
                    "y": y if isinstance(y, (int, float)) else 0,
                },
                "data": n["data"],
            }
        )
    ends = on_map | {c["id"] for c in cards}
    links: list[dict[str, Any]] = []
    for e in raw_links:
        if not isinstance(e, dict) or not all(isinstance(e.get(k), str) for k in ("id", "source", "target")):
            raise Refusal(422, "bad_proposal", "Each link has an id and its two ends.")
        if e["id"] in links_on_map or e["source"] not in ends or e["target"] not in ends:
            continue
        links.append(
            {
                "id": e["id"][:200],
                "source": e["source"],
                "target": e["target"],
                "data": e["data"] if isinstance(e.get("data"), dict) else {},
            }
        )
    if not cards and not links:
        raise Refusal(422, "nothing_new", "Everything in this proposal is on the map already.")
    return cards, links


def propose(u: dict[str, Any], lid: str, base: Any, cards: Any, links: Any, note: Any) -> dict[str, Any]:
    """A member proposes cards and links for the lesson's map, under their name for the class to see; the instructor
    confirms them into the map or declines them."""
    with tx() as conn:
        lesson, _, role = _lesson_role(conn, u, lid)
        if role != "member":
            raise Refusal(403, "instructor_edits", "The instructor edits the map itself.")
        if datetime.now(UTC) > open_until(lesson):
            raise Refusal(409, "closed", "This lesson is not open.")
        g = _graph_of(conn, lesson)
        if g is None:
            raise Refusal(409, "no_map", "This lesson has no map yet.")
        mine = q1(
            conn,
            "select count(*)::int as n from classroom.proposals where lesson_id = :l and user_id = :u and status = 'pending'",
            {"l": lesson["id"], "u": u["id"]},
        )["n"]  # type: ignore[index]
        if mine >= MAX_PENDING:
            raise Refusal(429, "too_many", "That is as many proposals as can wait at once.")
        got_cards, got_links = _proposed(cards, links, g["doc"])
        p = q1(
            conn,
            """insert into classroom.proposals (lesson_id, user_id, base_revision, cards, links, note)
               values (:l, :u, :b, cast(:c as jsonb), cast(:k as jsonb), :n) returning *""",
            {
                "l": lesson["id"],
                "u": u["id"],
                "b": base if isinstance(base, int) and base >= 1 else g["revision"],
                "c": json.dumps(got_cards, ensure_ascii=False),
                "k": json.dumps(got_links, ensure_ascii=False),
                "n": _str(note, 500),
            },
        )
        assert p is not None
        _log(
            conn,
            lesson["id"],
            u["id"],
            "proposed",
            {"proposal": str(p["id"]), "cards": [_card(c) for c in got_cards], "links": len(got_links)},
        )
        return _proposal_out(p, {str(u["id"]): u.get("display_name")}, u)


def _proposal(conn: Connection, pid: str) -> dict[str, Any]:
    p = q1(conn, "select * from classroom.proposals where id = :p", {"p": _uuid(pid, "proposal")})
    if p is None:
        raise Refusal(404, "not_found", "No such proposal.")
    return p


def decide(u: dict[str, Any], pid: str, decision: Any) -> dict[str, Any]:
    """The instructor confirms a proposal — its cards and links are taken into the map in their editor, saved as a
    revision — or declines it."""
    if decision not in ("confirmed", "declined"):
        raise Refusal(422, "bad_decision", "Confirm or decline.")
    with tx() as conn:
        p = _proposal(conn, pid)
        lesson, _ = _teaching(conn, u, str(p["lesson_id"]))
        if p["status"] != "pending":
            raise Refusal(409, "decided", "This proposal was decided already.")
        p = q1(
            conn,
            """update classroom.proposals set status = :s, decided_by = :u, decided_at = now() where id = :p
               returning *""",
            {"s": decision, "u": u["id"], "p": p["id"]},
        )
        assert p is not None
        _log(
            conn,
            lesson["id"],
            u["id"],
            decision,
            {
                "proposal": str(p["id"]),
                "for": str(p["user_id"]),
                "cards": [_card(c) for c in p["cards"]],
                "links": len(p["links"]),
            },
        )
        return _proposal_out(p, _names(conn, {p["user_id"]}), u)


def withdraw(u: dict[str, Any], pid: str) -> None:
    """Its author takes a waiting proposal back: it leaves the feed too."""
    with tx() as conn:
        p = _proposal(conn, pid)
        if p["user_id"] != u["id"]:
            raise Refusal(404, "not_found", "No such proposal.")
        if p["status"] != "pending":
            raise Refusal(409, "decided", "This proposal was decided already.")
        q(
            conn,
            "update classroom.proposals set status = 'withdrawn' where id = :p returning id",
            {"p": p["id"]},
        )
        q(
            conn,
            """delete from classroom.activity where lesson_id = :l and kind = 'proposed'
                 and detail->>'proposal' = :p returning id""",
            {"l": p["lesson_id"], "p": str(p["id"])},
        )


def activity(u: dict[str, Any], lid: str, before: Any = None, limit: Any = 30) -> dict[str, Any]:
    """What happened on the lesson's map, newest first: the instructor's edits, proposals made and decided, and the
    map's comments — each saying what it touched in the product's words. `before` continues from an earlier page."""
    n = limit if isinstance(limit, int) and 1 <= limit <= FEED_MOST else 30
    cut: datetime | None = None
    if before:
        try:
            cut = datetime.fromisoformat(str(before))
        except ValueError:
            raise Refusal(422, "bad_cursor", "No such page.") from None
    with tx() as conn:
        lesson, _, _ = _lesson_role(conn, u, lid)
        rows = q(
            conn,
            """select * from classroom.activity where lesson_id = :l and (cast(:b as timestamptz) is null or at < :b)
               order by at desc, id desc limit :n""",
            {"l": lesson["id"], "b": cut, "n": n},
        )
        said = (
            q(
                conn,
                """select id, author_id, node_id, parent_id, body, created_at from graphs.comments
                   where graph_id = :g and deleted_at is null
                     and (cast(:b as timestamptz) is null or created_at < :b)
                   order by created_at desc limit :n""",
                {"g": lesson["graph_id"], "b": cut, "n": n},
            )
            if lesson["graph_id"]
            else []
        )
        g = _graph_of(conn, lesson)
        cards = {
            nd.get("id"): _card(nd) for nd in (g["doc"].get("nodes", []) if g else []) if isinstance(nd, dict)
        }
        who = (
            {r["who"] for r in rows}
            | {r["author_id"] for r in said}
            | {r["detail"].get("for") for r in rows if r["detail"].get("for")}
        )
        names = _names(conn, {w for w in who if w})
    items = [
        {
            "id": f"a{r['id']}",
            "kind": r["kind"],
            "who": {"name": names.get(str(r["who"])), "me": r["who"] == u["id"]},
            "at": _iso(r["at"]),
            "detail": {
                **{k: v for k, v in r["detail"].items() if k != "for"},
                **({"for": names.get(str(r["detail"]["for"]))} if r["detail"].get("for") else {}),
            },
        }
        for r in rows
    ] + [
        {
            "id": f"c{c['id']}",
            "kind": "commented",
            "who": {"name": names.get(str(c["author_id"])), "me": c["author_id"] == u["id"]},
            "at": _iso(c["created_at"]),
            "detail": {
                "body": c["body"][:200],
                "reply": c["parent_id"] is not None,
                "card": cards.get(c["node_id"]) if c["node_id"] else None,
            },
        }
        for c in said
    ]
    items.sort(key=lambda x: x["at"] or "", reverse=True)
    page = items[:n]
    return {
        "data": page,
        "next": page[-1]["at"] if len(items) > n or len(rows) == n or len(said) == n else None,
    }
