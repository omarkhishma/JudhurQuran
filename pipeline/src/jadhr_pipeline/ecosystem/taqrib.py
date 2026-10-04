"""Ibn Ḥajar's Taqrīb al-Tahdhīb (d. 852), OpenITI's version of ʿAwwāma's edition (JK000121): the narrators of the
Six Books, one entry each, read into what the hadith pages and the narrator linking need (PLAN P11.2b, research 21 §3).

Each entry keeps Ibn Ḥajar's words verbatim (his edition's number, the entry as printed, the page and milestone markers
taken out); beside them, read by rule from those words and never written by us:

* the verdict as he words it («صدوق له أوهام»), and its rank on his own twelve-step scale — the scale and its terms are
  his introduction's (``RANKS``), quoted where a page explains a rank;
* the ṭabaqa, his «من العاشرة»;
* the year of death: his words («مات سنة ست وثلاثين»), and the year they mean by the rule his introduction states — the
  first and second ṭabaqāt before 100, the third to the eighth after 100, the ninth on after 200, other cases spelt
  out by him (a year written in full or in figures is taken as written);
* the books that narrate from him, his sigla (``SIGLA``)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import normalize

HEADER_END = "#META#Header#End#"
_NOISE = re.compile(r"PageV\d+P\d+|(?<![A-Za-z])ms\d+(?![A-Za-z])|\|")
_ENTRY = re.compile(r"^### (\${1,3}) ?(.*)$")

# the sigla his introduction lists, each with the book it names
SIGLA = {
    "خ": "صحيح البخاري",
    "خت": "صحيح البخاري، تعليقا",
    "بخ": "الأدب المفرد للبخاري",
    "عخ": "خلق أفعال العباد للبخاري",
    "ر": "جزء القراءة للبخاري",
    "ي": "رفع اليدين للبخاري",
    "م": "صحيح مسلم",
    "د": "سنن أبي داود",
    "مد": "المراسيل لأبي داود",
    "صد": "فضائل الأنصار لأبي داود",
    "خد": "الناسخ لأبي داود",
    "قد": "القدر لأبي داود",
    "ف": "التفرد لأبي داود",
    "ل": "المسائل لأبي داود",
    "كد": "مسند مالك لأبي داود",
    "ت": "جامع الترمذي",
    "تم": "الشمائل للترمذي",
    "س": "سنن النسائي",
    "عس": "مسند علي للنسائي",
    "كن": "مسند مالك للنسائي",
    "ق": "سنن ابن ماجه",
    "فق": "التفسير لابن ماجه",
    "ع": "الستة",
    "4": "الأربعة سوى الشيخين",
    "تمييز": "ليست له رواية عندهم؛ ذكر ليتميز عن غيره",
}
# which collections each siglum covers, for the narrator linking: «ع» all six, «4» the four Sunan
BOOKS_OF = {
    "خ": {"bukhari"},
    "خت": {"bukhari"},
    "م": {"muslim"},
    "د": {"abudawud"},
    "ت": {"tirmidhi"},
    "س": {"nasai"},
    "ق": {"ibnmajah"},
    "ع": {"bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah"},
    "4": {"abudawud", "tirmidhi", "nasai", "ibnmajah"},
}

ORDINALS = {
    "الاولي": 1,
    "الثانيه": 2,
    "الثالثه": 3,
    "الرابعه": 4,
    "الخامسه": 5,
    "السادسه": 6,
    "السابعه": 7,
    "الثامنه": 8,
    "التاسعه": 9,
    "العاشره": 10,
    "الحاديه": 11,
    "الثانيه عشره": 12,
}

# his twelve ranks (the introduction): the first words of a verdict, longest first, and the rank they open
RANKS: list[tuple[tuple[str, ...], int]] = sorted(
    [
        (tuple(normalize(w) for w in phrase.split()), rank)
        for phrase, rank in [
            ("صحابي", 1),
            ("صحابية", 1),
            ("له صحبة", 1),
            ("لها صحبة", 1),
            ("له رؤية", 1),
            ("من كبار الصحابة", 1),
            ("من صغار الصحابة", 1),
            ("من الصحابة", 1),
            ("الصحابي", 1),
            ("الصحابية", 1),
            # a caliph and a Mother of the Believers are Companions, as he calls them
            ("أمير المؤمنين", 1),
            ("أم المؤمنين", 1),
            ("ثقة ثقة", 2),
            ("ثقة حافظ", 2),
            ("ثقة ثبت", 2),
            ("ثقة متقن", 2),
            ("ثقة حجة", 2),
            ("ثقة إمام", 2),
            ("ثقة فقيه", 3),
            ("ثقة", 3),
            ("متقن", 3),
            ("ثبت", 3),
            ("عدل", 3),
            ("صدوق سيء الحفظ", 5),
            ("صدوق يهم", 5),
            ("صدوق له أوهام", 5),
            ("صدوق يخطىء", 5),
            ("صدوق يخطئ", 5),
            ("صدوق ربما وهم", 5),
            ("صدوق تغير", 5),
            ("صدوق اختلط", 5),
            ("صدوق رمي", 5),
            ("صدوق", 4),
            ("لا بأس به", 4),
            ("ليس به بأس", 4),
            ("مقبول", 6),
            ("لين الحديث", 6),
            ("لين", 6),
            ("مستور", 7),
            ("مجهول الحال", 7),
            ("ضعيف", 8),
            ("مجهول", 9),
            ("متروك", 10),
            ("واهي الحديث", 10),
            ("ساقط", 10),
            ("متهم بالكذب", 11),
            ("اتهم", 11),
            ("كذاب", 12),
            ("كذبوه", 12),
            ("وضاع", 12),
        ]
    ],
    key=lambda x: -len(x[0]),
)

_DESCRIBES = frozenset(
    normalize(w)
    for w in [
        "الفقيه",
        "الحافظ",
        "متفق",
        "مشهور",
        "المشهور",
        "الإمام",
        "إمام",
        "نزيل",
        "قاضي",
        "صاحب",
        "الصحابي",
        "الصحابية",
        "حليف",
    ]
)
_UNITS = {
    "واحد": 1,
    "احدي": 1,
    "احد": 1,
    "اثنتين": 2,
    "اثنين": 2,
    "اثنتي": 2,
    "اثني": 2,
    "ثلاث": 3,
    "ثلاثه": 3,
    "اربع": 4,
    "اربعه": 4,
    "خمس": 5,
    "خمسه": 5,
    "ست": 6,
    "سته": 6,
    "سبع": 7,
    "سبعه": 7,
    "ثمان": 8,
    "ثماني": 8,
    "ثمانيه": 8,
    "تسع": 9,
    "تسعه": 9,
}
_TENS = {
    "عشر": 10,
    "عشره": 10,
    "عشرين": 20,
    "ثلاثين": 30,
    "اربعين": 40,
    "خمسين": 50,
    "ستين": 60,
    "سبعين": 70,
    "ثمانين": 80,
    "تسعين": 90,
}
_HUNDREDS = {"ماءه": 100, "مايه": 100, "ماه": 100, "مائه": 100, "ماءتين": 200, "مايتين": 200, "مائتين": 200}


@dataclass
class Entry:
    number: int | None  # his edition's number; None for a cross-reference («$$$»)
    kind: str  # entry | see
    text: str  # verbatim, markers out
    name: str  # the words before his verdict
    verdict: str | None  # his verdict as worded, up to the ṭabaqa
    rank: int | None
    tabaqa: int | None
    tabaqa_rule: str | None  # written | companion
    death_text: str | None
    death_ah: int | None
    death_rule: str | None  # written | century-by-tabaqa
    sigla: list[str] = field(default_factory=list)

    def row(self) -> dict[str, Any]:
        return self.__dict__.copy()


def _number(words: list[str]) -> tuple[int | None, bool]:
    """An Arabic number in words («ست وثلاثين», «إحدى عشرة», «مائتين») or figures; and whether it holds its
    hundreds."""
    total = 0
    hundreds = False
    seen = False
    skip = False
    for w in words:
        if skip:
            # «ثلاث أو أربع وسبعين»: the first reading, the other said in his words
            skip = False
            continue
        if w == "او" and seen:
            skip = True
            continue
        w = w.removeprefix("و")
        if w.isdigit():
            return int(w), int(w) >= 100
        if w in _UNITS:
            total += _UNITS[w]
        elif w in _TENS:
            total += _TENS[w]
        elif w in _HUNDREDS:
            total += _HUNDREDS[w]
            hundreds = True
        elif w.endswith(("ماءه", "مايه", "مائه")) and w[:-4] in _UNITS:
            total += _UNITS[w[:-4]] * 100
            hundreds = True
        else:
            break
        seen = True
    return (total if seen else None), hundreds


def _death(norm_words: list[str], tabaqa: int | None) -> tuple[int | None, str | None, int | None]:
    """The year after «مات سنة», by Ibn Ḥajar's rule; and where the phrase starts (word index)."""
    for i in range(len(norm_words) - 1):
        verb = norm_words[i][1:] if norm_words[i][:1] in ("و", "ف") else norm_words[i]
        # «مات سنة …», «استشهد في ذي الحجة سنة …», «مات في رجب سنة …»
        at = next((k for k in range(i + 1, min(i + 6, len(norm_words))) if norm_words[k] == "سنه"), None)
        if verb in ("مات", "ماتت", "قتل", "قتلت", "استشهد") and at is not None:
            n, full = _number(norm_words[at + 1 : at + 6])
            if n is None:
                return None, None, i
            if n < 10 and not full:
                # «سنة سبع وقيل سنة ثمان وقيل تسع وخمسين»: the tens the alternatives end on are the first's too
                after = norm_words[at + 2 : at + 14]
                if any(w in ("وقيل", "قيل", "او") for w in after[:3]):
                    tens = next(
                        (_TENS[w.removeprefix("و")] for w in after if w.removeprefix("و") in _TENS), 0
                    )
                    n += tens
            if full:
                return n, "written", i
            if tabaqa is None:
                return None, None, i
            century = 0 if tabaqa <= 2 else 100 if tabaqa <= 8 else 200
            return n + century, "century-by-tabaqa", i
    return None, None, None


