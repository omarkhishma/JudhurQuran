"""The Quran knowledge layers and relation seeds as the reader shows them (PLAN P2.5a, P3.9, P3.1/P8.4).

Every row is verbatim from a named source with its locator; status says whether an editor reviewed it
(nothing has been reviewed yet, and the payload says so — law L3, visible uncertainty)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import Connection

from . import board
from .db import one, rows

_KS_COLS = "id, kind, use, title_ar, title_en, version, url, license, license_ar, license_url, attribution_ar, attribution_en"
_RS_COLS = (
    "id, kind, sort_order, title_ar, title_en, author_ar, author_en, death_hijri, death_ce, edition_ar, "
    "edition_en, source_url, licence, licence_url, redistributable, attribution_ar, attribution_en"
)


def _verse_key_map(conn: Connection, ids: set[int]) -> dict[int, dict[str, Any]]:
    if not ids:
        return {}
    return {
        r["id"]: r
        for r in rows(
            conn,
            """select v.id, v.key, v.surah, v.ayah, s.name_ar, s.name_translit
               from content.verses v join content.surahs s on s.number = v.surah where v.id = any(:ids)""",
            {"ids": sorted(ids)},
        )
    }


def _knowledge_sources(conn: Connection, ids: set[str]) -> dict[str, dict[str, Any]]:
    if not ids:
        return {}
    return {
        r["id"]: r
        for r in rows(
            conn,
            f"select {_KS_COLS} from content.knowledge_sources where id = any(:ids)",
            {"ids": sorted(ids)},
        )
    }


def verse_knowledge(conn: Connection, key: str) -> dict[str, Any] | None:
    """What the knowledge layers say about one verse: occasions of revelation, Makki/Madani notes,
    the verses Ibn Kathīr cites to explain it (and those whose explanation cites it), people and places."""
    v = one(conn, "select id, surah, ayah from content.verses where key = :k", {"k": key})
    if v is None:
        return None
    vid = v["id"]
    asbab = rows(
        conn,
        """select id, work, source_id, surah, ayah_from, ayah_to, number, heading, text, takhrij, notes, locator,
                  match_method, confidence, page, section_kind
           from content.asbab where verse_from <= :v and verse_to >= :v
           order by case work when 'tafsircenter' then 0 when 'wahidi' then 1 else 2 end, id""",
        {"v": vid},
    )
    places = rows(
        conn,
        """select id, surah, ayah_from, ayah_to, place, period, role, attributed_to, quote, context, method, scope,
                  source_id, tc_check
           from content.verse_places
           where (scope = 'verses' and verse_from <= :v and verse_to >= :v) or (scope = 'surah' and surah = :s)
           order by case role when 'source-note' then 0 when 'preferred' then 1 else 2 end, id""",
        {"v": vid, "s": v["surah"]},
    )
    cites = rows(
        conn,
        """select to_verse, to_verse_end, method, confidence, quote, reference, mentions, source_id
           from content.verse_crossrefs where from_verse = :v
           order by case confidence when 'high' then 0 when 'medium' then 1 else 2 end, to_verse""",
        {"v": vid},
    )
    cited_by = rows(
        conn,
        """select from_verse, method, confidence, quote, reference, source_id
           from content.verse_crossrefs where to_verse <= :v and to_verse_end >= :v and from_verse <> :v
           order by case confidence when 'high' then 0 when 'medium' then 1 else 2 end, from_verse limit 40""",
        {"v": vid},
    )
    entities = rows(
        conn,
        """select e.id, e.name_ar, e.name_plain, e.occurrences, e.verse_count, e.wikidata_id, e.wikidata_label_ar,
                  e.wikidata_label_en, e.wikidata_description, e.status, e.source_ids, l.slug as lemma_slug
           from content.entity_candidates e join content.lemmas l on l.id = e.lemma_id
           where :v = any(e.verses) order by e.occurrences desc""",
        {"v": vid},
    )
    keys = _verse_key_map(
        conn,
        {c["to_verse"] for c in cites}
        | {c["to_verse_end"] for c in cites}
        | {c["from_verse"] for c in cited_by},
    )
    for c in cites:
        c["to"] = keys[c.pop("to_verse")]
        c["to_end"] = keys[c.pop("to_verse_end")]
    for c in cited_by:
        c["from"] = keys[c.pop("from_verse")]
    sources = {r["source_id"] for r in asbab + places + cites + cited_by}
    sources |= {s for e in entities for s in e["source_ids"]}
    return {
        "key": key,
        "status": "extracted",
        "asbab": asbab,
        "places": places,
        "cites": cites,
        "cited_by": cited_by,
        "entities": entities,
        "sources": _knowledge_sources(conn, sources),
    }


def surah_card(conn: Connection, number: int) -> dict[str, Any] | None:
    card = one(conn, "select * from content.surah_cards where surah = :s", {"s": number})
    if card is None:
        return None
    return {"card": card, "sources": _knowledge_sources(conn, set(card["source_ids"]))}


def word_relations(conn: Connection, slug: str, at: str | None = None) -> dict[str, Any] | None:
    """The classical wujūh (senses of a Quranic word with the verses for each), furūq (how it differs from
    near words) and aḍdād (a word with two opposite senses) for a lemma and its root. ``at`` marks the
    senses whose verses include this occurrence's verse."""
    lem = one(
        conn,
        """select l.id, l.key, l.slug, r.key as root from content.lemmas l
           left join content.roots r on r.id = l.root_id where l.slug = :s""",
        {"s": slug},
    )
    if lem is None:
        return None
    here = ":".join(at.split(":")[:2]) if at else None
    if not lem["root"]:
        entries: list[dict[str, Any]] = rows(
            conn,
            """select * from content.relation_entries where lemma_key = :l order by source_id, seq""",
            {"l": lem["key"]},
        )
    else:
        entries = rows(
            conn,
            """select * from content.relation_entries where root_key = :r or lemma_key = :l
               order by source_id, seq""",
            {"r": lem["root"], "l": lem["key"]},
        )
    by_entry = {e["id"]: e for e in entries}
    senses = rows(
        conn,
        """select id, entry_id, sense_index, sense_marker_ar, sense_label_ar, text_ar, verses, locator, page_vol, page,
                  status
           from content.relation_candidates where type = 'wujuh_sense' and entry_id = any(:ids)
           order by entry_id, sense_index""",
        {"ids": list(by_entry)},
    )
    # the board's verdict on each sense; a rejected one is left out (P3.0c, P8.4)
    senses = board.marked(conn, "relation_candidates", senses)
    wujuh: dict[str, dict[str, Any]] = {}
    for s in senses:
        e = by_entry[s["entry_id"]]
        if e["id"] not in wujuh:
            scope = (
                "lemma"
                if e["lemma_key"] == lem["key"]
                else "root"
                if not e["lemma_key"] and e["root_key"] == lem["root"]
                else "other-lemma"
            )
            wujuh[e["id"]] = {
                "id": e["id"],
                "source_id": e["source_id"],
                "heading_ar": e["heading_ar"],
                "headword_ar": e["headword_ar"],
                "scope": scope,
                "match_method": e["match_method"],
                "match_confidence": e["match_confidence"],
                "stated_count": e["stated_count"],
                "stated_count_ar": e["stated_count_ar"],
                "intro_ar": e["intro_ar"],
                "locator": e["locator"],
                "page_vol": e["page_vol"],
                "page": e["page"],
                "status": e["status"],
                "senses": [],
            }
        s["cites_here"] = bool(here and here in (s["verses"] or []))
        wujuh[e["id"]]["senses"].append(s)
    contrasts = []
    if lem["root"]:
        # rows the board mapped onto this root count here too (P8.4); those it mapped away are dropped below
        moved = [
            i
            for i, v in board.layer(conn, "relation_candidates").items()
            if lem["root"] in (v["value"].get("ends") or {}).values()
        ]
        contrasts = rows(
            conn,
            """select id, type, source_id, entry_id, headword_ar, target_ar, root_key, target_root_key, text_ar,
                      verses, locator, page_vol, page, status
               from content.relation_candidates
               where type in ('furuq_contrast', 'didd')
                 and (root_key = :r or target_root_key = :r or id = any(cast(:moved as text[])))
               order by type, source_id, id""",
            {"r": lem["root"], "moved": moved},
        )
        heading = {
            e["id"]: e["heading_ar"]
            for e in rows(
                conn,
                "select id, heading_ar from content.relation_entries where id = any(:ids)",
                {"ids": sorted({c["entry_id"] for c in contrasts})},
            )
        }
        for c in contrasts:
            c["heading_ar"] = heading.get(c["entry_id"])
        contrasts = [
            c
            for c in board.marked(conn, "relation_candidates", contrasts)
            if lem["root"] in (c["root_key"], c["target_root_key"])
        ]
    # the fields whose chapters name a word of this root (P8.4c): a loose reading's only once the board has read them
    fields: list[dict[str, Any]] = []
    if lem["root"]:
        moved = [
            i
            for i, v in board.layer(conn, "relation_candidates").items()
            if lem["root"] in (v["value"].get("ends") or {}).values()
        ]
        fields = rows(
            conn,
            """select c.id, c.type, c.source_id, c.entry_id, c.headword_ar, c.root_key, c.lemma_key, c.match_confidence,
                      c.sense_label_ar, c.text_ar, c.verses, c.locator, c.page_vol, c.page, c.status,
                      e.heading_ar, e.section_ar, s.shown_extracted
               from content.relation_candidates c join content.relation_entries e on e.id = c.entry_id
               join content.relation_sources s on s.id = c.source_id
               where c.type = 'field_member' and (c.root_key = :r or c.id = any(cast(:moved as text[])))
               order by s.sort_order, c.entry_id, c.id""",
            {"r": lem["root"], "moved": moved},
        )
        fields = [
            f
            for f in board.marked(conn, "relation_candidates", fields)
            if f["root_key"] == lem["root"] and (f.pop("shown_extracted") or f.get("review"))
        ]
    source_ids = (
        {w["source_id"] for w in wujuh.values()}
        | {c["source_id"] for c in contrasts}
        | {f["source_id"] for f in fields}
    )
    sources = (
        {
            r["id"]: r
            for r in rows(
                conn,
                f"select {_RS_COLS} from content.relation_sources where id = any(:ids)",
                {"ids": sorted(source_ids)},
            )
        }
        if source_ids
        else {}
    )
    order = {"lemma": 0, "root": 1, "other-lemma": 2}
    return {
        "slug": slug,
        "lemma_key": lem["key"],
        "root": lem["root"],
        "status": "extracted",
        "wujuh": sorted(
            wujuh.values(), key=lambda w: (order[w["scope"]], sources[w["source_id"]]["sort_order"], w["id"])
        ),
        "furuq": [c for c in contrasts if c["type"] == "furuq_contrast"],
        "addad": [c for c in contrasts if c["type"] == "didd"],
        "fields": fields,
        "sources": sources,
    }
