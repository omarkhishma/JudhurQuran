"""Morphological pattern (wazn, الميزان الصرفي) for each lemma.

Three layers, most reliable first; a lemma gets a pattern only when one layer is certain:

1. **Tagged derivatives** — the corpus tags participles and verbal nouns with their verb form
   (ACT PCPL (X) …). Their pattern is fixed by the form: مُسْتَقِيم → مُسْتَفْعِل. Following the
   classical rule, the wazn reflects the underlying form, not vowel changes (إعلال بالقلب/النقل):
   قِيَام → فِعَال, مَقُول → مَفْعُول.
2. **Verbs** — the form number gives the pattern (II فَعَّلَ … X اسْتَفْعَلَ). Form I takes the vowel
   of its middle radical when that radical is sound (عَلِمَ → فَعِلَ); otherwise it is left as
   "ثلاثي مجرد" without a vowel claim.
3. **Other nouns and adjectives** — the lemma is matched letter by letter against its radicals
   (shadda expanded, hamza carriers folded, a weak radical may surface as ا/و/ي/ى). Non-radical
   letters must be augments (حروف الزيادة «سألتمونيها»). The resulting pattern is accepted only if
   it is in the closed list of classical patterns below; anything else stays without a pattern.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

FATHA, DAMMA, KASRA, SUKUN, SHADDA = "َ", "ُ", "ِ", "ْ", "ّ"
TANWIN = {"ً", "ٌ", "ٍ"}
VOWELS = {FATHA, DAMMA, KASRA, SUKUN}
AUGMENTS = set("سءلتمونيها") | {"ا", "ى", "ة"}
HAMZAS = set("ءأإؤئ")
WEAK = set("وي")

# Verb forms → pattern of the perfect (form I handled separately).
VERB_FORM_PATTERN = {
    2: "فَعَّلَ", 3: "فَاعَلَ", 4: "أَفْعَلَ", 5: "تَفَعَّلَ", 6: "تَفَاعَلَ",
    7: "انْفَعَلَ", 8: "افْتَعَلَ", 9: "افْعَلَّ", 10: "اسْتَفْعَلَ", 11: "افْعَالَّ",
}  # fmt: skip
# The corpus labels its one form-XII verb اطْمَأَنَّ (root طمن), which is not افْعَوْعَلَ, so XII gets no pattern.

# Quadriliteral verb forms: فَعْلَلَ، تَفَعْلَلَ، افْعَلَلَّ (اقْشَعَرَّ).
VERB_FORM4_PATTERN = {1: "فَعْلَلَ", 2: "تَفَعْلَلَ", 4: "افْعَلَلَّ"}

# Tagged derivatives: (verb form, derivation) → pattern.
DERIVED = {
    (1, "ACT_PCPL"): "فَاعِل", (1, "PASS_PCPL"): "مَفْعُول",
    (2, "ACT_PCPL"): "مُفَعِّل", (2, "PASS_PCPL"): "مُفَعَّل", (2, "VN"): "تَفْعِيل",
    (3, "ACT_PCPL"): "مُفَاعِل", (3, "PASS_PCPL"): "مُفَاعَل",
    (4, "ACT_PCPL"): "مُفْعِل", (4, "PASS_PCPL"): "مُفْعَل", (4, "VN"): "إِفْعَال",
    (5, "ACT_PCPL"): "مُتَفَعِّل", (5, "PASS_PCPL"): "مُتَفَعَّل", (5, "VN"): "تَفَعُّل",
    (6, "ACT_PCPL"): "مُتَفَاعِل", (6, "PASS_PCPL"): "مُتَفَاعَل", (6, "VN"): "تَفَاعُل",
    (7, "ACT_PCPL"): "مُنْفَعِل", (7, "PASS_PCPL"): "مُنْفَعَل", (7, "VN"): "انْفِعَال",
    (8, "ACT_PCPL"): "مُفْتَعِل", (8, "PASS_PCPL"): "مُفْتَعَل", (8, "VN"): "افْتِعَال",
    (9, "ACT_PCPL"): "مُفْعَلّ",
    (10, "ACT_PCPL"): "مُسْتَفْعِل", (10, "PASS_PCPL"): "مُسْتَفْعَل", (10, "VN"): "اسْتِفْعَال",
    (11, "ACT_PCPL"): "مُفْعَالّ",
}  # fmt: skip

# Closed list of classical patterns accepted from letter matching (singular bases; ة / plural endings are
# handled as suffixes). Quadriliteral patterns use ل twice (فَعْلَل).
KNOWN = {
    # triliteral nouns, maṣdars, adjectives
    "فَعْل", "فِعْل", "فُعْل", "فَعَل", "فَعِل", "فَعُل", "فِعَل", "فُعَل", "فِعِل", "فُعُل",
    "فَعَال", "فِعَال", "فُعَال", "فَعِيل", "فَعُول", "فُعُول", "فُعَيْل",
    "فَعْلَان", "فِعْلَان", "فُعْلَان", "فَعَلَان", "فَعْلَى", "فُعْلَى", "فِعْلَى", "فَعْلَاء",
    "فَاعِل", "فَاعُول", "فَاعَل", "مَفْعُول", "مَفْعَل", "مَفْعِل", "مِفْعَل", "مِفْعَال", "مِفْعِيل",
    "فَعَّال", "فِعِّيل", "فَعُّول", "فُعَّال", "فُعَّل", "فَيْعُول", "فَيْعَل", "فَيْعِل", "فَوْعَل",
    "تَفْعَال", "تِفْعَال", "فَيْعَال", "تَفْعُول", "أَفْعَل", "إِفْعِيل", "يَفْعُول", "فُعْلُول",
    # broken plurals
    "أَفْعَال", "أَفْعُل", "أَفْعِلَاء", "فُعَلَاء", "فِعَلَ", "فَوَاعِل", "فَعَائِل", "مَفَاعِل",
    "مَفَاعِيل", "أَفَاعِل", "أَفَاعِيل", "فَعَالَى", "فَعَالِي", "تَفَاعِيل", "فَعَالِيّ",
    # derived nouns (also produced by layer 1)
    *DERIVED.values(),
    "مُفَاعَل", "تَفْعِل", "أَفْعِلَة", "فُعَالَى", "فَوَاعِيل", "فَعَلُوت",
}  # fmt: skip

# Quadriliteral roots (four radicals: ف ع ل ل).
KNOWN4 = {
    "فَعْلَل", "فِعْلِل", "فُعْلُل", "فَعْلَال", "فِعْلَال", "فُعْلَال", "فُعْلُول", "فِعْلِيل", "فَعَالِل", "فَعَالِيل",
    "مُفَعْلِل", "مُفَعْلَل", "فَعْلَلَة",
}  # fmt: skip

SUFFIXES = ("ة", "َة", "َات", "ات", "ُون", "ِين", "ون", "ين", "ِيّ", "ِيَّة", "َان", "َيْن")


@dataclass(frozen=True)
class Unit:
    letter: str
    vowel: str  # one of VOWELS, '' (none / long-vowel letter), or 'ً' etc.


MARKS = "[\u064b-\u0652]"
TANWIN_VOWEL = {"\u064b": FATHA, "\u064c": DAMMA, "\u064d": KASRA}


def _units(word: str) -> list[Unit]:
    """Split a vocalised Uthmani word into (letter, vowel) units; shadda doubles the consonant."""
    t = unicodedata.normalize("NFC", word)
    # a hamza written above a tatweel or a gap (مَـَٔاب، سَيِّـَٔات) is the letter ء
    t = re.sub(f"[\u0640 ]({MARKS}*)\u0654", "ء\\1", t)
    t = "".join(ch for ch in t if ch not in "\u0640\u06e5\u06e6\u0653\u0654\u0655 ")
    # A shadda on the first letter is assimilation from the preceding word (مَّعْلُوم), not part of the lemma.
    if len(t) > 2 and t[1] == SHADDA:
        t = t[0] + t[2:]
    elif len(t) > 3 and t[2] == SHADDA and t[1] in VOWELS:
        t = t[:2] + t[3:]
    t = re.sub("\u064b\u0627$", "\u064b", t)  # the alef after a final tanwin is orthographic (أَبَدًا)
    t = (
        t.replace("\u0648\u0670\u0627", "ا").replace("\u0648\u0670", "ا").replace("\u0649\u0670", "ى")
    )  # rasm و/ى with a dagger alef spell ā (زَكَوٰة، رُجْعَىٰ)
    t = t.replace("\u0670", "ا").replace("\u0671", "ا")  # dagger alef, wasla
    # آ starting a word is ء + ā (آخِر); inside a word it is ā with the madd sign (سَمَآء)
    t = ("ءَا" + t[1:] if t.startswith("\u0622") else t).replace("\u0622", "ا")
    t = re.sub(f"\u0649(?={MARKS}|.)", "ي", t)  # a dotless ي that is marked or not final is the consonant ي
    out: list[Unit] = []
    for ch in t:
        if "ء" <= ch <= "ي":
            out.append(Unit(ch, ""))
        elif ch == SHADDA and out:
            last = out[-1]
            out[-1] = Unit(last.letter, SUKUN)
            out.append(Unit(last.letter, last.vowel))
        elif (ch in VOWELS or ch in TANWIN) and out:
            last = out[-1]
            # after a doubled consonant the vowel belongs to the second copy; tanwin carries its short vowel
            out[-1] = Unit(last.letter, TANWIN_VOWEL.get(ch, ch))
    # An unmarked consonant inside the word is quiescent: the mushaf drops the sukun before ikhfa and
    # assimilation (عِند، إِنسَان). Alef stays unmarked; the final letter carries no case vowel (أُذُنٌ).
    return [
        Unit(u.letter, "")
        if i + 1 == len(out)
        else Unit(u.letter, SUKUN)
        if u.vowel == "" and u.letter not in "اى"
        else u
        for i, u in enumerate(out)
    ]


def _nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def _canon(s: str) -> str:
    """NFC with the shadda moved before the vowel, so suffixes compare letter by letter (يُّون → يّ + ُون)."""
    return re.sub(f"({MARKS}){SHADDA}", f"{SHADDA}\\1", _nfc(s))


def _render(units: list[Unit]) -> str:
    s = ""
    i = 0
    while i < len(units):
        u = units[i]
        if i + 1 < len(units) and units[i + 1].letter == u.letter and u.vowel == SUKUN:
            s += u.letter + SHADDA + units[i + 1].vowel
            i += 2
            continue
        vowel = u.vowel
        prev = units[i - 1].vowel if i else ""
        if vowel == SUKUN and ((u.letter == "ي" and prev == KASRA) or (u.letter == "و" and prev == DAMMA)):
            vowel = ""  # a long vowel letter, written without sukun in a pattern (فَعِيل، فُعُول)
        s += u.letter + vowel
        i += 1
    return _canon(s)


def _radical_matches(radical: str, letter: str, last: bool = False, after_alef: bool = False) -> bool:
    if radical == "ء":
        return letter in HAMZAS or letter == "ا"
    if radical in WEAK:
        # و/ي may swap (قِيَام from قوم). A final weak radical is written ى (هُدَى، جَنَى). After an augment
        # alef a weak radical becomes ء (قَائِم، سَمَآء). Alef standing for a weak radical is handled in _match.
        if letter in ("و", "ي"):
            return True
        return (last and letter == "ى") or (after_alef and letter in HAMZAS)
    return letter == radical


def _match(units: list[Unit], radicals: list[str]) -> list[str]:
    """All patterns produced by in-order assignments of radicals to units (augments elsewhere)."""
    templates = ["ف", "ع", "ل", "ل"]
    results: list[str] = []
    triliteral = len(radicals) == 3

    def rec(ui: int, ri: int, acc: list[Unit]) -> None:
        if ri == len(radicals):
            rest = units[ui:]
            if all(u.letter in AUGMENTS or u.letter in HAMZAS for u in rest):
                results.append(_render(acc + rest))
            return
        if ui >= len(units):
            return
        u = units[ui]
        radical = radicals[ri]
        last = ri == len(radicals) - 1
        after_alef = bool(acc) and acc[-1].letter == "ا"
        if _radical_matches(radical, u.letter, last, after_alef):
            vowel = u.vowel
            if (
                vowel == ""
                and (u.letter in WEAK or (radical == "ء" and u.letter == "ا"))
                and ui + 1 < len(units)
            ):
                # a weak radical written as a long vowel (حِين، صُورَة) is quiescent; so is a hamza radical
                # merged into a preceding hamza (آبَاء = أَأْبَاء)
                vowel = SUKUN
            rec(ui + 1, ri + 1, [*acc, Unit(templates[ri], vowel)])
        if radical in WEAK and u.letter == "ا" and last and ui + 1 == len(units):
            rec(ui + 1, ri + 1, [*acc, Unit(templates[ri], "")])  # final weak radical written ا (عَصَا، أَقْصَا)
        if radical in WEAK and u.letter == "ا" and triliteral and acc and acc[-1].letter == "ف" and ri == 1:
            # Hollow root, middle radical written as alef: بَاب، دَار are فَعَل; after a prefix the vowel moved
            # from the radical to the one before it (مَقَام = مَقْوَم → مَفْعَل).
            prefix = any(x.letter not in "فعل" for x in acc[:-1])
            head = [*acc[:-1], Unit("ف", SUKUN)] if prefix else acc
            rec(ui + 1, ri + 1, [*head, Unit("ع", FATHA)])
        if (
            radical in WEAK
            and u.letter == "ا"
            and last
            and ui + 1 < len(units)
            and units[ui + 1].letter == "ة"
        ):
            rec(ui + 1, ri + 1, [*acc, Unit(templates[ri], FATHA)])  # صَلَاة = صَلَوَة → فَعَلَة
        # a radical may also repeat (doubled middle/last radical expanded from shadda)
        if ri > 0 and acc and u.letter == units[ui - 1].letter and acc[-1].letter == templates[ri - 1]:
            rec(ui + 1, ri, [*acc, Unit(templates[ri - 1], u.vowel)])
        if u.letter in AUGMENTS or u.letter in HAMZAS:
            rec(ui + 1, ri, [*acc, u])

    rec(0, 0, [])
    return results


def _doubled(pattern: str, radicals: list[str]) -> str:
    """Undo assimilation in a doubled root (ع = ل): the vowel moved off the second radical."""
    if len(radicals) != 3 or radicals[1] != radicals[2]:
        return pattern
    # أَشَدّ = أَشْدَد → أَفْعَل; مَحِلّ → مَفْعِل (only after a prefix: حَقّ is a true فَعْل)
    pattern = re.sub("(?<=.)ف([َُِ])عْل", "فْع\\1ل", pattern)
    # دَابَّة = دَابِبَة → فَاعِلَة (the active-participle shape)
    return pattern.replace("فَاعْل", "فَاعِل")


KNOWN_NFC = {_canon(p) for p in KNOWN}
KNOWN4_NFC = {_canon(p) for p in KNOWN4}
SUFFIXES_CANON = tuple(_canon(x) for x in SUFFIXES)


def _strip_suffix(pattern: str, known: set[str]) -> tuple[str, str]:
    for suf in SUFFIXES_CANON:
        if pattern.endswith(suf) and pattern[: -len(suf)] in known:
            return pattern[: -len(suf)], suf
    return pattern, ""


def noun_pattern(lemma: str, radicals: list[str]) -> str | None:
    known = KNOWN4_NFC if len(radicals) == 4 else KNOWN_NFC
    final_ya_alef = _nfc(lemma).endswith("يَا")
    candidates = set()
    for p in _match(_units(lemma), radicals):
        if p.startswith("ء"):
            p = ("إ" if p[1:2] == KASRA else "أ") + p[1:]  # an initial augment hamza is written on its seat
        p = _doubled(p, radicals)
        if p.endswith("َت"):
            p = p[:-1] + "ة"  # the rasm writes some ة as an open ت (فَصِيلَت); the pattern uses ة
        if final_ya_alef and p.endswith("َا"):
            p = p[:-1] + "ى"  # after ي the rasm writes final ى as ا (دُنْيَا = فُعْلَى)
        base, suf = _strip_suffix(p, known)
        if base in known:
            candidates.add(base + suf)
    if len(candidates) == 1:
        return _nfc(candidates.pop())
    return None  # none, or ambiguous between several patterns → no claim


def verb_pattern(lemma: str, radicals: list[str], form: int | None) -> tuple[str | None, str | None]:
    """(pattern, note). Form I gets the middle radical's vowel only when that radical is sound."""
    if len(radicals) == 4:
        return VERB_FORM4_PATTERN.get(form or 1), None
    if form and form != 1:
        return VERB_FORM_PATTERN.get(form), None
    units = _units(lemma)
    sound_middle = (
        len(radicals) == 3 and radicals[1] not in WEAK and radicals[1] != radicals[2] and radicals[1] != "ء"
    )
    # Only a perfect-tense lemma shows the pattern's vowel: it starts with the first radical carrying a fatha
    # (عَلِمَ). Imperfect or truncated lemmas (يَعْلَمُ، لَقُ) carry the imperfect vowel, so no claim is made.
    if (
        sound_middle
        and len(units) == 3
        and (units[0].letter == radicals[0] or (radicals[0] == "ء" and units[0].letter in HAMZAS))
        and units[0].vowel == FATHA
        and units[1].letter == radicals[1]
        and _radical_matches(radicals[2], units[2].letter, last=True)
    ):
        pattern = {FATHA: "فَعَلَ", KASRA: "فَعِلَ", DAMMA: "فَعُلَ"}.get(units[1].vowel)
        if pattern:
            return pattern, None
    return None, "triliteral"


