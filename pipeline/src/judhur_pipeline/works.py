"""Tafsir and translation works: import verbatim texts into passages.

A passage covers a contiguous verse range. QuranEnc files carry one row per ayah. The
tafsir_api mirror copies a grouped passage's text into every member ayah, so consecutive
ayahs with byte-identical text are folded back into one passage (the original grouping).
Identical text in non-adjacent ayahs stays separate. Nothing is edited.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

import yaml


class WorkError(ValueError):
    pass


def _quranenc(path: Path) -> list[tuple[int, int, str, str | None]]:
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        rows = con.execute(
            "select sura, aya, translation, footnotes from translations order by sura, aya"
        ).fetchall()
    finally:
        con.close()
    return [(int(s), int(a), t, (f or None)) for s, a, t, f in rows]


def _tafsir_api(path: Path) -> list[tuple[int, int, str, str | None]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [(int(x["surah"]), int(x["ayah"]), x["text"], None) for x in data["ayahs"]]


def build_works(
    raw: Path, registry: Path, verse_ids: dict[tuple[int, int], int]
) -> tuple[list[dict], list[dict], dict]:
    works_cfg = yaml.safe_load(registry.read_text(encoding="utf-8"))["works"]
    works_out: list[dict[str, Any]] = []
    passages_out: list[dict[str, Any]] = []
    report: dict[str, Any] = {}
    pid = 0
    for order, w in enumerate(works_cfg, start=1):
        path = raw / w["file"]
        if not path.exists():
            report[w["id"]] = {"status": "missing-file", "file": w["file"]}
            continue
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        if w["format"] == "quranenc-sqlite":
            rows = _quranenc(path)
        elif w["format"] == "tafsir-api":
            rows = _tafsir_api(path)
        else:
            raise WorkError(f"{w['id']}: unknown format {w['format']}")
        rows = [r for r in rows if r[2] and r[2].strip()]
        seen = set()
        for s, a, _, _ in rows:
            if (s, a) not in verse_ids:
                raise WorkError(f"{w['id']}: unknown verse {s}:{a}")
            if (s, a) in seen:
                raise WorkError(f"{w['id']}: duplicate verse {s}:{a}")
            seen.add((s, a))
        rows.sort(key=lambda r: verse_ids[(r[0], r[1])])
        passages: list[dict[str, Any]] = []
        for s, a, text, foot in rows:
            vid = verse_ids[(s, a)]
            last = passages[-1] if passages else None
            if (
                w["format"] == "tafsir-api"
                and last is not None
                and last["text"] == text
                and last["verse_to"] == vid - 1
            ):
                last["verse_to"] = vid
                continue
            pid += 1
            passages.append(
                {
                    "id": pid,
                    "work_id": w["id"],
                    "verse_from": vid,
                    "verse_to": vid,
                    "text": text,
                    "footnotes": foot,
                }
            )
        passages_out += passages
        covered = sum(p["verse_to"] - p["verse_from"] + 1 for p in passages)
        works_out.append(
            {
                "id": w["id"],
                "kind": w["kind"],
                "lang": w["lang"],
                "level": w.get("level"),
                "title_ar": w["title_ar"],
                "title_en": w["title_en"],
                "author_ar": w["author_ar"],
                "author_en": w["author_en"],
                "source_id": w["source"],
                "version": w["version"],
                "file_sha256": sha,
                "sort_order": order,
                "default_for": w.get("default_for"),
                "strip_leading_number": bool(w.get("strip_leading_number")),
                "verse_coverage": covered,
                "passage_count": len(passages),
            }
        )
        report[w["id"]] = {
            "status": "ok",
            "verses_covered": covered,
            "passages": len(passages),
            "chars": sum(len(p["text"]) for p in passages),
            "sha256": sha,
        }
    return works_out, passages_out, report
