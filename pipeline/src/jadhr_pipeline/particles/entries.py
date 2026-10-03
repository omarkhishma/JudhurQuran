"""Entry parsers: where each particle's entry starts in Ibn Hishām's and al-Murādī's texts.

* ``mughni`` — Ibn Hishām, *Mughnī al-Labīb*, chapter one («الباب الأول في تفسير المفردات»), arranged by
  letter sections («& حرف الألف &», or a paragraph «حرف الكاف»). The typing prints a headword at the start of
  a paragraph, either alone («حتى», «إذ ما»), with the words that describe its shape («إن المكسورة
  الخفيفة», «عل بلام خفيفة», «الباء المفردة»), or running into what it is («حاشا على ثلاثة أوجه», «غير اسم
  ملازم …», «ثم ويقال فيها فم»). A paragraph opens an entry when its first word begins with the letter of
  its section and one of those shapes holds (``_mughni_heading``); two entries the edition adds in square
  brackets («[ آ بالمد حرف لنداء البعيد ]») are read the same way. A letter section with no headword of its
  own («حرف الألف» before «حرف الياء»: the soft alif) is one entry. Headwords the typing dropped are supplied
  from the registry (``supplied_headwords``), each with the words of the entry that name it.
* ``jana`` — al-Murādī, *al-Janā al-Dānī*, five chapters by the number of letters («الباب الأول في
  الأحادي» … «الخماسي»), each opening with the author's own list of its particles («وهو أربعة عشر حرفا:
  الهمزة، والباء، …»). The list is the checklist: an entry opens at a paragraph that starts with the next
  listed particle (or one of the next three), alone, with the words that describe it («إن المكسورة الهمزة»,
  «من بضم الميم»), or followed by what it is («الباء حرف مختص بالاسم»). Pronouns he treats together («هو
  وهي وهم») take one entry for their list items.

Particle forms are compared after the project's normalisation (``jadhr_arabic.normalize``) only where the
spelling of hamza differs between the list and the heading («آي» / «أي بالمد»).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import normalize

from .structure import _T, _TENS, _U, _UNITS, COUNT, Sense, SenseList, find_markers, parse_senses
from .text import Source

LETTER_NAMES: dict[str, str] = {
    "الهمزة": "ء", "الألف": "ا", "الالف": "ا", "الباء": "ب", "التاء": "ت", "الثاء": "ث", "الجيم": "ج",
    "الحاء": "ح", "الخاء": "خ", "الدال": "د", "الذال": "ذ", "الراء": "ر", "الزاي": "ز", "السين": "س",
    "الشين": "ش", "الصاد": "ص", "الضاد": "ض", "الطاء": "ط", "الظاء": "ظ", "العين": "ع", "الغين": "غ",
    "الفاء": "ف", "القاف": "ق", "الكاف": "ك", "اللام": "ل", "الميم": "م", "النون": "ن", "الهاء": "ه",
    "الواو": "و", "الياء": "ي",
}  # fmt: skip
# A word in a letter section begins with the section's letter; the alif section takes every hamza seat.
_SECTION_INITIALS = {"ا": "اأإآء", "ء": "اأإآء"}


@dataclass
class Entry:
    seq: int
    start: int
    end: int
    heading: tuple[int, int]  # the heading as printed
    form: tuple[int, int] | None  # the particle's form(s) within the heading («إن», «هو وهي وهم»)
    section: str | None  # «حرف الألف», «الباب الثاني في الثنائي»
    letters: int | None = None  # al-Murādī: the chapter's number of letters
    listed_as: list[str] = field(default_factory=list)  # al-Murādī: the list items this entry answers
    supplied_headword: str | None = None
    supplied_evidence: str | None = None
    intro: tuple[int, int] | None = None
    senses: list[Sense] = field(default_factory=list)
    lists: list[SenseList] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def paragraphs(text: str) -> list[tuple[int, int]]:
    out = []
    pos = 0
    for p in text.split("\n"):
        out.append((pos, pos + len(p)))
        pos += len(p) + 1
    return out


# Words that describe a headword's shape («المكسورة الخفيفة», «بفتح الهمزة والتشديد», «بلام مشددة
# مفتوحة أو مكسورة», «مشددة النون», «المفردة»).
_DESC_WORD = re.compile(
    r"و?(?:ب|ل)?(?:ال)?(?:فتح|كسر|ضم|سكون|مد|تشديد|تخفيف|مكسور|مفتوح|مشدد|مخفف|ساكن|مضموم|خفيف|ثقيل|"
    r"همز|نون|لام|ياء|عين|ميم|ألف|واو|مفرد)ة?|أو"
)
# What a headword may run into: what it is, or how many senses it has.
_DEFINER = re.compile(r"(?:حرف|اسم|فعل|كلمة|أداة|لفظ|ظرف|ضمير|ويقال|مثل|مرادفة|تأتي|ترد|المختص)(?![ء-ي])")
_ON_COUNT = re.compile(r"(?:على|علي)\s+")
_STOP = {
    "قوله", "وقوله", "كقوله", "وقول", "قال", "وقال", "قلت", "قيل", "وقيل", "انتهى", "البيت", "الأصل",
    "التقدير", "المعنى", "الرواية", "أراد", "حرف", "كلمة", "لأن", "ولأن", "أي", "إن", "وإن", "أما", "وأما",
    "فأما", "وهي", "وهو", "وهذا", "وهذه", "ولا", "ومن", "وما", "والله", "تنبيه", "مسألة", "فائدة", "فصل",
}  # fmt: skip
_STOP_SINGLE_OK = {"أي", "إن", "أما", "وا"}  # stop-words that are headwords when they stand alone or shaped


def _words_with_spans(text: str, s: int, e: int) -> list[tuple[int, int, str]]:
    return [(s + m.start(), s + m.end(), m.group(0)) for m in re.finditer(r"\S+", text[s:e])]


_SHAPE_FIRST = re.compile(
    r"(?:ب?ال|ب)?(?:فتح|كسر|ضم|سكون|مد|تشديد|تخفيف|مكسور|مفتوح|مشدد|مخفف|ساكن|مضموم|خفيف|مفرد)ة?|بلام"
)


def _shape_end(text: str, words: list[tuple[int, int, str]], i: int) -> int:
    """Index after the run of shape words that starts at ``words[i]`` (the run opens with a vowel or
    shape word — «بفتح», «المكسورة», «مشددة», «بلام» — and may go on with the letter it names)."""
    if i >= len(words) or not _SHAPE_FIRST.fullmatch(words[i][2].strip("،.:")):
        return i
    j = i + 1
    while j < len(words) and _DESC_WORD.fullmatch(words[j][2].strip("،.:")):
        j += 1
    return j


def _section_letter(heading: str) -> str | None:
    m = re.fullmatch(r"حرف\s+(\S+)(?:\s+(?:المهملة|المعجمة))?", heading.strip())
    return LETTER_NAMES.get(m.group(1)) if m else None


def _mughni_heading(
    text: str, ps: int, pe: int, letter: str, next_para: str
) -> tuple[tuple[int, int], tuple[int, int]] | None:
    """(heading span, form span) when the paragraph ``text[ps:pe]`` opens an entry of the section."""
    words = _words_with_spans(text, ps, pe)
    if not words:
        return None
    initials = _SECTION_INITIALS.get(letter, letter)
    names = [n for n, ltr in LETTER_NAMES.items() if ltr == letter]
    w0 = words[0][2]
    # the letter's own entry: «الباء المفردة …», «الكاف المفردة جارة …»
    if w0 in names and len(words) > 1 and words[1][2] == "المفردة":
        return (words[0][0], words[1][1]), (words[0][0], words[0][1])
    # a headword is a short word beginning with the section's letter («العلوق بفتح العين», a word of a
    # verse explained, is not)
    if w0[0] not in initials or len(w0) > 5:
        return None
    form = (words[0][0], words[0][1])
    j = _shape_end(text, words, 1)
    if j > 1:  # «إن المكسورة الخفيفة», «أي بفتح الهمزة وتشديد الياء»
        return (words[0][0], words[j - 1][1]), form
    if w0 in _STOP and not (w0 in _STOP_SINGLE_OK and len(words) == 1):
        return None  # prose that opens with «قال», «أي», «وأما» …
    if len(words) == 1:
        return form, form
    rest = text[words[1][0] : pe]
    if _DEFINER.match(rest):
        return form, form
    on = _ON_COUNT.match(rest)
    if on and COUNT.match(rest, on.end()):
        return form, form  # «حاشا على ثلاثة أوجه»
    w1 = words[1][2]
    if len(words) == 2 and w1.startswith("و") and len(w1) > 1 and w1[1] in initials:
        return (words[0][0], words[1][1]), (words[0][0], words[1][1])  # «منذ ومذ», «كلا وكلتا»
    if len(words) <= 3 and _DEFINER.match(next_para):
        return (words[0][0], words[-1][1]), (words[0][0], words[-1][1])  # «إذ ما» + «أداة شرط …»
    return None


_BRACKET_ENTRY = re.compile(r"\[\s*(?P<form>[ء-ي]+)\s+(?:بالمد\s+)?حرف")


def parse_mughni(src: Source, cfg: dict[str, Any]) -> list[Entry]:
    t = src.text
    c = src.clean
    paras = paragraphs(t)
    heads = [(s, e) for s, e in paras if c.is_heading(s)]
    ch_start = next(s for s, e in heads if t[s:e].strip() == "الباب الأول")
    ch_end = next(s for s, e in heads if t[s:e].strip().startswith("الباب الثاني"))
    supplied = {x["opens_with"]: x for x in cfg.get("supplied_headwords") or ()}
    not_headings = cfg.get("not_headings") or ()
    run_in = cfg.get("run_in_headings") or ()
    found_run_in: list[str] = []
    entries: list[Entry] = []
    section: str | None = None
    letter: str | None = None
    sections: list[tuple[int, int, str]] = []  # (start, heading end, heading)
    starts: list[tuple[int, tuple[int, int], tuple[int, int] | None, str | None, dict[str, Any] | None]] = []
    in_ch = [(s, e) for s, e in paras if ch_start <= s < ch_end]
    for i, (s, e) in enumerate(in_ch):
        para = t[s:e]
        sl = _section_letter(para)
        if sl:
            section, letter = para.strip(), sl
            sections.append((s, e, section))
            continue
        if letter is None or not para.strip():
            continue
        for x in run_in:
            k = para.find(x["text"])
            if x["section"] == section and k > 0:
                hs = s + k
                fe = hs + len(x["text"].split()[0])
                starts.append((hs, (hs, hs + len(x["text"])), (hs, fe), section, {"run_in": x}))
                found_run_in.append(x["text"])
        sup = next((x for o, x in supplied.items() if para.startswith(o) and x["section"] == section), None)
        if sup:
            starts.append((s, (s, s + len(sup["opens_with"])), None, section, sup))
            continue
        if any(m.start == s for m in find_markers(t, s, min(e, s + 40))):
            continue
        if any(para.startswith(x["opens_with"]) and x["section"] == section for x in not_headings):
            continue
        nxt = t[in_ch[i + 1][0] : in_ch[i + 1][1]] if i + 1 < len(in_ch) else ""
        hit = _mughni_heading(t, s, e, letter, nxt)
        if hit:
            starts.append((s, hit[0], hit[1], section, None))
            continue
        initials = _SECTION_INITIALS.get(letter, letter)
        for m in _BRACKET_ENTRY.finditer(t, s, e):
            if m.group("form")[0] in initials:
                fs, fe = m.start("form"), m.end("form")
                starts.append((m.start(), (fs, fe), (fs, fe), section, None))
    for x in run_in:
        if found_run_in.count(x["text"]) != 1:
            raise ValueError(f"run-in heading «{x['text']}» found {found_run_in.count(x['text'])} times")
    # a letter section that opens no entry of its own is one entry: the letter itself
    for k, (s, e, name) in enumerate(sections):
        nxt_sec = sections[k + 1][0] if k + 1 < len(sections) else ch_end
        if not any(s < x[0] < nxt_sec for x in starts):
            starts.append((s, (s, e), None, name, {"letter_section": True}))
    starts.sort(key=lambda x: x[0])
    bounds = sorted({x[0] for x in starts} | {s for s, _, _ in sections} | {ch_end})
    for seq, (s, heading, form, sec, extra) in enumerate(starts, 1):
        end = next(b for b in bounds if b > s)
        ent = Entry(seq, s, end, heading, form, sec)
        if extra and extra.get("letter_section"):
            ent.notes.append("a letter section with no headword paragraph: the section is the entry")
            ent.form = (heading[0] + len("حرف "), heading[1])
        elif extra and extra.get("run_in"):
            ent.notes.append(
                f"heading run into the previous paragraph by the typing: {extra['run_in']['reason']}"
            )
        elif extra:
            ent.supplied_headword = extra["headword"]
            ent.supplied_evidence = extra["evidence"]
            ent.notes.append(
                "headword not in the typing: supplied from the registry with the words that name it"
            )
        _senses(src, ent)
        entries.append(ent)
    return entries


# A paragraph that is only one of these words is a sub-heading of the entry, printed apart («تنبيه»,
# «مسألة», «فصل» …); it closes the numbered lists before it.
_SUBHEADING = re.compile(
    r"؟?(?:تنبيه|تنبيهان|تنبيهات|تنبية|تنبه|مسألة|مسألتان|مسائل|فصل|فائدة|فرع|قاعدة)\s*[:.]?"
)


def is_subheading(c: Any, t: str, s: int, e: int) -> bool:
    """A heading paragraph of the typing, or a paragraph that holds only a sub-heading word."""
    if _SUBHEADING.fullmatch(t[s:e].strip()):
        return True
    return bool(c.is_heading(s)) and not any(m.start == s for m in find_markers(t, s, min(e, s + 40)))


def _senses(src: Source, ent: Entry) -> None:
    t = src.text
    c = src.clean
    body = ent.heading[1]
    bounds = [s for s, e in paragraphs(t) if ent.start < s < ent.end and is_subheading(c, t, s, e)]
    ent.senses, ent.lists, notes = parse_senses(t, body, ent.end, bounds)
    ent.notes += notes
    first = ent.senses[0].start if ent.senses else ent.end
    s, e = body, first
    while s < e and t[s] in " \n:،.-":
        s += 1
    while e > s and t[e - 1] in " \n":
        e -= 1
    ent.intro = (s, e) if e > s else None


# --- al-Murādī -------------------------------------------------------------------------------------
_BAB = re.compile(r"الباب (الأول|الثاني|الثالث|الرابع|الخامس)")
_BAB_LETTERS = {"الأحادي": 1, "الثنائي": 2, "الثلاثي": 3, "الرباعي": 4, "الخماسي": 5}
_LIST_END = re.compile(r"\.\s|وأنا أذكرها|ويجمعها")
_LIST_CLOSE = re.compile(r"وأنا أذكرها|ويجمعها")
_LIST_COUNT = re.compile(
    rf"(?P<num>(?:(?:{_U})\s+(?:عشر|عشرة|و(?:{_T})))|(?:{_T})|(?:{_U}))(?:\s+(?:حرفا|أحرف|حروف))?\s*$"
)


def _number(words: str) -> int:
    w = words.split()
    if len(w) == 1:
        return _TENS.get(w[0]) or _UNITS[w[0]]
    return _UNITS[w[0]] + (10 if w[1] in ("عشر", "عشرة") else _TENS[w[1][1:]])


def _chapter_list(
    t: str, s: int, e: int
) -> tuple[list[tuple[str, int, int]], list[str], tuple[int, int] | None]:
    """The particles a chapter's opening paragraph lists, as (item, start, end): after the last colon
    before «وأنا أذكرها» («وجميع ذلك ثلاثة وثلاثون حرفا: إذ، وأل، …»), up to the end of that sentence.
    Also returns the span of the number stated just before the colon."""
    close = _LIST_CLOSE.search(t, s, e)
    colon = t.rfind(":", s, close.start() if close else e)
    if colon < 0:
        return [], ["no list after a colon in the chapter's opening"], None
    stated = _LIST_COUNT.search(t, max(s, colon - 40), colon)
    stated_span = (stated.start("num"), stated.end("num")) if stated else None
    stop = _LIST_END.search(t, colon, e)
    end = stop.start() if stop else e
    items: list[tuple[str, int, int]] = []
    dropped: list[str] = []
    pos = colon + 1
    for piece in re.split(r"(،)", t[colon + 1 : end]):
        a = pos
        pos += len(piece)
        if piece == "،":
            continue
        for m in re.finditer(r"\S+(?:\s+ما)?", piece):  # «إذ ما» is one item
            w = m.group(0)
            ws, we = a + m.start(), a + m.end()
            if items and w.startswith("و") and len(w) > 1:
                w, ws = w[1:], ws + 1  # «والباء», «ووا»: the conjunction is not the item's
            if len(piece.split()) > 2:
                dropped.append(piece.strip())
                break
            items.append((w, ws, we))
    return items, dropped, stated_span


def _norm(w: str) -> str:
    return normalize(w.strip("؟:،."))


def parse_jana(src: Source, cfg: dict[str, Any]) -> list[Entry]:
    t = src.text
    paras = paragraphs(t)
    overrides = {x["chapter"]: x for x in cfg.get("chapter_lists") or ()}
    slips = {x["printed"]: x["reads"] for x in cfg.get("heading_slips") or ()}
    list_slips = {(x["chapter"], x["printed"]): x["reads"] for x in cfg.get("list_slips") or ()}
    supplied = cfg.get("supplied_headwords") or ()
    run_in = cfg.get("run_in_headings") or ()
    babs: list[tuple[int, int, str, int]] = []  # para index, start, title, letters
    for i, (s, e) in enumerate(paras):
        m = _BAB.fullmatch(t[s:e].strip())
        if not m:
            continue
        nxt = t[paras[i + 1][0] : paras[i + 1][1]] if i + 1 < len(paras) else ""
        kind = next((k for k in _BAB_LETTERS if nxt.startswith(f"في {k}")), None)
        if kind:
            babs.append((i, s, f"{t[s:e].strip()} {' '.join(nxt.split()[:2])}", _BAB_LETTERS[kind]))
    entries: list[Entry] = []
    report_lists: dict[str, Any] = {}
    for b, (pi, _start, title, letters) in enumerate(babs):
        b_end_pi = babs[b + 1][0] if b + 1 < len(babs) else len(paras)
        # the list: in the paragraph after the title, or the title's own second line
        lp = next(j for j in range(pi + 1, min(pi + 3, b_end_pi)) if ":" in t[paras[j][0] : paras[j][1]])
        if title in overrides:
            ov = overrides[title]
            items = [(w, -1, -1) for w in ov["items"]]
            dropped: list[str] = []
            stated_ar, stated_n = ov["stated_ar"], ov["stated"]
        else:
            items, dropped, sspan = _chapter_list(t, paras[lp][0], paras[lp][1])
            stated_ar = t[sspan[0] : sspan[1]] if sspan else None
            stated_n = _number(stated_ar) if stated_ar else None
        fixed = []
        for w, ws, we in items:
            if (title, w) in list_slips:
                fixed.append((list_slips[(title, w)], ws, we))
            else:
                fixed.append((w, ws, we))
        items = fixed
        report_lists[title] = {
            "letters": letters,
            "items": [w for w, _, _ in items],
            "item_count": len(items),
            "stated": stated_n,
            "stated_ar": stated_ar,
            "dropped": dropped,
            "from_registry": title in overrides,
        }
        k = 0  # next list item expected
        for j in range(lp + 1, b_end_pi):
            s, e = paras[j]
            if k >= len(items):
                break
            para = t[s:e]
            words = _words_with_spans(t, s, e)
            if not words:
                continue
            sup = next(
                (x for x in supplied if x["chapter"] == title and para.startswith(x["opens_with"])), None
            )
            if sup and items[k][0] == sup["headword"]:
                # the typing dropped the headword: the entry opens with what it is
                ent = Entry(len(entries) + 1, s, e, (s, s + len(sup["opens_with"])), None, title, letters)
                ent.listed_as = [items[k][0]]
                ent.supplied_headword, ent.supplied_evidence = sup["headword"], sup["evidence"]
                ent.notes.append(
                    "headword not in the typing: supplied from the registry with the words that name it"
                )
                entries.append(ent)
                k += 1
                continue
            lead = 1 if words[0][2].startswith("؟") else 0
            match, width = None, 1
            for d in range(min(3, len(items) - k)):
                item = items[k + d][0]
                width = len(item.split())
                head = " ".join(w for _, _, w in words[:width]).lstrip("؟")
                head = slips.get(head, head)
                if head == item or _norm(head) == _norm(item):
                    match = d
                    break
            if match is None:
                continue
            # the heading: the listed particles it names, then shape words; or the particle running into
            # what it is («الباء حرف مختص …»)
            n_items, n_words = 1, width
            while (
                n_words < len(words)
                and k + match + n_items < len(items)
                and _norm(words[n_words][2].removeprefix("و")) == _norm(items[k + match + n_items][0])
            ):
                n_items += 1
                n_words += 1
            shape = _shape_end(t, words, n_words)
            rest = t[words[n_words][0] : e] if n_words < len(words) else ""
            alone = len(words) == n_words
            shaped = shape > n_words and (shape == len(words) or _DEFINER.match(t[words[shape][0] : e]))
            # a short heading with no sentence in it, at the very next listed particle: «إيا في إياك
            # وأخواته», «أيمن المستعمل في القسم»
            short = match == 0 and len(words) <= 5 and not re.search(r"[.،:؛!؟…]", para.lstrip("؟"))
            run = next(
                (x for x in run_in if x["chapter"] == title and para.startswith(x["opens_with"])), None
            )
            if not (alone or shaped or _DEFINER.match(rest) or short or run):
                continue
            if short and not (alone or shaped or _DEFINER.match(rest)):
                shape = len(words)
            fs = words[0][0] + lead
            form = (fs, words[n_words - 1][1])
            heading = (fs, words[max(shape, n_words) - 1][1])
            ent = Entry(len(entries) + 1, s, e, heading, form, title, letters)
            ent.listed_as = [items[k + match + x][0] for x in range(n_items)]
            if run:
                ent.notes.append(f"the headword runs into the first sentence: {run['reason']}")
            if match:
                skipped = [items[k + x][0] for x in range(match)]
                ent.notes.append(f"listed before this entry but without an entry paragraph: {skipped}")
            if lead:
                ent.notes.append("a stray «؟» before the heading")
            printed = " ".join(w for _, _, w in words[:width]).lstrip("؟")
            if printed in slips:
                ent.notes.append(f"heading «{printed}» is a slip of the typing for «{slips[printed]}»")
            entries.append(ent)
            k += match + n_items
        if k < len(items):
            report_lists[title]["not_found"] = [w for w, _, _ in items[k:]]
    # an entry ends where the next begins, or at the next chapter
    bab_starts = [bs for _, bs, _, _ in babs]
    for i, ent in enumerate(entries):
        nxt_entry = entries[i + 1].start if i + 1 < len(entries) else len(t)
        nxt_bab = next((x for x in bab_starts if x > ent.start), len(t))
        ent.end = min(nxt_entry, nxt_bab)
        _senses(src, ent)
    cfg.setdefault("_report", {})["chapter_lists"] = report_lists
    return entries


PARSERS = {"mughni": parse_mughni, "jana": parse_jana}
