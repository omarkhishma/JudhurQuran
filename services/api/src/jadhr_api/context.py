"""A word's Quranic context and the words the administration relates to it (PLAN P14, P15; D31, D32).

The context of a word is the run of verses its meaning is read in. It is set by people, never computed: a word's own
range (``context_word``) or, failing one, the passage of its sūra that holds it (``context_passages``), each in force
by the administration's publication or the board's approval. Until one is set the reader is told so and shown how the
sources group the verses around the word — the rukūʿ of the mushafs that mark them, the passages each tafsir
explains together, the ranges the commentaries' headings name, Quranpedia's topics that run across the verse — each
with its source, never as the context.

A word's near, related and opposite words (``word_relations``) are links the administration or the board defined on
either word: a link is shown on both of its words, with where it was defined.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import Connection

from .db import one, rows

DIRECT = ("context_passages", "context_word", "word_relations")
RELS = ("near", "related", "opposite")
# the tafsirs whose passages group verses (QuranEnc's two are verse by verse) and the commentaries whose headings
# name their range themselves (B55's rule ``range``; al-Ṭabarī's references and al-Zamakhsharī's stretched
# headings are left out — research P14: they run long or are our rule's, not the book's)
TAFSIR_GROUPS = ("saadi", "baghawi", "ibn-kathir", "qurtubi", "tabari")
BOOK_RANGES = ("hudhawwari-tafsir", "ibncatiyyaandalusi-muharrarwajiz", "ibnkathir-tafsirquran")
PASSAGE_SHOWN = 30  # verses of a context shown in the panel; the rest are one tap away in the reader


def _verse(conn: Connection, key: str) -> dict[str, Any] | None:
    return one(conn, "select id, key, surah, ayah from content.verses where key = :k", {"k": key})


def _span(conn: Connection, a: int, b: int) -> dict[str, Any]:
    ends = rows(conn, "select id, key, surah, ayah from content.verses where id = any(:i)", {"i": [a, b]})
    by = {e["id"]: e for e in ends}
    return {"from": by[a]["key"], "to": by[b]["key"], "from_id": a, "to_id": b, "verses": b - a + 1}


def groupings(conn: Connection, verse_id: int) -> list[dict[str, Any]]:
    """How the sources group the verses around this one, each grouping once with every source that draws it."""
    found: list[dict[str, Any]] = []
    ruku = one(
        conn,
        """select min(v.id) as a, max(v.id) as b from content.verses v
           where v.ruku = (select ruku from content.verses where id = :v)""",
        {"v": verse_id},
    )
    if ruku and ruku["a"] is not None:
        found.append(
            {
                "a": ruku["a"],
                "b": ruku["b"],
                "kind": "ruku",
                "source": "tanzil-metadata",
                "title_ar": "الركوع",
                "title_en": "Rukūʿ",
            }
        )
    for r in rows(
        conn,
        """select p.verse_from as a, p.verse_to as b, w.id as source, w.title_ar, w.title_en, w.sort_order
           from content.work_passages p join content.works w on w.id = p.work_id
           where w.id = any(:w) and p.verse_from <= :v and p.verse_to >= :v and p.verse_to > p.verse_from
           order by w.sort_order""",
        {"w": list(TAFSIR_GROUPS), "v": verse_id},
    ):
        found.append(
            {
                "a": r["a"],
                "b": r["b"],
                "kind": "tafsir",
                "source": r["source"],
                "title_ar": r["title_ar"],
                "title_en": r["title_en"],
            }
        )
    for r in rows(
        conn,
        """select min(c.verse_id) as a, max(c.verse_id) as b, t.slug as source, t.title_ar, t.title_en
           from content.verse_commentary c join content.texts t on t.id = c.text_id
           where c.rule = 'range' and t.slug = any(:s) and c.chapter_id in (
             select chapter_id from content.verse_commentary where verse_id = :v and rule = 'range')
           group by c.chapter_id, t.slug, t.title_ar, t.title_en having max(c.verse_id) > min(c.verse_id)""",
        {"s": list(BOOK_RANGES), "v": verse_id},
    ):
        found.append(
            {
                "a": r["a"],
                "b": r["b"],
                "kind": "book",
                "source": r["source"],
                "title_ar": r["title_ar"],
                "title_en": r["title_en"],
            }
        )
    # Quranpedia's topics of this verse, each as the unbroken run of its verses that holds this one (two at least)
    for r in rows(
        conn,
        """with mine as (
             select l.topic_id from content.topic_links l join content.verses v on v.key = l.verse_key
             where v.id = :v and l.source_id = 'quranpedia-topics'),
           runs as (
             select l.topic_id, v.id, v.id - row_number() over (partition by l.topic_id order by v.id) as grp
             from content.topic_links l join content.verses v on v.key = l.verse_key
             where l.topic_id in (select topic_id from mine) and l.source_id = 'quranpedia-topics')
           select r.topic_id, min(r.id) as a, max(r.id) as b, t.name_ar
           from runs r join content.topics t on t.id = r.topic_id
           group by r.topic_id, r.grp, t.name_ar
           having min(r.id) <= :v and max(r.id) >= :v and max(r.id) > min(r.id)
           order by max(r.id) - min(r.id) desc limit 6""",
        {"v": verse_id},
    ):
        found.append(
            {
                "a": r["a"],
                "b": r["b"],
                "kind": "topic",
                "source": "quranpedia-topics",
                "title_ar": r["name_ar"],
                "title_en": None,
                "topic_id": r["topic_id"],
            }
        )
    merged: dict[tuple[int, int], dict[str, Any]] = {}
    for g in found:
        m = merged.setdefault((g["a"], g["b"]), {**_span(conn, g["a"], g["b"]), "sources": []})
        keys = ["kind", "source", "title_ar", "title_en", *(["topic_id"] if "topic_id" in g else [])]
        m["sources"].append({k: g[k] for k in keys})
    # the ranges more sources draw first, then the shorter
    return sorted(merged.values(), key=lambda m: (-len(m["sources"]), m["verses"], m["from_id"]))


def _entry(conn: Connection, kind: str, target: str) -> dict[str, Any] | None:
    """The entry in force on a target, with how it came into force: published by the administration, or approved by
    the board; and whether the board has reviewed what the administration published."""
    return one(
        conn,
        """select e.id, e.value, e.sources, e.decided_at, e.revision,
                  exists (select 1 from editorial.reviews r where r.entry_id = e.id and r.revision = e.revision
                          and r.decision = 'approve' and r.reviewer_id is distinct from e.author_id) as reviewed,
                  exists (select 1 from editorial.log l where l.entry_id = e.id and l.action = 'published'
                          and l.revision = e.revision) as published
           from editorial.entries e where e.kind = :k and e.target = :t and e.status = 'approved'""",
        {"k": kind, "t": target},
    )


def _by(e: dict[str, Any]) -> dict[str, Any]:
    return {
        "by": "administration" if e["published"] else "board",
        "reviewed": bool(e["reviewed"]),
        "at": e["decided_at"].isoformat() if e["decided_at"] else None,
    }


def resolve(conn: Connection, location: str) -> dict[str, Any] | None:
    """The context in force for a word: its own range, else its sūra's passage that holds its verse, else None."""
    w = one(
        conn,
        "select w.location, w.surah, w.ayah, w.verse_id from content.words w where w.location = :l",
        {"l": location},
    )
    if w is None:
        return None
    own = _entry(conn, "context_word", location)
    if own:
        v = own["value"]
        a, b = _verse(conn, v["from"]), _verse(conn, v["to"])
        if a and b:
            return {
                "level": "word",
                **_span(conn, a["id"], b["id"]),
                "statement": {k: v.get(k, "") for k in ("meaning_ar", "meaning_en", "note_ar")},
                "sources": own["sources"],
                **_by(own),
            }
    seg = _entry(conn, "context_passages", str(w["surah"]))
    if seg:
        for p in seg["value"].get("passages", []):
            if p["from"] <= w["ayah"] <= p["to"]:
                ends = rows(
                    conn,
                    "select id from content.verses where surah = :s and ayah = any(:a) order by id",
                    {"s": w["surah"], "a": [p["from"], p["to"]]},
                )
                return {
                    "level": "passage",
                    **_span(conn, ends[0]["id"], ends[-1]["id"]),
                    "title_ar": p.get("title_ar") or "",
                    "title_en": p.get("title_en") or "",
                    "statement": None,
                    "sources": seg["sources"],
                    **_by(seg),
                }
    return None


