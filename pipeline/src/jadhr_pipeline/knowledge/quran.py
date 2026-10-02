"""The Quran as a lookup structure for the knowledge layers: verse ids, sūra names and quote matching.

Everything here is for MATCHING only. The keys are built from the build's normalised imlāʾī verse text
(``verses.jsonl`` → ``norm``, the KFGQPC "emlaey" text through the one normalisation spec); nothing
produced here is ever displayed.

Quote matching runs at three strictness levels, and every caller records which one matched:

* ``exact``    — the normalised quote, word-bounded, inside the normalised verse text;
* ``loose``    — spaces and alefs dropped on both sides (السماوات/السموات, يا أيها/ياأيها, ٱ/ا);
* ``skeleton`` — the consonantal skeleton (alef, waw, yaa and hamza dropped); only for quotes of at
                 least four words, because a short skeleton matches too much.

At every level a word-final ت is read as ه on both sides (the imlāʾī text keeps the mushaf's open tāʾ in
كلمت، رحمت، مرضات where editors type ة). Checking a span the source itself cites may also accept
``fuzzy`` (see ``QuranIndex.contains``). A quote never matches across a sūra boundary; it may run
across consecutive verses of one sūra.
"""

from __future__ import annotations

import bisect
import json
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from jadhr_arabic import normalize, skeleton

LEVELS = ("exact", "loose", "skeleton")
_NON_LETTER = re.compile(r"[^ء-ي\s]")
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def to_ascii_digits(text: str) -> str:
    return text.translate(_ARABIC_DIGITS)


def match_key(text: str) -> str:
    """Normalised letters and single spaces only (punctuation, digits, brackets and ornaments dropped)."""
    return re.sub(r"\s+", " ", _NON_LETTER.sub(" ", normalize(text))).strip()


_FINAL_TAA = re.compile(r"ت(?= |$)")


def _fold_open_taa(key: str) -> str:
    """The KFGQPC imlāʾī text keeps the mushaf's open tāʾ in some words (كلمت، رحمت، مرضات) where an
    editor types ة (folded to ه): a word-final ت is matched as ه on both sides."""
    return _FINAL_TAA.sub("ه", key)


def loose_key(text: str) -> str:
    return _fold_open_taa(match_key(text)).replace(" ", "").replace("ا", "")


def skeleton_key(text: str) -> str:
    return skeleton(_fold_open_taa(match_key(text)))


def _word_keys(text: str) -> list[str]:
    return [w.replace("ا", "") for w in _fold_open_taa(match_key(text)).split()]


def in_order_ratio(quote: str, text: str) -> float:
    """Share of the quote's words found in the text in the same order (longest common subsequence of
    words, alef-insensitive). Used only to check a span the source itself cites, never to search."""
    q, t = _word_keys(quote), _word_keys(text)
    if not q:
        return 0.0
    prev = [0] * (len(t) + 1)
    for qw in q:
        cur = [0] * (len(t) + 1)
        for j, tw in enumerate(t, 1):
            cur[j] = prev[j - 1] + 1 if qw == tw else max(prev[j], cur[j - 1])
        prev = cur
    return prev[-1] / len(q)


def exact_key(text: str) -> str:
    return _fold_open_taa(match_key(text))


_KEYS = {"exact": exact_key, "loose": loose_key, "skeleton": skeleton_key}


@dataclass(frozen=True)
class Verse:
    id: int
    surah: int
    ayah: int
    norm: str


@dataclass(frozen=True)
class Match:
    verse_from: int  # verse id
    verse_to: int
    level: str


