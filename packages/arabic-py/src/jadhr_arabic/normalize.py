"""Arabic normalisation for MATCHING ONLY.

Nothing produced here is ever displayed in place of the source text. The
stored Quranic text stays byte-identical to its verified source; these
functions build shadow columns and normalise user queries so that both sides
of a comparison are folded the same way.

Three levels:

* ``strip_marks``  — remove harakat, Quranic annotation signs, tatweel and
  invisible format characters. Letters are untouched.
* ``fold``         — fold orthographic variants that users do not type
  consistently: the alef family (incl. alef wasla ٱ), alef maksura, teh
  marbuta, hamza carriers.
* ``normalize``    — ``fold(strip_marks(text))`` plus whitespace collapse.
  This is the key used by search on both the index and the query side.

``skeleton`` goes one step further (drops long-vowel letters and hamza) and is
used only to align two spellings of the same verse (Uthmani rasm vs. standard
imlāʾī spelling), never for search ranking.
"""

from __future__ import annotations

import re
import unicodedata

# Combining marks and Quranic annotation signs (all removed for matching).
_MARK_RANGES: tuple[tuple[int, int], ...] = (
    (0x0610, 0x061A),  # small high signs (sallallahou, alayhe, small fatha/damma/kasra…)
    (0x064B, 0x065F),  # tanwin, harakat, shadda, sukun, maddah, hamza above/below, subscript alef…
    (0x0670, 0x0670),  # superscript (dagger) alef
    (0x06D6, 0x06DC),  # small high ligatures / pause marks ۖ ۗ ۘ ۙ ۚ ۛ ۜ
    (0x06DD, 0x06DE),  # end of ayah, rub el hizb
    (
        0x06DF,
        0x06E4,
    ),  # small high rounded zero, upright rect. zero, dotless head of khah (QPC sukun), meem, low seen, madda
    (0x06E5, 0x06E6),  # small waw, small yeh (modifier letters, not base letters)
    (0x06E7, 0x06E8),  # small high yeh, small high noon
    (0x06E9, 0x06E9),  # place of sajdah ۩
    (0x06EA, 0x06ED),  # empty centre stops, small low meem
    (0x08D3, 0x08E1),  # Arabic extended-A marks
    (0x08E3, 0x08FF),  # incl. open tanwin U+08F0–U+08F2 used by QPC encodings
)
_INVISIBLE = "ـ​‌‍‎‏؜﻿"  # tatweel + zero-width/format chars

_MARK_CLASS = "".join(f"\\u{a:04x}-\\u{b:04x}" for a, b in _MARK_RANGES)
_STRIP_RE = re.compile(f"[{_MARK_CLASS}{re.escape(_INVISIBLE)}]")
_SPACE_RE = re.compile(r"\s+")

_FOLD_TABLE = str.maketrans(
    {
        "ٱ": "ا",  # ٱ alef wasla
        "أ": "ا",  # أ
        "إ": "ا",  # إ
        "آ": "ا",  # آ
        "ٲ": "ا",  # ٲ
        "ٳ": "ا",  # ٳ
        "ٵ": "ا",  # ٵ
        "ى": "ي",  # ى → ي
        "ی": "ي",  # Persian yeh → ي
        "ة": "ه",  # ة → ه
        "ؤ": "و",  # ؤ → و
        "ئ": "ي",  # ئ → ي
        "ک": "ك",  # Persian keheh → ك
        " ": " ",  # NBSP
    }
)

ARABIC_LETTERS = frozenset(chr(c) for c in range(0x0621, 0x064B) if c != 0x0640)


def strip_marks(text: str) -> str:
    """Remove diacritics, Quranic annotation signs, tatweel and invisible format characters."""
    return _STRIP_RE.sub("", unicodedata.normalize("NFC", text))


def fold(text: str) -> str:
    """Fold orthographic variants (alef family, alef maksura, teh marbuta, hamza carriers)."""
    return text.translate(_FOLD_TABLE)


def normalize(text: str) -> str:
    """Matching key: strip marks, fold variants, collapse whitespace."""
    return _SPACE_RE.sub(" ", fold(strip_marks(text))).strip()


_SKELETON_DROP = str.maketrans("", "", "اويء")  # ا و ي ء after folding


def skeleton(text: str) -> str:
    """Consonantal skeleton used to align two spellings of the same text (no spaces)."""
    return normalize(text).replace(" ", "").translate(_SKELETON_DROP)


_UTHMANI_ONLY = re.compile("[\u0670\u0671\u06d6-\u06ed\u08f0-\u08f2]")


_DAGGER_AFTER_YA_MID = re.compile("\u0649\u0670(?=[\u0621-\u064a])")


def plain_spelling(text: str) -> str:
    """Heuristic Uthmani → everyday spelling, for MATCHING lemmas only (never displayed).

    وٰ → ا (صَلَوٰة → صلاة) · ىٰ inside a word → ا (تَوْرَىٰة → توراة), at the end → ى (عَلَىٰ)
    · other dagger alef → ا (عَٰلَمِين → عالمين) · small waw/yeh → و/ي. Words whose everyday
    spelling omits the alef (إِلَٰه → إله) are covered by also matching the stripped form.
    """
    t = unicodedata.normalize("NFC", text)
    t = t.replace("\u0648\u0670", "\u0627")
    t = _DAGGER_AFTER_YA_MID.sub("\u0627", t)
    t = t.replace("\u0649\u0670", "\u0649").replace("\u0670", "\u0627")
    t = t.replace("\u06e5", "\u0648").replace("\u06e6", "\u064a").replace("\u06e7", "\u064a")
    return normalize(t)


def is_uthmani(text: str) -> bool:
    """True when the text carries Uthmani-script signs (dagger alef, alef wasla, Quranic annotation
    marks) — i.e. it was copied from a mushaf rather than typed in everyday spelling."""
    return bool(_UTHMANI_ONLY.search(text))


def has_arabic(text: str) -> bool:
    return any("؀" <= ch <= "ۿ" or "ݐ" <= ch <= "ݿ" or "ࢠ" <= ch <= "ࣿ" for ch in text)


def has_marks(text: str) -> bool:
    """True when the text carries at least one diacritic (used to boost exact-form matches)."""
    return strip_marks(text) != unicodedata.normalize("NFC", text).replace("ـ", "")
