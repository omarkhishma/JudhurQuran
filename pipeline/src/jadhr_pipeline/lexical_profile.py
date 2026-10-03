"""How common a verse's words are in the Quran (P3.6): a fixed, documented function of the text alone.

Each word's lemma falls in a band by how often that lemma occurs in the whole Quran (the corpus's lemma
counts): ``c100`` 100 times or more (105 lemmas, 58% of the text), ``c20`` 20–99 (to 81%), ``c5`` 5–19
(to 92%), ``c2`` 2–4, ``c1`` once (1,994 lemmas). A verse's profile counts its words per band; its
lexical level 1–5 follows the share of its words that occur fewer than 20 times:

    none → 1 · up to 15% → 2 · up to 30% → 3 · up to 50% → 4 · more → 5

Words with no lemma (the muqaṭṭaʿāt) are not counted. The level describes vocabulary frequency and
nothing else (law L4): it never judges a sūra and is shown with what it measures. A sūra's profile sums
its verses'. Thresholds are constants; changing one is a decision (docs/DECISIONS.md), not a tweak.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

BANDS = (("c100", 100), ("c20", 20), ("c5", 5), ("c2", 2), ("c1", 1))
LEVELS = (
    0.0,
    0.15,
    0.30,
    0.50,
)  # share of words under 20 occurrences: ≤ each bound → level 1, 2, 3, 4; above → 5


def band(occurrences: int) -> str:
    return next(name for name, floor in BANDS if occurrences >= floor)


def level(rare_share: float) -> int:
    for i, bound in enumerate(LEVELS, start=1):
        if rare_share <= bound:
            return i
    return 5


def _profile(counts: Counter[str]) -> dict[str, Any]:
    n = sum(counts.values())
    rare = n - counts["c100"] - counts["c20"]
    return {"words": n, **{name: counts[name] for name, _ in BANDS}, "level": level(rare / n) if n else None}


def verse_profiles(words: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    """verse_id → profile, from the word records (``verse_id``, ``lemma_id``)."""
    occ = Counter(w["lemma_id"] for w in words if w.get("lemma_id"))
    per: dict[int, Counter[str]] = {}
    for w in words:
        c = per.setdefault(w["verse_id"], Counter())
        if w.get("lemma_id"):
            c[band(occ[w["lemma_id"]])] += 1
    return {vid: _profile(c) for vid, c in per.items()}


def surah_profile(profiles: list[dict[str, Any]]) -> dict[str, Any]:
    total: Counter[str] = Counter()
    levels: Counter[int] = Counter()
    for p in profiles:
        total.update({name: p[name] for name, _ in BANDS})
        if p["level"]:
            levels[p["level"]] += 1
    out = _profile(total)
    out["verse_levels"] = {str(k): levels[k] for k in range(1, 6)}
    return out
