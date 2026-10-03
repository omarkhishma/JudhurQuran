"""Where each particle entry, its heading and its numbered senses lie in a cleaned text.

Everything here returns spans into the cleaned text (``Source.text``); nothing copies or edits it.

Numbered lists. Both works number what a particle does with ordinals — «أحدها … والثاني …» (Ibn Hishām,
mostly at a paragraph start), «الأول: … الثاني: …» (al-Murādī, with a colon), sometimes after a noun
(«الوجه الثالث», «المسألة الثانية», «التنبيه الثاني») or after the edition's marginal number («13
والثالث عشر»). A marker counts only at a paragraph start or before a colon, so an ordinal in running prose
is not read as one. Markers are read in order with a stack:

* an ordinal ``k > 1`` continues the most recent open list of its gender whose last item is ``k-1``
  (closing lists opened after it) — «والثانية» in «أحدها الفاعل … والثانية متعدية لاثنين» is not the second
  of «أحدها» — preferring a list whose markers are written alike (with or without a following colon:
  «الأول: … وهي قسمان: أحدهما … والآخر … الثاني:»); if none is, one whose last item is ``k-2`` (the text
  skipped an ordinal: noted) — up to ``k-4`` for a compound ordinal («الحادي والعشرون» after «الثامن
  عشر»); otherwise it is left in the text and noted;
* a first ordinal opens a list — inside the current item when it stands in the same paragraph («ولها
  قسمان: الأول: أن تكون حرف جر. وذكروا له معاني: الأول: المجاوزة»), otherwise beside the current list,
  which stays open: a list may go on after another one inside its item («… الأول: … تنبيه … أحدها …
  والثاني … الثاني: …»).

A sense's text runs from its marker to the next marker or sub-heading paragraph (تنبيه، مسألة، فصل، فائدة
…) or the end of the entry, so rows never overlap; nesting is kept as ``parent``. A list's stated count is the last count statement («على أربعة
أوجه», «وله تسعة معان», «ولها قسمان») between the previous marker (or the entry's start) and its first
marker.
"""

from __future__ import annotations

import bisect
import re
from dataclasses import dataclass, field
from functools import lru_cache

from ..relations.numerals import ordinal_words

# --- count statements -------------------------------------------------------------------------------
_UNITS = {
    "واحد": 1, "أحد": 1, "احد": 1, "إحدى": 1, "احدى": 1, "اثنين": 2, "اثني": 2, "اثنا": 2, "اثنى": 2,
    "اثنان": 2, "اثنتان": 2, "اثنتين": 2, "اثنتي": 2,
    "ثلاثة": 3, "ثلاث": 3, "أربعة": 4, "اربعة": 4, "أربع": 4, "خمسة": 5, "خمس": 5, "ستة": 6, "ست": 6,
    "سبعة": 7, "سبع": 7, "ثمانية": 8, "ثماني": 8, "ثمان": 8, "تسعة": 9, "تسع": 9, "عشرة": 10, "عشر": 10,
}  # fmt: skip
# the typing sometimes ends ة as ه («على ثلاثه أوجه»)
_UNITS |= {k[:-1] + "ه": v for k, v in _UNITS.items() if k.endswith("ة")}
_TENS = {"عشرين": 20, "عشرون": 20, "ثلاثين": 30, "ثلاثون": 30}
_U = "|".join(sorted(map(re.escape, _UNITS), key=len, reverse=True))
_T = "|".join(sorted(map(re.escape, _TENS), key=len, reverse=True))
# Nouns a list is counted in: senses (أوجه، معان), divisions (أقسام، أنواع، أضرب), rulings (أحكام، مسائل،
# أمور، شروط), views (مذاهب، أقوال), and the like.
_COUNTED = (
    "أوجه|اوجه|وجوه|وجها|معان|معاني|معنى|أقسام|اقسام|قسما|أنواع|انواع|نوعا|أضرب|اضرب|ضروب|ضربا|مواضع|"
    "موضعا|أحكام|احكام|حكما|أمور|امور|أمرا|شروط|شرائط|شرطا|مسائل|مذاهب|أقوال|اقوال|قولا|أحوال|حالات|"
    "لغات|أشياء|فوائد|تنبيهات|أوجها"
)
_DUAL = {
    "وجهين": "وجه", "وجهان": "وجه", "معنيين": "معنى", "معنيان": "معنى", "قسمين": "قسم", "قسمان": "قسم",
    "ضربين": "ضرب", "ضربان": "ضرب", "نوعين": "نوع", "نوعان": "نوع", "شرطين": "شرط", "شرطان": "شرط",
    "حكمين": "حكم", "حكمان": "حكم", "أمرين": "أمر", "أمران": "أمر", "قولين": "قول", "قولان": "قول",
    "مذهبين": "مذهب", "مذهبان": "مذهب", "موضعين": "موضع", "موضعان": "موضع", "لغتين": "لغة",
    "لغتان": "لغة", "تنبيهان": "تنبيه", "مسألتان": "مسألة", "مسألتين": "مسألة",
}  # fmt: skip
COUNT = re.compile(
    rf"(?<![ء-ي])(?:(?P<dual>{'|'.join(_DUAL)})"
    rf"|(?:ل|و?له|و?لها)?\s*(?P<num>(?:(?:{_U})\s+(?:عشر|عشرة|و(?:{_T})))|(?:{_T})|(?:{_U}))\s+(?P<noun>{_COUNTED}))"
    r"(?![ء-ي])"
)


