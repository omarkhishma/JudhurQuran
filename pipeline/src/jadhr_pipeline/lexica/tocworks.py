"""Article segmentation for Shamela works whose articles are listed in the TOC
(al-Mufradat, Maqayis al-Lugha, al-Sihah).

The TOC gives the expected ordered list of article headwords. Shamela's own anchors for them
are not reliable (some sit inside a word of the previous article), so an article boundary is
the printed heading LINE that matches the next expected TOC title:

* ``parent-kitab``      (al-Mufradat) — the headword stands alone on its line ("رحم").
* ``after-first-kitab`` (Maqayis)     — the headword stands alone on its line, as a TOC span.
* ``bracketed``         (al-Sihah)    — the line opens with the bracketed headword "[رحم] …".

A standalone TOC heading that is a section (كتاب/باب/فصل…) closes the running article; the
text under it up to the next article is section prose and is not imported. Expected titles
that cannot be found within a short look-ahead are reported (their text stays in the
preceding article, unchanged).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import strip_marks

from .maqayis_core import core_statement
from .registry import WorkSpec
from .shamela import Counters, Line, TocEntry, assemble, match_key, root_like_title

LOOKAHEAD = 4
_NOT_HEADING_CHAR = re.compile("[^\u0621-\u0652\u0670\u0671\\s]")
_BRACKET = re.compile(r"^\s*\[([^\]\[]{1,24})\]?\s*(.*)$", re.S)


@dataclass
class RawArticle:
    headword: str
    body: str
    page_ref: str | None
    source_ref: str
    core_meaning: str | None = None
    # Root-mapping keys when they differ from the printed headword: the permutations of a combined
    # header ("عق، قع") or the Tāj root an al-Qāmūs bullet is aligned to. Never displayed.
    match_heads: list[str] | None = None


@dataclass
class _Open:
    headword: str
    source_ref: str
    lines: list[Line] = field(default_factory=list)
    first_text: str | None = None


def _expected(spec: WorkSpec, toc: dict[int, TocEntry]) -> tuple[list[TocEntry], set[int], int | None]:
    rule = spec.cfg["article_rule"]
    entries = sorted(toc.values(), key=lambda e: e.order)
    articles: list[TocEntry] = []
    end_id: int | None = None
    if rule == "parent-kitab":
        articles = [e for e in entries if (e.parent_title or "").startswith("كتاب")]
        end_id = next((e.shamela_title_id for e in entries if e.title.startswith("الفهارس")), None)
    elif rule == "after-first-kitab":
        started = False
        for e in entries:
            if not started and e.title.startswith("كتاب"):
                started = True
            if started and e.title == spec.cfg.get("end_title"):
                end_id = e.shamela_title_id
                break
            if started and root_like_title(e.title):
                articles.append(e)
    elif rule == "bracketed":
        articles = [e for e in entries if e.title.strip().startswith("[") and root_like_title(e.title)]
    else:
        raise ValueError(f"{spec.id}: unknown article_rule {rule}")
    ids = {e.shamela_title_id for e in articles}
    sections = {e.shamela_title_id for e in entries if e.shamela_title_id not in ids}
    return articles, sections, end_id


_TRAILING_DIGITS = re.compile(r"\s*[\u0660-\u06690-9]+$")
_LETTER_NAMES = {
    "ء": "الهمزة", "ب": "الباء", "ت": "التاء", "ث": "الثاء", "ج": "الجيم", "ح": "الحاء", "خ": "الخاء",
    "د": "الدال", "ذ": "الذال", "ر": "الراء", "ز": "الزاء", "س": "السين", "ش": "الشين", "ص": "الصاد",
    "ض": "الضاد", "ط": "الطاء", "ظ": "الظاء", "ع": "العين", "غ": "الغين", "ف": "الفاء", "ق": "القاف",
    "ك": "الكاف", "ل": "اللام", "م": "الميم", "ن": "النون", "ه": "الهاء", "و": "الواو", "ي": "الياء",
}  # fmt: skip
_RADICAL_FOLD = str.maketrans(
    {
        "\u0623": "\u0621",
        "\u0625": "\u0621",
        "\u0622": "\u0621",
        "\u0627": "\u0621",
        "\u0649": "\u064a",
        "\u0629": "\u0647",
    }
)


@dataclass(frozen=True)
class _Head:
    key: str
    printed: str
    rest: str
    toc_id: int | None
    span: bool


def _heading(rule: str, line: Line, counters: Counters) -> _Head | None:
    """A line that looks like an article heading (not yet checked against the TOC)."""
    text = line.text.strip()
    if not text:
        return None
    lead = line.leading_span
    if rule == "bracketed":
        m = _BRACKET.match(line.text)
        if not m or not root_like_title(m.group(1)):
            return None
        return _Head(
            match_key(m.group(1)),
            "[" + m.group(1).strip() + "]",
            m.group(2),
            lead.toc_id if lead else None,
            lead is not None,
        )
    bare = text.strip("[]() ")
    digits = _TRAILING_DIGITS.search(bare)
    if digits:
        # "كون ١": a footnote reference digit printed after the headword (not text).
        bare = bare[: digits.start()].strip("[]() ")
    tokens = bare.split()
    if not tokens or len(tokens) > 3 or _NOT_HEADING_CHAR.search(bare):
        return None
    if digits:
        counters.add("footnote-markers-removed:heading-digit")
        counters.add("footnote-markers-removed")
    sl = line.span_line
    return _Head(match_key(bare), bare, "", sl.toc_id if sl else None, sl is not None)


def _formula_follows(lines: list[Line], i: int, key_letters: str) -> bool:
    """Maqayis: an article opens by naming its letters ("الكاف والواو والنون أصلٌ…")."""
    letters = strip_marks(key_letters).translate(_RADICAL_FOLD)
    if len(letters) < 2 or letters[0] not in _LETTER_NAMES or letters[1] not in _LETTER_NAMES:
        return False
    for j in range(i + 1, min(i + 3, len(lines))):
        nxt = strip_marks(lines[j].text).strip()
        if nxt:
            words = nxt.split()
            return (
                len(words) >= 2
                and words[0] == _LETTER_NAMES[letters[0]]
                and words[1].startswith("و" + _LETTER_NAMES[letters[1]])
            )
    return False


def segment_toc_work(
    spec: WorkSpec, lines: list[Line], toc: dict[int, TocEntry], counters: Counters
) -> tuple[list[RawArticle], dict[str, Any]]:
    rule = spec.cfg["article_rule"]
    expected, sections, end_id = _expected(spec, toc)
    exp_keys = [match_key(e.title) for e in expected]
    sid = spec.cfg["shamela_id"]
    out: list[RawArticle] = []
    not_found: list[str] = []
    not_in_toc: list[str] = []
    k = 0
    started = False
    ended = False
    current: _Open | None = None
    skipped = 0

    def close() -> None:
        nonlocal current
        if current is None:
            return
        body, ref = assemble(current.lines, counters, current.first_text)
        core = None
        if spec.cfg.get("core_meaning") == "statement":
            core, how = core_statement(body)
            counters.add(f"core-statement:{how}")
        out.append(RawArticle(current.headword, body, ref, current.source_ref, core))
        current = None

    for i, line in enumerate(lines):
        sl = line.span_line
        if sl is not None and sl.toc_id in sections:
            close()
            counters.add("front-matter-skipped:section-headings")
            title = toc[sl.toc_id].title
            if rule == "after-first-kitab" and title.startswith("كتاب"):
                started = True
            if end_id is not None and sl.toc_id == end_id:
                ended = True
            continue
        h = None if ended else _heading(rule, line, counters)
        accept = False
        toc_id: int | None = None
        if h is not None:
            j = next((j for j in range(k, min(k + LOOKAHEAD, len(expected))) if exp_keys[j] == h.key), None)
            if j is not None and (started or rule != "after-first-kitab"):
                not_found.extend(e.title for e in expected[k:j])
                k = j + 1
                started = True
                accept = True
                toc_id = expected[j].shamela_title_id
            elif started and (
                rule == "bracketed"
                or (rule == "after-first-kitab" and h.span)
                or (rule == "after-first-kitab" and _formula_follows(lines, i, h.key))
            ):
                accept = True
                toc_id = h.toc_id
                not_in_toc.append(h.printed)
        if accept and h is not None:
            close()
            ref = (
                f"shamela:{sid}:toc-{toc_id}"
                if toc_id is not None
                else f"shamela:{sid}:page-{line.page.shamela_page_id}:line-{i}"
            )
            current = _Open(h.printed, ref)
            if h.rest.strip():
                current.lines.append(line)
                current.first_text = h.rest
            continue
        if current is not None and not ended:
            current.lines.append(line)
        else:
            skipped += len(line.text)
    close()
    not_found.extend(e.title for e in expected[k:])
    counters.add("front-matter-skipped:chars", skipped)
    counters.add("toc-heading-not-found", len(not_found))
    counters.add("heading-not-in-toc", len(not_in_toc))
    return out, {
        "expected_articles": len(expected),
        "toc_headings_not_found": not_found,
        "headings_not_in_toc": not_in_toc,
    }
