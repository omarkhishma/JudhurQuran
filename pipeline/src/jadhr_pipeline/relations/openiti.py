"""OpenITI mARkdown → the author's running text, with printed-page and milestone locators.

The relation seeds quote their source verbatim, so this is the ONE place where a source file is turned
into text. Every row's ``text`` is a slice of ``clean(raw).text``; the tests re-run this cleaning on the
pinned file and check that each row is a substring of it. The rules (also listed, with the same ids, in
``data/relations.yaml`` → ``cleaning_rules``; each is counted per source in the build report):

* ``header-dropped`` — the ``#META#`` header up to ``#META#Header#End#``.
* ``annotator-lines-dropped`` — OpenITI working notes on their own line (``### | CHECK [13-89]``).
* ``auto-heading-inline`` — ``### | AUTO X``: a word the conversion lifted out of the running text into a
  heading line (Ibn al-Anbārī's headwords, printed bold inline). ``X`` is put back where it stood: glued to
  a one-letter proclitic before it (و ف ب ل ك), and to the next line when that line continues the word
  (``# ة: قطعة`` → ``الفلذة: قطعة``; ``#  من`` with a space keeps the space).
* ``paragraphs`` — ``# `` opens a paragraph, ``~~`` continues it (joined with one space), heading lines
  (``# |``, ``### |``) are paragraphs of their own; a line holding only a page or milestone marker stays in
  the paragraph it interrupts. Paragraphs are separated by ``\\n``.
* ``page-marks`` — ``PageVxxPyyy`` removed and kept as a locator (the marker closes printed page yyy).
* ``milestones`` — ``msNNN`` removed and kept as a locator (the marker closes 300-word chunk NNN; OpenITI
  regenerates milestones, so they are cited only together with the release).
* ``line-marks`` — ``|``, the typist's printed-line breaks and heading bars, removed.
* ``quote-markup`` — ``@QB@ … @QE@`` and ``^`` (OpenITI's Quran-quote tags) removed; ``@QB@…@QE@`` spans, and
  ``^ ( … ) ^`` pairs that enclose one bracketed span, are kept as quote spans for verse resolution.
* ``stray-marks`` — ``$`` and ``@`` left over from the conversion, removed.
* ``folio-marks`` — the modern editor's manuscript folio marks ``( 52 / أ )`` removed (decision D22).
* ``whitespace`` — runs of spaces collapse to one; paragraphs are trimmed and empty ones dropped; no space
  before ``، ؛ : . ؟ ! ) ]`` or after ``( [``. Whitespace only: no letter is added, removed or changed.

One rule is opt-in (``clean(..., inline_headings=True)``), for files converted from al-Jāmiʿ al-Kabīr that
mark headings inside the running text (the particle works, ``data/particles.yaml``):

* ``inline-heading-marks`` — ``& X &``: the two ampersands are removed and ``X`` becomes a heading paragraph
  of its own, splitting the paragraph it stood in («… شرحها & حرف الألف &» → «… شرحها» / «حرف الألف»).
"""

from __future__ import annotations

import bisect
import re
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field

HEADER_END = "#META#Header#End#"

_PAGE_ONLY = re.compile(r"^\s*(?:PageV\d+P\d+|ms\d+)(?:\s+(?:PageV\d+P\d+|ms\d+))*\s*\|?\s*$")
_HEADING_3 = re.compile(r"^###\s*\|+\s?(.*)$")
_TOKEN = re.compile(
    r"PageV(?P<pv>\d+)P(?P<pp>\d+)"
    r"|(?<![A-Za-z])ms(?P<ms>\d+)(?![A-Za-z])"
    r"|(?P<qb>@QB@)|(?P<qe>@QE@)"
    r"|(?P<folio>\(\s*\d+\s*/\s*[أبا]\s*\))"
    r"|(?P<line>\|)|(?P<quote>\^)|(?P<stray>[$@])"
)
# the edition's footnote numbers left glued to the word they annotate («دب1 على»), the footnotes themselves gone
_FOOTNOTE_REF = re.compile(r"(?<=[\u0621-\u064A\u064B-\u0652\u0670])\d{1,3}(?=[\s،؛:.؟!)\]»\"]|$)")
_PROCLITIC_END = re.compile(r"(?:^|[\s،؛:.(\[])[وفبلك]$")

