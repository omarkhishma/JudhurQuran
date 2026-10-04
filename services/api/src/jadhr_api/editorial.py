"""The editorial workbench (PLAN P3.0, research 14).

The editorial board writes and decides here what only scholars can: a root's English gloss, a correction of Ibn
Fāris's statement as cut, a pattern's function and its plain explanation, a word's sense list, the glossary's
bodies, the topic taxonomy (P8.3b), and a verdict on every row extracted from a book. Candidates are verbatim slices of cited sources or counts
from the corpus — the tool never suggests wording of its own (L2). An entry is in force only when an editor other
than its author approves its current revision; the database refuses a self-decision and a second approval of one
revision by one person (migration 0023). The work is keyed by stable keys and read beside the content, so a dataset
release never loses it; every save, submission and decision is logged.
"""

from __future__ import annotations

import json
import re
import threading
import urllib.error
import urllib.request
import uuid
from decimal import Decimal
from typing import Any

from jadhr_arabic import normalize
from sqlalchemy import Connection

from . import board, lexicon
from .accounts import q, q1, tx
from .db import connect, one, rows
from .refusal import Refusal
from .settings import get_settings

KINDS = (
    "root_gloss",
    "root_core",
    "pattern_function",
    "pattern_plain",
    "sense_list",
    "glossary",
    "topic",
    "verdict",
)
BOARD = {"editor", "admin"}
OPEN = ("draft", "review", "changes")

# the books' rows a verdict is given on: the table, the column that says what the row is, and an order to work in
LAYERS: dict[str, dict[str, str]] = {
    "pattern_functions": {
        "table": "content.pattern_functions",
        "label": "coalesce(heading_ar, '')",
        "text": "text_ar",
        "order": "source_id, seq",
    },
    "particle_entries": {
        "table": "content.particle_entries",
        "label": "headword_ar",
        "text": "coalesce(descriptor_ar, '')",
        "order": "source_id, seq",
    },
    "mufradat_subentries": {
        "table": "content.mufradat_subentries",
        "label": "coalesce(headword_ar, article_headword_ar)",
        "text": "text_ar",
        "order": "entry_id, seq",
    },
    "gharib_meanings": {
        "table": "content.gharib_meanings",
        "label": "phrase_ar",
        "text": "meaning_ar",
        "order": "surah, ayah, seq",
    },
    "loanword_links": {
        "table": "content.loanword_links",
        "label": "headword_ar",
        "text": "coalesce(lemma_ar, '')",
        "order": "id",
    },
    "relation_candidates": {
        "table": "content.relation_candidates",
        "label": "headword_ar",
        "text": "coalesce(text_ar, '')",
        "order": "source_id, id",
    },
    # Quranpedia's verse–topic links (P8.3): a verdict per link — reviewed, or rejected and left out
    "topic_links": {
        "table": """(select l.id, l.verse_key, l.topic_id, t.name_ar, 'extracted' as status
                    from content.topic_links l join content.topics t on t.id = l.topic_id
                    where l.source_id = 'quranpedia-topics') topic_links""",
        "label": "name_ar",
        "text": "verse_key",
        "order": "topic_id, split_part(verse_key, ':', 1)::int, split_part(verse_key, ':', 2)::int",
    },
    # QSAC's model-made tags on the verses Quranpedia leaves without a topic (P8.3b, D29): the board places a verse
    # under an Arabic topic (a correction naming it) or rejects the tag; nothing of QSAC's reaches a reader otherwise
    "topic_candidates": {
        "table": """(select l.id, l.verse_key, l.topic_id, t.name_en, 'extracted' as status
                    from content.topic_links l join content.topics t on t.id = l.topic_id
                    where l.source_id = 'qsac' and not exists (
                      select 1 from content.topic_links p
                      where p.verse_key = l.verse_key and p.source_id = 'quranpedia-topics')) topic_candidates""",
        "label": "name_en",
        "text": "verse_key",
        "order": "split_part(verse_key, ':', 1)::int, split_part(verse_key, ':', 2)::int, topic_id",
    },
    "entity_candidates": {
        "table": "content.entity_candidates",
        "label": "name_ar",
        "text": "coalesce(wikidata_label_ar, '')",
        "order": "occurrences desc, id",
    },
}


def _board(u: dict[str, Any]) -> None:
    if u["role"] not in BOARD or u.get("blocked_at"):
        raise Refusal(403, "not_board", "The workbench is for the editorial board.")


def _uuid(raw: str) -> str:
    try:
        return str(uuid.UUID(raw))
    except (ValueError, AttributeError, TypeError):
        raise Refusal(404, "not_found", "No such entry.") from None


def _str(v: Any, most: int, *, need: bool = False) -> str:
    s = v.strip() if isinstance(v, str) else ""
    if need and not s:
        raise Refusal(422, "empty", "This field cannot be empty.")
    if len(s) > most:
        raise Refusal(422, "too_long", f"At most {most} characters.")
    return s


def _sources(raw: Any, *, need: bool) -> list[dict[str, str]]:
    """A source names a work and where in it — a page, an entry, a locator — and may carry the words quoted."""
    if not isinstance(raw, list) or len(raw) > 20:
        raise Refusal(422, "bad_sources", "Sources are a list of at most twenty.")
    out = []
    for s in raw:
        if not isinstance(s, dict):
            raise Refusal(422, "bad_sources", "Each source names a work and where in it.")
        src = {"work": _str(s.get("work"), 60, need=True), "ref": _str(s.get("ref"), 200)}
        quote = _str(s.get("quote"), 2000)
        if quote:
            src["quote"] = quote
        out.append(src)
    if need and not out:
        raise Refusal(422, "sources_required", "Name the source this rests on.")
    return out


