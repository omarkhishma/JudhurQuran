"""Buckwalter transliteration → Arabic, Quranic Arabic Corpus variant.

The Quranic Arabic Corpus (corpus.quran.com) extends classic Buckwalter with
Quranic annotation marks. The table below was checked entry by entry against
the corpus' published table (corpus.quran.com/java/buckwalter.jsp, 2026-10-03):
all 60 published entries match; ``|`` (alef with madda) is kept from classic
Buckwalter although the corpus does not use it. Mapping is strict: an unknown
character raises, because a silently dropped byte would corrupt a root or a lemma.

This module is used for morphology metadata (roots, lemmas, segment forms).
The displayed Quranic text never passes through it.
"""

from __future__ import annotations

BW_TO_AR: dict[str, str] = {
    "'": "ء",  # ء hamza
    "|": "آ",  # آ alef with madda
    ">": "أ",  # أ alef with hamza above
    "&": "ؤ",  # ؤ waw with hamza
    "<": "إ",  # إ alef with hamza below
    "}": "ئ",  # ئ yeh with hamza
    "A": "ا",  # ا alef
    "b": "ب",  # ب
    "p": "ة",  # ة teh marbuta
    "t": "ت",  # ت
    "v": "ث",  # ث
    "j": "ج",  # ج
    "H": "ح",  # ح
    "x": "خ",  # خ
    "d": "د",  # د
    "*": "ذ",  # ذ
    "r": "ر",  # ر
    "z": "ز",  # ز
    "s": "س",  # س
    "$": "ش",  # ش
    "S": "ص",  # ص
    "D": "ض",  # ض
    "T": "ط",  # ط
    "Z": "ظ",  # ظ
    "E": "ع",  # ع
    "g": "غ",  # غ
    "_": "ـ",  # ـ tatweel
    "f": "ف",  # ف
    "q": "ق",  # ق
    "k": "ك",  # ك
    "l": "ل",  # ل
    "m": "م",  # م
    "n": "ن",  # ن
    "h": "ه",  # ه
    "w": "و",  # و
    "Y": "ى",  # ى alef maksura
    "y": "ي",  # ي
    "F": "ً",  # fathatan
    "N": "ٌ",  # dammatan
    "K": "ٍ",  # kasratan
    "a": "َ",  # fatha
    "u": "ُ",  # damma
    "i": "ِ",  # kasra
    "~": "ّ",  # shadda
    "o": "ْ",  # sukun
    "^": "ٓ",  # maddah above
    "#": "ٔ",  # hamza above
    "`": "ٰ",  # superscript (dagger) alef
    "{": "ٱ",  # ٱ alef wasla
    ":": "ۜ",  # small high seen
    "@": "۟",  # small high rounded zero
    '"': "۠",  # small high upright rectangular zero
    "[": "ۢ",  # small high meem isolated form
    ";": "ۣ",  # small low seen
    ",": "ۥ",  # small waw
    ".": "ۦ",  # small yeh
    "!": "ۨ",  # small high noon
    "-": "۪",  # empty centre low stop
    "+": "۫",  # empty centre high stop
    "%": "۬",  # rounded high stop with filled centre
    "]": "ۭ",  # small low meem
}

AR_TO_BW: dict[str, str] = {v: k for k, v in BW_TO_AR.items()}


class BuckwalterError(ValueError):
    """Raised when a string contains a character outside the corpus scheme."""


def bw_to_arabic(text: str) -> str:
    """Convert a corpus Buckwalter string to Arabic. Strict: unknown chars raise."""
    out: list[str] = []
    for ch in text:
        mapped = BW_TO_AR.get(ch)
        if mapped is None:
            raise BuckwalterError(f"unmapped Buckwalter character {ch!r} in {text!r}")
        out.append(mapped)
    return "".join(out)


def arabic_to_bw(text: str) -> str:
    """Inverse mapping, strict."""
    out: list[str] = []
    for ch in text:
        mapped = AR_TO_BW.get(ch)
        if mapped is None:
            raise BuckwalterError(f"unmapped Arabic character U+{ord(ch):04X} in {text!r}")
        out.append(mapped)
    return "".join(out)


def split_lemma_key(bw_lemma: str) -> tuple[str, int | None]:
    """Split a corpus LEM value into (lemma, homograph index).

    The corpus disambiguates homographic lemmas with a trailing ASCII digit
    (``bayona`` vs ``bayona2``) and joins multiword lemmas with ``_``
    (``<ilo_yaAsiyn``) — note ``_`` is also tatweel in plain Buckwalter, but
    inside LEM values the corpus uses it only as the multiword joiner.
    """
    i = len(bw_lemma)
    while i > 0 and bw_lemma[i - 1].isdigit():
        i -= 1
    index = int(bw_lemma[i:]) if i < len(bw_lemma) else None
    return bw_lemma[:i], index


def bw_lemma_to_arabic(bw_lemma: str) -> str:
    """Render a corpus LEM value as Arabic (homograph digit removed, ``_`` → space)."""
    base, _ = split_lemma_key(bw_lemma)
    return " ".join(bw_to_arabic(part) for part in base.split("_"))


def bw_root_letters(bw_root: str) -> list[str]:
    """``ktb`` → ['ك', 'ت', 'ب']; corpus roots carry no diacritics."""
    letters = [bw_to_arabic(ch) for ch in bw_root]
    for letter in letters:
        if not ("ء" <= letter <= "ي"):
            raise BuckwalterError(f"root {bw_root!r} contains a non-letter {letter!r}")
    return letters
