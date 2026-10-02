"""Verse counts by counting system, read from the opening sentence of the two classical counting texts
the Tafsir Center prints for each sūra (``surahAyahCount0`` and ``surahAyahCount1``).

Both state the count in words and name the schools («وهي: مئتا آيةٍ وثمانون وخمسُ آياتٍ في المدنيين
والمكي والشامي، وستٌّ في الكوفي، وسبعٌ في البصري»; «وآيها: مائتان وثمانون وخمس: حجازي وشامي، وست:
كوفي، وسبع: بصري»). A later clause gives only the part of the number that changes («وستٌّ» replaces
the units, «وثلاثون» the tens and units).

This is extraction, not judgement: a sūra gets structured counts only when its sentence parses
completely, and the result is checked twice — the Kūfī count must equal the verse count of our mushaf
(Ḥafṣ follows the Kūfī count) and, where both texts parse, they must agree on every school. Anything
else stays null with the reason; the two texts are always kept verbatim on the card.

The six schools are al-Madanī al-awwal, al-Madanī al-akhīr, al-Makkī, al-Kūfī, al-Baṣrī and al-Shāmī
(the second text sometimes splits al-Shāmī into Dimashqī and Ḥimṣī: Dimashqī is taken as al-Shāmī, a
Ḥimṣī-only figure is not one of the six and is skipped).
"""

from __future__ import annotations

import re
from typing import Any

from jadhr_arabic import normalize

SYSTEMS = ("madani1", "madani2", "makki", "kufi", "basri", "shami")
SYSTEM_AR = {
    "madani1": "المدني الأول",
    "madani2": "المدني الأخير",
    "makki": "المكي",
    "kufi": "الكوفي",
    "basri": "البصري",
    "shami": "الشامي",
}

_UNITS = {
    "واحد": 1, "واحده": 1, "احد": 1, "احدي": 1,
    "اثنان": 2, "اثنتان": 2, "اثنا": 2, "اثنتا": 2, "اثنين": 2, "اثنتين": 2, "ثنتان": 2, "ثنتين": 2,
    "ايتان": 2, "ايتين": 2,
    "ثلاث": 3, "ثلاثه": 3, "اربع": 4, "اربعه": 4, "خمس": 5, "خمسه": 5, "ست": 6, "سته": 6,
    "سبع": 7, "سبعه": 7, "ثمان": 8, "ثماني": 8, "ثمانيه": 8, "تسع": 9, "تسعه": 9,
    "عشر": 10, "عشره": 10,
}  # fmt: skip
_TENS = {
    "عشرون": 20, "عشرين": 20, "ثلاثون": 30, "ثلاثين": 30, "اربعون": 40, "اربعين": 40,
    "خمسون": 50, "خمسين": 50, "ستون": 60, "ستين": 60, "سبعون": 70, "سبعين": 70,
    "ثمانون": 80, "ثمانين": 80, "تسعون": 90, "تسعين": 90,
}  # fmt: skip
_HUNDREDS = {"ميه": 100, "مايه": 100, "ميتان": 200, "ميتا": 200, "مايتان": 200, "مايتا": 200, "ميتين": 200}
_VERSE = {"ايه", "ايات", "اي"}
_SKIP = {"في", "عدد", "وهي", "هي", "وهى", "ايها", "وايها", "اهل", "و"}
_ALL = re.compile(r"(جميع العدد|متفق|متفقه|بلا خلاف|ليس فيها اختلاف|لا اختلاف فيها)")
_REST = {"الباقين", "الباقي", "الباقون", "الباقيين"}


_AND_ONE = "+ايه"  # «وآيةٌ»: "and one verse" (a bare «آيةً» after a number is only the counted noun)


def _strip_wa(w: str) -> str:
    if w == "وايه":
        return _AND_ONE
    known = (
        _UNITS.keys() | _TENS.keys() | _HUNDREDS.keys() | _VERSE | _REST | {"الاول", "الاخير", "فيه", "فيهما"}
    )
    if w.startswith("و") and len(w) > 2 and (w[1:] in known or _school(w[1:], "") is not None):
        return w[1:]
    return w