def _value(kind: str, raw: Any) -> tuple[dict[str, Any], bool]:
    """The value in its kind's shape, and whether the entry needs a source of its own."""
    v = raw if isinstance(raw, dict) else {}
    if kind == "root_gloss":
        return {"en": _str(v.get("en"), 200, need=True)}, True
    if kind == "root_core":
        kept = v.get("kept")
        if kept not in ("source", "corrected"):
            raise Refusal(422, "bad_value", "Say whether Ibn Fāris's statement stands or is corrected.")
        return {"ar": _str(v.get("ar"), 2000, need=True), "kept": kept}, True
    if kind in ("pattern_function", "pattern_plain"):
        ar, en = _str(v.get("ar"), 2000), _str(v.get("en"), 2000)
        if not ar and not en:
            raise Refusal(422, "empty", "Write it in Arabic, in English, or both.")
        out: dict[str, Any] = {"ar": ar, "en": en}
        if kind == "pattern_function":
            ids = v.get("rows") or []
            if (
                not isinstance(ids, list)
                or len(ids) > 20
                or not all(isinstance(x, str) and len(x) <= 60 for x in ids)
            ):
                raise Refusal(422, "bad_value", "The rows quoted are a list of row ids.")
            out["rows"] = ids
        # a pattern's function rests on the sarf books; its plain explanation is the board's own words
        return out, kind == "pattern_function"
    if kind == "sense_list":
        senses = v.get("senses")
        if not isinstance(senses, list) or not 1 <= len(senses) <= 60:
            raise Refusal(422, "bad_value", "A sense list holds one to sixty senses.")
        out_s = []
        for s in senses:
            s = s if isinstance(s, dict) else {}
            ar, en = _str(s.get("ar"), 1000), _str(s.get("en"), 1000)
            if not ar and not en:
                raise Refusal(422, "empty", "Each sense is written in Arabic, in English, or both.")
            out_s.append({"ar": ar, "en": en, "sources": _sources(s.get("sources"), need=True)})
        return {"senses": out_s}, False
    if kind == "topic":
        # the board's Arabic name for a heading, and where it stands: "" as its source places it, "top", or a topic;
        # whether it needs a source of its own depends on whose heading it is (_check_topic)
        return {
            "name_ar": _str(v.get("name_ar"), 200),
            "name_en": _str(v.get("name_en"), 200),
            "under": _str(v.get("under"), 60),
        }, False
    if kind == "glossary":
        ar, en = _str(v.get("body_ar"), 4000), _str(v.get("body_en"), 4000)
        if not ar and not en:
            raise Refusal(422, "empty", "Write it in Arabic, in English, or both.")
        return {"body_ar": ar, "body_en": en}, False
    if kind == "verdict":
        verdict = v.get("verdict")
        if verdict not in ("reviewed", "corrected", "rejected"):
            raise Refusal(422, "bad_value", "A verdict is reviewed, corrected or rejected.")
        raw_ends = v.get("ends")
        ends: dict[str, Any] = raw_ends if isinstance(raw_ends, dict) else {}
        remap = {k: _str(ends.get(k), 20) for k in ("root", "target_root") if _str(ends.get(k), 20)}
        # a QSAC tag's verse placed under an Arabic topic (P8.3b): the topic named says what the board decided
        if _str(ends.get("topic"), 60):
            remap["topic"] = _str(ends.get("topic"), 60)
        out_v: dict[str, Any] = {
            "verdict": verdict,
            "note": _str(v.get("note"), 2000, need=verdict != "reviewed" and "topic" not in remap),
        }
        if verdict == "corrected":
            # a relation's end mapped to another root is a correction of its own; words may say why
            out_v["correction"] = _str(v.get("correction"), 4000, need=not remap)
        if remap:
            if verdict != "corrected":
                raise Refusal(
                    422, "bad_value", "A root mapped anew, or a verse placed under a topic, is a correction."
                )
            out_v["ends"] = remap
        return out_v, False
    raise Refusal(404, "not_found", "No such kind of entry.")


def _kind(kind: str) -> str:
    if kind not in KINDS:
        raise Refusal(404, "not_found", "No such kind of entry.")
    return kind


def _layer(target: str) -> tuple[str, str]:
    layer, _, row = target.partition(":")
    if layer not in LAYERS or not row:
        raise Refusal(404, "not_found", "No such row.")
    return layer, row


def _target(conn: Connection, kind: str, target: str) -> dict[str, Any]:
    """What an entry is about, as the content holds it now; a target the content does not hold is not found."""
    if kind in ("root_gloss", "root_core"):
        t = one(
            conn,
            "select key, spaced as label, translit, occurrences, gist_ar, gist_source from content.roots where key = :k",
            {"k": target},
        )
    elif kind in ("pattern_function", "pattern_plain"):
        t = one(
            conn,
            "select slug as key, ar as label, translit, occurrences, lemma_count from content.patterns where slug = :k",
            {"k": target},
        )
    elif kind == "sense_list":
        t = one(
            conn,
            """select l.slug as key, l.ar as label, l.key as lemma_key, l.translit, l.occurrences, l.verse_count, l.gloss_en,
                      r.key as root_key, r.spaced as root_spaced
               from content.lemmas l left join content.roots r on r.id = l.root_id where l.slug = :k""",
            {"k": target},
        )
    elif kind == "glossary":
        t = one(
            conn,
            "select key, label_ar as label, label_en, body_ar, body_en, category from content.glossary_terms where key = :k",
            {"k": target},
        )
    elif kind == "topic":
        t = _topic_target(conn, target)
    else:
        layer, row = _layer(target)
        spec = LAYERS[layer]
        t = one(conn, f"select *, {spec['label']} as label from {spec['table']} where id = :r", {"r": row})
        if t is not None:
            t["layer"] = layer
            t["key"] = target
    if t is None:
        raise Refusal(404, "not_found", "The content holds nothing by that key.")
    # numbers the database keeps as decimals travel as numbers
    return {k: float(v) if isinstance(v, Decimal) else v for k, v in t.items()}