def word_context(conn: Connection, location: str) -> dict[str, Any] | None:
    """What the panel's contextual layer shows for a word: the context in force (or none), how the sources group the
    verses around it, and the context's verses as the mushaf writes them with this word and its root's words marked."""
    w = one(
        conn,
        """select w.location, w.surah, w.ayah, w.verse_id, w.root_id, w.lemma_id, w.text_uthmani
           from content.words w where w.location = :l""",
        {"l": location},
    )
    if w is None:
        return None
    ctx = resolve(conn, location)
    a, b = (ctx["from_id"], ctx["to_id"]) if ctx else (w["verse_id"], w["verse_id"])
    shown_b = min(b, a + PASSAGE_SHOWN - 1)
    verses = rows(
        conn,
        """select id, key, surah, ayah, text_qpc, number_text from content.verses
           where id between :a and :b order by id""",
        {"a": a, "b": shown_b},
    )
    same_root = (
        rows(
            conn,
            """select w.location, w.verse_id, w.token_from, w.token_to, w.text_uthmani, l.slug as lemma_slug
               from content.words w left join content.lemmas l on l.id = w.lemma_id
               where w.root_id = :r and w.verse_id between :a and :b and w.location <> :l order by w.id""",
            {"r": w["root_id"], "a": a, "b": b, "l": location},
        )
        if w["root_id"]
        else []
    )
    return {
        "word": {
            "location": w["location"],
            "verse_key": f"{w['surah']}:{w['ayah']}",
            "verse_id": w["verse_id"],
            "text": w["text_uthmani"],
        },
        "context": ctx,
        "groupings": groupings(conn, w["verse_id"]),
        "verses": verses,
        "verses_more": b - shown_b,
        "same_root": same_root,
    }


