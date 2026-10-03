"""al-Suyūṭī's *al-Muhadhdhab*: the cleaned text read from OpenITI, its printed pages, and the version check.

The text is cleaned by the one OpenITI cleaner the relation seeds and the particle works use
(``relations.openiti.clean``), after two opt-in rules for this file (``data/loanwords.yaml`` → ``cleaning_rules``):

* ``pipe-paragraphs`` — in this typing a ``|`` inside the running text marks where a paragraph of the Shamela
  typing it was converted from ended (its 225 bars stand where ShamAY0034093 opens a new ``#`` line); the
  shared cleaner removes bars as printed-line marks, which would run the whole of a letter chapter into one
  paragraph. Here a bar inside a line becomes a paragraph break; heading bars (``# |``) are left to the
  cleaner. Whitespace only: no letter is added, removed or changed.
* ``name-marks`` — the pages the Shamela typist typed afresh (the apostrophes stand on pp. 67–79, 82, 118) put
  a straight apostrophe ``'`` around names («قال ' ابن مردويه ' حدثنا ' أحمد …»), a conversion residue like the ``$`` and ``@``
  the shared cleaner drops. They are removed and counted.

Every row's text is a slice of ``Source.text``; the tests re-run this loading on the pinned file.

Printed pages come from the file's own ``PageV01Pnnn`` markers (the marker closes the page it names). They
are ShamAY0034093's markers, carried over by OpenITI's cleaning letter for letter; ShamAY0034093 is the
Shamela typing of Samīr Ḥusayn Ḥalabī's edition whose card says «ترقيم الشاملة موافق للمطبوع», and each of
its 126 page labels («صفحة رقم N») follows the marker of page N − 1. ``compare_same_typing`` re-checks both
claims at build time; ``compare_other_edition`` compares the third version (Shamela0026097, another edition's
typing) word by word.
"""

from __future__ import annotations

import bisect
import difflib
import re
from dataclasses import dataclass, field
from typing import Any

from ..particles.text import Block, align_letters, letter_positions
from ..relations.openiti import HEADER_END, Clean, clean

_HEADING_LINE = re.compile(r"^(#+ ?\|)(.*)$")
_SHAMELA_LABEL = re.compile(r'"{6} صفحة رقم (?:(ms\d+) )?\d+ "{6}')
_MARKER_OR_LABEL = re.compile(r'PageV01P(\d+)|"{6} صفحة رقم (?:ms\d+ )?(\d+) "{6}')
_WORD = re.compile("[ء-ي]+")


def preclean(raw: str, rules: set[str]) -> tuple[str, dict[str, int]]:
    """Apply the opt-in rules ``pipe-paragraphs`` and ``name-marks`` to the raw file (body only)."""
    if HEADER_END not in raw:
        raise ValueError(f"no {HEADER_END} line — not an OpenITI mARkdown file")
    head, body = raw.split(HEADER_END, 1)
    stats: dict[str, int] = {}
    if "pipe-paragraphs" in rules:
        out = []
        n = 0
        for line in body.split("\n"):
            m = _HEADING_LINE.match(line)
            prefix, rest = (m.group(1), m.group(2)) if m else ("", line)
            n += rest.count("|")
            out.append(prefix + rest.replace("|", "\n# "))
        body = "\n".join(out)
        stats["pipe-paragraphs"] = n
    if "name-marks" in rules:
        stats["name-marks"] = body.count("'")
        body = body.replace("'", "")
    return head + HEADER_END + body, stats


@dataclass
class Source:
    """The registered work: its cleaned text and where every offset stands in the printed edition."""

    id: str
    uri: str
    clean: Clean
    precleaning: dict[str, int] = field(default_factory=dict)
    _pp: list[int] = field(default_factory=list, repr=False)
    _mp: list[int] = field(default_factory=list, repr=False)

    def __post_init__(self) -> None:
        self._pp = [p for p, _, _ in self.clean.pages]
        self._mp = [p for p, _ in self.clean.milestones]

    @property
    def text(self) -> str:
        return self.clean.text

    def page_at(self, offset: int) -> int:
        """The printed page a character stands on: the first page marker after it closes its page."""
        pages = self.clean.pages
        i = bisect.bisect_right(self._pp, offset)
        return pages[i][2] if i < len(pages) else pages[-1][2] + 1

    def milestone_at(self, offset: int) -> int:
        ms = self.clean.milestones
        i = bisect.bisect_right(self._mp, offset)
        return ms[i][1] if i < len(ms) else ms[-1][1] + 1

    def pages_of(self, start: int, end: int) -> list[int]:
        """Every printed page the span ``[start, end)`` stands on, in order."""
        last = max(start, end - 1)
        return list(range(self.page_at(start), self.page_at(last) + 1))

    def locator(self, start: int, end: int | None = None) -> dict[str, Any]:
        page = self.page_at(start)
        return {
            "locator": f"urn:cts:arabicLit:{self.uri}:1.{page}",
            "page": page,
            "pages": self.pages_of(start, end) if end is not None else [page],
            "milestone": f"ms{self.milestone_at(start):03d}",
        }