_BOARD_TOPIC = re.compile(r"^board:[a-z0-9]{6,16}$")
# the headings the board works on: Quranpedia's (renamed or placed anew) and La Beaume's chapters (adopted)
_TOPIC_SOURCES = ("quranpedia-topics", "labeaume")


def _topic_target(conn: Connection, target: str) -> dict[str, Any] | None:
    """A heading the board names or places: a source's (with its own name, place and verses) or one of its own."""
    if target.startswith("board:"):
        if not _BOARD_TOPIC.match(target):
            return None
        named = one(
            conn,
            """select value from editorial.entries where kind = 'topic' and target = :t and status <> 'retired'
               order by (status = 'approved') desc, updated_at desc limit 1""",
            {"t": target},
        )
        return {
            "key": target,
            "label": (named["value"].get("name_ar") if named else "") or "",
            "source_id": "board",
            "parent_id": None,
            "verse_count": None,
        }
    return one(
        conn,
        """select t.id as key, coalesce(t.name_ar, t.name_fr, t.name_en) as label, t.name_ar, t.name_fr, t.source_id,
                  t.source_ref, t.parent_id, t.level, t.verse_count, p.name_ar as parent_name
           from content.topics t left join content.topics p on p.id = t.parent_id
           where t.id = :k and t.source_id = any(:s)""",
        {"k": target, "s": list(_TOPIC_SOURCES)},
    )


def _known_topic(conn: Connection, tid: str) -> None:
    """A topic a verse or a heading may be placed under: a source's heading the board works on, or one of the
    board's own that an entry names."""
    if tid.startswith("board:"):
        found = one(
            conn,
            "select 1 as x from editorial.entries where kind = 'topic' and target = :t and status <> 'retired' limit 1",
            {"t": tid},
        )
    else:
        found = one(
            conn,
            "select 1 as x from content.topics where id = :t and source_id = any(:s)",
            {"t": tid, "s": list(_TOPIC_SOURCES)},
        )
    if not found:
        raise Refusal(422, "unknown_topic", f"No topic {tid} to place it under.")


def _parent_of(conn: Connection, tid: str, placed: dict[str, dict[str, Any]]) -> str | None:
    """Where a topic stands with the board's places in force: as its source places it, at the top, or under another."""
    v = placed.get(tid)
    under = (v or {}).get("under") or ""
    if under == "top":
        return None
    if under:
        return under
    if tid.startswith("board:"):
        return None
    r = one(conn, "select parent_id from content.topics where id = :t", {"t": tid})
    return r["parent_id"] if r else None


def _check_topic(
    conn: Connection, t: dict[str, Any], value: dict[str, Any], sources: list[dict[str, str]]
) -> None:
    """A chapter adopted or a topic of the board's own is named in Arabic and rests on a source; a place is a topic
    the board works on, never the topic itself or one beneath it."""
    key, src = t["key"], t["source_id"]
    if src in ("labeaume", "board") and not value["name_ar"]:
        raise Refusal(422, "empty", "Name the topic in Arabic.")
    if src in ("labeaume", "board") and not sources:
        raise Refusal(422, "sources_required", "Name the source this heading rests on.")
    if src == "quranpedia-topics" and value["name_ar"] == (t.get("name_ar") or ""):
        value["name_ar"] = ""  # the source's own name kept: nothing renamed
    under = value["under"]
    if under in ("", "top"):
        return
    _known_topic(conn, under)
    placed = {k: v["value"] for k, v in board.every(conn, "topic").items()} | {key: value}
    seen, at = {key}, under
    while at:
        if at in seen:
            raise Refusal(
                422, "topic_cycle", "A topic cannot stand under itself or under a topic beneath it."
            )
        seen.add(at)
        at = _parent_of(conn, at, placed)


def _check_ends(conn: Connection, t: dict[str, Any], ends: dict[str, str]) -> None:
    """A re-mapping only on a relation's row, only of an end it has, and only to a root the corpus holds; a placement
    only of a QSAC tag's verse, under a topic the board works on."""
    if "topic" in ends:
        if t.get("layer") != "topic_candidates" or set(ends) != {"topic"}:
            raise Refusal(422, "bad_value", "Only a QSAC tag's verse is placed under a topic.")
        _known_topic(conn, ends["topic"])
        return
    if t.get("layer") != "relation_candidates":
        raise Refusal(422, "bad_value", "Only a relation's ends are mapped anew.")
    if "target_root" in ends and not t.get("target_ar"):
        raise Refusal(422, "bad_value", "This row names one word: it has no second end.")
    for k in ends.values():
        if not one(conn, "select 1 as x from content.roots where key = :k", {"k": k}):
            raise Refusal(422, "unknown_root", f"No root {k} in the corpus.")


def _who(conn: Connection, ids: list[Any]) -> dict[str, str | None]:
    ids = [i for i in ids if i]
    if not ids:
        return {}
    return {
        str(r["id"]): r["display_name"]
        for r in q(conn, "select id, display_name from accounts.users where id = any(:i)", {"i": ids})
    }


def _entry_out(e: dict[str, Any], names: dict[str, str | None]) -> dict[str, Any]:
    return {
        "id": str(e["id"]),
        "kind": e["kind"],
        "target": e["target"],
        "value": e["value"],
        "sources": e["sources"],
        "status": e["status"],
        "revision": e["revision"],
        "author": {
            "id": str(e["author_id"]) if e["author_id"] else None,
            "name": names.get(str(e["author_id"])) if e["author_id"] else None,
        },
        "updated_at": e["updated_at"].isoformat(),
        "decided_at": e["decided_at"].isoformat() if e["decided_at"] else None,
    }


