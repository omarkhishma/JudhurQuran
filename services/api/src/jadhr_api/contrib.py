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
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, text

from . import content, plain
from .accounts import q, q1, tx
from .db import connect, one, rows
from .refusal import Refusal

KINDS = ("edit", "sense", "gloss", "morphology", "error", "attest", "entry", "correction")
# B58 (RVQ-Q11): a correction to a layer the build made by rule — a hadith's split into isnād and matn, a name in its
# isnād linked to a narrator, a dictionary article filed under a root, a book paragraph's printed page — its target
# named by the item's own address (hadith:…, dict:…, book:…) where a word of the Quran names its lemma
CORRECTION_FIELDS = {"split": "hadith", "narrator": "hadith", "filing": "dict", "page": "book"}
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
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
# the settled ends of a proposal: a revert takes a merge back without making it a decline (audit 12 F5)
SETTLED_NOT_IN_FORCE = ("declined", "withdrawn", "reverted")


def _uuid(raw: str, what: str = "proposal") -> str:
    """An id from the address, checked before it reaches the database: a malformed one is not found, not a 500
    (audit 12 F26)."""
    try:
        return str(uuid.UUID(raw))
    except (ValueError, AttributeError, TypeError):
        raise Refusal(404, "not_found", f"No such {what}.") from None


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
            raise Refusal(422, "source_shape", "Each source names a work and, where it can, a place in it.")
        work = plain.text(str(s.get("work") or "")).strip()[:40]
        ref = plain.text(str(s.get("ref") or "")).strip()[:200]
        if work not in works and work not in ("quran", "grammar", "other"):
            raise Refusal(422, "unknown_source", f"Unknown source {work!r}.")
        if work == "quran":
            # a verse typed on an Arabic keyboard is the same verse (DECISIONS: every reference parser takes both)
            ref = ref.translate(_DIGITS).replace(" ", "")
            if not _VERSE.match(ref):
                raise Refusal(422, "quran_ref", "A Quranic source names its verse, as 2:255.")
        out.append({"work": work, "ref": ref})
    return out


def structured(sources: list[dict[str, Any]]) -> bool:
    """A source a reviewer can check: a lexicon with its entry or page, a verse, or a named grammar with its
    reference — never a title alone, never free text (RVQ-Q05, audit 12 F9)."""
    return any((s["work"] == "quran") or (s["work"] != "other" and bool(s["ref"])) for s in sources)


def _morph_value(conn: Connection, word: dict[str, Any], field: str) -> str:
    """A morphology field's value at a word's place, as the dataset holds it, in its Arabic terms — the "before" a
    correction is read against, never the label a reader's interface happened to show (audit 12 F7)."""
    f = word["features"] or {}

    def ar(key: str) -> str:
        return str((f.get(key) or {}).get("ar") or "")

    if field == "gRoot":
        r = (
            one(conn, "select spaced from content.roots where id = :r", {"r": word["root_id"]})
            if word["root_id"]
            else None
        )
        return r["spaced"] if r else "—"
    if field == "gLemma":
        lem = (
            one(conn, "select ar from content.lemmas where id = :l", {"l": word["lemma_id"]})
            if word["lemma_id"]
            else None
        )
        return content.lemma_display(lem["ar"]) if lem else ""
    if field == "gForm":
        vf = f.get("verb_form") or {}
        return f"{vf.get('pattern')} ({vf.get('roman')})" if vf else ""
    if field == "gPgn":
        return " • ".join(x for x in (ar("person"), ar("gender"), ar("number")) if x)
    if field == "gGroup":
        return ar("special")
    return ar(
        {
            "gPos": "pos",
            "gAspect": "aspect",
            "gVoice": "voice",
            "gDerivation": "derivation",
            "gCase": "case",
            "gMood": "mood",
        }[field]
    )


