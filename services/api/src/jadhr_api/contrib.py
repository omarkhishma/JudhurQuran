"""Contribution and moderation (PLAN P7, D4; inventory RVQ, RDR §23).

A signed-in reader proposes; reviewers decide; two distinct approvals, one of them the editorial board's, merge
(DECISIONS). Everything a decision depends on is checked here and again by the database (no self-approve, no
double-approve). A merge is shown beside the source it concerns, never over it, credited, and can be reverted;
both go to the changelog. Proposals never name the Quranic text (L1): their targets are a lemma, a sense, a word's
gloss or morphology, an error, an attestation, a new entry.
"""

from __future__ import annotations

import json
import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Connection, text

from . import content
from .accounts import q, q1, tx
from .db import connect, one, rows

KINDS = ("edit", "sense", "gloss", "morphology", "error", "attest", "entry")
# a wording of meaning needs a structured source before it can be approved (RVQ-Q05)
NEEDS_SOURCE = {"edit", "sense", "gloss"}
MORPH_FIELDS = {
    "gRoot",
    "gLemma",
    "gPos",
    "gForm",
    "gAspect",
    "gVoice",
    "gDerivation",
    "gPgn",
    "gCase",
    "gMood",
    "gGroup",
}
REVIEWERS = {"reviewer", "editor", "admin"}
BOARD = {"editor", "admin"}
APPROVALS_TO_MERGE = 2
REVIEWER_AFTER = 10  # merged contributions that earn the reviewer role (D4)
PER_DAY = 30  # proposals a reader may send in a day (abuse control)
MAX_OPEN = 100
FILTERS = ("open", "mine", "approved", "changes", "merged", "declined")
_VERSE = re.compile(r"^\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?$")


def _dataset_version() -> str:
    with connect() as conn:
        v = one(conn, "select version from content.dataset limit 1")
    return v["version"] if v else "unknown"


def _works() -> dict[str, dict[str, Any]]:
    with connect() as conn:
        return {w["id"]: w for w in rows(conn, "select id, title_ar, title_en from content.lexicon_works")}


def clean_sources(raw: list[Any]) -> list[dict[str, Any]]:
    """Sources as `{work, ref}`: a lexicon's id, `quran` with a verse, `grammar` with its reference, or `other`."""
    works = _works()
    out: list[dict[str, Any]] = []
    for s in raw[:10]:
        if isinstance(s, str):
            s = {"work": s, "ref": ""}
        if not isinstance(s, dict):
            raise HTTPException(
                status_code=422, detail="Each source names a work and, where it can, a place in it."
            )
        work = str(s.get("work") or "").strip()[:40]
        ref = str(s.get("ref") or "").strip()[:200]
        if work not in works and work not in ("quran", "grammar", "other"):
            raise HTTPException(status_code=422, detail=f"Unknown source {work!r}.")
        if work == "quran" and not _VERSE.match(ref):
            raise HTTPException(status_code=422, detail="A Quranic source names its verse, as 2:255.")
        out.append({"work": work, "ref": ref})
    return out


def structured(sources: list[dict[str, Any]]) -> bool:
    """A source a reviewer can check: a lexicon, a verse, or a named grammar with its reference — not free text."""
    return any(
        s["work"] not in ("other", "grammar") or (s["work"] == "grammar" and s["ref"]) for s in sources
    )