# ─── what is in force: read beside the content ─────────────────────────────────


def in_force(kind: str, targets: list[str]) -> dict[str, dict[str, Any]]:
    """The approved entries of a kind for these targets, with who wrote and who approved them — what the content API
    shows beside the source."""
    if not targets:
        return {}
    with tx() as conn:
        found = q(
            conn,
            """select e.target, e.value, e.sources, e.decided_at, e.author_id,
                      (select r.reviewer_id from editorial.reviews r where r.entry_id = e.id and r.revision = e.revision
                         and r.decision = 'approve' order by r.created_at desc limit 1) as reviewer_id
               from editorial.entries e where e.kind = :k and e.status = 'approved' and e.target = any(:t)""",
            {"k": kind, "t": targets},
        )
        names = _who(conn, [x for f in found for x in (f["author_id"], f["reviewer_id"])])
    return {
        f["target"]: {
            "value": f["value"],
            "sources": f["sources"],
            "approved_at": f["decided_at"].isoformat() if f["decided_at"] else None,
            "by": names.get(str(f["author_id"])) if f["author_id"] else None,
            "approved_by": names.get(str(f["reviewer_id"])) if f["reviewer_id"] else None,
        }
        for f in found
    }


def verdicts(layer: str, ids: list[str]) -> dict[str, dict[str, Any]]:
    """The board's verdict on rows of a layer, by row id."""
    found = in_force("verdict", [f"{layer}:{i}" for i in ids])
    return {k.split(":", 1)[1]: v for k, v in found.items()}


# ─── the board's view ─────────────────────────────────────────────────────────

_POOL = {
    "root_gloss": "select count(*) from content.roots",
    "root_core": "select count(*) from content.roots",
    "pattern_function": "select count(*) from content.patterns",
    "pattern_plain": "select count(*) from content.patterns",
    "sense_list": "select count(*) from content.lemmas",
    "glossary": "select count(*) from content.glossary_terms",
    "topic": "select count(*) from content.topics where source_id in ('quranpedia-topics', 'labeaume')",
}


def works(u: dict[str, Any]) -> list[dict[str, str]]:
    """The works a source may name, by the id the reader resolves to a title (jadhr_api.board)."""
    _board(u)
    with connect() as conn:
        return [{"id": k, **v} for k, v in board.works(conn).items()]


def worklists(u: dict[str, Any]) -> dict[str, Any]:
    """Each worklist with how much there is, how much is in force, in review and open; the board's own open work,
    and what waits on this editor's review."""
    _board(u)
    with connect() as conn:
        totals = {k: int(one(conn, sql)["count"]) for k, sql in _POOL.items()}  # type: ignore[index]
        layers = {k: int(one(conn, f"select count(*) from {v['table']}")["count"]) for k, v in LAYERS.items()}  # type: ignore[index]
    with tx() as conn:
        by = q(
            conn,
            "select kind, status, count(*)::int as n from editorial.entries where status <> 'retired' group by kind, status",
        )
        vby = q(
            conn,
            """select split_part(target, ':', 1) as layer, status, count(*)::int as n from editorial.entries
               where kind = 'verdict' and status <> 'retired' group by 1, 2""",
        )
        waiting = q1(
            conn,
            """select count(*)::int as n from editorial.entries e where e.status = 'review' and e.author_id <> :u
                 and not exists (select 1 from editorial.reviews r where r.entry_id = e.id and r.revision = e.revision and r.reviewer_id = :u)""",
            {"u": u["id"]},
        )
        mine = q1(
            conn,
            "select count(*)::int as n from editorial.entries where author_id = :u and status in ('draft', 'changes')",
            {"u": u["id"]},
        )

    def counts(xs: list[dict[str, Any]], key: str, name: str) -> dict[str, int]:
        c = {s: 0 for s in ("draft", "review", "changes", "approved")}
        for x in xs:
            if x[key] == name and x["status"] in c:
                c[x["status"]] = x["n"]
        return c

    return {
        "kinds": [{"kind": k, "total": totals[k], **counts(by, "kind", k)} for k in _POOL],
        "layers": [{"layer": k, "total": layers[k], **counts(vby, "layer", k)} for k in LAYERS],
        "awaiting_me": waiting["n"] if waiting else 0,
        "my_open": mine["n"] if mine else 0,
    }


_LISTS = {
    "root_gloss": ("select key, spaced as label, translit as sub, occurrences from content.roots", "spaced"),
    "root_core": (
        "select key, spaced as label, coalesce(gist_ar, '') as sub, occurrences from content.roots",
        "spaced",
    ),
    "pattern_function": (
        "select slug as key, ar as label, translit as sub, occurrences from content.patterns",
        "ar",
    ),
    "pattern_plain": (
        "select slug as key, ar as label, translit as sub, occurrences from content.patterns",
        "ar",
    ),
    "sense_list": (
        "select slug as key, ar as label, coalesce(gloss_en, '') as sub, occurrences from content.lemmas",
        "ar_bare",
    ),
    "glossary": (
        "select key, label_ar as label, label_en as sub, sort_order as occurrences from content.glossary_terms",
        "label_ar",
    ),
}