def _validate_correction(target: str, field: str | None, location: str | None) -> dict[str, Any]:
    """A correction's target exists, of the kind its layer belongs to, and what it holds now is read here (B58)."""
    from . import texts

    space = CORRECTION_FIELDS.get(field or "")
    if space is None:
        raise Refusal(422, "no_field", "No such layer to correct.")
    if not target.startswith(f"{space}:"):
        raise Refusal(422, "wrong_target", "This layer belongs to another kind of item.")
    with connect() as conn:
        if space == "dict":
            e = one(
                conn,
                "select headword, dict_roots, dict_candidates from content.lexicon_entries where uri = :u",
                {"u": target},
            )
            if e is None:
                raise Refusal(422, "no_target", "No such article.")
            filed = " · ".join(e["dict_roots"] or [])
            open_ = " · ".join(str(c) for c in (e["dict_candidates"] or []))
            return {"lemma_id": None, "current": filed or f"؟ {open_}".strip(), "location": None}
        row = one(
            conn,
            """select t.slug, t.kind, p.ref from content.passages p join content.texts t on t.id = p.text_id
                where p.uri = :u""",
            {"u": target},
        )
        if row is None or row["kind"] != space:
            raise Refusal(422, "no_target", "No such passage.")
        pg = texts.passage(conn, row["slug"], row["ref"])
    if pg is None:
        raise Refusal(422, "no_target", "No such passage.")
    meta, body = pg["meta"] or {}, pg["ar_full"] or ""
    if field == "split":
        sp = meta.get("split") or {}
        cut = lambda r: body[r[0] : r[1]].strip()[:400] if r else ""  # noqa: E731
        return {
            "lemma_id": None,
            "current": f"{cut(sp.get('isnad'))}\n—\n{cut(sp.get('matn'))}",
            "location": None,
        }
    if field == "narrator":
        n = next((x for x in pg.get("narrators") or [] if str(x["ordinal"]) == str(location)), None)
        if n is None:
            raise Refusal(422, "no_place", "No such name in this isnād.")
        linked = (n.get("narrator") or {}).get("name") or "—"
        return {"lemma_id": None, "current": f"{n['text']} ← {linked}", "location": str(location)}
    pages = meta.get("pages") or []
    first, last = (pages[0], pages[-1]) if pages else (None, None)
    shown = f"{first[0]}/{first[1]}" if first else "—"
    if last and last != first:
        shown += f"–{last[0]}/{last[1]}"
    return {"lemma_id": None, "current": shown, "location": None}


def _validate_target(
    kind: str, lemma: str, ordinal: int | None, location: str | None, field: str | None
) -> dict[str, Any]:
    """The target exists in this dataset, and is never the Quranic text. Returns what the reader sees of it now —
    the "before" of every kind that has one is read here, never taken from the request (audit 12 F7)."""
    if location is not None:
        location = location.translate(_DIGITS)
    if kind == "correction":
        return _validate_correction(lemma, field, location)
    with connect() as conn:
        lem = one(conn, "select id, slug, ar, gloss_en from content.lemmas where slug = :s", {"s": lemma})
        if kind == "entry":
            # a word the lexicon lacks: named as the reader met it, at a place where there is one
            if location and not one(conn, "select 1 from content.words where location = :l", {"l": location}):
                raise Refusal(422, "no_place", "No word at that place.")
            return {"lemma_id": lem["id"] if lem else None, "current": "", "location": location}
        if lem is None:
            raise Refusal(422, "no_word", "No such word in the lexicon.")
        current = ""
        if kind == "edit":
            if ordinal is None:
                raise Refusal(422, "sense_needed", "An edit names the sense it edits.")
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
                    raise Refusal(422, "no_sense", "No such sense.")
                current = merged["text"]
            else:
                current = sense["text_ar"] or sense["text_en"] or ""
        if kind == "morphology" and field not in MORPH_FIELDS:
            raise Refusal(422, "no_field", "No such morphology field.")
        if location and kind in ("gloss", "morphology", "attest", "error"):
            word = one(
                conn,
                "select gloss_en, lemma_id, root_id, features from content.words where location = :l",
                {"l": location},
            )
            if word is None or word["lemma_id"] != lem["id"]:
                raise Refusal(422, "place_mismatch", "That place does not hold this word.")
            if kind == "gloss":
                current = word["gloss_en"] or ""
            elif kind == "morphology":
                current = _morph_value(conn, word, field or "")
        elif kind == "gloss":
            current = lem["gloss_en"] or ""
        if kind == "error":
            # the word the report concerns, as the lexicon writes it — one language in one field (SHR-H05, F13)
            current = content.lemma_display(lem["ar"])
        return {"lemma_id": lem["id"], "current": current, "location": location}


def _check_active(conn: Connection, u: dict[str, Any]) -> None:
    if u.get("blocked_at"):
        raise Refusal(403, "blocked", "This account can no longer propose, review or report.")