def load_source(src: dict[str, Any], raw: str) -> Source:
    rules = set(src.get("extra_cleaning") or ())
    pre, stats = preclean(raw, rules)
    return Source(src["id"], src["openiti_uri"], clean(pre, src["openiti_uri"]), stats)


# --- version check ------------------------------------------------------------------------------------
def _letters(c: Clean) -> tuple[list[int], str]:
    lp = letter_positions(c.text)
    return lp, "".join(c.text[p] for p in lp)


def _stretches(a: str, b: str, blocks: list[Block]) -> list[tuple[int, int, int, int]]:
    out = []
    pa = pb = 0
    for blk in [*blocks, Block(len(a), len(b), 0)]:
        if blk.a > pa or blk.b > pb:
            out.append((pa, blk.a, pb, blk.b))
        pa, pb = blk.a + blk.size, blk.b + blk.size
    return out


def compare_same_typing(primary: Clean, raw_other: str, uri: str) -> dict[str, Any]:
    """Letter-level comparison with ShamAY0034093, the Shamela typing JK009264 was cleaned from: the
    differing stretches, and whether its page markers stand where the primary's do. Its page labels (the
    words «صفحة رقم N» between two runs of six double quotes, a milestone sometimes inside) are dropped first
    and checked to follow the marker of page N − 1."""
    raw_other = raw_other.lstrip(chr(0xFEFF))
    last = None
    label_ok = label_bad = 0
    for marker, label in _MARKER_OR_LABEL.findall(raw_other):
        if marker:
            last = int(marker)
        elif last is not None and int(label) == last + 1:
            label_ok += 1
        else:
            label_bad += 1
    other = clean(_SHAMELA_LABEL.sub(lambda m: m.group(1) or "", raw_other), uri)
    la, a = _letters(primary)
    lb, b = _letters(other)
    blocks = align_letters(a, b, window=12, reach=400)
    diffs = []
    for pa, a_end, pb, b_end in _stretches(a, b, blocks):
        sa = primary.text[la[pa] : la[a_end - 1] + 1] if a_end > pa else ""
        sb = other.text[lb[pb] : lb[b_end - 1] + 1] if b_end > pb else ""
        diffs.append({"primary": sa, "other": sb, "letters": max(a_end - pa, b_end - pb)})
    b_starts = [blk.b for blk in blocks]

    def to_a(j: int) -> int:
        k = bisect.bisect_right(b_starts, j) - 1
        if k >= 0 and j < blocks[k].b + blocks[k].size:
            return blocks[k].a + (j - blocks[k].b)
        return blocks[k + 1].a if k + 1 < len(blocks) else len(a)

    mine = {(bisect.bisect_left(la, off), page) for off, _, page in primary.pages}
    theirs = {(to_a(bisect.bisect_left(lb, off)), page) for off, _, page in other.pages}
    return {
        "uri": uri,
        "letters_primary": len(a),
        "letters_other": len(b),
        "letters_differing": sum(d["letters"] for d in diffs),
        "differences": diffs,
        "page_markers_primary": len(primary.pages),
        "page_markers_other": len(other.pages),
        "page_markers_at_the_same_letter": len(mine & theirs),
        "page_labels_following_their_marker": label_ok,
        "page_labels_out_of_step": label_bad,
    }


def compare_other_edition(primary: Clean, raw_other: str, uri: str, min_words: int = 4) -> dict[str, Any]:
    """Word-level comparison with Shamela0026097, another edition's typing of the same text: how many words
    agree in order, and every hunk of ``min_words`` or more where they part (with the printed page on
    both sides), which is where blocks were moved, added or left out."""
    other = clean(raw_other, uri)
    wa = [(m.start(), m.group(0)) for m in _WORD.finditer(primary.text)]
    wb = [(m.start(), m.group(0)) for m in _WORD.finditer(other.text)]
    sm = difflib.SequenceMatcher(None, [w for _, w in wa], [w for _, w in wb], autojunk=False)
    hunks = []
    small = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        if max(i2 - i1, j2 - j1) < min_words:
            small += 1
            continue

        def page(c: Clean, off: int) -> int | None:
            p = c.page_at(off)
            return p[1] if p else None

        hunks.append(
            {
                "op": tag,
                "words_primary": i2 - i1,
                "words_other": j2 - j1,
                "page_primary": page(primary, wa[i1][0]) if i1 < len(wa) else None,
                "page_other": page(other, wb[j1][0]) if j1 < len(wb) else None,
                "opens_primary": " ".join(w for _, w in wa[i1 : min(i2, i1 + 8)]),
                "opens_other": " ".join(w for _, w in wb[j1 : min(j2, j1 + 8)]),
            }
        )
    return {
        "uri": uri,
        "words_primary": len(wa),
        "words_other": len(wb),
        "words_in_common_in_order": sum(blk.size for blk in sm.get_matching_blocks()),
        "small_differences": small,
        "hunks": hunks,
        "page_markers_other": len(other.pages),
        "printed_pages_other": [other.pages[0][2], other.pages[-1][2]] if other.pages else None,
    }


__all__ = ["Source", "compare_other_edition", "compare_same_typing", "load_source", "preclean"]