def _topic_targets(conn: Connection, query: str) -> list[dict[str, Any]]:
    """The headings of the taxonomy: the board's own first, then La Beaume's chapters in the book's order, then
    Quranpedia's topics, those gathering the most verses first; a search folds the Arabic as every search does."""
    folded = normalize(query) if query else ""
    own = rows(
        conn,
        """select distinct on (target) target as key, coalesce(value->>'name_ar', '') as label
           from editorial.entries where kind = 'topic' and target like 'board:%' and status <> 'retired'
           order by target, (status = 'approved') desc, updated_at desc""",
    )
    items = [
        {"key": o["key"], "label": o["label"], "sub": "", "occurrences": None}
        for o in own
        if not folded or folded in normalize(o["label"])
    ]
    items += rows(
        conn,
        f"""select t.id as key, coalesce(t.name_ar, t.name_fr) as label,
                   case when t.source_id = 'labeaume' then t.source_ref else coalesce(p.name_ar, '') end as sub,
                   t.verse_count as occurrences
            from content.topics t left join content.topics p on p.id = t.parent_id
            where t.source_id in ('quranpedia-topics', 'labeaume'){" and t.name_norm like :q" if folded else ""}
            order by (t.source_id = 'labeaume') desc, t.level, t.verse_count desc, length(t.id), t.id""",
        {"q": f"%{folded}%"} if folded else {},
    )
    return items


def targets(
    u: dict[str, Any], kind: str, state: str, query: str, offset: int, limit: int, layer: str | None
) -> dict[str, Any]:
    """A worklist's targets, the most used in the Quran first (a layer's rows in the book's order), each with the
    state of the board's work on it: to do, open (a draft or changes asked), in review, in force."""
    _board(u)
    _kind(kind)
    if state not in ("all", "todo", "open", "review", "approved"):
        raise Refusal(422, "bad_state", "No such state.")
    with tx() as conn:
        work = q(
            conn,
            "select target, status from editorial.entries where kind = :k and status <> 'retired'",
            {"k": kind},
        )
    states: dict[str, set[str]] = {}
    for w in work:
        states.setdefault(w["target"], set()).add(w["status"])

    def state_of(key: str) -> str:
        s = states.get(key, set())
        return (
            "review"
            if "review" in s
            else "open"
            if s & {"draft", "changes"}
            else "approved"
            if "approved" in s
            else "todo"
        )

    with connect() as conn:
        if kind == "verdict":
            if layer not in LAYERS:
                raise Refusal(422, "bad_layer", "Name the layer whose rows to list.")
            spec = LAYERS[layer]
            all_rows = rows(
                conn,
                f"select id, {spec['label']} as label, {spec['text']} as sub, status from {spec['table']} order by {spec['order']}",
            )
            items = [
                {
                    "key": f"{layer}:{r['id']}",
                    "label": r["label"],
                    "sub": (r["sub"] or "")[:200],
                    "source_status": r["status"],
                }
                for r in all_rows
            ]
            if layer in ("topic_links", "topic_candidates"):
                # the verse in the mushaf's text, and the topic or the tag as its source names and places it (P8.3b)
                det = {
                    r["id"]: r
                    for r in rows(
                        conn,
                        f"""select l.id, l.verse_key, v.text_qpc as verse_text, t.id as topic_id,
                                   coalesce(t.name_ar, t.name_en) as name, t.description, p.name_ar as parent_ar,
                                   p.name_en as parent_en, g.name_en as grand_en
                            from {spec["table"]} join content.topic_links l on l.id = {layer}.id
                            join content.verses v on v.surah = split_part(l.verse_key, ':', 1)::int
                                                 and v.ayah = split_part(l.verse_key, ':', 2)::int
                            join content.topics t on t.id = l.topic_id
                            left join content.topics p on p.id = t.parent_id
                            left join content.topics g on g.id = p.parent_id""",
                    )
                }
                for it in items:
                    d = det[it["key"].split(":", 1)[1]]
                    it["topic"] = {k: d[k] for k in d if k != "id"}
            if layer == "relation_candidates":
                # a relation's two ends with the roots they were mapped to, the sense it names, its verses (P8.4)
                rel = {
                    r["id"]: r
                    for r in rows(
                        conn,
                        """select c.id, c.type, c.source_id, c.headword_ar, c.target_ar,
                                  coalesce(c.root_key, e.root_key) as root, c.target_root_key as target_root,
                                  c.match_confidence, c.target_match_confidence, c.sense_label_ar, c.verses, c.locator
                           from content.relation_candidates c left join content.relation_entries e on e.id = c.entry_id""",
                    )
                }
                for it in items:
                    r = rel[it["key"].split(":", 1)[1]]
                    it["relation"] = {k: r[k] for k in r if k != "id"}
        elif kind == "topic":
            items = _topic_targets(conn, query)
        else:
            sql, col = _LISTS[kind]
            where = f" where {col} ilike :q" if query else ""
            order = (
                " order by occurrences asc" if kind == "glossary" else " order by occurrences desc nulls last"
            )
            items = rows(conn, sql + where + order, {"q": f"%{query}%"} if query else {})
    for it in items:
        it["state"] = state_of(it["key"])
    if kind == "verdict" and query:
        items = [i for i in items if query in (i["label"] or "") or query in (i["sub"] or "")]
    if state != "all":
        items = [i for i in items if i["state"] == state]
    return {"total": len(items), "data": items[offset : offset + limit]}