def count_value(m: re.Match[str]) -> int:
    if m.group("dual"):
        return 2
    words = m.group("num").split()
    if len(words) == 1:
        return _TENS.get(words[0]) or _UNITS[words[0]]
    unit = _UNITS[words[0]]
    if words[1] in ("عشر", "عشرة"):
        return 10 + unit
    return unit + _TENS[words[1][1:]]


def count_noun(m: re.Match[str]) -> str:
    return m.group("noun") or m.group("dual")


# --- ordinal markers --------------------------------------------------------------------------------
# Nouns that may stand before an ordinal («الوجه الثالث», «المسألة الثانية»).
MARKER_NOUNS = (
    "الوجه",
    "المعنى",
    "القسم",
    "النوع",
    "الضرب",
    "الأمر",
    "المسألة",
    "التنبيه",
    "الفصل",
    "الحكم",
    "الموضع",
    "الشرط",
    "القول",
    "المذهب",
    "الحال",
)
_NOUN_RX = "|".join(MARKER_NOUNS)
_FIRST = [
    "أحدها", "أحدهما", "احدها", "احدهما", "إحداها", "إحداهما", "احداها", "احداهما", "الأول", "الاول",
    "أولها", "أولاها",
]  # fmt: skip
_FEMININE_FIRST = {"إحداها", "إحداهما", "احداها", "احداهما", "الأولى", "الاولى", "أولاها"}
_POSSESSIVE_STEMS = ["ثاني", "ثالث", "رابع", "خامس", "سادس", "سابع", "ثامن", "تاسع", "عاشر"]


def is_feminine(ordinal: str) -> bool:
    """«الثانية», «إحداهما», «الأولى» — the ordinal of a feminine noun («مسألة», «واو»)."""
    w = ordinal.split()[0]
    return w in _FEMININE_FIRST or w.endswith("ة")


@lru_cache(maxsize=64)
def marker_rx(k: int) -> tuple[re.Pattern[str], ...]:
    """The k-th item marker: at a paragraph start (optionally after the edition's marginal number), and
    anywhere before a colon; a first item also right after the colon that announces the list («ثلاثة
    مذاهب: أحدها أنها …»). ``noun`` is an optional «الوجه»/«المسألة» before the ordinal."""
    words = _FIRST if k == 1 else ordinal_words(k)
    if 2 <= k <= 10:
        # «أحدها … وثانيها … وثالثها» (al-Murādī's way of counting views)
        stem = _POSSESSIVE_STEMS[k - 2]
        words = [*words, f"{stem}ها", f"{stem}هما"]
    alts = "|".join(re.escape(w) for w in words)
    if k == 1:
        alts += "|الأولى|الاولى"  # «المسألة الأولى» — kept only after a noun (find_markers)
    tail = r"(?!\s*(?:عشر|عشرة|والعشر))" if k < 10 else ""
    body = rf"[\[(]?(?:و|ف)?(?:(?P<noun>{_NOUN_RX})\s+)?(?P<ord>{alts}){tail}[\])]?"
    patterns = [
        re.compile(rf"(?:(?<=\n)|^)(?P<num>\d{{1,3}}\s+)?{body}(?=[\s:،.\-]|$)"),
        re.compile(rf"(?<![^\s.،:؛)\]])(?P<num>){body}\s*(?=:)"),
    ]
    if k == 1:
        patterns.append(re.compile(rf"(?:(?<=:)|(?<=: ))(?P<num>){body}(?=[\s،.\-])"))
    return tuple(patterns)