# Whitespace-only normalisation, in order. Each is a (pattern, replacement) applied with offset tracking.
_SPACING: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile("[ \t" + chr(0xA0) + "]+"), " "),  # spaces, tabs, no-break spaces
    (re.compile(r" ?\n ?"), "\n"),
    (re.compile(r"\n{2,}"), "\n"),
    (re.compile(r" +(?=[،؛:.؟!)\]])"), ""),
    (re.compile(r"(?<=[(\[]) +"), ""),
    (re.compile(r"^[ \n]+|[ \n]+$"), ""),
)


@dataclass
class Clean:
    """A cleaned OpenITI text and everything needed to cite a span of it."""

    uri: str
    text: str
    pages: list[tuple[int, int, int]]  # (offset where the marker stood, volume, page it closes)
    milestones: list[tuple[int, int]]  # (offset, milestone number it closes)
    quote_spans: list[tuple[int, int]]  # @QB@…@QE@ spans
    auto_spans: list[tuple[int, int]]  # words put back from "### | AUTO" lines
    headings: list[tuple[int, int]]  # paragraphs that were heading lines (# | … / ### | …)
    stats: Counter[str] = field(default_factory=Counter)

    def __post_init__(self) -> None:
        self._page_pos = [p for p, _, _ in self.pages]
        self._ms_pos = [p for p, _ in self.milestones]

    def page_at(self, offset: int) -> tuple[int, int] | None:
        """The printed (volume, page) a character at ``offset`` stands on: the first page marker after it
        closes its page. Text after the last marker is on the page after it."""
        if not self.pages:
            return None
        i = bisect.bisect_right(self._page_pos, offset)
        if i < len(self.pages):
            return self.pages[i][1], self.pages[i][2]
        return self.pages[-1][1], self.pages[-1][2] + 1

    def milestone_at(self, offset: int) -> int | None:
        if not self.milestones:
            return None
        i = bisect.bisect_right(self._ms_pos, offset)
        if i < len(self.milestones):
            return self.milestones[i][1]
        return self.milestones[-1][1] + 1

    def locator(self, start: int) -> dict[str, object]:
        page = self.page_at(start)
        ms = self.milestone_at(start)
        return {
            "locator": f"urn:cts:arabicLit:{self.uri}:{page[0]}.{page[1]}"
            if page
            else f"urn:cts:arabicLit:{self.uri}",
            "page_vol": page[0] if page else None,
            "page": page[1] if page else None,
            "milestone": f"ms{ms:03d}" if ms is not None else None,
        }

    def is_heading(self, start: int) -> bool:
        """True when ``start`` falls inside a paragraph that was a heading line."""
        i = bisect.bisect_right([s for s, _ in self.headings], start) - 1
        return i >= 0 and self.headings[i][0] <= start < self.headings[i][1]


def _sub_tracked(
    rx: re.Pattern[str], repl: str | Callable[[re.Match[str]], str], text: str, points: list[int]
) -> tuple[str, list[int]]:
    """``rx.sub`` that also maps tracked offsets from the old text into the new one."""
    pieces: list[str] = []
    spans: list[tuple[int, int, int, int]] = []  # old start, old end, new start, new length
    pos = 0
    new_len = 0
    for m in rx.finditer(text):
        s, e = m.span()
        pieces.append(text[pos:s])
        new_len += s - pos
        r = repl(m) if callable(repl) else repl
        spans.append((s, e, new_len, len(r)))
        pieces.append(r)
        new_len += len(r)
        pos = e
    pieces.append(text[pos:])
    if not spans:
        return text, points
    starts = [s for s, _, _, _ in spans]

    def mp(p: int) -> int:
        i = bisect.bisect_right(starts, p) - 1
        if i < 0:
            return p
        s, e, ns, nl = spans[i]
        if p >= e:
            return ns + nl + (p - e)
        return ns + min(p - s, nl)

    return "".join(pieces), [mp(p) for p in points]