def _validate_target(
    kind: str, lemma: str, ordinal: int | None, location: str | None, field: str | None
) -> dict[str, Any]:
    """The target exists in this dataset, and is never the Quranic text. Returns what the reader sees of it."""
    with connect() as conn:
        lem = one(conn, "select id, slug, ar, gloss_en from content.lemmas where slug = :s", {"s": lemma})
        if kind == "entry":
            # a word the lexicon lacks: named as the reader met it, at a place where there is one
            if location and not one(conn, "select 1 from content.words where location = :l", {"l": location}):
                raise HTTPException(status_code=422, detail="No word at that place.")
            return {"lemma_id": lem["id"] if lem else None, "current": ""}
        if lem is None:
            raise HTTPException(status_code=422, detail="No such word in the lexicon.")
        current = ""
        if kind == "edit":
            if ordinal is None:
                raise HTTPException(status_code=422, detail="An edit names the sense it edits.")
            sense = one(
                conn,
                "select text_ar, text_en from content.senses where lemma_id = :l and ordinal = :o",
                {"l": lem["id"], "o": ordinal},
            )
            if sense is None:
                with tx() as w:
                    merged = q1(
                        w,
                        """select text from contributions.merges where lemma = :s and kind = 'sense' and sense_ordinal = :o
                           and reverted_at is null""",
                        {"s": lemma, "o": ordinal},
                    )
                if merged is None:
                    raise HTTPException(status_code=422, detail="No such sense.")
                current = merged["text"]
            else:
                current = sense["text_ar"] or sense["text_en"] or ""
        if kind in ("gloss", "morphology") and location:
            word = one(
                conn,
                "select gloss_en, lemma_id from content.words where location = :l",
                {"l": location},
            )
            if word is None or word["lemma_id"] != lem["id"]:
                raise HTTPException(status_code=422, detail="That place does not hold this word.")
            if kind == "gloss":
                current = word["gloss_en"] or ""
        elif kind == "gloss":
            current = lem["gloss_en"] or ""
        if kind == "morphology" and field not in MORPH_FIELDS:
            raise HTTPException(status_code=422, detail="No such morphology field.")
        return {"lemma_id": lem["id"], "current": current}


def _check_active(conn: Connection, u: dict[str, Any]) -> None:
    if u.get("blocked_at"):
        raise HTTPException(status_code=403, detail="This account can no longer propose or review.")