@dataclass
class Marker:
    start: int
    end: int
    k: int
    text: str
    noun: str | None
    feminine: bool = False
    colon: bool = False  # a colon follows it («الأول: …»)


def find_markers(text: str, start: int, end: int, max_k: int = 30) -> list[Marker]:
    found: dict[int, Marker] = {}
    for k in range(1, max_k + 1):
        patterns = marker_rx(k)
        at_para = patterns[0]
        for m in (x for rx in patterns for x in rx.finditer(text, start, end)):
            # «فيها مسائل: ⏎ الأولى في نوعها …», «الأولى: …»: a bare «الأولى» counts at a paragraph's start
            # without «و» («والأولى أن …» is prose), or by a colon
            if (
                m.group("ord") in ("الأولى", "الاولى")
                and not m.group("noun")
                and m.re is at_para
                and m.group(0).lstrip("0123456789 [(").startswith(("و", "ف"))
            ):
                continue
            s = m.start() + (len(m.group("num")) if m.group("num") else 0)
            mk = Marker(
                s, m.end(), k, text[s : m.end()].strip(), m.group("noun"), is_feminine(m.group("ord"))
            )
            mk.colon = text[m.end() : m.end() + 3].lstrip(" ").startswith(":")
            prev = found.get(s)
            if prev is None or (mk.end - mk.start) > (prev.end - prev.start):
                found[s] = mk
    return [found[s] for s in sorted(found)]


# --- senses -----------------------------------------------------------------------------------------
@dataclass
class Sense:
    start: int
    end: int
    index: int  # ordinal as printed
    marker: str  # the marker as printed («والثاني», «الوجه الثالث»)
    marker_noun: str | None
    list_no: int
    depth: int
    parent: int | None  # position (in Entry.senses) of the sense this list stands in
    notes: list[str] = field(default_factory=list)


@dataclass
class SenseList:
    no: int
    depth: int
    parent: int | None
    lead: tuple[int, int]  # the words that introduce the list, up to its first marker
    count_span: tuple[int, int] | None = None
    stated: int | None = None
    noun: str | None = None
    items: list[int] = field(default_factory=list)  # positions in Entry.senses
    last_k: int = 0
    feminine: bool = False  # the gender of its ordinals («الثاني» does not continue «الأولى … الثانية»)
    colon: bool = False  # its first marker is followed by a colon («الأول:»)


def _trim(text: str, s: int, e: int) -> tuple[int, int]:
    while s < e and text[s] in " \n":
        s += 1
    while e > s and text[e - 1] in " \n":
        e -= 1
    return s, e


_SENTENCE_END = re.compile(r"[.؟!\n]")


def _continues(lst: SenseList, m: Marker, gap: int, style: bool) -> bool:
    """Does marker ``m`` continue ``lst`` (``gap`` 1: the next ordinal; more: ordinals skipped)? ``style``:
    also require the same way of writing the marker (with or without a colon)."""
    return lst.last_k == m.k - gap and lst.feminine == m.feminine and (not style or lst.colon == m.colon)