@dataclass
class _Para:
    kind: str  # text | heading
    text: str
    autos: list[tuple[int, int]] = field(default_factory=list)  # spans inside .text


def _paragraphs(body: str, stats: Counter[str]) -> list[_Para]:
    paras: list[_Para] = []
    glue_next = False

    def cur() -> _Para:
        if not paras:
            paras.append(_Para("text", ""))
        return paras[-1]

    for line in body.split("\n"):
        if not line.strip():
            continue
        if _PAGE_ONLY.match(line.lstrip("#~ |@")):
            # a marker on a line of its own belongs to the paragraph it interrupts
            p = cur()
            p.text += " " + line.lstrip("#~ |@")
            continue
        m3 = _HEADING_3.match(line)
        if m3:
            content = m3.group(1).strip()
            if content.startswith("CHECK"):
                stats["annotator-lines-dropped"] += 1
                continue
            if content.startswith("AUTO"):
                word = content[4:].strip()
                stats["auto-heading-inline"] += 1
                p = cur()
                base = p.text.rstrip()
                sep = "" if (not base or _PROCLITIC_END.search(base)) else " "
                p.text = base + sep
                p.autos.append((len(p.text), len(p.text) + len(word)))
                p.text += word
                glue_next = True
                continue
            paras.append(_Para("heading", content))
            glue_next = False
            continue
        if line.startswith("~~"):
            cur().text += " " + line[2:]
            continue
        if line.startswith("#"):
            rest = line[1:]
            if glue_next and paras:
                # the line continues the word or sentence an AUTO heading interrupted
                paras[-1].text += rest[1:] if rest.startswith(" ") else rest
                glue_next = False
                continue
            glue_next = False
            if rest.startswith(" |"):
                paras.append(_Para("heading", rest[2:]))
            else:
                paras.append(_Para("text", rest[1:] if rest.startswith(" ") else rest))
            continue
        glue_next = False
        paras.append(_Para("text", line))
    return paras


_INLINE_HEADING = re.compile(r"&\s*([^&]*?)\s*&")


def _split_inline_headings(paras: list[_Para], stats: Counter[str]) -> list[_Para]:
    """``& X &`` inside a paragraph → the text before, a heading paragraph ``X``, the text after."""
    out: list[_Para] = []
    for p in paras:
        if p.kind != "text" or "&" not in p.text:
            out.append(p)
            continue
        if p.autos:
            raise ValueError("inline heading marks and AUTO words in one paragraph are not supported")
        pos = 0
        for m in _INLINE_HEADING.finditer(p.text):
            before = p.text[pos : m.start()]
            if before.strip():
                out.append(_Para("text", before))
            out.append(_Para("heading", m.group(1)))
            stats["inline-heading-marks"] += 1
            pos = m.end()
        rest = p.text[pos:]
        if "&" in rest:
            stats["inline-heading-marks-unpaired"] += 1
        if rest.strip():
            out.append(_Para("text", rest))
    return out