class QuranIndex:
    def __init__(self, verses: list[dict], surahs: list[dict]) -> None:
        self.verses = [Verse(v["id"], v["surah"], v["ayah"], v["norm"]) for v in verses]
        self.by_id = {v.id: v for v in self.verses}
        self.ids = {(v.surah, v.ayah): v.id for v in self.verses}
        self.verse_count = {s["number"]: s["verse_count"] for s in surahs}
        self.surah_name = {s["number"]: s["name_ar"] for s in surahs}
        self._text: dict[str, str] = {}
        self._starts: dict[str, list[int]] = {}
        self._start_ids: dict[str, list[int]] = {}
        self._surah_span: dict[str, dict[int, tuple[int, int]]] = {}
        for level, fn in _KEYS.items():
            parts: list[str] = []
            starts: list[int] = []
            ids: list[int] = []
            pos = 0
            prev_surah = None
            sep_verse = " " if level == "exact" else ""
            for v in self.verses:
                if prev_surah is not None:
                    sep = sep_verse if v.surah == prev_surah else " | "
                    parts.append(sep)
                    pos += len(sep)
                key = fn(v.norm)
                starts.append(pos)
                ids.append(v.id)
                parts.append(key)
                pos += len(key)
                prev_surah = v.surah
            self._text[level] = " " + "".join(parts) + " "
            self._starts[level] = [s + 1 for s in starts]
            self._start_ids[level] = ids
            span: dict[int, tuple[int, int]] = {}
            for vid, st in zip(ids, self._starts[level], strict=True):
                s = self.by_id[vid].surah
                a = span[s][0] if s in span else st
                span[s] = (a, st + len(fn(self.by_id[vid].norm)))
            self._surah_span[level] = span

    @classmethod
    def load(cls, build_dir: Path) -> QuranIndex:
        return cls(_read_jsonl(build_dir / "verses.jsonl"), _read_jsonl(build_dir / "surahs.jsonl"))

    def verse_id(self, surah: int, ayah: int) -> int | None:
        return self.ids.get((surah, ayah))

    def key(self, verse_id: int) -> str:
        v = self.by_id[verse_id]
        return f"{v.surah}:{v.ayah}"

    def _vid_at(self, level: str, offset: int) -> int:
        i = bisect.bisect_right(self._starts[level], offset) - 1
        return self._start_ids[level][max(i, 0)]

    def find(
        self, quote: str, level: str = "exact", limit: int = 50, surah: int | None = None
    ) -> list[Match]:
        """Every occurrence of the quote at one strictness level (empty if the key is too short). With
        ``surah``, only inside that sūra, where a shorter loose key (five letters) is accepted."""
        q = _KEYS[level](quote)
        words = len(match_key(quote).split())
        min_len = 5 if surah else 8
        if not q or (level == "skeleton" and words < 4) or (level != "exact" and len(q) < min_len):
            return []
        text = self._text[level]
        needle = f" {q} " if level == "exact" else q
        lo, hi = 0, len(text)
        if surah is not None:
            a, b = self._surah_span[level][surah]
            lo, hi = a - 1, b + 1
        out: list[Match] = []
        seen: set[tuple[int, int]] = set()
        i = text.find(needle, lo, hi)
        while i != -1 and len(out) < limit:
            start = i + (1 if level == "exact" else 0)
            end = start + len(q) - 1
            a, b = self._vid_at(level, start), self._vid_at(level, end)
            if "|" not in text[start : end + 1] and (a, b) not in seen:
                seen.add((a, b))
                out.append(Match(a, b, level))
            i = text.find(needle, i + 1, hi)
        return out

    def locate(self, quote: str, levels: Iterable[str] = LEVELS, surah: int | None = None) -> list[Match]:
        """Occurrences at the strictest level that finds any (optionally inside one sūra)."""
        for level in levels:
            hits = self.find(quote, level, surah=surah)
            if hits:
                return hits
        return []

    def contains(self, verse_from: int, verse_to: int, quote: str) -> str | None:
        """The strictest level at which the verse span contains the quote, else None. Beyond the three
        search levels, ``fuzzy`` accepts a quote of four or more words whose words appear in the span in
        order for at least 80% of them (a reading-variant spelling such as بمسيطر/بمصيطر, أن لا/ألا)."""
        span = [self.by_id[i] for i in range(verse_from, verse_to + 1) if i in self.by_id]
        if not span or len({v.surah for v in span}) != 1:
            return None
        text = " ".join(v.norm for v in span)
        words = len(match_key(quote).split())
        for level, fn in _KEYS.items():
            q, t = fn(quote), fn(text)
            if not q or (level == "skeleton" and words < 4) or (level != "exact" and len(q) < 8):
                continue
            if (level == "exact" and f" {q} " in f" {t} ") or (level != "exact" and q in t):
                return level
        if words >= 4 and in_order_ratio(quote, text) >= 0.8:
            return "fuzzy"
        return None