def _lemma_cards(conn: Connection, slugs: list[str]) -> dict[str, dict[str, Any]]:
    return {
        r["slug"]: r
        for r in rows(
            conn,
            """select l.slug, l.ar, l.pos, l.occurrences, l.gloss_en, r.key as root_key, r.spaced as root_spaced
               from content.lemmas l left join content.roots r on r.id = l.root_id where l.slug = any(:s)""",
            {"s": slugs},
        )
    }


def word_relations(conn: Connection, slug: str) -> dict[str, list[dict[str, Any]]]:
    """The near, related and opposite words in force for a word, whichever of the two words the link was defined on."""
    found = rows(
        conn,
        """select e.id, e.target, e.value, e.decided_at, e.author_id,
                  exists (select 1 from editorial.reviews r where r.entry_id = e.id and r.revision = e.revision
                          and r.decision = 'approve' and r.reviewer_id is distinct from e.author_id) as reviewed,
                  exists (select 1 from editorial.log l where l.entry_id = e.id and l.action = 'published'
                          and l.revision = e.revision) as published
           from editorial.entries e
           where e.kind = 'word_relations' and e.status = 'approved'
             and (e.target = :s or e.value @> cast(:c as jsonb))""",
        {"s": slug, "c": json.dumps({"links": [{"to": slug}]}, ensure_ascii=False)},
    )
    links: list[dict[str, Any]] = []
    for e in found:
        for link in e["value"].get("links", []):
            if e["target"] == slug:
                other, defined_on = link["to"], "here"
            elif link["to"] == slug:
                other, defined_on = e["target"], "there"
            else:
                continue
            links.append(
                {
                    "slug": other,
                    "rel": link["rel"],
                    "note_ar": link.get("note_ar", ""),
                    "note_en": link.get("note_en", ""),
                    "source": link.get("source"),
                    "defined_on": defined_on,
                    **_by(e),
                }
            )
    cards = _lemma_cards(conn, sorted({x["slug"] for x in links}))
    out: dict[str, list[dict[str, Any]]] = {r: [] for r in RELS}
    seen: set[tuple[str, str]] = set()
    for x in links:
        if x["slug"] not in cards or (x["slug"], x["rel"]) in seen:
            continue  # a word no longer in the dataset, or the same link defined on both words: shown once
        seen.add((x["slug"], x["rel"]))
        out[x["rel"]].append({**x, "word": cards[x["slug"]]})
    for r in RELS:
        out[r].sort(key=lambda x: -(x["word"]["occurrences"] or 0))
    return out