def clean(raw: str, uri: str, *, inline_headings: bool = False, footnote_refs: bool = False) -> Clean:
    """Apply the documented cleaning rules to one OpenITI file (``inline_headings``: the opt-in
    ``inline-heading-marks`` rule; ``footnote_refs``: the opt-in ``footnote-refs`` rule)."""
    stats: Counter[str] = Counter()
    if HEADER_END not in raw:
        raise ValueError(f"{uri}: no {HEADER_END} line — not an OpenITI mARkdown file")
    body = raw.split(HEADER_END, 1)[1]
    stats["header-dropped"] = 1
    paras = _paragraphs(body, stats)
    if inline_headings:
        paras = _split_inline_headings(paras, stats)
    stats["paragraphs"] = len(paras)

    # Join, remembering where each paragraph and AUTO word sits, then strip tokens and spacing while
    # tracking those offsets.
    chunks: list[str] = []
    para_bounds: list[tuple[int, int, str]] = []
    autos: list[tuple[int, int]] = []
    pos = 0
    for p in paras:
        para_bounds.append((pos, pos + len(p.text), p.kind))
        autos += [(pos + a, pos + b) for a, b in p.autos]
        chunks.append(p.text)
        pos += len(p.text) + 1
    text = "\n".join(chunks)

    events: list[tuple[int, str, tuple[int, ...]]] = []
    for m in _TOKEN.finditer(text):
        if m.group("pv"):
            events.append((m.start(), "page", (int(m.group("pv")), int(m.group("pp")))))
            stats["page-marks"] += 1
        elif m.group("ms"):
            events.append((m.start(), "ms", (int(m.group("ms")),)))
            stats["milestones"] += 1
        elif m.group("qb"):
            events.append((m.start(), "qb", ()))
            stats["quote-markup"] += 1
        elif m.group("qe"):
            events.append((m.start(), "qe", ()))
            stats["quote-markup"] += 1
        elif m.group("folio"):
            stats["folio-marks"] += 1
        elif m.group("line"):
            stats["line-marks"] += 1
        elif m.group("quote"):
            events.append((m.start(), "caret", ()))
            stats["quote-markup"] += 1
        else:
            stats["stray-marks"] += 1

    points = [e[0] for e in events]
    n_ev = len(points)
    for s, e, _ in para_bounds:
        points += [s, e]
    for s, e in autos:
        points += [s, e]
    text, points = _sub_tracked(_TOKEN, "", text, points)
    if footnote_refs:
        stats["footnote-refs"] = len(_FOOTNOTE_REF.findall(text))
        text, points = _sub_tracked(_FOOTNOTE_REF, "", text, points)
    before = len(text)
    for rx, repl in _SPACING:
        text, points = _sub_tracked(rx, repl, text, points)
    stats["whitespace"] = before - len(text)

    ev_pos = points[:n_ev]
    pb = points[n_ev : n_ev + 2 * len(para_bounds)]
    au = points[n_ev + 2 * len(para_bounds) :]
    pages = [(p, ev[2][0], ev[2][1]) for p, ev in zip(ev_pos, events, strict=True) if ev[1] == "page"]
    milestones = [(p, ev[2][0]) for p, ev in zip(ev_pos, events, strict=True) if ev[1] == "ms"]
    quote_spans: list[tuple[int, int]] = []
    open_at: int | None = None
    for p, ev in zip(ev_pos, events, strict=True):
        if ev[1] == "qb":
            if open_at is not None:
                stats["quote-markup-unclosed"] += 1
            open_at = p
        elif ev[1] == "qe":
            if open_at is None:
                stats["quote-markup-unopened"] += 1
            elif p > open_at:
                quote_spans.append((open_at, p))
            open_at = None
    # "^ ( … ) ^": a caret pair is a quotation when what it encloses is one bracketed span
    carets = [p for p, ev in zip(ev_pos, events, strict=True) if ev[1] == "caret"]
    i = 0
    while i + 1 < len(carets):
        a, b = carets[i], carets[i + 1]
        inner = text[a:b].strip()
        if inner.startswith("(") and inner.endswith(")") and "\n" not in inner:
            quote_spans.append((a, b))
            i += 2
        else:
            i += 1
    quote_spans.sort()
    headings = [
        (pb[2 * i], pb[2 * i + 1])
        for i, (_, _, kind) in enumerate(para_bounds)
        if kind == "heading" and pb[2 * i + 1] > pb[2 * i]
    ]
    auto_spans = [(au[2 * i], au[2 * i + 1]) for i in range(len(autos)) if au[2 * i + 1] > au[2 * i]]
    return Clean(
        uri=uri,
        text=text,
        pages=pages,
        milestones=milestones,
        quote_spans=quote_spans,
        auto_spans=auto_spans,
        headings=headings,
        stats=stats,
    )
