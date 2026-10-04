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
    """A class deleted takes its lessons, notes, members and everything counted with it."""
    with tx() as conn:
        c = _own(conn, u, cid)
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
    lessons = "select id from classroom.lessons where class_id = :c"
    for t in ("counts", "progress", "nudges"):
        q(
            conn,
            f"delete from classroom.{t} where user_id = :u and lesson_id in ({lessons}) returning user_id",
            {"c": cid, "u": uid},
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


def add_lesson(u: dict[str, Any], cid: str, title: Any, ranges: Any, roots: Any, due: Any) -> dict[str, Any]:
    with tx() as conn:
        c = _own(conn, u, cid)
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
    with tx() as conn:
        lesson = _lesson(conn, lid)
        _own(conn, u, str(lesson["class_id"]))
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
    return {
        "classroom": {
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
