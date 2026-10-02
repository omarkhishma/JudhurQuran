"""Root helpers: canonical keys, display forms, transliteration.

A root is an ordered sequence of radicals. Canonical storage uses the corpus
convention: hamza radicals are ``ء`` (never an alef-with-hamza), weak radicals
are ``و``/``ي``. Users type roots many ways (``أمن``, ``ا م ن``, ``ء-م-ن``);
``parse_root_input`` folds all of them to the canonical letters.
"""

from __future__ import annotations

import itertools

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


# Plain-ASCII input cannot carry the dots that tell ح from ه or ص from س; each such letter stands for all
# of its readings, and the caller keeps the combinations that are real roots.
_ASCII_AMBIGUOUS: dict[str, tuple[str, ...]] = {
    "h": ("ه", "ح"), "s": ("س", "ص"), "d": ("د", "ض"), "t": ("ت", "ط"), "z": ("ز", "ظ"),
    "dh": ("ذ", "ظ"), "a": ("ء", "ع"), "e": ("ع", "ء"), "g": ("غ", "ج"), "x": ("خ",), "kh": ("خ",),
    "c": ("ش",), "ch": ("ش",),
}  # fmt: skip
_MAX_CANDIDATES = 64


def root_input_candidates(raw: str) -> list[list[str]]:
    """Every root a typed input may mean, the strict reading first.

    Arabic input and dotted transliteration (``ḥ-m-d``) have one reading. Plain ASCII (``h-m-d``) expands
    each ambiguous letter (h → ه/ح, s → س/ص, d → د/ض, t → ت/ط, z → ز/ظ, a → ء/ع, g → غ/ج); at most 64
    combinations are returned.
    """
    strict = parse_root_input(raw)
    text = strip_marks(raw).strip()
    if any("ء" <= ch <= "ي" or ch == "ٱ" for ch in text):
        return [strict] if strict else []
    parts = [p for p in text.replace("_", "-").replace(" ", "-").lower().split("-") if p]
    if not 2 <= len(parts) <= 5:
        return [strict] if strict else []
    options: list[tuple[str, ...]] = []
    for part in parts:
        opts = _ASCII_AMBIGUOUS.get(part)
        if opts is None:
            mapped = _LATIN_DIGRAPHS.get(part) or _LATIN_TO_AR.get(part)
            if mapped is None:
                return [strict] if strict else []
            opts = (mapped,)
        options.append(opts)
    out: list[list[str]] = [strict] if strict else []
    for combo in itertools.product(*options):
        letters = list(combo)
        if letters not in out:
            out.append(letters)
        if len(out) >= _MAX_CANDIDATES:
            break
    return out


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