def parse(raw: str) -> list[Entry]:
    body = raw.split(HEADER_END, 1)[1]
    blocks: list[tuple[str, str]] = []
    for line in body.splitlines():
        m = _ENTRY.match(line)
        if m:
            blocks.append((m.group(1), m.group(2)))
        elif line.startswith("~~") and blocks:
            mark, text = blocks[-1]
            blocks[-1] = (mark, text + " " + line[2:])
        elif line.startswith(("### ", "# ")):
            blocks.append(("", ""))
    out = []
    for mark, text in blocks:
        if mark not in ("$", "$$", "$$$"):
            continue
        text = re.sub(r"\s+", " ", _NOISE.sub(" ", text)).strip()
        number = None
        # «$» the men, «$$» the women's section (numbered on, from 8525), «$$$» a cross-reference
        if mark in ("$", "$$"):
            m = re.match(r"(\d+)\s+(.*)$", text)
            if not m:
                continue
            number, text = int(m.group(1)), m.group(2)
        out.append(_entry(number, "see" if mark == "$$$" else "entry", text))
    return out


def _entry(number: int | None, kind: str, text: str) -> Entry:
    words = text.split()
    norm = [normalize(w) for w in words]
    # the sigla at the end
    sigla: list[str] = []
    while words and words[-1] in SIGLA:
        sigla.insert(0, words.pop())
        norm.pop()
    # the ṭabaqa: «من الثانية عشرة», «من العاشرة»
    tabaqa = None
    tabaqa_rule = None
    t_at = None
    for i in range(len(norm) - 1):
        # «من العاشرة», «من الثانية عشرة», «من كبار التاسعة», «من صغار الثالثة», «من رؤوس الطبقة الثامنة»
        k = i + 1
        while (
            k < len(norm)
            and k - i <= 3
            and norm[k] in ("كبار", "صغار", "اوساط", "اواسط", "رووس", "روس", "الطبقه")
        ):
            k += 1
        if norm[i] == "من" and k < len(norm) and norm[k] in ORDINALS:
            tabaqa = 12 if " ".join(norm[k : k + 2]) == "الثانيه عشره" else ORDINALS[norm[k]]
            if norm[k] == "الحاديه":
                tabaqa = 11
            tabaqa_rule = "written"
            t_at = i
            break
    # the verdict: the first of his rank terms after the name
    rank = None
    v_at = None
    for i in range(1, len(norm)):
        for phrase, r in RANKS:
            if tuple(norm[i : i + len(phrase)]) == phrase:
                rank, v_at = r, i
                break
        if v_at is not None:
            break
    if tabaqa is None and rank == 1:
        # «فالأولى: الصحابة» (his introduction): a Companion is of the first
        tabaqa, tabaqa_rule = 1, "companion"
    death_ah, rule, d_at = _death(norm, tabaqa)
    ends = [x for x in (v_at, t_at, d_at) if x is not None]
    # a description never part of a name ends it too («… الزهري أبو بكر الفقيه الحافظ متفق على جلالته»)
    ends += [
        i
        for i in range(2, len(norm))
        if norm[i] in _DESCRIBES or norm[i : i + 2] in (["ام", "المومنين"], ["امير", "المومنين"])
    ][:1]
    name_end = min(ends) if ends else len(words)
    verdict = " ".join(words[v_at : t_at if t_at and t_at > v_at else (d_at or len(words))]) if v_at else None
    death_text = None
    if d_at is not None:
        stop = len(words)
        death_text = " ".join(words[d_at:stop])
    return Entry(
        number=number,
        kind=kind,
        text=text,
        name=" ".join(words[:name_end]),
        verdict=verdict,
        rank=rank,
        tabaqa=tabaqa,
        tabaqa_rule=tabaqa_rule,
        death_text=death_text,
        death_ah=death_ah,
        death_rule=rule,
        sigla=sigla,
    )