def candidates(conn: Connection, kind: str, t: dict[str, Any]) -> dict[str, Any]:
    """What the sources say about a target — verbatim slices and corpus counts, each with its work and place — for
    the board to quote and cite. Never wording of the tool's own (L2)."""
    if kind in ("root_gloss", "root_core"):
        out: dict[str, Any] = {
            "core": {"ar": t["gist_ar"], "source": t["gist_source"]} if t.get("gist_ar") else None,
            # the corpus's English glosses of the root's words, with how often each word occurs
            "word_glosses": rows(
                conn,
                """select l.slug, l.ar, l.gloss_en, l.occurrences from content.lemmas l join content.roots r on r.id = l.root_id
                   where r.key = :k and l.gloss_en is not null order by l.occurrences desc limit 20""",
                {"k": t["key"]},
            ),
        }
        lane = one(
            conn,
            """select e.id, e.page_ref, left(e.body, 1500) as body, length(e.body) as length from content.lexicon_entries e
               where e.work_id = 'lane' and e.root_key = :k and e.displayable order by e.id limit 1""",
            {"k": t["key"]},
        )
        maqayis = one(
            conn,
            """select e.id, e.page_ref, left(e.body, 2000) as body, length(e.body) as length from content.lexicon_entries e
               where e.work_id = 'maqayis' and e.root_key = :k and e.displayable order by e.id limit 1""",
            {"k": t["key"]},
        )
        out["lane"] = lane
        out["maqayis"] = maqayis
        return out
    if kind in ("pattern_function", "pattern_plain"):
        return {"classical": lexicon.pattern_classical(conn, t["key"])}
    if kind == "sense_list":
        mufradat = rows(
            conn,
            """select s.id, s.headword_ar, s.text_ar, s.page_ref, s.status from content.mufradat_subentries s
               where s.lemma_key = :k order by s.entry_id, s.seq""",
            {"k": t["lemma_key"]},
        )
        # al-Muyassar's meaning at the word's places: each distinct wording with how many places it is given for
        muyassar = rows(
            conn,
            """select m.meaning_ar, m.phrase_ar, count(*)::int as places, min(m.surah * 1000 + m.ayah) as first
               from content.gharib_meanings m
               where exists (select 1 from content.words w join content.lemmas l on l.id = w.lemma_id
                             where l.slug = :s and w.location = any(m.word_locations))
               group by m.meaning_ar, m.phrase_ar order by places desc, first limit 30""",
            {"s": t["key"]},
        )
        wujuh = rows(
            conn,
            """select id, source_id, sense_index, sense_label_ar, text_ar, verses, page_vol, page from content.relation_candidates
               where type = 'wujuh_sense' and lemma_key = :k order by source_id, sense_index limit 60""",
            {"k": t["lemma_key"]},
        )
        lane = (
            one(
                conn,
                """select e.id, e.page_ref, left(e.body, 1500) as body, length(e.body) as length from content.lexicon_entries e
                   where e.work_id = 'lane' and e.root_key = :k and e.displayable order by e.id limit 1""",
                {"k": t["root_key"]},
            )
            if t.get("root_key")
            else None
        )
        return {
            "mufradat": mufradat,
            "muyassar": muyassar,
            "wujuh": wujuh,
            "lane": lane,
            "corpus_gloss": t.get("gloss_en"),
        }
    if kind == "glossary":
        return {"current": {"body_ar": t["body_ar"], "body_en": t["body_en"]}}
    if kind == "topic":
        return _topic_candidates(conn, t)
    return {"row": {k: v for k, v in t.items() if k not in ("label",)}}


def _topic_candidates(conn: Connection, t: dict[str, Any]) -> dict[str, Any]:
    """What the sources say of a heading: La Beaume's chapter as the book prints it, to cite; a Quranpedia topic's
    chain, sub-topics and first verses, and the QSAC tags its verses carry (an English hint, never a name); the
    headings the board has placed under it."""
    out: dict[str, Any] = {"source_id": t["source_id"]}
    if t["source_id"] == "labeaume":
        out["chapter"] = {"work": "labeaume", "ref": t["source_ref"], "title_fr": t["name_fr"]}
    if t["source_id"] == "quranpedia-topics":
        out["chain"] = (
            rows(
                conn,
                """with recursive up as (
                 select id, name_ar, parent_id, 0 as d from content.topics where id = :p
                 union all select x.id, x.name_ar, x.parent_id, up.d + 1 from content.topics x join up on x.id = up.parent_id)
               select id, name_ar from up order by d desc""",
                {"p": t["parent_id"]},
            )
            if t["parent_id"]
            else []
        )
        out["subtopics"] = rows(
            conn,
            """select id, name_ar, verse_count from content.topics where parent_id = :id
               order by verse_count desc, id limit 30""",
            {"id": t["key"]},
        )
        out["verses"] = [
            r["verse_key"]
            for r in rows(
                conn,
                """select verse_key from content.topic_links where topic_id = :id
                   order by split_part(verse_key, ':', 1)::int, split_part(verse_key, ':', 2)::int limit 12""",
                {"id": t["key"]},
            )
        ]
        out["qsac"] = rows(
            conn,
            """select q.name_en as tag, p.name_en as category, count(*)::int as verses
               from content.topic_links a join content.topic_links b on b.verse_key = a.verse_key and b.source_id = 'qsac'
               join content.topics q on q.id = b.topic_id left join content.topics p on p.id = q.parent_id
               where a.topic_id = :id group by q.name_en, p.name_en order by verses desc, q.name_en limit 10""",
            {"id": t["key"]},
        )
    placed = [k for k, v in board.every(conn, "topic").items() if v["value"].get("under") == t["key"]]
    out["placed_here"] = rows(
        conn,
        "select id, coalesce(name_ar, name_fr) as name from content.topics where id = any(:i) order by id",
        {"i": placed},
    ) + [
        {"id": k, "name": board.every(conn, "topic")[k]["value"]["name_ar"]}
        for k in placed
        if k.startswith("board:")
    ]
    return out