def _school(w: str, nxt: str) -> tuple[list[str], int] | None:
    """(systems, words consumed) for a school name at this word, else None."""
    if w in ("المدني", "مدني") and nxt in ("الاول", "اول"):
        return ["madani1"], 2
    if w in ("المدني", "مدني") and nxt in ("الاخير", "اخير", "الاخر"):
        return ["madani2"], 2
    if w in ("المدنيين", "المدنيان", "مدنيان", "مدنيين", "المدني", "مدني"):
        return ["madani1", "madani2"], 1
    if w in ("المكي", "مكي"):
        return ["makki"], 1
    if w in ("الكوفي", "كوفي"):
        return ["kufi"], 1
    if w in ("البصري", "بصري"):
        return ["basri"], 1
    if w in ("الشامي", "شامي", "الدمشقي", "دمشقي"):
        return ["shami"], 1
    if w in ("حجازي", "الحجازي", "حرمي", "الحرمي", "الحرميين", "الحجازيين"):
        return ["madani1", "madani2", "makki"], 1
    if w in ("عراقي", "العراقي", "العراقيين", "عراقيين"):
        return ["kufi", "basri"], 1
    if w in ("حمصي", "الحمصي"):
        return [], 1
    if w == "الاول":  # «كوفي والأول»: al-Madanī al-awwal
        return ["madani1"], 1
    if w == "الاخير":
        return ["madani2"], 1
    return None


def _schools_run(ws: list[str], i: int) -> tuple[list[str], int]:
    """Consecutive school names from position i («كوفي وحمصي») → (systems, next position)."""
    out: list[str] = []
    j = i
    while j < len(ws):
        sch = _school(ws[j], ws[j + 1] if j + 1 < len(ws) else "")
        if sch is None:
            break
        out += sch[0]
        j += sch[1]
    return out, j


def _number(ws: list[str], i: int) -> tuple[dict[str, int] | None, int]:
    """Read number words (with «آية/آيات» between them) from position i. «عشر وست» is sixteen;
    «خمسون وآيةٌ» fifty-one; «وآيةٌ» alone, one."""
    h = u = t = 0
    seen = False
    j = i
    while j < len(ws):
        w = ws[j]
        if w in _HUNDREDS:
            h, seen = _HUNDREDS[w], True
        elif w in _TENS:
            t, seen = _TENS[w], True
        elif w in _UNITS:
            val = _UNITS[w]
            if val < 10 and j + 1 < len(ws) and ws[j + 1] in ("عشر", "عشره"):
                val += 10
                j += 1
            u = 10 + val if (u == 10 and val < 10) else val
            seen = True
        elif w == _AND_ONE:
            if not u:
                u, seen = 1, True
        elif w in _VERSE:
            pass
        else:
            break
        j += 1
    return ({"h": h, "u": u, "t": t} if seen else None), j


def _value(n: dict[str, int]) -> int:
    return n["h"] + n["t"] + n["u"]


def _apply(base: dict[str, int], part: dict[str, int]) -> dict[str, int]:
    """A later clause replaces the components from its highest one down. A bare unit after a teen
    keeps the teen (ثماني عشرة … وتسع = 19), and after a lone «عشر» makes one (عشر … وإحدى = 11);
    after «مئة وعشر» it replaces the ten (مئة وعشر … وتسع = 109)."""
    if part["h"]:
        return dict(part)
    if part["t"]:
        return {"h": base["h"], "t": part["t"], "u": part["u"]}
    u = part["u"]
    if u < 10 and (base["u"] > 10 or (base["u"] == 10 and not base["h"] and not base["t"])):
        u += 10
    return {"h": base["h"], "t": base["t"], "u": u}


