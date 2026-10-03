"""The relations a meaning map draws (PLAN P8.4, research 15): the classical books' own edges — al-ʿAskarī's «الفرق
بين…», a wujūh book naming a sense by another word, a wujūh sense with its verses, Ibn al-Anbārī's ḍidd — each quoted
with its locator, and in force only once the editorial board has reviewed it (the verdict layer
`relation_candidates`, P3.0): reviewed, or corrected — a root on either end mapped anew — while a rejected row is
left out. What is extracted and not yet reviewed is counted, never drawn as the dataset's.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Connection

from . import board
from .db import rows

LAYER = "relation_candidates"
# a candidate's type, as the map's relation (P8.1a)
REL = {
    "furuq_contrast": "near-in-meaning",
    "near_synonym_candidate": "near-in-meaning",
    "wujuh_sense": "wujuh-sense",
    "didd": "didd",
}
_COLS = """c.id, c.type, c.source_id, c.entry_id, c.headword_ar, c.target_ar, c.root_key, c.target_root_key,
           c.sense_label_ar, c.text_ar, c.verses, c.locator, c.page_vol, c.page, c.derived_from, c.derivation,
           coalesce(c.root_key, e.root_key) as entry_root"""
_SRC = """s.id, s.title_ar, s.title_en, s.author_ar, s.author_en, s.death_hijri, s.death_ce, s.attribution_ar,
          s.attribution_en, s.redistributable"""


def _in_force(conn: Connection) -> list[dict[str, Any]]:
    """Every relation in force, its ends as the board left them."""
    verdicts = board.layer(conn, LAYER)
    if not verdicts:
        return []
    found = rows(
        conn,
        f"""select {_COLS} from content.relation_candidates c
            left join content.relation_entries e on e.id = c.entry_id where c.id = any(:ids)""",
        {"ids": list(verdicts)},
    )
    out = []
    for r in found:
        v = verdicts[r["id"]]["value"]
        if v["verdict"] == "rejected":
            continue
        ends = v.get("ends") or {}
        r["root_key"] = ends.get("root") or r["root_key"] or r["entry_root"]
        r["target_root_key"] = ends.get("target_root") or r["target_root_key"]
        r["review"] = {
            "verdict": v["verdict"],
            "note": v.get("note") or None,
            "correction": v.get("correction"),
            "approved_at": verdicts[r["id"]]["approved_at"],
        }
        out.append(r)
    return out


def _edge(r: dict[str, Any], sources: dict[str, dict[str, Any]]) -> dict[str, Any]:
    two = r["type"] in ("furuq_contrast", "near_synonym_candidate")
    return {
        "id": r["id"],
        "type": r["type"],
        "rel": REL[r["type"]],
        "a": {"root": r["root_key"], "word": r["headword_ar"]},
        "b": {"root": r["target_root_key"], "word": r["target_ar"]} if two else None,
        # the sense a wujūh book names (for a near-synonym, the sense in which the two are near)
        "sense": r["sense_label_ar"] or (r["target_ar"] if r["derivation"] == "wujuh-sense-label" else None),
        "quote": r["text_ar"],
        "verses": r["verses"] or [],
        "source": {
            **sources[r["source_id"]],
            "locator": r["locator"],
            "page_vol": r["page_vol"],
            "page": r["page"],
        },
        "review": r["review"],
    }


def _sources(conn: Connection, ids: set[str]) -> dict[str, dict[str, Any]]:
    if not ids:
        return {}
    return {
        s["id"]: s
        for s in rows(
            conn,
            f"select {_SRC} from content.relation_sources s where s.id = any(:ids)",
            {"ids": sorted(ids)},
        )
    }


def of_root(conn: Connection, root: str) -> dict[str, Any]:
    """The relations in force on a root, and how many extracted candidates on it still wait for the board."""
    edges = [r for r in _in_force(conn) if root in (r["root_key"], r["target_root_key"])]
    sources = _sources(conn, {r["source_id"] for r in edges})
    decided = set(board.layer(conn, LAYER))
    waiting = rows(
        conn,
        """select count(*)::int as n from content.relation_candidates c
           left join content.relation_entries e on e.id = c.entry_id
           where (coalesce(c.root_key, e.root_key) = :r or c.target_root_key = :r)
             and not (c.id = any(cast(:done as text[])))""",
        {"r": root, "done": list(decided)},
    )[0]["n"]
    order = {"near-in-meaning": 0, "didd": 1, "wujuh-sense": 2}
    edges.sort(key=lambda r: (order[REL[r["type"]]], r["source_id"], r["id"]))
    return {"root": root, "data": [_edge(r, sources) for r in edges], "waiting": waiting}


def among(conn: Connection, roots: list[str]) -> dict[str, Any]:
    """The relations in force between roots of a set, and for each pair the verses where both occur in the corpus —
    counted, never read as a relation of their own."""
    want = set(roots)
    edges = [
        r
        for r in _in_force(conn)
        if r["root_key"] in want and r["target_root_key"] in want and r["root_key"] != r["target_root_key"]
    ]
    sources = _sources(conn, {r["source_id"] for r in edges})
    pairs = sorted({tuple(sorted((r["root_key"], r["target_root_key"]))) for r in edges})
    shared = {}
    for a, b in pairs:
        vs = rows(
            conn,
            """select w.surah, w.ayah from content.words w join content.roots r on r.id = w.root_id
               where r.key in (:a, :b) group by w.surah, w.ayah having count(distinct r.key) = 2
               order by w.surah, w.ayah""",
            {"a": a, "b": b},
        )
        shared[f"{a}|{b}"] = {"count": len(vs), "verses": [f"{v['surah']}:{v['ayah']}" for v in vs[:50]]}
    return {"data": [_edge(r, sources) for r in edges], "shared": shared}