def parse_senses(
    text: str, start: int, end: int, boundaries: list[int]
) -> tuple[list[Sense], list[SenseList], list[str]]:
    """Numbered lists in ``text[start:end]``; ``boundaries`` are heading-paragraph starts that close them."""
    markers = find_markers(text, start, end)
    events: list[tuple[int, str, Marker | None]] = [(m.start, "m", m) for m in markers]
    events += [(b, "b", None) for b in boundaries if start <= b < end]
    events.sort(key=lambda x: (x[0], x[1] == "m"))
    senses: list[Sense] = []
    lists: list[SenseList] = []
    notes: list[str] = []
    stack: list[int] = []
    prev_event = start

    def para_of(pos: int) -> int:
        return text.rfind("\n", 0, pos)

    for pos, kind, m in events:
        if kind == "b":
            prev_event = pos  # a sub-heading ends the sense before it; the list may go on after it
            continue
        assert m is not None
        skipped = 0
        if m.k == 1:
            parent, depth = None, 0
            if stack:
                top = lists[stack[-1]]
                cur = senses[top.items[-1]]
                if para_of(cur.start) == para_of(m.start):
                    parent, depth = top.items[-1], top.depth + 1
                else:
                    parent, depth = top.parent, top.depth
            # the words that introduce the list: its paragraph up to the marker, or the paragraph before
            # when the marker opens one («حرف جر لأربعة عشر معنى ⏎ أولها الإلصاق …»)
            para_start = text.rfind("\n", 0, m.start) + 1
            if not text[para_start : m.start].strip() and para_start > 0:
                para_start = text.rfind("\n", 0, para_start - 1) + 1
            lead_start = max(prev_event, para_start)
            if m.start - lead_start > 300:
                cut = [x.end() for x in _SENTENCE_END.finditer(text, lead_start, m.start)]
                lead_start = cut[-1] if cut else m.start - 300
            lst = SenseList(
                len(lists) + 1,
                depth,
                parent,
                _trim(text, lead_start, m.start),
                feminine=m.feminine,
                colon=m.colon,
            )
            counts = list(COUNT.finditer(text, prev_event, m.start))
            if counts:
                c = counts[-1]
                lst.count_span, lst.stated, lst.noun = (c.start(), c.end()), count_value(c), count_noun(c)
            lists.append(lst)
            stack.append(len(lists) - 1)
            target = lst
        else:
            # the most recent list it continues, preferring one whose markers are written the same way
            # («الأول: … الثاني:» with their colons, past «وهي قسمان: أحدهما … والآخر …» in between)
            order = range(len(stack) - 1, -1, -1)
            found = next((d for d in order if _continues(lists[stack[d]], m, 1, True)), None)
            if found is None:
                found = next((d for d in order if _continues(lists[stack[d]], m, 1, False)), None)
            # the text may skip an ordinal (a typing gap); a compound one («الحادي والعشرون») is distinctive
            # enough to bridge up to three
            for gap in range(2, (4 if m.k > 10 else 2) + 1):
                if found is None:
                    found = next((d for d in order if _continues(lists[stack[d]], m, gap, False)), None)
                    skipped = gap - 1 if found is not None else 0
            if found is None:
                notes.append(f"ordinal «{m.text}» outside a list it continues: left in the text")
                continue
            del stack[found + 1 :]
            target = lists[stack[found]]
        if senses:
            senses[-1].end = m.start
        s = Sense(m.start, end, m.k, m.text, m.noun, target.no, target.depth, target.parent)
        if skipped:
            missing = ", ".join(str(x) for x in range(m.k - skipped, m.k))
            what = "sense" if skipped == 1 else "senses"
            s.notes.append(f"{what} {missing}: no marker in the text")
            notes.append(f"list {target.no}: {what} {missing}: no marker in the text")
        target.items.append(len(senses))
        target.last_k = m.k
        senses.append(s)
        prev_event = pos
    # a sense ends at the next marker or heading, whichever comes first
    stops = sorted({s.start for s in senses} | {b for b in boundaries if start <= b < end} | {end})
    for s in senses:
        i = bisect.bisect_right(stops, s.start)
        s.end = stops[i] if i < len(stops) else end
        s.start, s.end = _trim(text, s.start, s.end)
    return senses, lists, notes


# --- labels -----------------------------------------------------------------------------------------
_LABEL_END = re.compile(
    r"[.،؛:\n(\"]|\s(?:نحو|كقوله|كقول|قوله|ومنه|ومثله|ومثاله|مثل|وهو|وهي|وهذه|وهذا|وذلك|ذكره|قاله|قال|وقال"
    r"|أي|وتسمى|ويسمى|وحقيقته|ومعناه|إذا|بشرط|وشرطها|وشرطه|كما|كذا|عند|فتقول|تقول|وذهب|وزعم|قيل|وقيل"
    r"|فقيل)(?=\s|$)"
)


def sense_label(text: str, s: Sense) -> tuple[int, int] | None:
    """The phrase a sense opens with, after its marker («الأول: الظرفية.» → «الظرفية»; «أحدها أن تكون حرفا
    ينادى به القريب كقوله» → «أن تكون حرفا ينادى به القريب»), when it is seven words or fewer."""
    pos = s.start + len(s.marker)
    while pos < s.end and text[pos] in " :-–":
        pos += 1
    m = _LABEL_END.search(text, pos, s.end)
    end = m.start() if m else s.end
    label = text[pos:end].strip()
    if not label or len(label.split()) > 7:
        return None
    a = text.index(label, pos)
    return a, a + len(label)
