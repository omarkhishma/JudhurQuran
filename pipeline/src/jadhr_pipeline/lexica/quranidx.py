"""A Quran word-pair index used only to RECOGNISE Quran quotations inside lexicon text (never displayed).

Tāj's typing uses the Quranic brackets ﴿ ﴾ both for real quotations and as converted headword
markers; a span is kept as a quotation when its words read as Quran text. Spelling differs between
the lexicographers' quotations and the mushaf (ءامنا / آمنا, هاذا / هذا), so words are compared after
stripping marks, folding the alef/hamza family, ى→ي, ة→ه and dropping a bare hamza.
"""

from __future__ import annotations

import itertools
import re
from collections.abc import Iterable

from jadhr_arabic import strip_marks

_FOLD = str.maketrans(
    {
        "أ": "ا",
        "إ": "ا",
        "آ": "ا",
        "ٱ": "ا",
        "ى": "ي",
        "ة": "ه",
        "ؤ": "و",
        "ئ": "ي",
        "ء": "",
    }
)
_NOT_LETTER = re.compile("[^ء-ي]+")


def qtokens(text: str) -> list[str]:
    """Letter-only words, folded for comparison with the Quran (digits and punctuation dropped)."""
    return [t for t in _NOT_LETTER.sub(" ", strip_marks(text).translate(_FOLD)).split() if t]


class QuranPairs:
    """Every pair of consecutive words inside one verse (imlāʾī spelling, folded)."""

    def __init__(self, words: Iterable[dict]) -> None:
        verses: dict[tuple[int, int], list[tuple[int, str]]] = {}
        for w in words:
            verses.setdefault((int(w["surah"]), int(w["ayah"])), []).append((int(w["position"]), w["norm"]))
        self.pairs: set[tuple[str, str]] = set()
        for ws in verses.values():
            toks = [t for _, n in sorted(ws) for t in qtokens(n)]
            self.pairs.update(itertools.pairwise(toks))
        if not self.pairs:
            raise ValueError("QuranPairs needs the words of the Quran")

    def share(self, toks: list[str]) -> float:
        """Share of consecutive word pairs of ``toks`` that occur in some verse (0 for fewer than 2 words)."""
        if len(toks) < 2:
            return 0.0
        pairs = list(itertools.pairwise(toks))
        return sum(1 for p in pairs if p in self.pairs) / len(pairs)
