"""A particle work's cleaned text, with printed-page locators that may come from a second OpenITI version.

The text is cleaned by the one OpenITI cleaner the relation seeds use (``relations.openiti.clean``), so every
row is a slice of ``Source.clean.text``. al-Murādī's text is read from OpenITI's primary version, whose page
markers are al-Jāmiʿ al-Kabīr's screens, not printed pages; the printed pages of the edition come from the
Shamela version of the same typing (``page_source`` in ``data/particles.yaml``). The two files carry the
same letters in the same order (the build checks it: ``page_alignment`` in the report), so a printed-page
marker is carried over to the primary text by letter position: the n-th Arabic letter of one file is the
n-th of the other, except where the alignment shows a differing letter.
"""

from __future__ import annotations

import bisect
import re
from dataclasses import dataclass, field
from typing import Any

from ..relations.openiti import Clean, clean

LETTER = re.compile("[ء-ي]")


def letter_positions(text: str) -> list[int]:
    """Offsets of the Arabic letters (hamza … yā') in ``text``."""
    return [m.start() for m in LETTER.finditer(text)]


@dataclass
class PageMap:
    """Printed-page and milestone lookup for offsets into a cleaned text."""

    page_uri: str  # the version whose page markers give the printed pages
    pages: list[tuple[int, int, int]]  # (offset in the text where the marker stood, volume, page it closes)
    milestones: list[tuple[int, int]]  # (offset, milestone it closes) — of the text's own version
    _pp: list[int] = field(default_factory=list, repr=False)
    _mp: list[int] = field(default_factory=list, repr=False)

    def __post_init__(self) -> None:
        self._pp = [p for p, _, _ in self.pages]
        self._mp = [p for p, _ in self.milestones]

    def page_at(self, offset: int) -> tuple[int, int] | None:
        """The page a character stands on: the first page marker after it closes its page."""
        if not self.pages:
            return None
        i = bisect.bisect_right(self._pp, offset)
        if i < len(self.pages):
            return self.pages[i][1], self.pages[i][2]
        return self.pages[-1][1], self.pages[-1][2] + 1

    def milestone_at(self, offset: int) -> int | None:
        if not self.milestones:
            return None
        i = bisect.bisect_right(self._mp, offset)
        if i < len(self.milestones):
            return self.milestones[i][1]
        return self.milestones[-1][1] + 1

    def locator(self, start: int) -> dict[str, Any]:
        page = self.page_at(start)
        ms = self.milestone_at(start)
        return {
            "locator": f"urn:cts:arabicLit:{self.page_uri}:{page[0]}.{page[1]}"
            if page
            else f"urn:cts:arabicLit:{self.page_uri}",
            "page_vol": page[0] if page else None,
            "page": page[1] if page else None,
            "milestone": f"ms{ms:03d}" if ms is not None else None,
        }


@dataclass
class Source:
    """One registered work: its cleaned text and where every offset stands in the printed edition."""

    id: str
    clean: Clean
    pages: PageMap
    alignment: dict[str, Any] | None = None  # page_source alignment statistics (al-Murādī)

    @property
    def text(self) -> str:
        return self.clean.text


@dataclass(frozen=True)
class Block:
    a: int
    b: int
    size: int


def align_letters(a: str, b: str, window: int = 16, reach: int = 400) -> list[Block]:
    """Matching blocks of two nearly identical letter strings: walk both, and where they part, resume at
    the nearest point (fewest letters skipped on both sides) where ``window`` letters agree again.
    Linear in the length for texts that differ in a few places (difflib is quadratic here)."""
    blocks: list[Block] = []
    i = j = 0
    n, m = len(a), len(b)
    while i < n and j < m:
        if a[i] == b[j]:
            k = 0
            while i + k < n and j + k < m and a[i + k] == b[j + k]:
                k += 1
            blocks.append(Block(i, j, k))
            i, j = i + k, j + k
            continue
        for d in range(1, 2 * reach + 1):
            hit = next(
                (
                    (di, d - di)
                    for di in range(max(0, d - reach), min(d, reach) + 1)
                    if a[i + di : i + di + window] == b[j + d - di : j + d - di + window]
                    and i + di + window <= n
                    and j + d - di + window <= m
                ),
                None,
            )
            if hit:
                i, j = i + hit[0], j + hit[1]
                break
        else:
            break  # the texts part for good: the rest is reported as one difference
    return blocks


def transfer_pages(text: Clean, page_source: Clean) -> tuple[list[tuple[int, int, int]], dict[str, Any]]:
    """Carry ``page_source``'s printed-page markers over to ``text`` by letter position.

    Both files must be the same typing: their letter strings are aligned (``align_letters``), every
    differing stretch is reported, and the build fails when more than a handful of letters differ."""
    la = letter_positions(text.text)
    lb = letter_positions(page_source.text)
    a = "".join(text.text[p] for p in la)
    b = "".join(page_source.text[p] for p in lb)
    blocks = align_letters(a, b)
    diffs: list[dict[str, Any]] = []
    pa = pb = 0
    for blk in [*blocks, Block(len(a), len(b), 0)]:
        if blk.a > pa or blk.b > pb:
            diffs.append(
                {
                    "text": a[pa : blk.a],
                    "page_source": b[pb : blk.b],
                    "context": a[max(0, pa - 12) : blk.a + 12],
                }
            )
        pa, pb = blk.a + blk.size, blk.b + blk.size
    differing = sum(max(len(d["text"]), len(d["page_source"])) for d in diffs)
    if differing > 20:
        raise ValueError(
            f"{text.uri} and {page_source.uri} are not the same typing: {differing} letters differ"
        )
    b_starts = [blk.b for blk in blocks]

    def to_a(j: int) -> int:
        """The letter index in ``a`` matching letter index ``j`` of ``b`` (the next matched letter when ``j``
        falls in a differing stretch)."""
        k = bisect.bisect_right(b_starts, j) - 1
        if k >= 0 and j < blocks[k].b + blocks[k].size:
            return blocks[k].a + (j - blocks[k].b)
        return blocks[k + 1].a if k + 1 < len(blocks) else len(a)

    pages: list[tuple[int, int, int]] = []
    for off, vol, page in page_source.pages:
        j = bisect.bisect_left(lb, off)  # letters of the page source before the marker
        i = to_a(j)
        pages.append((la[i] if i < len(la) else len(text.text), vol, page))
    stats = {
        "letters_text": len(a),
        "letters_page_source": len(b),
        "letters_differing": differing,
        "differences": diffs,
        "page_markers": len(pages),
    }
    return pages, stats


def load_source(src: dict[str, Any], raw_text: str, page_raw: str | None) -> Source:
    """Clean a registered work and build its page map (``page_raw``: the page-source file, if any)."""
    rules = set(src.get("extra_cleaning") or ())
    c = clean(raw_text, src["openiti_uri"], inline_headings="inline-heading-marks" in rules)
    if page_raw is None:
        return Source(src["id"], c, PageMap(src["openiti_uri"], c.pages, c.milestones))
    ps = src["page_source"]
    pc = clean(page_raw, ps["openiti_uri"])
    pages, stats = transfer_pages(c, pc)
    return Source(src["id"], c, PageMap(ps["openiti_uri"], pages, c.milestones), stats)
