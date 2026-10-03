"""The parts of al-Suyūṭī's *al-Muhadhdhab*: introduction, letter chapters with their entries, closing count and
verses, the colophon, and the blocks set aside — every letter of the cleaned text belongs to exactly one.

* Chapters are the typing's heading paragraphs «1 (حرف الهمزة) 1».
* An entry opens at its headword: one to three words in brackets («(أباريق):», «(الأولى والآخرة):», reversed
  «) آنية (:») at the start of a sentence — after a full stop (or a full stop and colon) or a chapter heading;
  a paragraph break alone is not enough, as the re-typed pages break paragraphs before a bracketed quotation
  inside an entry — unless the registry lists it as a quotation (``not_headings``); or a headword the registry
  names because the typing printed it without brackets («سجين:», «سكر قال», «تحت):»), found once. It runs to
  the next headword, chapter, set-aside block or the closing passage; a set-aside block inside it is a hole,
  and the entry's text is its slices before and after («(درى) … بالحبشية.» / «وكذا قال أبو القاسم …»).
* Set-aside blocks (registry ``set_aside``) are split into copies by the same heading rule; each copy names the
  entry it repeats.
* The introduction and the closing part are cut into passages at paragraph breaks; the introduction's
  passages carry the view they belong to (registry ``introduction.views``) and the names the text gives.
* Languages are found by words in an entry's text after its heading (registry ``languages``).
"""

from __future__ import annotations

import itertools
import re
from dataclasses import dataclass, field
from typing import Any

CHAPTER = re.compile(r"^1 \((حرف [ء-ي]+)\) 1$", re.M)
_BRACKETED = re.compile(r"[()]\s*([ء-ي]+(?: [ء-ي]+){0,2})\s*[()]")
_WORD = re.compile("[ء-ي]+")


class StructureError(ValueError):
    pass


@dataclass
class Heading:
    start: int  # the heading as printed, brackets included
    end: int
    word: tuple[int, int]  # the headword within it
    style: str  # brackets | reversed-brackets | half-bracket | bare


@dataclass
class EntrySpan:
    seq: int
    chapter: str
    chapter_seq: int
    heading: Heading
    segments: list[tuple[int, int]]  # the entry's text, a hole left where a set-aside block stood


@dataclass
class Copy:
    block_id: str
    heading: Heading | None
    start: int
    end: int


@dataclass
class Passage:
    section: str  # introduction | chapter | conclusion | colophon | set-aside
    kind: str  # text | editorial-heading | chapter-heading | colophon | copy
    start: int
    end: int
    view_id: str | None = None
    copy: Copy | None = None