def propose(u: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    kind = body["kind"]
    if kind not in KINDS:
        raise HTTPException(status_code=422, detail="Unknown kind of proposal.")
    lemma = body["lemma"].strip()
    ordinal, location, field = body.get("sense_ordinal"), body.get("location"), body.get("field")
    target = _validate_target(kind, lemma, ordinal, location, field)
    current = target["current"] if kind in ("edit", "gloss") else (body.get("current_text") or "")[:4000]
    proposed = body["text"].strip()
    if kind in ("edit", "gloss") and proposed == current.strip():
        raise HTTPException(status_code=422, detail="The wording is the same as the current one.")
    sources = clean_sources(body.get("sources") or [])
    version = _dataset_version()
    with tx() as conn:
        _check_active(conn, u)
        recent = q1(
            conn,
            """select count(*) filter (where created_at > now() - interval '1 day') as day,
                      count(*) filter (where status in ('open', 'changes', 'approved')) as open
               from contributions.proposals where proposer_id = :u""",
            {"u": u["id"]},
        )
        if recent and (recent["day"] >= PER_DAY or recent["open"] >= MAX_OPEN):
            raise HTTPException(status_code=429, detail="That is as many proposals as can be sent for now.")
        row = q1(
            conn,
            """insert into contributions.proposals
                 (kind, lemma, sense_ordinal, location, field, current_text, text, why, sources, proposer_id, dataset_version)
               values (:k, :l, :o, :loc, :f, :c, :t, :w, cast(:s as jsonb), :u, :v) returning id""",
            {
                "k": kind,
                "l": lemma,
                "o": ordinal,
                "loc": location,
                "f": field,
                "c": current,
                "t": proposed,
                "w": body["why"].strip(),
                "s": json.dumps(sources, ensure_ascii=False),
                "u": u["id"],
                "v": version,
            },
        )
    assert row is not None
    return detail(str(row["id"]), u)


# ─── reading the queue ─────────────────────────────────────────────────────────

_BASE = """select p.*, u.display_name as proposer_name,
                  (select count(distinct d.reviewer_id) from contributions.decisions d
                    where d.proposal_id = p.id and d.revision = p.revision and d.decision = 'approve') as approvals
           from contributions.proposals p left join accounts.users u on u.id = p.proposer_id"""


def _where(f: str) -> str:
    return {
        "open": "p.status = 'open'",
        "approved": "p.status = 'approved'",
        "changes": "p.status = 'changes'",
        "merged": "p.status = 'merged'",
        "declined": "p.status in ('declined', 'withdrawn')",
        "mine": "p.proposer_id = :viewer",
    }[f]


def _lemma_ar(slugs: list[str]) -> dict[str, str]:
    with connect() as conn:
        return {
            r["slug"]: content.lemma_display(r["ar"])
            for r in rows(conn, "select slug, ar from content.lemmas where slug = any(:s)", {"s": slugs})
        }


def _out(
    p: dict[str, Any], viewer: dict[str, Any] | None, names: dict[str, str], works: dict[str, Any]
) -> dict[str, Any]:
    sources = p["sources"] or []
    mine = viewer is not None and p["proposer_id"] is not None and str(p["proposer_id"]) == str(viewer["id"])
    return {
        "id": str(p["id"]),
        "kind": p["kind"],
        "lemma": p["lemma"],
        "lemma_ar": names.get(p["lemma"], p["lemma"]),
        "sense_ordinal": p["sense_ordinal"],
        "location": p["location"],
        "field": p["field"],
        "current_text": p["current_text"],
        "text": p["text"],
        "why": p["why"],
        "sources": [
            {
                **s,
                "title_ar": (works.get(s["work"]) or {}).get("title_ar"),
                "title_en": (works.get(s["work"]) or {}).get("title_en"),
            }
            for s in sources
        ],
        "has_source": structured(sources),
        "status": p["status"],
        "revision": p["revision"],
        "note": p["note"],
        "approvals": int(p["approvals"] or 0),
        "proposer": {"name": p["proposer_name"], "mine": mine},
        "created_at": p["created_at"].isoformat(),
        "updated_at": p["updated_at"].isoformat(),
        "decided_at": p["decided_at"].isoformat() if p["decided_at"] else None,
    }


def queue(viewer: dict[str, Any] | None, f: str, before: str | None, limit: int) -> dict[str, Any]:
    if f not in FILTERS:
        raise HTTPException(status_code=422, detail="Unknown filter.")
    if f == "mine" and viewer is None:
        raise HTTPException(status_code=401, detail="Sign in to see your proposals.")
    params: dict[str, Any] = {"viewer": viewer["id"] if viewer else None, "n": limit + 1}
    cond = _where(f)
    if before:
        cond += " and p.created_at < cast(:before as timestamptz)"
        params["before"] = before
    with tx() as conn:
        found = q(conn, f"{_BASE} where {cond} order by p.created_at desc limit :n", params)
        counts = q1(
            conn,
            """select count(*) filter (where status = 'open') as open, count(*) filter (where status = 'approved') as approved,
                      count(*) filter (where status = 'changes') as changes, count(*) filter (where status = 'merged') as merged,
                      count(*) filter (where status in ('declined', 'withdrawn')) as declined,
                      count(*) filter (where proposer_id = :viewer) as mine
               from contributions.proposals""",
            {"viewer": params["viewer"]},
        )
    more = len(found) > limit
    found = found[:limit]
    names = _lemma_ar([p["lemma"] for p in found])
    works = _works()
    return {
        "data": [_out(p, viewer, names, works) for p in found],
        "more": more,
        "counts": counts,
        "viewer": _viewer(viewer),
    }


def _viewer(viewer: dict[str, Any] | None) -> dict[str, Any] | None:
    if viewer is None:
        return None
    return {
        "role": viewer["role"],
        "reviewer": viewer["role"] in REVIEWERS and not viewer.get("blocked_at"),
        "board": viewer["role"] in BOARD,
    }


def detail(pid: str, viewer: dict[str, Any] | None) -> dict[str, Any]:
    with tx() as conn:
        p = q1(conn, f"{_BASE} where p.id = cast(:id as uuid)", {"id": pid})
        if p is None:
            raise HTTPException(status_code=404, detail="No such proposal.")
        decisions = q(
            conn,
            """select d.revision, d.decision, d.note, d.reviewer_role, d.created_at, u.display_name as name,
                      d.reviewer_id = :viewer as mine
               from contributions.decisions d left join accounts.users u on u.id = d.reviewer_id
               where d.proposal_id = cast(:id as uuid) order by d.created_at""",
            {"id": pid, "viewer": viewer["id"] if viewer else None},
        )
        merge = q1(
            conn,
            "select id, merged_at, reverted_at, revert_note from contributions.merges where proposal_id = cast(:id as uuid)",
            {"id": pid},
        )
    out = _out(p, viewer, _lemma_ar([p["lemma"]]), _works())
    approved_by_me = any(
        d["mine"] and d["decision"] == "approve" and d["revision"] == p["revision"] for d in decisions
    )
    v = _viewer(viewer)
    live = p["status"] in ("open", "approved")
    out["decisions"] = [
        {
            "revision": d["revision"],
            "decision": d["decision"],
            "note": d["note"],
            "board": d["reviewer_role"] in BOARD,
            "name": d["name"],
            "mine": bool(d["mine"]),
            "at": d["created_at"].isoformat(),
        }
        for d in decisions
    ]
    out["merge"] = (
        {
            "id": str(merge["id"]),
            "merged_at": merge["merged_at"].isoformat(),
            "reverted_at": merge["reverted_at"].isoformat() if merge["reverted_at"] else None,
            "revert_note": merge["revert_note"],
        }
        if merge
        else None
    )
    can_review = bool(v and v["reviewer"]) and not out["proposer"]["mine"] and live
    out["can"] = {
        "approve": can_review and not approved_by_me and (out["has_source"] or p["kind"] not in NEEDS_SOURCE),
        "decline": can_review,
        "changes": can_review,
        "revise": out["proposer"]["mine"] and p["status"] == "changes",
        "withdraw": out["proposer"]["mine"] and p["status"] in ("open", "changes", "approved"),
        "report": viewer is not None and not out["proposer"]["mine"],
        "revert": bool(v and v["board"]) and merge is not None and merge["reverted_at"] is None,
    }
    out["approved_by_me"] = approved_by_me
    return out


# ─── deciding ─────────────────────────────────────────────────────────────────


def decide(u: dict[str, Any], pid: str, decision: str, note: str | None) -> dict[str, Any]:
    if decision not in ("approve", "decline", "changes"):
        raise HTTPException(status_code=422, detail="Approve, decline or request changes.")
    if u["role"] not in REVIEWERS:
        raise HTTPException(status_code=403, detail="Only reviewers decide on proposals.")
    note = (note or "").strip()[:2000] or None
    with tx() as conn:
        _check_active(conn, u)
        p = q1(
            conn, "select * from contributions.proposals where id = cast(:id as uuid) for update", {"id": pid}
        )
        if p is None:
            raise HTTPException(status_code=404, detail="No such proposal.")
        if p["proposer_id"] is not None and str(p["proposer_id"]) == str(u["id"]):
            raise HTTPException(status_code=403, detail="You cannot decide on your own proposal.")
        if p["status"] not in ("open", "approved"):
            raise HTTPException(status_code=409, detail="This proposal is already settled.")
        if decision == "approve":
            if p["kind"] in NEEDS_SOURCE and not structured(p["sources"] or []):
                raise HTTPException(status_code=422, detail="A source is needed before this can be approved.")
            done = q1(
                conn,
                """select 1 as x from contributions.decisions where proposal_id = :id and revision = :r
                   and reviewer_id = :u and decision = 'approve'""",
                {"id": p["id"], "r": p["revision"], "u": u["id"]},
            )
            if done:
                raise HTTPException(status_code=409, detail="You have already approved this proposal.")
        conn.execute(
            text(
                """insert into contributions.decisions (proposal_id, revision, reviewer_id, reviewer_role, decision, note)
                   values (:id, :r, :u, :role, :d, :n)"""
            ),
            {"id": p["id"], "r": p["revision"], "u": u["id"], "role": u["role"], "d": decision, "n": note},
        )
        if decision == "approve":
            approvers = q(
                conn,
                """select distinct on (d.reviewer_id) d.reviewer_id, d.reviewer_role, u.display_name
                   from contributions.decisions d left join accounts.users u on u.id = d.reviewer_id
                   where d.proposal_id = :id and d.revision = :r and d.decision = 'approve'""",
                {"id": p["id"], "r": p["revision"]},
            )
            if len(approvers) >= APPROVALS_TO_MERGE and any(a["reviewer_role"] in BOARD for a in approvers):
                _merge(conn, p, approvers)
                status = "merged"
            else:
                status = "approved" if len(approvers) >= APPROVALS_TO_MERGE else "open"
        else:
            status = "declined" if decision == "decline" else "changes"
        conn.execute(
            text(
                """update contributions.proposals set status = :s, note = coalesce(:n, note), updated_at = now(),
                   decided_at = case when :s in ('merged', 'declined', 'changes') then now() else decided_at end
                   where id = :id"""
            ),
            {"s": status, "n": note, "id": p["id"]},
        )
    return detail(pid, u)


def _merge(conn: Connection, p: dict[str, Any], approvers: list[dict[str, Any]]) -> None:
    """One transaction: the merge shown in the reader, credited, and its changelog entry (08 §8.5)."""
    proposer = (
        q1(conn, "select display_name from accounts.users where id = :u", {"u": p["proposer_id"]})
        if p["proposer_id"]
        else None
    )
    ordinal = p["sense_ordinal"]
    if p["kind"] == "sense":
        # a new sense is numbered after the sourced ones and the senses merged before it
        with connect() as c:
            n = one(
                c,
                """select coalesce(max(s.ordinal), 0) as n from content.senses s
                   join content.lemmas l on l.id = s.lemma_id where l.slug = :s""",
                {"s": p["lemma"]},
            )
        merged = q1(
            conn,
            "select coalesce(max(sense_ordinal), 0) as n from contributions.merges where lemma = :s and kind = 'sense'",
            {"s": p["lemma"]},
        )
        ordinal = max(int(n["n"] if n else 0), int(merged["n"] if merged else 0)) + 1
    m = q1(
        conn,
        """insert into contributions.merges
             (proposal_id, kind, lemma, sense_ordinal, location, field, previous_text, text, sources,
              contributor_id, contributor_name, reviewers)
           values (:p, :k, :l, :o, :loc, :f, :prev, :t, cast(:s as jsonb), :cid, :cname, cast(:rv as jsonb))
           returning id""",
        {
            "p": p["id"],
            "k": p["kind"],
            "l": p["lemma"],
            "o": ordinal,
            "loc": p["location"],
            "f": p["field"],
            "prev": p["current_text"],
            "t": p["text"],
            "s": json.dumps(p["sources"] or [], ensure_ascii=False),
            "cid": p["proposer_id"],
            "cname": proposer["display_name"] if proposer else None,
            "rv": json.dumps(
                [
                    {
                        "id": str(a["reviewer_id"]),
                        "name": a["display_name"],
                        "board": a["reviewer_role"] in BOARD,
                    }
                    for a in approvers
                ],
                ensure_ascii=False,
            ),
        },
    )
    assert m is not None
    conn.execute(
        text(
            "insert into contributions.changelog (event, merge_id, dataset_version) values ('merged', :m, :v)"
        ),
        {"m": m["id"], "v": p["dataset_version"]},
    )
    # the reviewer role is earned by merged contributions (D4)
    if p["proposer_id"]:
        n = q1(
            conn,
            "select count(*) as n from contributions.proposals where proposer_id = :u and status = 'merged'",
            {"u": p["proposer_id"]},
        )
        role = q1(conn, "select role from accounts.users where id = :u", {"u": p["proposer_id"]})
        if n and role and role["role"] == "member" and n["n"] + 1 >= REVIEWER_AFTER:
            conn.execute(
                text("update accounts.users set role = 'reviewer' where id = :u"), {"u": p["proposer_id"]}
            )
            conn.execute(
                text(
                    "insert into contributions.role_grants (user_id, role, reason) values (:u, 'reviewer', :r)"
                ),
                {"u": p["proposer_id"], "r": f"earned: {REVIEWER_AFTER} merged contributions"},
            )


def revise(u: dict[str, Any], pid: str, body: dict[str, Any]) -> dict[str, Any]:
    """Changes requested: the proposer answers with a new revision, which goes back to the queue (RVQ-42)."""
    sources = clean_sources(body.get("sources") or [])
    with tx() as conn:
        _check_active(conn, u)
        p = q1(
            conn, "select * from contributions.proposals where id = cast(:id as uuid) for update", {"id": pid}
        )
        if p is None:
            raise HTTPException(status_code=404, detail="No such proposal.")
        if str(p["proposer_id"]) != str(u["id"]) or p["status"] != "changes":
            raise HTTPException(
                status_code=409,
                detail="Only a proposal with changes requested can be revised, by its proposer.",
            )
        conn.execute(
            text(
                """update contributions.proposals set text = :t, why = :w, sources = cast(:s as jsonb), revision = revision + 1,
                   status = 'open', note = null, updated_at = now(), decided_at = null where id = :id"""
            ),
            {
                "t": body["text"].strip(),
                "w": body["why"].strip(),
                "s": json.dumps(sources, ensure_ascii=False),
                "id": p["id"],
            },
        )
    return detail(pid, u)


def withdraw(u: dict[str, Any], pid: str) -> dict[str, Any]:
    with tx() as conn:
        r = conn.execute(
            text(
                """update contributions.proposals set status = 'withdrawn', updated_at = now(), decided_at = now()
                   where id = cast(:id as uuid) and proposer_id = :u and status in ('open', 'changes', 'approved')"""
            ),
            {"id": pid, "u": u["id"]},
        )
        if r.rowcount == 0:
            raise HTTPException(
                status_code=409, detail="Only an unsettled proposal of yours can be withdrawn."
            )
    return detail(pid, u)


def report(u: dict[str, Any], pid: str, reason: str) -> dict[str, Any]:
    with tx() as conn:
        p = q1(
            conn, "select proposer_id from contributions.proposals where id = cast(:id as uuid)", {"id": pid}
        )
        if p is None:
            raise HTTPException(status_code=404, detail="No such proposal.")
        conn.execute(
            text(
                """insert into contributions.reports (proposal_id, reporter_id, reason) values (cast(:id as uuid), :u, :r)
                   on conflict do nothing"""
            ),
            {"id": pid, "u": u["id"], "r": reason.strip()[:1000]},
        )
    return {"reported": True}


def revert(u: dict[str, Any], merge_id: str, note: str) -> dict[str, Any]:
    """The board takes a merge back; the proposal and its history stay, and the changelog says so (RVQ-Q07)."""
    if u["role"] not in BOARD:
        raise HTTPException(status_code=403, detail="Only the editorial board reverts a merge.")
    with tx() as conn:
        _check_active(conn, u)
        m = q1(
            conn,
            """update contributions.merges set reverted_at = now(), reverted_by = :u, revert_note = :n
               where id = cast(:id as uuid) and reverted_at is null returning id, proposal_id""",
            {"id": merge_id, "u": u["id"], "n": note.strip()[:2000] or None},
        )
        if m is None:
            raise HTTPException(status_code=409, detail="No such merge, or it is already reverted.")
        conn.execute(
            text(
                "insert into contributions.changelog (event, merge_id, dataset_version) values ('reverted', :m, :v)"
            ),
            {"m": m["id"], "v": _dataset_version()},
        )
    return detail(str(m["proposal_id"]), u)


# ─── what readers see: the changelog, a word's merged contributions, their own ───


def _merge_out(m: dict[str, Any], names: dict[str, str]) -> dict[str, Any]:
    return {
        "id": str(m["id"]),
        "proposal_id": str(m["proposal_id"]),
        "kind": m["kind"],
        "lemma": m["lemma"],
        "lemma_ar": names.get(m["lemma"], m["lemma"]),
        "sense_ordinal": m["sense_ordinal"],
        "location": m["location"],
        "field": m["field"],
        "previous_text": m["previous_text"],
        "text": m["text"],
        "sources": m["sources"],
        # a contributor who deleted their account, or never chose a name, is not named
        "contributor": m["contributor_name"],
        "former": m["contributor_id"] is None,
        "reviewers": [{"name": r.get("name"), "board": r.get("board", False)} for r in m["reviewers"]],
        "merged_at": m["merged_at"].isoformat(),
        "reverted_at": m["reverted_at"].isoformat() if m["reverted_at"] else None,
    }


def changelog(since: str | None, limit: int) -> dict[str, Any]:
    with tx() as conn:
        found = q(
            conn,
            f"""select c.id as entry, c.at, c.event, c.dataset_version, m.*
                from contributions.changelog c join contributions.merges m on m.id = c.merge_id
                {"where c.at > cast(:since as timestamptz)" if since else ""}
                order by c.at desc limit :n""",
            {"since": since, "n": limit},
        )
    names = _lemma_ar([m["lemma"] for m in found])
    return {
        "data": [
            {
                "entry": e["entry"],
                "at": e["at"].isoformat(),
                "event": e["event"],
                "dataset_version": e["dataset_version"],
                "merge": _merge_out(e, names),
            }
            for e in found
        ]
    }


def for_lemma(slug: str) -> dict[str, Any]:
    with tx() as conn:
        found = q(
            conn,
            "select * from contributions.merges where lemma = :s and reverted_at is null order by merged_at",
            {"s": slug},
        )
        pending = q1(
            conn,
            "select count(*) as n from contributions.proposals where lemma = :s and status in ('open', 'approved')",
            {"s": slug},
        )
    names = _lemma_ar([slug])
    return {"data": [_merge_out(m, names) for m in found], "pending": pending["n"] if pending else 0}


def mine(u: dict[str, Any]) -> dict[str, Any]:
    with tx() as conn:
        found = q(
            conn, f"{_BASE} where p.proposer_id = :u order by p.created_at desc limit 500", {"u": u["id"]}
        )
    names = _lemma_ar([p["lemma"] for p in found])
    works = _works()
    return {"data": [_out(p, u, names, works) for p in found]}


def grant(admin: dict[str, Any] | None, email: str, role: str, reason: str | None) -> dict[str, Any]:
    """The editorial board is appointed (D4): an admin grants editor or reviewer, and every grant is recorded."""
    if role not in ("member", "reviewer", "editor", "instructor", "admin"):
        raise HTTPException(status_code=422, detail="Unknown role.")
    if admin is not None and admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only an administrator grants roles.")
    with tx() as conn:
        u = q1(
            conn,
            "update accounts.users set role = :r where email = :e returning id, email, role",
            {"r": role, "e": email.strip().lower()},
        )
        if u is None:
            raise HTTPException(status_code=404, detail="No account with that address.")
        conn.execute(
            text(
                "insert into contributions.role_grants (user_id, role, granted_by, reason) values (:u, :r, :by, :why)"
            ),
            {
                "u": u["id"],
                "r": role,
                "by": admin["id"] if admin else None,
                "why": reason or ("appointed" if admin else "granted from the command line"),
            },
        )
    return {"email": u["email"], "role": u["role"]}


def forget(conn: Connection, user_id: Any) -> None:
    """Deleting an account (P6): its unmerged proposals go; every name it left is cleared; merges stay, credited
    to a former contributor."""
    conn.execute(
        text("delete from contributions.proposals where proposer_id = :u and status <> 'merged'"),
        {"u": user_id},
    )
    conn.execute(
        text("update contributions.merges set contributor_name = null where contributor_id = :u"),
        {"u": user_id},
    )
    conn.execute(
        text(
            """update contributions.merges set reviewers = (
                 select jsonb_agg(case when r->>'id' = cast(:u as text) then r - 'name' - 'id' else r end)
                 from jsonb_array_elements(reviewers) r)
               where reviewers @> jsonb_build_array(jsonb_build_object('id', cast(:u as text)))"""
        ),
        {"u": user_id},
    )