def entry(u: dict[str, Any], kind: str, target: str) -> dict[str, Any]:
    """A target with what is in force on it, the open work, the decisions on that work's revision, the sources'
    candidates and the history."""
    _board(u)
    _kind(kind)
    with connect() as conn:
        t = _target(conn, kind, target)
        cand = candidates(conn, kind, t)
    with tx() as conn:
        es = q(
            conn,
            "select * from editorial.entries where kind = :k and target = :t and status <> 'retired' order by created_at",
            {"k": kind, "t": target},
        )
        opened = next((e for e in es if e["status"] in OPEN), None)
        force = next((e for e in es if e["status"] == "approved"), None)
        decisions = (
            q(
                conn,
                "select revision, reviewer_id, decision, note, created_at from editorial.reviews where entry_id = :e order by created_at",
                {"e": opened["id"]},
            )
            if opened
            else []
        )
        log = q(
            conn,
            """select l.action, l.revision, l.actor_id, l.at, l.detail from editorial.log l
               join editorial.entries e on e.id = l.entry_id where e.kind = :k and e.target = :t order by l.at desc limit 50""",
            {"k": kind, "t": target},
        )
        names = _who(
            conn,
            [
                *(e["author_id"] for e in es),
                *(d["reviewer_id"] for d in decisions),
                *(x["actor_id"] for x in log),
            ],
        )
    return {
        "kind": kind,
        "target": {k: v for k, v in t.items() if not isinstance(v, (bytes, bytearray))},
        "in_force": _entry_out(force, names) if force else None,
        "open": _entry_out(opened, names) | {"mine": str(opened["author_id"]) == str(u["id"])}
        if opened
        else None,
        "decisions": [
            {
                "revision": d["revision"],
                "decision": d["decision"],
                "note": d["note"],
                "by": names.get(str(d["reviewer_id"])),
                "at": d["created_at"].isoformat(),
            }
            for d in decisions
        ],
        "candidates": cand,
        "history": [
            {
                "action": x["action"],
                "revision": x["revision"],
                "by": names.get(str(x["actor_id"])),
                "at": x["at"].isoformat(),
            }
            for x in log
        ],
    }


def _log(
    conn: Connection,
    entry_id: Any,
    u: dict[str, Any],
    action: str,
    revision: int,
    detail: dict[str, Any] | None = None,
) -> None:
    q(
        conn,
        "insert into editorial.log (entry_id, actor_id, action, revision, detail) values (:e, :u, :a, :r, cast(:d as jsonb)) returning id",
        {
            "e": entry_id,
            "u": u["id"],
            "a": action,
            "r": revision,
            "d": json.dumps(detail or {}, ensure_ascii=False),
        },
    )


def save(u: dict[str, Any], kind: str, target: str, raw_value: Any, raw_sources: Any) -> dict[str, Any]:
    """A draft, or the author's open work changed: only its author edits it; work in review goes back to draft."""
    _board(u)
    _kind(kind)
    value, needs = _value(kind, raw_value)
    sources = _sources(raw_sources, need=needs)
    with connect() as conn:
        t = _target(conn, kind, target)
        if value.get("ends"):
            _check_ends(conn, t, value["ends"])
        if t.get("layer") == "topic_candidates" and value["verdict"] != "rejected" and not value.get("ends"):
            raise Refusal(422, "place_or_reject", "Place the verse under an Arabic topic, or reject the tag.")
        if kind == "topic":
            _check_topic(conn, t, value, sources)
    with tx() as conn:
        e = q1(
            conn,
            "select * from editorial.entries where kind = :k and target = :t and status in ('draft', 'review', 'changes') for update",
            {"k": kind, "t": target},
        )
        if e is None:
            e = q1(
                conn,
                """insert into editorial.entries (kind, target, value, sources, author_id)
                   values (:k, :t, cast(:v as jsonb), cast(:s as jsonb), :u) returning *""",
                {
                    "k": kind,
                    "t": target,
                    "v": json.dumps(value, ensure_ascii=False),
                    "s": json.dumps(sources, ensure_ascii=False),
                    "u": u["id"],
                },
            )
        else:
            if str(e["author_id"]) != str(u["id"]):
                raise Refusal(
                    409, "not_author", "Another editor is writing this; review it when it is submitted."
                )
            e = q1(
                conn,
                """update editorial.entries set value = cast(:v as jsonb), sources = cast(:s as jsonb), updated_at = now(),
                     status = case when status = 'review' then 'draft' else status end
                   where id = :id returning *""",
                {
                    "id": e["id"],
                    "v": json.dumps(value, ensure_ascii=False),
                    "s": json.dumps(sources, ensure_ascii=False),
                },
            )
        assert e is not None
        _log(conn, e["id"], u, "saved", e["revision"])
        return _entry_out(e, {str(u["id"]): u.get("display_name")})


def _open(conn: Connection, entry_id: str) -> dict[str, Any]:
    e = q1(conn, "select * from editorial.entries where id = :id for update", {"id": _uuid(entry_id)})
    if e is None:
        raise Refusal(404, "not_found", "No such entry.")
    return e


def submit(u: dict[str, Any], entry_id: str) -> dict[str, Any]:
    """The author's draft goes to review; after changes were asked, as a new revision."""
    _board(u)
    with tx() as conn:
        e = _open(conn, entry_id)
        if str(e["author_id"]) != str(u["id"]):
            raise Refusal(403, "not_author", "Only its author submits an entry.")
        if e["status"] not in ("draft", "changes"):
            raise Refusal(409, "not_draft", "Only a draft, or work sent back for changes, is submitted.")
        done = q1(
            conn,
            """update editorial.entries set status = 'review', updated_at = now(),
                 revision = case when status = 'changes' then revision + 1 else revision end
               where id = :id returning *""",
            {"id": e["id"]},
        )
        assert done is not None
        _log(conn, done["id"], u, "submitted", done["revision"])
        return _entry_out(done, {})


def withdraw(u: dict[str, Any], entry_id: str) -> dict[str, Any]:
    """Work in review taken back to draft by its author."""
    _board(u)
    with tx() as conn:
        e = _open(conn, entry_id)
        if str(e["author_id"]) != str(u["id"]) or e["status"] != "review":
            raise Refusal(409, "not_yours", "Only its author takes back work in review.")
        done = q1(
            conn,
            "update editorial.entries set status = 'draft', updated_at = now() where id = :id returning *",
            {"id": e["id"]},
        )
        assert done is not None
        _log(conn, done["id"], u, "withdrawn", done["revision"])
        return _entry_out(done, {})