# ── Sūra names ──────────────────────────────────────────────────────────────────────────────────
# Other names the classical sources and modern editors use for a sūra, mapped to its number. Each is a
# well-known name (documented in the ʿulūm al-Qurʾān literature), not a guess; spelling variants of the
# Tanzil names are handled by the key function, not listed here.
SURAH_ALIASES: dict[str, int] = {
    "فاتحة الكتاب": 1,
    "الحمد": 1,
    "أم القرآن": 1,
    "براءة": 9,
    "بني إسرائيل": 17,
    "سبحان": 17,
    "المؤمن": 40,
    "الطول": 40,
    "حم السجدة": 41,
    "السجدة حم": 41,
    "حم عسق": 42,
    "القتال": 47,
    "اقتربت": 54,
    "الحواريين": 61,
    "ن": 68,
    "ن والقلم": 68,
    "سأل سائل": 70,
    "الدهر": 76,
    "هل أتى": 76,
    "عم": 78,
    "عم يتساءلون": 78,
    "التساؤل": 78,
    "كورت": 81,
    "انفطرت": 82,
    "التطفيف": 83,
    "انشقت": 84,
    "سبح": 87,
    "سبح اسم ربك الأعلى": 87,
    "ألم نشرح": 94,
    "الانشراح": 94,
    "اقرأ": 96,
    "إذا زلزلت": 99,
    "الهمزة": 104,
    "أرأيت": 107,
    "تبت": 111,
    "اللهب": 111,
    "أبي لهب": 111,
    "الصمد": 112,
    "قل هو الله أحد": 112,
    "التوحيد": 112,
}


def surah_key(name: str) -> str:
    """A spelling-insensitive key for a sūra name: marks, hamza seats and spaces folded, a leading
    «سورة» and the article dropped, digits and ornaments removed."""
    k = match_key(to_ascii_digits(name)).replace(" ", "")
    k = re.sub(r"^سوره", "", k)
    k = re.sub(r"^ال", "", k)
    return k


class SurahNames:
    def __init__(self, names: dict[int, str], aliases: dict[str, int] = SURAH_ALIASES) -> None:
        self.table: dict[str, int] = {}
        for n, name in names.items():
            self.table[surah_key(name)] = n
        for alias, n in aliases.items():
            self.table.setdefault(surah_key(alias), n)

    def resolve(self, name: str) -> tuple[int | None, str]:
        """(sūra number, how) — how is 'name', 'variant' (ين/ون ending) or 'edit-1' (one-letter typo,
        accepted only when unique and the key has at least four letters); (None, 'unknown') otherwise."""
        k = surah_key(name)
        if not k:
            return None, "unknown"
        if k in self.table:
            return self.table[k], "name"
        for a, b in (("ين", "ون"), ("ون", "ين")):
            if k.endswith(a) and k[: -len(a)] + b in self.table:
                return self.table[k[: -len(a)] + b], "variant"
        if len(k) >= 4:
            near = {n for key, n in self.table.items() if len(key) >= 4 and _edit1(k, key)}
            if len(near) == 1:
                return near.pop(), "edit-1"
        return None, "unknown"


def _edit1(a: str, b: str) -> bool:
    """True when a and b differ by exactly one substitution, insertion, deletion or adjacent swap."""
    if a == b or abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        diff = [i for i in range(len(a)) if a[i] != b[i]]
        if len(diff) == 1:
            return True
        return (
            len(diff) == 2
            and diff[1] == diff[0] + 1
            and a[diff[0]] == b[diff[1]]
            and a[diff[1]] == b[diff[0]]
        )
    if len(a) > len(b):
        a, b = b, a
    i = 0
    while i < len(a) and a[i] == b[i]:
        i += 1
    return a[i:] == b[i + 1 :]


def _read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


read_jsonl = _read_jsonl