def introduction(raw: str) -> list[dict[str, Any]]:
    """His introduction's own definitions, verbatim: the twelve ranks («فأما المراتب»), the twelve ṭabaqāt («وأما
    الطبقات») and the rule for the years of death («وذكرت وفاة …») — quoted where a page explains a rank, a ṭabaqa
    or a year read by that rule."""
    body = raw.split(HEADER_END, 1)[1]
    paragraphs: list[str] = []
    for line in body.splitlines():
        if line.startswith("# "):
            paragraphs.append(line[2:])
        elif line.startswith("~~") and paragraphs:
            paragraphs[-1] += " " + line[2:]
        elif line.startswith("### $"):
            break
    clean = [re.sub(r"\s+", " ", _NOISE.sub(" ", p)).strip() for p in paragraphs]
    start = next(i for i, p in enumerate(clean) if p.startswith("فأولها"))
    middle = next(i for i, p in enumerate(clean) if p.startswith("وأما الطبقات"))
    death = next(i for i, p in enumerate(clean) if p.startswith("وذكرت وفاة"))
    ranks, tabaqat = clean[start:middle], clean[middle + 1 : death]
    if len(ranks) != 12 or len(tabaqat) != 12:
        raise ValueError(f"the introduction: {len(ranks)} ranks and {len(tabaqat)} ṭabaqāt, not 12 and 12")
    return (
        [{"scale": "rank", "n": n, "text": t} for n, t in enumerate(ranks, start=1)]
        + [{"scale": "tabaqa", "n": n, "text": t} for n, t in enumerate(tabaqat, start=1)]
        + [{"scale": "death", "n": 1, "text": clean[death]}]
    )
