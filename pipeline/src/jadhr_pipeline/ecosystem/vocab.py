"""The vocabulary every text is read against (P11.4): the Quran's words, lemmas, patterns and roots, and the
dictionary's roots — built from the dataset's own rows, exactly as the site's Analyser reads its database (a word
is counted once under each of its matching keys: its everyday spelling, its mushaf spelling, the spelling read off
the mushaf)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# one function for the build and the API (jadhr_arabic.analysis): every text is read against the same vocabulary
from jadhr_arabic.analysis import Vocabulary, vocabulary_from

__all__ = ["vocabulary", "vocabulary_from"]


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
