"""The vocabulary every text is read against (P11.4): the Quran's words, lemmas, patterns and roots, and the
dictionary's roots — built from the dataset's own files, exactly as the site's Analyser reads its database (a word
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
    roots = {r["id"]: r["key"] for r in _rows(build / "roots.jsonl")}
    counts: dict[str, Counter[tuple[int | None, str | None, str | None]]] = {}
    for w in _rows(build / "words.jsonl"):
        sig = (w["lemma_id"], roots.get(w["root_id"]) if w["root_id"] else None, w["pos"])
        for key in {w.get("norm"), w.get("norm_uthmani"), w.get("norm_plain")} - {None, ""}:
            counts.setdefault(key, Counter())[sig] += 1
    forms = {k: [(*sig, n) for sig, n in c.items()] for k, c in counts.items()}
    patterns = [
        (p["slug"], p["ar_bare"], p.get("pos_hint"), int(p["occurrences"]))
        for p in _rows(build / "patterns.jsonl")
    ]
    dict_rows = _rows(build / "dict_roots.jsonl")
    to_dict = {r["quran_root"]: r["key"] for r in dict_rows if r["quran_root"]}
    return Vocabulary(
        forms=forms,
        patterns=patterns,
        quran_roots=set(roots.values()),
        dict_roots={r["key"] for r in dict_rows if r["letters"] >= 3},
        to_dict=to_dict,
    )