def discard(u: dict[str, Any], entry_id: str) -> None:
    """A draft never approved, removed by its author."""
    _board(u)
    with tx() as conn:
        e = _open(conn, entry_id)
        if str(e["author_id"]) != str(u["id"]) or e["status"] not in ("draft", "changes"):
            raise Refusal(409, "not_yours", "Only its author discards a draft.")
        q(conn, "delete from editorial.entries where id = :id returning id", {"id": e["id"]})


def decide(u: dict[str, Any], entry_id: str, decision: str, note: str | None) -> dict[str, Any]:
    """Another editor approves the revision in review — it comes into force, and what was in force before is
    retired — or asks for changes, with a note."""
    _board(u)
    if decision not in ("approve", "changes"):
        raise Refusal(422, "bad_decision", "Approve, or ask for changes.")
    note = _str(note, 2000, need=decision == "changes") or None
    with tx() as conn:
        e = _open(conn, entry_id)
        if str(e["author_id"]) == str(u["id"]):
            raise Refusal(403, "self_review", "An author does not decide on their own entry.")
        if e["status"] != "review":
            raise Refusal(409, "not_in_review", "Only work in review is decided.")
        if (
            decision == "approve"
            and e["kind"] == "topic"
            and (e["value"].get("under") or "") not in ("", "top")
        ):
            # the tree may have changed since it was written: an approval never makes a topic stand under itself
            with connect() as c:
                t = _topic_target(c, e["target"])
                if t is not None:
                    _check_topic(c, t, dict(e["value"]), e["sources"] or [{"work": "-", "ref": ""}])
        try:
            q(
                conn,
                "insert into editorial.reviews (entry_id, revision, reviewer_id, decision, note) values (:e, :r, :u, :d, :n) returning id",
                {"e": e["id"], "r": e["revision"], "u": u["id"], "d": decision, "n": note},
            )
        except (
            Exception
        ) as ex:  # the database's own refusal: a second approval, or a self-review it caught first
            raise Refusal(409, "already_decided", "This revision has your decision already.") from ex
        if decision == "approve":
            q(
                conn,
                "update editorial.entries set status = 'retired', updated_at = now() where kind = :k and target = :t and status = 'approved' returning id",
                {"k": e["kind"], "t": e["target"]},
            )
            done = q1(
                conn,
                "update editorial.entries set status = 'approved', decided_at = now(), updated_at = now() where id = :id returning *",
                {"id": e["id"]},
            )
            assert done is not None
            _log(conn, done["id"], u, "approved", done["revision"], {"note": note} if note else None)
        else:
            done = q1(
                conn,
                "update editorial.entries set status = 'changes', updated_at = now() where id = :id returning *",
                {"id": e["id"]},
            )
            assert done is not None
            _log(conn, done["id"], u, "changes", done["revision"], {"note": note})
        out = _entry_out(done, {})
    if decision == "approve":
        _in_force_changed()
    return out


def _in_force_changed() -> None:
    """What the reader is served changed: this process reads it afresh, and the web's cached pages are expired so the
    board's work shows at once rather than after a day."""
    board.clear()
    threading.Thread(target=_expire_web, daemon=True).start()


def _expire_web() -> None:
    s = get_settings()
    if not s.web_revalidate_url:
        return
    req = urllib.request.Request(s.web_revalidate_url, method="POST", data=b"")
    if s.revalidate_secret:
        req.add_header("Authorization", f"Bearer {s.revalidate_secret}")
    try:
        with urllib.request.urlopen(req, timeout=15):
            pass
    except (urllib.error.URLError, TimeoutError):
        # the pages expire on their own within the day; nothing the board did is lost
        return


def awaiting(u: dict[str, Any], limit: int) -> dict[str, Any]:
    """Work in review that this editor did not write and has not decided on: what waits on them."""
    _board(u)
    with tx() as conn:
        es = q(
            conn,
            """select e.* from editorial.entries e where e.status = 'review' and e.author_id <> :u
                 and not exists (select 1 from editorial.reviews r where r.entry_id = e.id and r.revision = e.revision and r.reviewer_id = :u)
               order by e.updated_at limit :n""",
            {"u": u["id"], "n": limit},
        )
        names = _who(conn, [e["author_id"] for e in es])
    return {"data": [_entry_out(e, names) for e in es]}


def save_verdicts(
    u: dict[str, Any], layer: str, items: list[dict[str, Any]], submit_now: bool
) -> dict[str, Any]:
    """Verdicts on many rows of a layer at once, each its own entry — saved, and submitted for review when asked."""
    _board(u)
    if layer not in LAYERS:
        raise Refusal(404, "not_found", "No such layer.")
    if not 1 <= len(items) <= 200:
        raise Refusal(422, "bad_batch", "One to two hundred rows at a time.")
    out = []
    for it in items:
        e = save(
            u,
            "verdict",
            f"{layer}:{_str(it.get('row'), 120, need=True)}",
            {k: it.get(k) for k in ("verdict", "note", "correction", "ends")},
            [],
        )
        if submit_now:
            e = submit(u, e["id"])
        out.append(e)
    return {"data": out}


def decide_many(u: dict[str, Any], ids: list[str], decision: str, note: str | None) -> dict[str, Any]:
    """One decision on many entries in review — each decided on its own, each still refused to its author."""
    if not 1 <= len(ids) <= 200:
        raise Refusal(422, "bad_batch", "One to two hundred entries at a time.")
    return {"data": [decide(u, i, decision, note) for i in ids]}
