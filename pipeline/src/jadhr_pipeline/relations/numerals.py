"""Arabic number words as the wujūh books write them: «على خمسة أوجه», «على أربعة عشر وجها», «والثالث:»."""

from __future__ import annotations

import re
from functools import lru_cache

_UNITS = {
    "واحد": 1, "اثنين": 2, "اثني": 2, "اثنا": 2, "ثلاثة": 3, "ثلاث": 3, "أربعة": 4, "اربعة": 4, "أربع": 4,
    "خمسة": 5, "خمس": 5, "ستة": 6, "ست": 6, "سبعة": 7, "سبع": 7, "ثمانية": 8, "ثماني": 8, "ثمان": 8,
    "تسعة": 9, "تسع": 9, "عشرة": 10, "عشر": 10, "أحد": 1, "احد": 1, "إحدى": 1, "احدى": 1,
}  # fmt: skip
_TENS = {"عشرين": 20, "عشرون": 20, "ثلاثين": 30, "ثلاثون": 30}

_UNIT_RX = "|".join(sorted(map(re.escape, _UNITS), key=len, reverse=True))
_TENS_RX = "|".join(sorted(map(re.escape, _TENS), key=len, reverse=True))
# «على وجهين», «على خمسة أوجه», «على ثلاثة عشر وجها», «على أحد وعشرين وجها», «على عشرين وجها», «على 5 أوجه»
COUNT = re.compile(
    rf"على\s+(?:(?P<two>وجهين)|(?P<one>وجه\s+واحد)"
    rf"|(?P<num>(?:(?:{_UNIT_RX})\s+(?:عشر|و(?:{_TENS_RX})))|(?:{_TENS_RX})|(?:{_UNIT_RX})|\d{{1,2}})"
    rf"\s+(?:أوجه|اوجه|وجها|وجوه|وجه|أقسام|معان))"
)


def count_value(m: re.Match[str]) -> int | None:
    if m.group("two"):
        return 2
    if m.group("one"):
        return 1
    words = m.group("num").split()
    if words[0].isdigit():
        return int(words[0])
    if len(words) == 1:
        return _TENS.get(words[0]) or _UNITS.get(words[0])
    unit = _UNITS.get(words[0], 0)
    if words[1] == "عشر":
        return 10 + unit
    return unit + _TENS.get(words[1][1:], 0)


_ORD_UNITS = ["الحادي", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع"]


def ordinal_words(k: int) -> list[str]:
    """Ways the k-th sense is introduced (without the leading و or ف)."""
    if k == 1:
        return [
            "أحدها", "أحدهما", "احدها", "احدهما", "الأول", "الاول",
            # al-Dāmaghānī «فوجه منها»، and its typings «فرجه منها»، «فوجه مها»، «فوجهمنها»
            "فوجه منها", "فوجه منهما", "وجه منها", "فرجه منها", "فوجه مها", "فوجهمنها", "فوجه منه", "فوجد منها",
        ]  # fmt: skip
    if k == 2:
        return ["الثاني", "الثانى", "الثانية"]
    if 3 <= k <= 9:
        return [_ORD_UNITS[k - 1], _ORD_UNITS[k - 1] + "ة"]  # «والخامسة» is printed for «والخامس»
    if k == 10:
        return ["العاشر", "العاشرة"]
    if 11 <= k <= 19:
        u = _ORD_UNITS[k - 11]
        alts = [f"{u} عشر", f"{u} عشرة", f"{u}ة عشرة"]
        if u.endswith("ي"):
            alts.append(f"{u[:-1]}ى عشر")  # «الحادى عشر», «الثانى عشر»
        return alts
    if k == 20:
        return ["العشرون", "العشرين"]
    if 21 <= k <= 29:
        return [f"{_ORD_UNITS[k - 21]} والعشرون", f"{_ORD_UNITS[k - 21]} والعشرين"]
    if k == 30:
        return ["الثلاثون"]
    return []


@lru_cache(maxsize=256)
def ordinal_rx(k: int, loose: bool = False) -> re.Pattern[str]:
    """The k-th sense marker: at a paragraph start, or anywhere when a colon follows («والثاني:»).

    ``loose`` (al-Dāmaghānī, whose typing loses punctuation and paragraphs half-way through): also a bare
    ordinal between spaces, or run into the previous word («ونحوه كثيرالخامس الثقل»)."""
    alts = "|".join(re.escape(w) for w in ordinal_words(k))
    tail = r"(?!\s*(?:عشر|والعشر))" if k < 10 else ""
    if loose:
        # «… بالوجه منها: الخليل» — «فوجه» lost, «منها:» left
        glued = rf"|(?<=[ء-ي])(?:{alts}){tail}(?=\s)" if k > 1 else r"|(?<=\s)منها(?=:)"
        return re.compile(rf"(?:(?<=[\s.،:؛\"])|^)[\[(]?(?:و|ف)?(?:{alts}){tail}[\])]?(?=[\s:،.\-])" + glued)
    # the editor sometimes brackets a restored or doubtful marker: «[أحدها]:», «(والثاني):», «(والسادس: …)»
    return re.compile(
        rf"(?:(?<=\n)|^)[\[(]?(?:و|ف)?(?:{alts}){tail}[\])]?(?=[\s:،.\-])"
        rf"|(?<![^\s.،:؛)\]])[\[(]?(?:و|ف)?(?:{alts}){tail}[\])]?\s*(?=:)"
    )
