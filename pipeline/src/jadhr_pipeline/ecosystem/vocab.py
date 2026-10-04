"""The vocabulary every text is read against (P11.4): the Quran's words, lemmas, patterns and roots, and the
dictionary's roots — built from the dataset's own rows, exactly as the site's Analyser reads its database (a word
is counted once under each of its matching keys: its everyday spelling, its mushaf spelling, the spelling read off
the mushaf)."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from jadhr_arabic.analysis import Vocabulary


def _rows(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def vocabulary(build: Path) -> Vocabulary:
    """From a built dataset's files."""
    return vocabulary_from(
        _rows(build / "words.jsonl"),
        _rows(build / "roots.jsonl"),
        _rows(build / "patterns.jsonl"),
        _rows(build / "dict_roots.jsonl"),
    )


def vocabulary_from(
    words: list[dict[str, Any]],
    root_rows: list[dict[str, Any]],
    pattern_rows: list[dict[str, Any]],
    dict_rows: list[dict[str, Any]],
) -> Vocabulary:
    """From the build's rows, before they are written."""
    roots = {r["id"]: r["key"] for r in root_rows}
    counts: dict[str, Counter[tuple[int | None, str | None, str | None]]] = {}
    for w in words:
        sig = (w["lemma_id"], roots.get(w["root_id"]) if w["root_id"] else None, w["pos"])
        for key in {w.get("norm"), w.get("norm_uthmani"), w.get("norm_plain")} - {None, ""}:
            counts.setdefault(key, Counter())[sig] += 1
    forms = {k: [(*sig, n) for sig, n in c.items()] for k, c in counts.items()}
    patterns = [(p["slug"], p["ar_bare"], p.get("pos_hint"), int(p["occurrences"])) for p in pattern_rows]
    to_dict = {r["quran_root"]: r["key"] for r in dict_rows if r["quran_root"]}
    return Vocabulary(
        forms=forms,
        patterns=patterns,
        quran_roots=set(roots.values()),
        dict_roots={r["key"] for r in dict_rows if r["letters"] >= 3},
        to_dict=to_dict,
    )