@dataclass
class Parsed:
    entries: list[EntrySpan] = field(default_factory=list)
    passages: list[Passage] = field(default_factory=list)
    blocks: list[tuple[str, int, int]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _once(text: str, needle: str, what: str, lo: int = 0, hi: int | None = None) -> int:
    hi = len(text) if hi is None else hi
    hits = [m.start() for m in re.finditer(re.escape(needle), text) if lo <= m.start() < hi]
    if len(hits) != 1:
        raise StructureError(f"{what}: «{needle}» found {len(hits)} times, expected once")
    return hits[0]


def _trim(text: str, s: int, e: int) -> tuple[int, int]:
    while s < e and text[s] in " \n":
        s += 1
    while e > s and text[e - 1] in " \n":
        e -= 1
    return s, e


def sentence_start(text: str, pos: int) -> bool:
    """Does ``pos`` open a sentence: the start of the text, a full stop (or a full stop and colon) before it,
    or a chapter heading on the line before (spaces and paragraph breaks skipped)? A paragraph break alone
    is not enough: the re-typed pages break paragraphs inside an entry, before a bracketed quotation
    («قال:⏎(سجيل) بالفارسية»)."""
    i = pos - 1
    while i >= 0 and text[i] in " \n":
        i -= 1
    if i < 0 or text[i] == ".":
        return True
    if text[i] == ":":
        j = i - 1
        while j >= 0 and text[j] == " ":
            j -= 1
        return j >= 0 and text[j] == "."
    line_start = text.rfind("\n", 0, i) + 1
    return bool(CHAPTER.fullmatch(text, line_start, i + 1))


def bracketed_headings(text: str, lo: int, hi: int, not_headings: list[int] = ()) -> list[Heading]:  # type: ignore[assignment]
    out = []
    for m in _BRACKETED.finditer(text, lo, hi):
        if not sentence_start(text, m.start()) or m.start() in not_headings:
            continue
        opening, closing = text[m.start()], text[m.end() - 1]
        if opening == "(" and closing == ")":
            style = "brackets"
        elif opening == ")" and closing == "(":
            style = "reversed-brackets"
        else:
            continue
        out.append(Heading(m.start(), m.end(), m.span(1), style))
    return out


def registered_headings(
    text: str, cfg: dict[str, Any], lo: int, hi: int, holes: list[tuple[int, int]]
) -> list[Heading]:
    out = []
    for h in cfg.get("unbracketed_headings") or ():
        hits = [
            m.start()
            for m in re.finditer(re.escape(h["find"]), text)
            if lo <= m.start() < hi and not any(a <= m.start() < b for a, b in holes)
        ]
        if len(hits) != 1:
            raise StructureError(f"unbracketed heading «{h['find']}» found {len(hits)} times, expected once")
        s = hits[0]
        if not text.startswith(h["headword"], s):
            raise StructureError(f"unbracketed heading «{h['find']}» does not open with «{h['headword']}»")
        e = s + len(h["headword"])
        end = e
        while end < len(text) and text[end] in "):":
            end += 1
        out.append(Heading(s, end, (s, e), h["style"]))
    return out


def parse(text: str, cfg: dict[str, Any]) -> Parsed:
    """Cut the cleaned text into passages and entries (``cfg``: the source's registry entry)."""
    p = Parsed()
    chapters_all = [(m.start(), m.end(), m.group(1)) for m in CHAPTER.finditer(text)]
    if not chapters_all:
        raise StructureError("no letter chapter found")
    concl = cfg["conclusion"]
    c_start = _once(text, concl["opens_with"], "conclusion")
    col_start = _once(text, concl["colophon_opens_with"], "colophon")
    # set-aside blocks
    for b in cfg.get("set_aside") or ():
        s = _once(text, b["from"], f"set-aside {b['id']} start")
        e = _once(text, b["to"], f"set-aside {b['id']} end", lo=s) + len(b["to"])
        p.blocks.append((b["id"], s, e))
    holes = [(s, e) for _, s, e in p.blocks]

    def in_hole(x: int) -> bool:
        return any(a <= x < b for a, b in holes)

    chapters = [c for c in chapters_all if not in_hole(c[0])]
    first = chapters[0][0]
    # headings of the entry zone; a bracket the registry says is a quotation is not one
    not_heads = [
        _once(text, x["find"], "not a heading", first, c_start) for x in cfg.get("not_headings") or ()
    ]
    heads = [h for h in bracketed_headings(text, first, c_start, not_heads) if not in_hole(h.start)]
    if len(not_heads) != len(cfg.get("not_headings") or ()):
        raise StructureError("not_headings: a registered quotation was not found")
    heads += registered_headings(text, cfg, first, c_start, holes)
    heads = [h for h in heads if not any(cs <= h.start < ce for cs, ce, _ in chapters)]
    heads.sort(key=lambda h: h.start)
    for a, b in itertools.pairwise(heads):
        if b.start < a.end:
            raise StructureError(f"overlapping headings at {a.start} and {b.start}")
    # boundaries: headings, chapters, conclusion
    bounds = sorted({h.start for h in heads} | {c[0] for c in chapters} | {c_start})

    def next_bound(x: int) -> int:
        return next(b for b in bounds if b > x)

    for i, h in enumerate(heads):
        end = next_bound(h.start)
        chap = [c for c in chapters if c[0] < h.start][-1]
        segs = []
        pos = h.start
        for hs, he in sorted(holes):
            if pos <= hs < end:
                segs.append((pos, hs))
                pos = he
        segs.append((pos, end))
        segs = [_trim(text, s, e) for s, e in segs]
        segs = [(s, e) for s, e in segs if e > s]
        p.entries.append(EntrySpan(i + 1, chap[2], chapters.index(chap) + 1, h, segs))
    # passages: introduction (paragraph by paragraph), chapter headings, conclusion, colophon
    editorial = {x["text"] for x in cfg.get("editorial_headings") or ()}
    views = (cfg.get("introduction") or {}).get("views") or []
    pos = 0
    view = None
    for para in text[:first].split("\n"):
        s, e = _trim(text, pos, pos + len(para))
        pos += len(para) + 1
        if e <= s:
            continue
        body = text[s:e]
        for v in views:
            if body.startswith(v["opens_with"]):
                view = v["id"]
        kind = "editorial-heading" if body in editorial else "text"
        p.passages.append(Passage("introduction", kind, s, e, view if kind == "text" else None))
    for cs, ce, _ in chapters:
        p.passages.append(Passage("chapter", "chapter-heading", cs, ce))
    pos = c_start
    for para in text[c_start:col_start].split("\n"):
        s, e = _trim(text, pos, pos + len(para))
        pos += len(para) + 1
        if e > s:
            p.passages.append(Passage("conclusion", "text", s, e))
    s, e = _trim(text, col_start, len(text))
    p.passages.append(Passage("colophon", "colophon", s, e))
    # set-aside copies
    for bid, bs, be in p.blocks:
        inner_chapters = [(m.start(), m.end()) for m in CHAPTER.finditer(text, bs, be)]
        hs = [
            h
            for h in bracketed_headings(text, bs, be)
            if not any(a <= h.start < b for a, b in inner_chapters)
        ]
        # the block's first copy opens with a half-bracket heading («السجل):») where it was cut from its line
        first_word = _WORD.match(text, bs)
        if (
            first_word
            and (not hs or hs[0].start > bs)
            and text[first_word.end() : first_word.end() + 1] == ")"
        ):
            hs.insert(0, Heading(bs, first_word.end() + 1, first_word.span(), "half-bracket"))
        cuts = sorted({bs, be} | {h.start for h in hs} | {x for span in inner_chapters for x in span})
        by_start = {h.start: h for h in hs}
        for a, b in itertools.pairwise(cuts):
            s, e = _trim(text, a, b)
            if e <= s:
                continue
            if (s, e) in inner_chapters:
                p.passages.append(Passage("set-aside", "chapter-heading", s, e, copy=Copy(bid, None, s, e)))
            else:
                p.passages.append(Passage("set-aside", "copy", s, e, copy=Copy(bid, by_start.get(s), s, e)))
    p.passages.sort(key=lambda x: x.start)
    return p


# --- languages ---------------------------------------------------------------------------------------------
@dataclass
class LanguageForm:
    key: str
    group: str
    name_ar: str
    name_en: str
    words: tuple[str, ...]
    slip: str | None  # evidence when the form is a registered typing slip


def language_forms(reg: list[dict[str, Any]]) -> list[LanguageForm]:
    out = []
    for lang in reg:
        for f in lang.get("forms") or ():
            out.append(
                LanguageForm(
                    lang["key"], lang["group"], lang["name_ar"], lang["name_en"], tuple(f.split()), None
                )
            )
        for sf in lang.get("slip_forms") or ():
            out.append(
                LanguageForm(
                    lang["key"],
                    lang["group"],
                    lang["name_ar"],
                    lang["name_en"],
                    tuple(sf["form"].split()),
                    sf["evidence"],
                )
            )
    # longest first, so «بلسان العبرية» is one match and not «العبرية» inside it
    return sorted(out, key=lambda f: -len(f.words))


def find_languages(text: str, start: int, end: int, forms: list[LanguageForm]) -> list[dict[str, Any]]:
    """Every language form in ``text[start:end]``, as {key, group, name, matched words, offsets in ``text``}."""
    toks = [(m.start(), m.end(), m.group(0)) for m in _WORD.finditer(text, start, end)]
    taken: set[int] = set()
    out = []
    for f in forms:
        n = len(f.words)
        for i in range(len(toks) - n + 1):
            if any(j in taken for j in range(i, i + n)):
                continue
            if tuple(t[2] for t in toks[i : i + n]) == f.words:
                s, e = toks[i][0], toks[i + n - 1][1]
                out.append(
                    {
                        "key": f.key,
                        "group": f.group,
                        "name_ar": f.name_ar,
                        "name_en": f.name_en,
                        "matched_ar": text[s:e],
                        "start": s,
                        "end": e,
                        "slip_evidence": f.slip,
                    }
                )
                taken.update(range(i, i + n))
    return sorted(out, key=lambda x: x["start"])


_UNKNOWN_LANGUAGE = re.compile(r"^بال[ء-ي]{3,}ية$")


def unrecognised_language_words(text: str, start: int, end: int, found: list[dict[str, Any]]) -> list[str]:
    """Words shaped like a language name («بالـ…ية») that no registered form covers («بالطحاوية»)."""
    spans = [(x["start"], x["end"]) for x in found]
    out = []
    for m in _WORD.finditer(text, start, end):
        if _UNKNOWN_LANGUAGE.match(m.group(0)) and not any(a <= m.start() < b for a, b in spans):
            out.append(m.group(0))
    return out


# --- who speaks in a passage -----------------------------------------------------------------------------------
_SPEAKER = re.compile(
    r"(?:^|(?<=[\s.،:]))(?:و|ف|ثم\s+)?(?:قال|نقل|أخرجه|أخرج|شدد|ذهب)\s+"
    r"(?!حدثنا|أخبرنا|حدثني|تعالى|بعضهم|في\s)"
    r"(?P<who>(?:[ء-ي]+\s+){0,4}?[ء-ي]+?)"
    r"(?=\s*(?::|\(|\s(?:في|بعد|رحمه|لو|عن|صرح|ذكر|النكير|إلى|قال)\s))"
)
_SEEN = re.compile(
    r"(?:^|(?<=[\s.،:]))(?:و|ف)?(?:قد\s+)?(?:ثم\s+)?رأيت\s+(?P<who>[ء-ي]+(?:\s+[ء-ي]+)?)\s+(?:صرح|ذكر)"
)
_AUTHOR = re.compile(r"(?:^|(?<=[\s.]))(?:و|ف)?(?:قلت|وهو اختياري)(?=[\s:]|$)")


def speakers(text: str, start: int, end: int) -> list[dict[str, Any]]:
    """The names the passage ``text[start:end]`` gives to who says what («وقال ابن فارس», «ونقل الثعلبي»,
    «ثم رأيت ابن النقيب صرح»), and the author's own «قلت», each with its span in ``text``."""
    out = []
    for rx, kind in ((_SPEAKER, "named"), (_SEEN, "named")):
        for m in rx.finditer(text, start, end):
            out.append({"kind": kind, "who_ar": m.group("who"), "start": m.start("who"), "end": m.end("who")})
    for m in _AUTHOR.finditer(text, start, end):
        out.append({"kind": "author", "who_ar": m.group(0).strip(), "start": m.start(), "end": m.end()})
    out.sort(key=lambda x: x["start"])
    return out


__all__ = [
    "CHAPTER",
    "Heading",
    "Parsed",
    "StructureError",
    "find_languages",
    "language_forms",
    "parse",
    "sentence_start",
    "speakers",
    "unrecognised_language_words",
]