def surah_groupings(conn: Connection, surah: int) -> dict[str, Any]:
    """For the sūra's passages tool: each source's runs of verses inside the sūra (rukūʿ, each tafsir's passages, each
    commentary's stated ranges), and for each verse that opens a run, the sources that open one there."""
    runs: dict[str, dict[str, Any]] = {}

    def add(key: str, kind: str, title_ar: str, title_en: str | None, a: int, b: int) -> None:
        r = runs.setdefault(
            key, {"source": key, "kind": kind, "title_ar": title_ar, "title_en": title_en, "runs": []}
        )
        r["runs"].append([a, b])

    for r in rows(
        conn,
        """select ruku, min(ayah) as a, max(ayah) as b from content.verses where surah = :s
           group by ruku order by min(ayah)""",
        {"s": surah},
    ):
        add("tanzil-metadata", "ruku", "الركوع", "Rukūʿ", r["a"], r["b"])
    for r in rows(
        conn,
        """select w.id, w.title_ar, w.title_en, va.ayah as a, vb.ayah as b
           from content.work_passages p join content.works w on w.id = p.work_id
           join content.verses va on va.id = p.verse_from join content.verses vb on vb.id = p.verse_to
           where w.id = any(:w) and va.surah = :s and vb.surah = :s order by w.sort_order, p.verse_from""",
        {"w": list(TAFSIR_GROUPS), "s": surah},
    ):
        add(r["id"], "tafsir", r["title_ar"], r["title_en"], r["a"], r["b"])
    for r in rows(
        conn,
        """select t.slug, t.title_ar, t.title_en, min(v.ayah) as a, max(v.ayah) as b
           from content.verse_commentary c join content.texts t on t.id = c.text_id
           join content.verses v on v.id = c.verse_id
           where c.rule = 'range' and t.slug = any(:b) and v.surah = :s
           group by t.slug, t.title_ar, t.title_en, c.chapter_id order by t.slug, min(v.ayah)""",
        {"b": list(BOOK_RANGES), "s": surah},
    ):
        add(r["slug"], "book", r["title_ar"], r["title_en"], r["a"], r["b"])
    opens: dict[int, list[str]] = {}
    for key, r in runs.items():
        for a, _ in r["runs"]:
            if a > 1:
                opens.setdefault(a, []).append(key)
    return {"sources": list(runs.values()), "opens": {str(a): sorted(v) for a, v in sorted(opens.items())}}


def relation_candidates(conn: Connection, slug: str) -> dict[str, Any]:
    """What the classical books relate to this word's root — furūq, near-synonym seeds, aḍdād — each with the other
    root's most frequent words to choose from, and the words its semantic fields hold; never a link by themselves."""
    me = one(
        conn,
        "select l.slug, r.key as root_key from content.lemmas l left join content.roots r on r.id = l.root_id where l.slug = :s",
        {"s": slug},
    )
    if me is None or not me["root_key"]:
        return {"classical": [], "fields": []}
    classical = rows(
        conn,
        """select c.id, c.type, c.source_id, c.headword_ar, c.target_ar, c.root_key, c.target_root_key, c.locator,
                  left(c.text_ar, 600) as text_ar, s.title_ar as source_title_ar
           from content.relation_candidates c left join content.relation_sources s on s.id = c.source_id
           where c.type in ('furuq_contrast', 'near_synonym_candidate', 'didd')
             and (c.root_key = :r or c.target_root_key = :r) order by c.type, c.source_id, c.id limit 40""",
        {"r": me["root_key"]},
    )
    others = sorted(
        {(c["target_root_key"] if c["root_key"] == me["root_key"] else c["root_key"]) for c in classical}
        - {None}
    )
    words = {
        k: rows(
            conn,
            """select l.slug, l.ar, l.occurrences from content.lemmas l join content.roots r on r.id = l.root_id
               where r.key = :k order by l.occurrences desc limit 6""",
            {"k": k},
        )
        for k in others
    }
    for c in classical:
        other = c["target_root_key"] if c["root_key"] == me["root_key"] else c["root_key"]
        c["other_root"] = other
        c["other_words"] = words.get(other, [])
    fields = rows(
        conn,
        """select e.id as field_id, coalesce(e.heading_ar, '') as field_ar, s.title_ar as source_title_ar,
                  array_agg(distinct m.root_key) filter (where m.root_key <> :r) as roots
           from content.relation_candidates mine
           join content.relation_entries e on e.id = mine.entry_id
           join content.relation_candidates m on m.entry_id = mine.entry_id and m.type = 'field_member'
           left join content.relation_sources s on s.id = e.source_id
           where mine.type = 'field_member' and mine.root_key = :r
           group by e.id, e.heading_ar, s.title_ar order by e.id limit 12""",
        {"r": me["root_key"]},
    )
    return {"classical": classical, "fields": fields}