def parse_counts(sentence: str) -> tuple[dict[str, int] | None, str]:
    """(counts by system, status) for one counting sentence."""
    t = normalize(re.sub(r"[\[\]]", " ", sentence))
    ws = [_strip_wa(w) for w in re.sub(r"[^ء-ي\s]", " ", t).split()]
    if _ALL.search(t) and "الا" not in ws and not any(_school(w, "") for w in ws):
        for k in range(len(ws)):
            n, _ = _number(ws, k)
            if n:
                return {x: _value(n) for x in SYSTEMS}, "same-in-all"
        return None, "no number"
    counts: dict[str, int] = {}
    base: dict[str, int] | None = None
    excluded: list[str] = []
    group: list[str] = []
    i = 0

    def assign(systems: list[str]) -> None:
        for x in systems:
            if x not in counts and base is not None:
                counts[x] = _value(base)

    while i < len(ws):
        if len(counts) == len(SYSTEMS):
            break  # everything is stated; the sentence goes on about other things
        w = ws[i]
        nxt = ws[i + 1] if i + 1 < len(ws) else ""
        n, j = _number(ws, i)
        if n is not None:
            base = n if base is None else _apply(base, n)
            group = []
            i = j
            continue
        sch = _school(w, nxt)
        if sch is not None:
            if base is None:
                return None, f"school before any number at «{w}»"
            group += sch[0]
            assign(sch[0])
            i += sch[1]
            continue
        if w in _REST:
            assign([x for x in SYSTEMS if x not in counts])
            i += 1
            continue
        if w == "غير":
            run, j = _schools_run(ws, i + 1)
            if j == i + 1:
                return None, f"unknown school after «غير»: «{nxt}»"
            excluded = run
            assign([x for x in SYSTEMS if x not in excluded])
            i = j
            continue
        if w in ("فيه", "فيهما", "هو", "لهما") and excluded:
            assign(excluded)
            i += 1
            continue
        if w == "الا" and nxt in ("الاول", "الاخير"):
            drop = "madani1" if nxt == "الاول" else "madani2"
            if drop in group and counts.get(drop) is not None:
                del counts[drop]
            excluded = [drop]
            i += 2
            continue
        if w in _SKIP:
            i += 1
            continue
        return None, f"unknown word «{w}»"
    if not counts and base is not None and not group and not excluded:
        return {x: _value(base) for x in SYSTEMS}, "single-number"  # «وآيها: خمس.»
    missing = [x for x in SYSTEMS if x not in counts]
    if missing:
        return None, "schools not stated: " + ", ".join(missing)
    return counts, "parsed"


def opening_sentence(text: str | None, style: str) -> str | None:
    """The sentence that states the count: text a — its first line up to the first full stop;
    text b — the line that starts «وآيها»."""
    if not text:
        return None
    if style == "a":
        return text.strip().split("\n")[0].split(".")[0]
    for line in text.split("\n"):
        if re.match(r"^\s*\[?\s*وآي", line):
            return line.strip()
    return None


def verse_counts(text_a: str | None, text_b: str | None, mushaf_count: int) -> dict[str, Any]:
    """Counts by school from each text separately (each is its own attributed source), with checks.
    A text's counts are kept only when its Kūfī figure equals the mushaf's verse count.

    status: ``agree`` (both parsed, checked and identical) · ``one-text`` (only one parsed and checked)
    · ``disagree`` (both parsed and checked, and they differ — both are kept, the difference listed)
    · ``unparsed`` (neither text yields checked counts)."""
    a_sent, b_sent = opening_sentence(text_a, "a"), opening_sentence(text_b, "b")
    a, a_status = parse_counts(a_sent) if a_sent else (None, "no sentence")
    b, b_status = parse_counts(b_sent) if b_sent else (None, "no sentence")
    checks: dict[str, Any] = {"text_a": a_status, "text_b": b_status}
    if a is not None and a["kufi"] != mushaf_count:
        checks["text_a"] = f"kufi {a['kufi']} ≠ mushaf {mushaf_count}"
        a = None
    if b is not None and b["kufi"] != mushaf_count:
        checks["text_b"] = f"kufi {b['kufi']} ≠ mushaf {mushaf_count}"
        b = None
    diff = {k: [a[k], b[k]] for k in SYSTEMS if a[k] != b[k]} if a and b else None
    status = (
        "unparsed"
        if a is None and b is None
        else "one-text"
        if a is None or b is None
        else "disagree"
        if diff
        else "agree"
    )
    return {"a": a, "b": b, "status": status, "differences": diff or None, "checks": checks}
