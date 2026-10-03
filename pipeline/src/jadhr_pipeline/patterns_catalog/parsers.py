"""Structure parsers: where each catalog row lies in a cleaned text. They return spans; nothing is copied.

* ``matn`` (al-Shāfiya, al-Kāfiya) — the chapters the registry names, found by the edition's heading as
  written (al-ʿUthmān's «# | الماضي», al-Shāʿir's «[اسم الفاعل]»). Two modes:

  - ``verb-statements`` — «الماضي»: a statement opens with a paragraph whose first word (after «و») is a
    pattern («ففعل لمعان كثيرة»، «و أفعل للتعدية»…) and runs to the next such paragraph; paragraphs before
    the first statement list the paradigms (kind ``inventory``). A statement's meanings are split where
    «و» or «أو» introduces a new one: a purpose «لـ» (للتعريض، لصيرورته، لوجوده، ليدل), «بمعنى», «مطاوع»
    (also «قد جاء مطاوع»), «باب» (باب المغالبة) or «تجيء / يجيء» (و تجيء الألوان …). «و منه …», «و من ثم
    …», «و شذ …» stay with the meaning they qualify. Each meaning is a row (kind ``meaning``).
  - ``paragraphs`` — every paragraph of the chapter (or the ones the registry selects) is a row; a
    paragraph ending in «نحو» runs on into the next, and a quoted verse line joins the paragraph before it.

* ``radi`` — al-Raḍī quotes the matn as «قال: " … "» (sometimes «قال " … "»), comments after «أقول:», and
  inside the comment takes up phrases as «قوله " … "». A block is the quote and its comment, up to the next
  quote; a comment is cut at each «قوله» into segments.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from itertools import pairwise
from typing import Any

from jadhr_arabic import display_bare

from ..relations.openiti import Clean
from .mentions import pattern_norm, tokens
from .text import paragraphs

SENSE_BOUNDARY = re.compile(
    r"(?<=\s)(?:و|أو) ?(?=لل|لصيرورت|لوجود|ليدل|بمعنى|مطاوع|قد جاء مطاوع|باب |تجيء|يجيء)"
)


@dataclass
class Unit:
    section: str
    heading_ar: str
    start: int
    end: int
    kind: str
    statement: int
    sense: int
    head: tuple[int, int] | None = None  # the statement's pattern word (verb chapters)
    statement_span: tuple[int, int] | None = None
    config: dict[str, Any] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


@dataclass
class Segment:
    start: int
    end: int
    cue: tuple[int, int] | None  # the phrase inside «قوله " … "»


@dataclass
class Block:
    seq: int
    matn: tuple[int, int]
    comment: tuple[int, int]
    segments: list[Segment]


def _trim(text: str, s: int, e: int) -> tuple[int, int]:
    while s < e and text[s] in " \n":
        s += 1
    while e > s and text[e - 1] in " \n":
        e -= 1
    return s, e


def _head(text: str, s: int, e: int) -> tuple[int, int] | None:
    toks = tokens(text[s:e])[:2]
    if not toks:
        return None
    t = toks[1] if display_bare(toks[0].text) == "و" and len(toks) > 1 else toks[0]
    return (s + t.start, s + t.end) if pattern_norm(t.text) else None


def _select(paras: list[tuple[int, int, bool]], sel: list[int] | None) -> list[tuple[int, int, bool]]:
    if not sel:
        return paras
    return [p for i, p in enumerate(paras, 1) if i in sel]


def _join_runons(text: str, paras: list[tuple[int, int, bool]]) -> list[tuple[int, int]]:
    """A paragraph ending in «نحو» runs into the next; a quoted verse line «( … )» joins the one before."""
    out: list[tuple[int, int]] = []
    for s, e, _ in paras:
        body = text[s:e].strip()
        verse = body.startswith("(") and body.endswith(")")
        if out and (verse or text[out[-1][0] : out[-1][1]].endswith("نحو")):
            out[-1] = (out[-1][0], e)
        else:
            out.append((s, e))
    return out


def parse_matn(c: Clean, sections: list[dict[str, Any]]) -> tuple[list[Unit], list[str]]:
    """Rows of the chapters the registry names; returns (units, headings not found)."""
    text = c.text
    paras = paragraphs(c)
    heads = [i for i, (_, _, h) in enumerate(paras) if h]
    by_heading = {sec["heading"]: sec for sec in sections}
    found: set[str] = set()
    units: list[Unit] = []
    for k, hi in enumerate(heads):
        hs, he, _ = paras[hi]
        heading = text[hs:he]
        sec = by_heading.get(heading)
        if not sec or heading in found:
            continue
        found.add(heading)
        end = heads[k + 1] if k + 1 < len(heads) else len(paras)
        body = [p for p in paras[hi + 1 : end] if p[1] > p[0]]
        if sec.get("mode") == "verb-statements":
            units += _verb_statements(text, body, sec, heading)
        else:
            units += _paragraph_units(text, _select(body, sec.get("paragraphs")), sec, heading)
    missing = [h for h in by_heading if h not in found]
    return units, missing


def _paragraph_units(
    text: str, body: list[tuple[int, int, bool]], sec: dict[str, Any], heading: str
) -> list[Unit]:
    units: list[Unit] = []
    for n, (s, e) in enumerate(_join_runons(text, body), 1):
        s, e = _trim(text, s, e)
        section = sec["id"]
        for ov in sec.get("overrides") or []:
            if ov["contains"] in text[s:e]:
                section = ov["id"]
        kind = "definition" if n == 1 and sec.get("first_is_definition") else "statement"
        units.append(Unit(section, heading, s, e, kind, n, 1, config=sec))
    return units


def _verb_statements(
    text: str, body: list[tuple[int, int, bool]], sec: dict[str, Any], heading: str
) -> list[Unit]:
    units: list[Unit] = []
    starts = [i for i, (s, e, _) in enumerate(body) if _head(text, s, e)]
    first = starts[0] if starts else len(body)
    for n, (s, e) in enumerate(_join_runons(text, body[:first]), 1):
        s, e = _trim(text, s, e)
        units.append(Unit(sec["id"], heading, s, e, "inventory", 0, n, config=sec))
    for k, i in enumerate(starts, 1):
        j = starts[k] if k < len(starts) else len(body)
        st_s, st_e = body[i][0], body[j - 1][1]
        head = _head(text, body[i][0], body[i][1])
        cuts = [st_s] + [m.start() for m in SENSE_BOUNDARY.finditer(text, st_s, st_e)] + [st_e]
        for m, (a, b) in enumerate(pairwise(cuts), 1):
            a, b = _trim(text, a, b)
            units.append(
                Unit(
                    sec["id"],
                    heading,
                    a,
                    b,
                    "meaning",
                    k,
                    m,
                    head=head,
                    statement_span=(st_s, st_e),
                    config=sec,
                )
            )
    return units


_QAL = re.compile(r'(?<!\S)قال:? "')
_AQUL = re.compile(r'"[\s.،]*أقول:?')
_QAWLUH = re.compile(r'(?<!\S)و?قوله:? "([^"\n]{1,300})"')
# «حالا من قوله " أصله " أو من قوله " أحد الامرين "»: a phrase referred to inside a sentence, not a new comment
_NOT_A_CUE_AFTER = {"من", "في", "إلى", "على", "عن", "أو", "بين", "كما", "مثل", "نحو", "بخلاف"}


def _cues(text: str, start: int, end: int) -> list[re.Match[str]]:
    out = []
    for q in _QAWLUH.finditer(text, start, end):
        before = text[max(start, q.start() - 20) : q.start()].split()
        if before and display_bare(before[-1]) in _NOT_A_CUE_AFTER:
            continue
        out.append(q)
    return out


def parse_radi(c: Clean) -> list[Block]:
    """Every «قال: " matn " أقول: comment» block of al-Raḍī's sharḥ, its comment cut at each «قوله"…"»."""
    text = c.text
    opens = list(_QAL.finditer(text))
    blocks: list[Block] = []
    for k, m in enumerate(opens):
        nxt = opens[k + 1].start() if k + 1 < len(opens) else len(text)
        close = _AQUL.search(text, m.end(), nxt)
        if not close:
            continue  # a quotation that is not followed by «أقول» is not a matn block
        matn = _trim(text, m.end(), close.start())
        comment = _trim(text, close.end(), nxt)
        cues = _cues(text, comment[0], comment[1])
        segs: list[Segment] = []
        cuts = [comment[0]] + [q.start() for q in cues] + [comment[1]]
        for i, (a, b) in enumerate(pairwise(cuts)):
            a, b = _trim(text, a, b)
            if b <= a:
                continue
            cue = cues[i - 1].span(1) if i > 0 else None
            segs.append(Segment(a, b, cue))
        blocks.append(Block(len(blocks) + 1, matn, comment, segs))
    return blocks