def _tagged_pattern(lemma: str, radicals: list[str], form: int, derivation: str) -> str:
    """The derivative's template, with its ending when the letters confirm it (كَافِرُون → فَاعِلُون)."""
    template = DERIVED[(form, derivation)]
    feminine = _units(lemma)[-1].letter == "ة"
    if form == 2 and derivation == "VN" and feminine:
        return "تَفْعِلَة"  # the second maṣdar of فَعَّلَ (تَذْكِرَة، تَزْكِيَة)
    matched = noun_pattern(lemma, radicals)
    if matched and _strip_suffix(_canon(matched), KNOWN_NFC)[0] == _canon(template):
        return matched
    # Deleted or changed letters (مُهْتَدُون) leave the plain template of the singular.
    return template + "َة" if feminine else template


def lemma_pattern(
    lemma: str, radicals: list[str] | None, pos: str, form: int | None, derivation: str | None
) -> dict[str, str] | None:
    """Pattern record for one lemma, or None when no layer is certain."""
    if not radicals:
        return None
    radicals = ["ء" if r in HAMZAS else r for r in radicals]  # the dataset spells a hamza radical ء
    if derivation and len(radicals) == 4:
        # The corpus form numbers are triliteral; a quadriliteral derivative is matched against KNOWN4 (مُفَعْلَل).
        p = noun_pattern(lemma, radicals)
        return {"pattern": p, "method": "match"} if p else None
    if derivation and (form or 1, derivation) in DERIVED:
        return {"pattern": _tagged_pattern(lemma, radicals, form or 1, derivation), "method": "tag"}
    if pos == "V":
        p, note = verb_pattern(lemma, radicals, form)
        if p:
            return {"pattern": p, "method": "verb-form"}
        if note == "triliteral":
            return {"pattern": "", "method": "verb-form-I"}
        return None
    p = noun_pattern(lemma, radicals)
    return {"pattern": p, "method": "match"} if p else None
