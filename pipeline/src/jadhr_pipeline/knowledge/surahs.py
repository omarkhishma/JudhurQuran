"""Sūra cards: type and traditional order from Tanzil's metadata; the Tafsir Center's Arabic
introduction fields (names, revelation, virtues, the two counting texts, aims) verbatim with their
editors' apparatus separated (``apparatus.split_tc``); verse counts by counting system extracted from
the counting texts and checked (``counts.verse_counts``)."""

from __future__ import annotations

import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any

from ..texts import parse_tanzil_meta
from .apparatus import notes_only, split_tc
from .counts import verse_counts

TANZIL_META = "tanzil-metadata"
TC = "tafsircenter-quran-db"

_FIELDS = (
    ("surahNameInfo", "names"),
    ("surahNujoolInfo", "revelation"),
    ("surahFadael", "virtues"),
    ("surahAyahCount0", "count_text_a"),
    ("surahAyahCount1", "count_text_b"),
    ("surahGoals", "aims"),
)
_PLACE_AR = {"مكية": "meccan", "مدنية": "medinan"}
_ENDINGS = tuple('.»"”)!؟?:')


def open_tc(path: Path) -> sqlite3.Connection:
    """Read-only and immutable: SQLite must not create journal side files next to a pinned source."""
    con = sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)
    con.row_factory = sqlite3.Row
    return con


def looks_truncated(text: str | None) -> bool:
    """Six revelation texts stop mid-word at about 32,600 characters in the source database (a cell
    limit somewhere upstream); a long field that does not end a sentence is flagged, not repaired."""
    return bool(text) and len(text) >= 30000 and not text.rstrip().endswith(_ENDINGS)  # type: ignore[union-attr]


def build_surah_cards(tanzil_meta: Path, tc_db: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    meta = parse_tanzil_meta(tanzil_meta)
    con = open_tc(tc_db)
    stats = {r["surahNo"]: r for r in con.execute("select * from surah_stats")}
    content = {r["surahNo"]: r for r in con.execute("select * from surah_content")}
    con.close()
    rows: list[dict[str, Any]] = []
    cleaned: Counter[str] = Counter()
    per_field: dict[str, Counter[str]] = {}
    count_status: Counter[str] = Counter()
    disagreements: list[dict[str, Any]] = []
    truncated: list[str] = []
    for s in meta.surahs:
        st, ct = stats[s.number], content[s.number]
        tc_place = _PLACE_AR.get((st["makkiMadani"] or "").strip())
        row: dict[str, Any] = {
            "surah": s.number,
            "name_ar": s.name_ar,
            "place": s.revelation_place,
            "revelation_order": s.revelation_order,
            "verse_count": s.verse_count,
            "tc_place": tc_place,
            "tc_place_ar": st["makkiMadani"],
            "tc_revelation_order": st["revelationSeq"],
            "tc_surah_class": st["surahClass"],
            "tc_opening_type": st["beginType"],
            "place_agrees": tc_place == s.revelation_place,
            "order_agrees": st["revelationSeq"] == s.revelation_order,
        }
        texts: dict[str, str] = {}
        for col, name in _FIELDS:
            original = ct[col]
            clean, items, counts = split_tc(original)
            cleaned.update(counts)
            per_field.setdefault(name, Counter()).update(counts)
            row[name] = clean or None
            row[f"{name}_notes"] = notes_only(items) or None
            if looks_truncated(original):
                truncated.append(f"{s.number}:{name}")
                row.setdefault("truncated_fields", []).append(name)
            texts[name] = clean
        row.setdefault("truncated_fields", None)
        vc = verse_counts(texts["count_text_a"], texts["count_text_b"], s.verse_count)
        count_status[vc["status"]] += 1
        if vc["differences"]:
            disagreements.append({"surah": s.number, "differences": vc["differences"]})
        row.update(
            {
                "verse_counts_a": vc["a"],
                "verse_counts_b": vc["b"],
                "verse_counts_status": vc["status"],
                "verse_counts_differences": vc["differences"],
                "verse_counts_checks": vc["checks"],
                "source_ids": [TANZIL_META, TC],
            }
        )
        rows.append(row)
    report = {
        "surahs": len(rows),
        "place_disagreements_tanzil_vs_tc": [r["surah"] for r in rows if not r["place_agrees"]],
        "order_disagreements_tanzil_vs_tc": [r["surah"] for r in rows if not r["order_agrees"]],
        "meccan": sum(r["place"] == "meccan" for r in rows),
        "medinan": sum(r["place"] == "medinan" for r in rows),
        "apparatus_separated": dict(cleaned),
        "apparatus_by_field": {k: dict(v) for k, v in per_field.items()},
        "fields_truncated_in_source": truncated,
        "verse_counts": dict(count_status),
        "verse_counts_text_disagreements": disagreements,
    }
    return rows, report