def propose(u: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    kind = body["kind"]
    if kind not in KINDS:
        raise Refusal(422, "unknown_kind", "Unknown kind of proposal.")
    lemma = body["lemma"].strip()
    ordinal, field = body.get("sense_ordinal"), body.get("field")
    target = _validate_target(kind, lemma, ordinal, body.get("location"), field)
    location = target["location"]
    current = target["current"]
    proposed = plain.text(body["text"]).strip()
    if kind in ("edit", "gloss", "morphology") and proposed == current.strip():
        raise Refusal(422, "same_wording", "The wording is the same as the current one.")
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
        # the same proposal sent twice (a draft from two devices) is the same proposal
        same = q1(
            conn,
            """select id from contributions.proposals where proposer_id = :u and kind = :k and lemma = :l
               and location is not distinct from :loc and field is not distinct from :f and text = :t
               and status in ('open', 'approved', 'changes') limit 1""",
            {"u": u["id"], "k": kind, "l": lemma, "loc": location, "f": field, "t": proposed},
        )
        if same:
            return detail(str(same["id"]), u)
        if recent and recent["day"] >= PER_DAY:
            raise Refusal(429, "too_many_today", "That is as many proposals as can be sent today.")
        if recent and recent["open"] >= MAX_OPEN:
            raise Refusal(429, "too_many_open", "That is as many proposals as can wait for review at once.")
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
        "declined": "p.status in ('declined', 'withdrawn', 'reverted')",
        "mine": "p.proposer_id = :viewer",
    }[f]


class _Names(dict[str, str | None]):
    """A proposal's target as the reader knows it, and where an item of the library (B58) is read on the site."""

    hrefs: dict[str, str]


_AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def _lemma_ar(slugs: list[str]) -> _Names:
    """A word of the Quran by its lemma; an item of the library (B58) by its text's title and its place in it, with the
    page that reads it — a dictionary article on the page of the root it is filed under."""
    with connect() as conn:
        out = _Names(
            (r["slug"], content.lemma_display(r["ar"]))
            for r in rows(conn, "select slug, ar from content.lemmas where slug = any(:s)", {"s": slugs})
        )
        out.hrefs = {}
        uris = [s for s in slugs if s.split(":", 1)[0] in ("hadith", "book", "dict")]
        if uris:
            for r in rows(
                conn,
                """select p.uri, t.kind, t.slug, t.title_ar, p.ref from content.passages p
                     join content.texts t on t.id = p.text_id where p.uri = any(:u)""",
                {"u": uris},
            ):
                hadith = r["kind"] == "hadith"
                out[r["uri"]] = (
                    f"{r['title_ar']}، {'الحديث' if hadith else 'الفقرة'} {r['ref'].translate(_AR_DIGITS)}"
                )
                out.hrefs[r["uri"]] = (
                    f"/hadith/{r['slug']}/{r['ref'].replace('.', '_', 1)}"
                    if hadith
                    else f"/books/{r['slug']}/p/{r['ref']}"
                )
            for r in rows(
                conn,
                """select e.uri, e.headword, e.dict_roots, w.title_ar from content.lexicon_entries e
                     join content.lexicon_works w on w.id = e.work_id where e.uri = any(:u)""",
                {"u": uris},
            ):
                out[r["uri"]] = f"{r['title_ar']}، مادة {r['headword']}"
                if r["dict_roots"]:
                    out.hrefs[r["uri"]] = f"/dictionary/{r['dict_roots'][0]}#{r['uri']}"
        return out


def _out(
    p: dict[str, Any], viewer: dict[str, Any] | None, names: _Names, works: dict[str, Any]
) -> dict[str, Any]:
    sources = p["sources"] or []
    mine = viewer is not None and p["proposer_id"] is not None and str(p["proposer_id"]) == str(viewer["id"])
    return {
        "id": str(p["id"]),
        "kind": p["kind"],
        "lemma": p["lemma"],
        "lemma_ar": names.get(p["lemma"], p["lemma"]),
        "target_href": names.hrefs.get(p["lemma"]),
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
        # an author who deleted their account is a former contributor, as on the word (audit 12 F24)
        "proposer": {"name": p["proposer_name"], "mine": mine, "former": p["proposer_id"] is None},
        "created_at": p["created_at"].isoformat(),
        "updated_at": p["updated_at"].isoformat(),
        "decided_at": p["decided_at"].isoformat() if p["decided_at"] else None,
    }


