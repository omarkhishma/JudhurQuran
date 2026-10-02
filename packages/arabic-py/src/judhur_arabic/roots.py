"""Root helpers: canonical keys, display forms, transliteration.

A root is an ordered sequence of radicals. Canonical storage uses the corpus
convention: hamza radicals are ``ء`` (never an alef-with-hamza), weak radicals
are ``و``/``ي``. Users type roots many ways (``أمن``, ``ا م ن``, ``ء-م-ن``);
``parse_root_input`` folds all of them to the canonical letters.
"""

from __future__ import annotations

from .normalize import strip_marks

# Single-character academic transliteration (DIN 31635-style, as in the design handoff).
TRANSLIT: dict[str, str] = {
    "ء": "ʾ", "ا": "ā", "ب": "b", "ت": "t", "ث": "ṯ", "ج": "j", "ح": "ḥ", "خ": "ḫ",
    "د": "d", "ذ": "ḏ", "ر": "r", "ز": "z", "س": "s", "ش": "š", "ص": "ṣ", "ض": "ḍ",
    "ط": "ṭ", "ظ": "ẓ", "ع": "ʿ", "غ": "ġ", "ف": "f", "ق": "q", "ك": "k", "ل": "l",
    "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "y",
}  # fmt: skip

LETTER_NAMES_AR: dict[str, str] = {
    "ء": "همزة", "ب": "باء", "ت": "تاء", "ث": "ثاء", "ج": "جيم", "ح": "حاء", "خ": "خاء",
    "د": "دال", "ذ": "ذال", "ر": "راء", "ز": "زاي", "س": "سين", "ش": "شين", "ص": "صاد",
    "ض": "ضاد", "ط": "طاء", "ظ": "ظاء", "ع": "عين", "غ": "غين", "ف": "فاء", "ق": "قاف",
    "ك": "كاف", "ل": "لام", "م": "ميم", "ن": "نون", "ه": "هاء", "و": "واو", "ي": "ياء",
}  # fmt: skip

# Every carrier of a hamza radical folds to ء; alef maksura folds to ي.
_RADICAL_FOLD = str.maketrans({"أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ٱ": "ء", "ى": "ي"})

# Latin input (k-t-b, ʿ-l-m, q-r-').
_LATIN_TO_AR: dict[str, str] = {
    "ʾ": "ء", "'": "ء", "’": "ء", "ʿ": "ع", "3": "ع", "`": "ع", "b": "ب", "t": "ت", "ṯ": "ث",
    "j": "ج", "ǧ": "ج", "ḥ": "ح", "ḫ": "خ", "d": "د", "ḏ": "ذ", "r": "ر", "z": "ز", "s": "س",
    "š": "ش", "ṣ": "ص", "ḍ": "ض", "ṭ": "ط", "ẓ": "ظ", "ġ": "غ", "f": "ف", "q": "ق", "k": "ك",
    "l": "ل", "m": "م", "n": "ن", "h": "ه", "w": "و", "y": "ي",
}  # fmt: skip
_LATIN_DIGRAPHS: dict[str, str] = {"th": "ث", "kh": "خ", "dh": "ذ", "sh": "ش", "gh": "غ"}


def display_letters(letters: list[str] | str) -> list[str]:
    """Dictionary convention: a hamza radical is written أ (أمن، سأل، قرأ)."""
    return ["أ" if ch == "ء" else ch for ch in letters]


def translit(letters: list[str] | str) -> str:
    """['ع','ل','م'] → 'ʿ-l-m'."""
    return "-".join(TRANSLIT.get(ch, ch) for ch in letters)


def spaced(letters: list[str] | str) -> str:
    """Display form with spaces: 'ع ل م', 'أ م ن'."""
    return " ".join(display_letters(letters))


def key(letters: list[str] | str) -> str:
    """URL / lookup key, the display letters joined: 'علم', 'أمن', 'قرأ'."""
    return "".join(display_letters(letters))


def from_qac(bw_root: str) -> list[str]:
    """Quranic Arabic Corpus root (Buckwalter) → canonical radicals.

    The corpus writes a hamza radical as ``A`` (``Amn``, ``sAl``, ``qrA``); an alef is
    never a radical, so ``A`` is mapped to ``ء``. Every other character must be a letter.
    """
    from .buckwalter import bw_root_letters

    return ["ء" if ch == "A" else bw_root_letters(ch)[0] for ch in bw_root]


def parse_root_input(raw: str) -> list[str] | None:
    """Parse a user-typed root into canonical radicals, or None if it is not a plausible root.

    Accepts Arabic with or without separators/diacritics (``ك ت ب``, ``كتب``, ``أمن``) and
    Latin transliteration with separators (``k-t-b``, ``q-r-'``, ``sh-r-k``).
    """
    text = strip_marks(raw).strip()
    if not text:
        return None
    if any("ء" <= ch <= "ي" or ch == "ٱ" for ch in text):
        letters = [ch for ch in text.translate(_RADICAL_FOLD) if "ء" <= ch <= "ي"]
        # A leading plain alef in a typed root stands for a hamza radical (امن → ءمن).
        letters = ["ء" if ch == "ا" else ch for ch in letters]
    else:
        parts = [p for p in text.replace("_", "-").replace(" ", "-").lower().split("-") if p]
        if len(parts) < 2:
            return None
        letters = []
        for part in parts:
            mapped = _LATIN_DIGRAPHS.get(part) or _LATIN_TO_AR.get(part)
            if mapped is None:
                return None
            letters.append(mapped)
    if not 2 <= len(letters) <= 5:
        return None
    return letters
