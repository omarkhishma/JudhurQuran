"""Romanisation of vocalised Arabic: scholarly transliteration, readable slugs, injective pattern slugs.

Used for the ``translit`` member of the API's Arabic envelope (``{full, bare, translit}``) where no
source transliteration exists, and for URL slugs. Input must be vocalised; unvocalised input gives
a consonant skeleton, which is honest rather than guessed.

* ``scholarly`` — kitāb, ʿilm, raḥma, ʾaṣl, al-raḥmān (ALA-LC style; hamza at word start omitted).
* ``slug_lemma`` — kitab, ilm, rahma: ASCII, ʿayn and hamza dropped, long vowels written once.
* ``slug_pattern`` — faa3il, maf3uul, fa3aalah: ʿayn ``3``, hamza ``2``, long vowels doubled, tāʾ
  marbūṭa ``h`` — distinct for distinct patterns.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

FATHA, DAMMA, KASRA, SUKUN, SHADDA = "َ", "ُ", "ِ", "ْ", "ّ"
TANWIN = {"ً", "ٌ", "ٍ", "ࣰ", "ࣱ", "ࣲ"}
DAGGER = "ٰ"
VOWELS = {FATHA: "a", DAMMA: "u", KASRA: "i"}
HAMZAS = {"ء", "أ", "إ", "ؤ", "ئ"}
_SKIP = {"ٓ", "ٔ", "ٕ", "ـ", *(chr(c) for c in range(0x06D6, 0x06EE))}


@dataclass(frozen=True)
class _Scheme:
    letters: dict[str, str]
    long: dict[str, str]  # short vowel → its long spelling
    hamza: str
    hamza_initial: str
    ain: str
    marbuta: str
    article: str  # how ٱل / ال at word start is written


_COMMON = {
    "ب": "b", "ت": "t", "ث": "th", "ج": "j", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z",
    "س": "s", "ش": "sh", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h",
}  # fmt: skip

SCHOLARLY = _Scheme(
    letters=_COMMON | {"ح": "ḥ", "ص": "ṣ", "ض": "ḍ", "ط": "ṭ", "ظ": "ẓ"},
    long={"a": "ā", "i": "ī", "u": "ū"},
    hamza="ʾ",
    hamza_initial="",
    ain="ʿ",
    marbuta="a",
    article="al-",
)
SLUG_LEMMA = _Scheme(
    letters=_COMMON | {"ح": "h", "ص": "s", "ض": "d", "ط": "t", "ظ": "z"},
    long={"a": "a", "i": "i", "u": "u"},
    hamza="",
    hamza_initial="",
    ain="",
    marbuta="a",
    article="al",
)
SLUG_PATTERN = _Scheme(
    letters=_COMMON | {"ح": "h", "ص": "s", "ض": "d", "ط": "t", "ظ": "z"},
    long={"a": "aa", "i": "ii", "u": "uu"},
    hamza="2",
    hamza_initial="2",
    ain="3",
    marbuta="h",
    article="al",
)


def _romanise(ar: str, sc: _Scheme) -> str:
    # NFC orders a vowel before the shadda; put the shadda first so it doubles its own consonant.
    text = re.sub("([ً-ِ])ّ", "ّ\\1", unicodedata.normalize("NFC", ar))
    out: list[str] = []
    last_cons = ""
    last_vowel = ""
    at_start = True

    def cons(rom: str) -> None:
        nonlocal last_cons, last_vowel
        out.append(rom)
        if rom:
            last_cons = rom
        last_vowel = ""

    def lengthen() -> None:
        # Replace the short vowel just written with its long spelling.
        nonlocal last_vowel
        if out and out[-1] == last_vowel:
            out[-1] = sc.long[last_vowel]
        else:
            out.append(sc.long[last_vowel])
        last_vowel = ""

    i = 0
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if ch.isspace():
            out.append("-" if sc is not SCHOLARLY else " ")
            last_cons, last_vowel, at_start = "", "", True
            i += 1
            continue
        start = at_start
        at_start = False
        if ch in VOWELS:
            out.append(VOWELS[ch])
            last_vowel = VOWELS[ch]
        elif ch == SHADDA:
            if last_cons and not "".join(out).endswith(last_cons * 2):
                out.append(last_cons)
        elif ch == DAGGER:
            if last_vowel == "a":
                lengthen()
            else:
                out.append(sc.long["a"])
            last_vowel = ""
        elif ch in (SUKUN, *TANWIN) or ch in _SKIP:
            pass
        elif ch in ("ٱ", "ا") and start:
            # wasla or plain alef opening a word: the article "al-", else a prothetic "i"
            if nxt == "ل":
                after = text[i + 2] if i + 2 < len(text) else ""
                if after == SHADDA:  # ٱلَّذِى: the article's own lam is doubled
                    out.append("all")
                    i += 3
                    last_cons, last_vowel = "l", ""
                    continue
                out.append(sc.article)
                i += 2
                last_cons, last_vowel = "", ""
                # sun-letter assimilation is shown by a shadda on the next letter; the article already says it
                if i + 1 < len(text) and text[i + 1] == SHADDA:
                    text = text[: i + 1] + text[i + 2 :]
                continue
            out.append("i")
        elif ch == "ا":
            if last_vowel == "a":
                lengthen()
            else:
                out.append(sc.long["a"])
        elif ch == "آ":
            if start:
                out.append(sc.hamza_initial + sc.long["a"])
            elif last_vowel == "a":  # Uthmani madd over a long alif, not a hamza
                lengthen()
            else:
                out.append(sc.long["a"])
        elif ch in ("و", "ي", "ى"):
            short = "u" if ch == "و" else "i"
            if nxt == DAGGER and (ch == "ى" or (ch == "و" and last_vowel == "a")):
                # ىٰ and the Uthmani وٰ (صَلَوٰة) are a long ā
                if last_vowel == "a":
                    lengthen()
                else:
                    out.append(sc.long["a"])
                i += 2
                last_vowel = ""
                continue
            consonantal = nxt in VOWELS or nxt in (SHADDA, SUKUN)
            if ch == "ى" and not consonantal:
                if last_vowel in ("a", "i"):
                    lengthen()
                else:
                    out.append(sc.long["a"])
            elif not consonantal and last_vowel == short:
                lengthen()
            elif not consonantal and ch != "ى" and last_vowel == "" and out and out[-1] in ("a",):
                cons("w" if ch == "و" else "y")  # diphthong written without sukun
            elif not consonantal and last_vowel == "" and not last_cons:
                out.append(sc.long[short])
            else:
                cons("w" if ch == "و" else "y")
        elif ch in HAMZAS:
            cons(sc.hamza_initial if start else sc.hamza)
        elif ch == "ع":
            cons(sc.ain)
        elif ch == "ة":
            if sc.marbuta == "a" and out and out[-1].endswith(sc.long["a"]) and sc.long["a"] != "a":
                out.append("h")  # after a long ā: ṣalāh
            elif not (sc.marbuta == "a" and last_vowel == "a"):
                out.append(sc.marbuta)
            last_vowel = ""
        elif ch in sc.letters:
            cons(sc.letters[ch])
        i += 1
    return "".join(out)


_ALLAH = {"\u0671\u0644\u0644\u0647", "\u0627\u0644\u0644\u0647"}


def _is_allah(ar: str) -> bool:
    return re.sub("[\u064b-\u0652\u0670]", "", unicodedata.normalize("NFC", ar)) in _ALLAH


def scholarly(ar: str) -> str:
    """kitāb, ʿilm, raḥma — for display next to Arabic. Empty for empty input."""
    if _is_allah(ar):
        return "Allāh"
    return re.sub(r"\s+", " ", _romanise(ar, SCHOLARLY)).strip()


def slug_lemma(ar: str) -> str:
    if _is_allah(ar):
        return "allah"
    s = _romanise(ar, SLUG_LEMMA).lower()
    s = re.sub(r"([aiu])\1+", r"\1", s)
    s = re.sub(r"[^a-z0-9-]", "", s)
    return re.sub(r"-{2,}", "-", s).strip("-")[:48] or "x"


def slug_pattern(ar: str) -> str:
    s = re.sub(r"[^a-z0-9-]", "", _romanise(ar, SLUG_PATTERN).lower())
    return re.sub(r"-{2,}", "-", s).strip("-")[:48] or "x"