def queue(viewer: dict[str, Any] | None, f: str, before: str | None, limit: int) -> dict[str, Any]:
    if f not in FILTERS:
        raise Refusal(422, "unknown_filter", "Unknown filter.")
    if f == "mine" and viewer is None:
        raise Refusal(401, "sign_in", "Sign in to see your proposals.")
    params: dict[str, Any] = {"viewer": viewer["id"] if viewer else None, "n": limit + 1}
    cond = _where(f)
    if before:
        try:
            params["before"] = datetime.fromisoformat(before)
        except ValueError:
            raise Refusal(422, "bad_cursor", "That is not a place in the queue.") from None
        cond += " and p.created_at < :before"
    with tx() as conn:
        found = q(conn, f"{_BASE} where {cond} order by p.created_at desc limit :n", params)
        counts = q1(
            conn,
            """select count(*) filter (where status = 'open') as open, count(*) filter (where status = 'approved') as approved,
                      count(*) filter (where status = 'changes') as changes, count(*) filter (where status = 'merged') as merged,
                      count(*) filter (where status in ('declined', 'withdrawn', 'reverted')) as declined,
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
    pid = _uuid(pid)
    board = bool(viewer and viewer["role"] in BOARD)
    with tx() as conn:
        p = q1(conn, f"{_BASE} where p.id = cast(:id as uuid)", {"id": pid})
        if p is None:
            raise Refusal(404, "not_found", "No such proposal.")
        # what readers reported about it, for the board to read and resolve (RVQ-74, audit 12 F4)
        reports = (
            q(
                conn,
                """select id, reason, created_at, resolved_at, outcome, resolution_note from contributions.reports
                   where proposal_id = cast(:id as uuid) order by created_at""",
                {"id": pid},
            )
            if board
            else []
        )
        blocked = (
            q1(conn, "select blocked_at from accounts.users where id = :u", {"u": p["proposer_id"]})
            if board and p["proposer_id"]
            else None
        )
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
    # two reviewers have approved and the board has not: a third reviewer's approval would change nothing (F22)
    waiting_board = p["status"] == "approved" and not (v and v["board"])
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
        "approve": can_review
        and not approved_by_me
        and not waiting_board
        and (out["has_source"] or p["kind"] not in NEEDS_SOURCE),
        "decline": can_review,
        "changes": can_review,
        "revise": out["proposer"]["mine"] and p["status"] == "changes",
        "withdraw": out["proposer"]["mine"] and p["status"] in ("open", "changes", "approved"),
        "report": viewer is not None and not out["proposer"]["mine"] and not viewer.get("blocked_at"),
        "revert": bool(v and v["board"]) and merge is not None and merge["reverted_at"] is None,
        # an administrator can stop an account proposing, reviewing and reporting (RVQ-74)
        "block": bool(viewer and viewer["role"] == "admin")
        and p["proposer_id"] is not None
        and str(p["proposer_id"]) != str(viewer["id"] if viewer else ""),
    }
    out["approved_by_me"] = approved_by_me
    out["waiting_board"] = waiting_board
    out["reports"] = [
        {
            "id": r["id"],
            "reason": r["reason"],
            "at": r["created_at"].isoformat(),
            "resolved_at": r["resolved_at"].isoformat() if r["resolved_at"] else None,
            "outcome": r["outcome"],
            "note": r["resolution_note"],
        }
        for r in reports
    ]
    out["proposer_blocked"] = bool(blocked and blocked["blocked_at"])
    # who is asking, as the server knows them now (a role granted after sign-in counts at once)
    out["viewer"] = v
    return out


# ─── deciding ─────────────────────────────────────────────────────────────────


def decide(u: dict[str, Any], pid: str, decision: str, note: str | None) -> dict[str, Any]:
    if decision not in ("approve", "decline", "changes"):
        raise Refusal(422, "unknown_decision", "Approve, decline or request changes.")
    if u["role"] not in REVIEWERS:
        raise Refusal(403, "not_reviewer", "Only reviewers decide on proposals.")
    pid = _uuid(pid)
    note = plain.text(note or "").strip()[:2000] or None
    with tx() as conn:
        _check_active(conn, u)
        p = q1(
            conn, "select * from contributions.proposals where id = cast(:id as uuid) for update", {"id": pid}
        )
        if p is None:
            raise Refusal(404, "not_found", "No such proposal.")
        if p["proposer_id"] is not None and str(p["proposer_id"]) == str(u["id"]):
            raise Refusal(403, "own_proposal", "You cannot decide on your own proposal.")
        if p["status"] not in ("open", "approved"):
            raise Refusal(409, "settled", "This proposal is already settled.")
        if decision == "approve":
            if p["status"] == "approved" and u["role"] not in BOARD:
                raise Refusal(409, "waiting_board", "Two reviewers have approved; it waits for the board.")
            if p["kind"] in NEEDS_SOURCE and not structured(p["sources"] or []):
                raise Refusal(422, "needs_source", "A source is needed before this can be approved.")
            done = q1(
                conn,
                """select 1 as x from contributions.decisions where proposal_id = :id and revision = :r
                   and reviewer_id = :u and decision = 'approve'""",
                {"id": p["id"], "r": p["revision"], "u": u["id"]},
            )
            if done:
                raise Refusal(409, "already_approved", "You have already approved this proposal.")
        conn.execute(
            text(
                """insert into contributions.decisions (proposal_id, revision, reviewer_id, reviewer_role, decision, note)
                   values (:id, :r, :u, :role, :d, :n)"""
            ),
            {"id": p["id"], "r": p["revision"], "u": u["id"], "role": u["role"], "d": decision, "n": note},
        )
        if decision == "approve":
            # in the order they approved, so the credit reads as it happened
            approvers = q(
                conn,
                """select d.reviewer_id, d.reviewer_role, u.display_name
                   from contributions.decisions d left join accounts.users u on u.id = d.reviewer_id
                   where d.proposal_id = :id and d.revision = :r and d.decision = 'approve'
                   order by d.created_at""",
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
    """One transaction: the merge shown in the reader, credited, and its changelog entry (08 §8.5). The credit
    holds who — the account ids — never their names, which are read when shown (audit 12 F14)."""
    ordinal = p["sense_ordinal"]
    if p["kind"] == "sense":
        # one new sense numbered at a time per word: two merges at once wait for each other (F12)
        conn.execute(
            text("select pg_advisory_xact_lock(hashtext('contrib-sense:' || :s))"), {"s": p["lemma"]}
        )
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
            "cname": None,
            "rv": json.dumps(
                [{"id": str(a["reviewer_id"]), "board": a["reviewer_role"] in BOARD} for a in approvers],
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
    pid = _uuid(pid)
    sources = clean_sources(body.get("sources") or [])
    with tx() as conn:
        _check_active(conn, u)
        p = q1(
            conn, "select * from contributions.proposals where id = cast(:id as uuid) for update", {"id": pid}
        )
        if p is None:
            raise Refusal(404, "not_found", "No such proposal.")
        if str(p["proposer_id"]) != str(u["id"]) or p["status"] != "changes":
            raise Refusal(
                409,
                "not_revisable",
                "Only a proposal with changes requested can be revised, by its proposer.",
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
    pid = _uuid(pid)
    with tx() as conn:
        r = conn.execute(
            text(
                """update contributions.proposals set status = 'withdrawn', updated_at = now(), decided_at = now()
                   where id = cast(:id as uuid) and proposer_id = :u and status in ('open', 'changes', 'approved')"""
            ),
            {"id": pid, "u": u["id"]},
        )
        if r.rowcount == 0:
            raise Refusal(409, "not_withdrawable", "Only an unsettled proposal of yours can be withdrawn.")
    return detail(pid, u)


def report(u: dict[str, Any], pid: str, reason: str) -> dict[str, Any]:
    """A reader reports a proposal to the board, who read it on the proposal and resolve it (RVQ-74, F4)."""
    pid = _uuid(pid)
    with tx() as conn:
        _check_active(conn, u)
        p = q1(
            conn, "select proposer_id from contributions.proposals where id = cast(:id as uuid)", {"id": pid}
        )
        if p is None:
            raise Refusal(404, "not_found", "No such proposal.")
        if p["proposer_id"] is not None and str(p["proposer_id"]) == str(u["id"]):
            raise Refusal(403, "own_proposal", "You cannot report your own proposal.")
        conn.execute(
            text(
                """insert into contributions.reports (proposal_id, reporter_id, reason) values (cast(:id as uuid), :u, :r)
                   on conflict do nothing"""
            ),
            {"id": pid, "u": u["id"], "r": plain.text(reason).strip()[:1000]},
        )
    return {"reported": True}


def revert(u: dict[str, Any], merge_id: str, note: str) -> dict[str, Any]:
    """The board takes a merge back; the proposal and its history stay, and the changelog says so (RVQ-Q07)."""
    if u["role"] not in BOARD:
        raise Refusal(403, "not_board", "Only the editorial board reverts a merge.")
    merge_id = _uuid(merge_id, "merge")
    with tx() as conn:
        _check_active(conn, u)
        m = q1(
            conn,
            """update contributions.merges set reverted_at = now(), reverted_by = :u, revert_note = :n
               where id = cast(:id as uuid) and reverted_at is null returning id, proposal_id""",
            {"id": merge_id, "u": u["id"], "n": plain.text(note).strip()[:2000] or None},
        )
        if m is None:
            raise Refusal(409, "not_revertible", "No such merge, or it is already reverted.")
        # taken back, it no longer counts as merged anywhere — the filter, the Profile, the role it earns (F5)
        conn.execute(
            text("update contributions.proposals set status = 'reverted', updated_at = now() where id = :p"),
            {"p": m["proposal_id"]},
        )
        conn.execute(
            text(
                "insert into contributions.changelog (event, merge_id, dataset_version) values ('reverted', :m, :v)"
            ),
            {"m": m["id"], "v": _dataset_version()},
        )
    return detail(str(m["proposal_id"]), u)


# ─── what readers see: the changelog, a word's merged contributions, their own ───


def _titled(sources: list[dict[str, Any]], works: dict[str, Any]) -> list[dict[str, Any]]:
    """A source as the reader knows it: the lexicon's title, never its id (RVQ-78)."""
    return [
        {
            **s,
            "title_ar": (works.get(s["work"]) or {}).get("title_ar"),
            "title_en": (works.get(s["work"]) or {}).get("title_en"),
        }
        for s in sources
    ]


def _people(merges: list[dict[str, Any]]) -> dict[str, str | None]:
    """The names the credited accounts carry now: a name changed or cleared reaches every credit (F14)."""
    ids = {str(m["contributor_id"]) for m in merges if m["contributor_id"]}
    ids |= {str(r["id"]) for m in merges for r in (m["reviewers"] or []) if r.get("id")}
    if not ids:
        return {}
    with tx() as conn:
        found = q(
            conn,
            "select id, display_name from accounts.users where id = any(cast(:ids as uuid[]))",
            {"ids": list(ids)},
        )
    return {str(r["id"]): r["display_name"] for r in found}


def _merge_out(
    m: dict[str, Any], names: _Names, works: dict[str, Any], people: dict[str, str | None]
) -> dict[str, Any]:
    return {
        "id": str(m["id"]),
        "proposal_id": str(m["proposal_id"]),
        "kind": m["kind"],
        "lemma": m["lemma"],
        "lemma_ar": names.get(m["lemma"], m["lemma"]),
        "target_href": names.hrefs.get(m["lemma"]),
        "sense_ordinal": m["sense_ordinal"],
        "location": m["location"],
        "field": m["field"],
        "previous_text": m["previous_text"],
        "text": m["text"],
        "sources": _titled(m["sources"] or [], works),
        # a contributor who deleted their account, or never chose a name, is not named
        "contributor": people.get(str(m["contributor_id"])) if m["contributor_id"] else None,
        "former": m["contributor_id"] is None,
        "reviewers": [
            {"name": people.get(str(r["id"])) if r.get("id") else None, "board": r.get("board", False)}
            for r in m["reviewers"]
        ],
        "merged_at": m["merged_at"].isoformat(),
        "reverted_at": m["reverted_at"].isoformat() if m["reverted_at"] else None,
    }


def changelog(since: str | None, limit: int, before: int | None = None) -> dict[str, Any]:
    """Every merge and revert, newest first, paged by entry (F6)."""
    params: dict[str, Any] = {"n": limit + 1}
    cond = []
    if since:
        try:
            params["since"] = datetime.fromisoformat(since)
        except ValueError:
            raise Refusal(422, "bad_cursor", "That is not a time.") from None
        cond.append("c.at > :since")
    if before:
        params["before"] = before
        cond.append("c.id < :before")
    with tx() as conn:
        found = q(
            conn,
            f"""select c.id as entry, c.at, c.event, c.dataset_version, m.*
                from contributions.changelog c join contributions.merges m on m.id = c.merge_id
                {"where " + " and ".join(cond) if cond else ""}
                order by c.id desc limit :n""",
            params,
        )
    more = len(found) > limit
    found = found[:limit]
    names = _lemma_ar([m["lemma"] for m in found])
    works = _works()
    people = _people(found)
    return {
        "data": [
            {
                "entry": e["entry"],
                "at": e["at"].isoformat(),
                "event": e["event"],
                "dataset_version": e["dataset_version"],
                "merge": _merge_out(e, names, works, people),
            }
            for e in found
        ],
        "more": more,
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
    works = _works()
    people = _people(found)
    return {
        "data": [_merge_out(m, names, works, people) for m in found],
        "pending": pending["n"] if pending else 0,
    }


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
        raise Refusal(422, "unknown_role", "Unknown role.")
    if admin is not None and admin["role"] != "admin":
        raise Refusal(403, "not_admin", "Only an administrator grants roles.")
    with tx() as conn:
        u = q1(
            conn,
            "update accounts.users set role = :r where email = :e returning id, email, role",
            {"r": role, "e": email.strip().lower()},
        )
        if u is None:
            raise Refusal(404, "no_account", "No account with that address.")
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
    # a merge and the proposal it came from stay together, merged or taken back
    conn.execute(
        text(
            "delete from contributions.proposals where proposer_id = :u and status not in ('merged', 'reverted')"
        ),
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


# ─── the board's tools: reports and blocks (RVQ-74, audit 12 F4) ────────────────


def resolve_report(u: dict[str, Any], rid: int, outcome: str, note: str | None) -> dict[str, Any]:
    """The board reads a report and says what came of it: dismissed, or acted on (a decline, a revert, a block)."""
    if u["role"] not in BOARD:
        raise Refusal(403, "not_board", "Only the editorial board resolves reports.")
    if outcome not in ("dismissed", "acted"):
        raise Refusal(422, "unknown_outcome", "Dismiss the report, or say it was acted on.")
    with tx() as conn:
        _check_active(conn, u)
        r = q1(
            conn,
            """update contributions.reports set resolved_at = now(), resolved_by = :u, outcome = :o,
                      resolution_note = :n
               where id = :id and resolved_at is null returning proposal_id""",
            {"u": u["id"], "o": outcome, "n": plain.text(note or "").strip()[:2000] or None, "id": rid},
        )
        if r is None:
            raise Refusal(409, "not_open_report", "No such report, or it is already resolved.")
    return detail(str(r["proposal_id"]), u)


def open_reports(u: dict[str, Any]) -> dict[str, Any]:
    """Unresolved reports, oldest first, each with the proposal it concerns — the board's to read."""
    if u["role"] not in BOARD:
        raise Refusal(403, "not_board", "Only the editorial board reads reports.")
    with tx() as conn:
        found = q(
            conn,
            """select r.id, r.reason, r.created_at, p.id as proposal_id, p.kind, p.lemma, p.text
               from contributions.reports r join contributions.proposals p on p.id = r.proposal_id
               where r.resolved_at is null order by r.created_at limit 200""",
        )
    names = _lemma_ar([r["lemma"] for r in found])
    return {
        "data": [
            {
                "id": r["id"],
                "reason": r["reason"],
                "at": r["created_at"].isoformat(),
                "proposal": {
                    "id": str(r["proposal_id"]),
                    "kind": r["kind"],
                    "lemma": r["lemma"],
                    "lemma_ar": names.get(r["lemma"], r["lemma"]),
                    "text": r["text"],
                },
            }
            for r in found
        ]
    }


def block(admin: dict[str, Any] | None, target: str, blocked: bool, reason: str | None) -> dict[str, Any]:
    """An administrator stops an account proposing, reviewing and reporting — or lets it again. The target is an
    account's address, or the id of a proposal of theirs (the screen blocks from a proposal); every change is
    recorded beside the role grants, with its reason."""
    if admin is not None and admin["role"] != "admin":
        raise Refusal(403, "not_admin", "Only an administrator blocks an account.")
    with tx() as conn:
        if "@" in target:
            u = q1(conn, "select id from accounts.users where email = :e", {"e": target.strip().lower()})
        else:
            u = q1(
                conn,
                "select proposer_id as id from contributions.proposals where id = cast(:p as uuid)",
                {"p": _uuid(target)},
            )
        if u is None or u["id"] is None:
            raise Refusal(404, "no_account", "No such account.")
        if admin is not None and str(u["id"]) == str(admin["id"]):
            raise Refusal(422, "own_account", "An administrator does not block their own account.")
        conn.execute(
            text(f"update accounts.users set blocked_at = {'now()' if blocked else 'null'} where id = :u"),
            {"u": u["id"]},
        )
        conn.execute(
            text(
                "insert into contributions.role_grants (user_id, role, granted_by, reason) values (:u, :r, :by, :why)"
            ),
            {
                "u": u["id"],
                "r": "blocked" if blocked else "unblocked",
                "by": admin["id"] if admin else None,
                "why": reason or ("from the command line" if admin is None else None),
            },
        )
    return {"blocked": blocked}


def export_for(u: dict[str, Any]) -> dict[str, Any]:
    """Everything the contributions schema holds about an account, for its export (audit 12 F15): its proposals
    with their revisions' decisions, the decisions it took, the reports it sent, its role grants, and the merges
    that credit it."""
    with tx() as conn:
        proposals = q(
            conn,
            """select id, kind, lemma, sense_ordinal, location, field, current_text, text, why, sources, status,
                      revision, note, dataset_version, created_at, updated_at, decided_at
               from contributions.proposals where proposer_id = :u order by created_at""",
            {"u": u["id"]},
        )
        decisions = q(
            conn,
            """select proposal_id, revision, reviewer_role, decision, note, created_at
               from contributions.decisions where reviewer_id = :u order by created_at""",
            {"u": u["id"]},
        )
        reports = q(
            conn,
            "select proposal_id, reason, created_at, resolved_at, outcome from contributions.reports where reporter_id = :u",
            {"u": u["id"]},
        )
        grants = q(
            conn,
            "select role, reason, at from contributions.role_grants where user_id = :u order by at",
            {"u": u["id"]},
        )
        merges = q(
            conn,
            """select id, proposal_id, kind, lemma, text, merged_at, reverted_at from contributions.merges
               where contributor_id = :u
                  or reviewers @> jsonb_build_array(jsonb_build_object('id', cast(:u as text)))
               order by merged_at""",
            {"u": u["id"]},
        )

    def plain(r: dict[str, Any]) -> dict[str, Any]:
        return {
            k: (v.isoformat() if isinstance(v, datetime) else str(v) if isinstance(v, uuid.UUID) else v)
            for k, v in r.items()
        }

    return {
        "proposals": [plain(r) for r in proposals],
        "decisions": [plain(r) for r in decisions],
        "reports": [plain(r) for r in reports],
        "role_grants": [plain(r) for r in grants],
        "merges_credited": [plain(r) for r in merges],
    }


def for_target(target: str) -> dict[str, Any]:
    """The corrections in force on an item of the library, shown beside what the build made (B58), and how many wait."""
    with tx() as conn:
        merged = q(
            conn,
            "select * from contributions.merges where lemma = :t and kind = 'correction' and reverted_at is null "
            "order by merged_at",
            {"t": target},
        )
        waiting = q1(
            conn,
            """select count(*) as n from contributions.proposals where lemma = :t and kind = 'correction'
               and status in ('open', 'approved', 'changes')""",
            {"t": target},
        )
    names = _lemma_ar([target])
    works = _works()
    people = _people(merged)
    return {
        "target": target,
        "label": names.get(target, target),
        "data": [_merge_out(m, names, works, people) for m in merged],
        "waiting": int(waiting["n"]) if waiting else 0,
    }


def in_force(targets: list[str]) -> dict[str, list[dict[str, Any]]]:
    """The corrections in force on many items at once — a dictionary page's articles (B58) — by item."""
    with tx() as conn:
        merged = q(
            conn,
            """select * from contributions.merges where lemma = any(:t) and kind = 'correction' and reverted_at is null
               order by merged_at""",
            {"t": targets},
        )
    names = _lemma_ar(targets)
    works = _works()
    people = _people(merged)
    out: dict[str, list[dict[str, Any]]] = {}
    for m in merged:
        out.setdefault(m["lemma"], []).append(_merge_out(m, names, works, people))
    return out
