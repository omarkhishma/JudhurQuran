"""Reading the Shamela 4 extraction (AuthenticIlm/Shamela4_Full_DB): pages, TOC, lines, cleaning.

Every transformation here is one of the registry's cleaning rules and is counted:

* ``footnotes-dropped``        — the page ``footnotes`` field is never read into an entry.
* ``footnote-markers-removed`` — editor reference markers in the body are removed.
* ``title-markup-removed``     — ``<span …>…</span>`` TOC markup is removed. The span's text is
  KEPT: Shamela typists sometimes anchored a TOC entry inside running text (even inside a
  word — "م<span>أخ</span>وذ"), so a span is only treated as a heading when it stands on its
  own line, and its text then becomes the headword.
* ``page-join``                — printed pages are joined (paragraph break or one space).
* ``whitespace-normalised``    — line breaks → paragraph breaks; runs of spaces collapse.

Nothing else touches the text.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from jadhr_arabic import strip_marks

ARABIC_DIGITS = str.maketrans("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669", "0123456789")

# Editor footnote reference markers, per edition. One preceding space is removed with the
# marker so that "رَحُومٌ (¬١)، إذا" becomes "رَحُومٌ، إذا".
MARKER_PATTERNS: dict[str, re.Pattern[str]] = {
    "guillemets": re.compile(r" ?\u00ab([\u0660-\u06690-9]{1,3})\u00bb"),
    "negation-parens": re.compile(r" ?\(\u00ac([\u0660-\u06690-9]{1,3})\)"),
    "parens": re.compile(r" ?\(([\u0660-\u06690-9]{1,3})\)"),
    # Tahdhīb: a numbered parenthesis is a note marker unless it numbers a verse — at the end of a
    # quotation ("…الْبَيِّنَة (٤) ﴾", "…الدُّنْيَا﴾ (١٠٨)") or after a sūra's name ("فِي سُورَة الْملك (٢٧)").
    "parens-unless-verse": re.compile(r" ?\(([\u0660-\u06690-9]{1,3})\)(?!\s*\ufd3e)"),
    "none": re.compile(r"(?!)"),  # an edition with no reference markers in the body (Tāj)
}
_SURA_BEFORE = re.compile(r"(?:سور[ةه]\s+\S+(?:\s+\S+)?|\ufd3e)\s*$")
_NOTE_NUMBER = re.compile(r"(?:^|[\r\n])\s*\(\u00ac?([\u0660-\u06690-9]{1,3})\)")
_TOC_ID = re.compile(r"toc-(\d+)")
_HSPACE = re.compile(r"[ \t\u00a0\u2000-\u200a\u202f\u205f\u3000]+")
# A page whose last line ends with one of these closes its paragraph.
_TERMINAL = set('.!؟?:»"”)]﴾*…')
_ARABIC_LETTER = re.compile(r"[\u0621-\u064a\u0671]")
_FOLD = str.maketrans(
    {
        "\u0623": "\u0627",
        "\u0625": "\u0627",
        "\u0622": "\u0627",
        "\u0671": "\u0627",
        "\u0649": "\u064a",
        "\u0629": "\u0647",
        "\u0624": "\u0648",
        "\u0626": "\u064a",
    }
)


@dataclass(frozen=True)
class Page:
    shamela_page_id: int
    part: str | None
    page_num: int | None
    body: str
    footnotes: str | None

    @property
    def ref(self) -> str:
        if self.page_num is None:
            return ""
        return f"{self.part}/{self.page_num}" if self.part else str(self.page_num)


@dataclass(frozen=True)
class TocEntry:
    shamela_title_id: int
    title: str
    parent_title: str | None
    page_id: int
    order: tuple[int, int]


def load_pages(book_dir: Path) -> list[Page]:
    rows = [json.loads(line) for line in (book_dir / "pages.jsonl").open(encoding="utf-8")]
    # Reading order is the Shamela page number. The dataset's sequence_num is wrong for three pages
    # (Tāj 2/313 has 9, Tahdhīb 1/56 has 205 and 1/219 has 1764), which moved them into other volumes;
    # page_id and shamela_page_id agree with each other and with sequence_num everywhere else.
    rows.sort(key=lambda r: (int(r["shamela_page_id"]), r["page_id"]))
    return [
        Page(
            shamela_page_id=int(r["shamela_page_id"]),
            part=str(r["part"]) if r.get("part") not in (None, "") else None,
            page_num=int(r["page_num"]) if r.get("page_num") is not None else None,
            body=r.get("body") or "",
            footnotes=r.get("footnotes") or None,
        )
        for r in rows
    ]


def load_toc(book_dir: Path) -> dict[int, TocEntry]:
    rows = [json.loads(line) for line in (book_dir / "toc.jsonl").open(encoding="utf-8")]
    by_id = {r["title_id"]: r for r in rows}
    out: dict[int, TocEntry] = {}
    for r in rows:
        parent = by_id.get(r["parent_id"])
        out[int(r["shamela_title_id"])] = TocEntry(
            shamela_title_id=int(r["shamela_title_id"]),
            title=r["title_text"],
            parent_title=parent["title_text"] if parent else None,
            page_id=int(r["page_id"]),
            order=(int(r["page_id"]), int(r["shamela_title_id"])),
        )
    return out


@dataclass
class Counters:
    """Per-work rule counters for the build report."""

    c: Counter[str] = field(default_factory=Counter)

    def add(self, rule: str, n: int = 1) -> None:
        if n:
            self.c[rule] += n


def strip_markers(page: Page, style: str, counters: Counters) -> str:
    """Remove the edition's footnote reference markers from a page body."""
    pattern = MARKER_PATTERNS[style]
    notes = {m.translate(ARABIC_DIGITS) for m in _NOTE_NUMBER.findall(page.footnotes or "")}

    def repl(m: re.Match[str]) -> str:
        n = m.group(1).translate(ARABIC_DIGITS)
        if style == "parens-unless-verse" and _SURA_BEFORE.search(
            strip_marks(page.body[max(0, m.start() - 40) : m.start()])
        ):
            counters.add("footnote-markers-removed:verse-number-kept")
            return m.group(0)
        counters.add("footnote-markers-removed")
        counters.add(
            "footnote-markers-removed:with-note-on-page"
            if n in notes
            else "footnote-markers-removed:no-note-on-page"
        )
        return ""

    return pattern.sub(repl, page.body)


@dataclass(frozen=True)
class Span:
    toc_id: int | None
    text: str
    start: int  # offset in Line.text


@dataclass
class Line:
    """One printed line (Shamela \\r-separated), TOC markup removed, span text kept."""

    text: str
    page: Page
    first_on_page: bool
    spans: list[Span]

    @property
    def span_line(self) -> Span | None:
        """The span when the whole line is one span (a heading standing on its own line)."""
        if self.spans and self.text.strip() and self.text.strip() == self.spans[0].text.strip():
            return self.spans[0]
        return None

    @property
    def leading_span(self) -> Span | None:
        if self.spans and not self.text[: self.spans[0].start].strip():
            return self.spans[0]
        return None


_TAG = re.compile(r"<span([^>]*)>|</span>")


def _strip_spans(raw: str, counters: Counters) -> tuple[str, list[Span]]:
    """Remove (possibly nested) <span> markup; keep the text; record each span's position."""
    out: list[str] = []
    spans: list[Span] = []
    stack: list[tuple[int | None, int]] = []
    pos = 0
    length = 0
    for m in _TAG.finditer(raw):
        chunk = raw[pos : m.start()]
        out.append(chunk)
        length += len(chunk)
        if m.group(0).startswith("</"):
            if stack:
                tid, start = stack.pop()
                spans.append(Span(tid, "".join(out)[start:length], start))
        else:
            counters.add("title-markup-removed")
            tid_m = _TOC_ID.search(m.group(1) or "")
            stack.append((int(tid_m.group(1)) if tid_m else None, length))
        pos = m.end()
    out.append(raw[pos:])
    spans.sort(key=lambda sp: (sp.start, -len(sp.text)))
    return "".join(out), spans


_BROKEN_SPAN = re.compile(
    r"((?:^|[\r\n])<span[^>]*>[^<\r\n]*)[\r\n]+([^<]*</span>)"
)  # spans that open a line


def read_lines(
    pages: list[Page], marker_style: str, counters: Counters, *, join_broken_spans: bool = False
) -> list[Line]:
    """``join_broken_spans``: a heading span the typist broke over two lines ("<span>ع ض⏎و: </span>")
    is put back on one line (the break becomes a space) so that it is still seen as a heading."""
    out: list[Line] = []
    for page in pages:
        if page.footnotes:
            counters.add("footnotes-dropped")
        body = strip_markers(page, marker_style, counters)
        if join_broken_spans:
            body, n = _BROKEN_SPAN.subn(r"\1 \2", body)
            counters.add("title-markup-removed:line-break-inside-heading", n)
        for n, raw in enumerate(re.split(r"\r\n|\r|\n", body)):
            text, spans = _strip_spans(raw, counters)
            out.append(Line(text, page, n == 0, spans))
    return out


def assemble(lines: list[Line], counters: Counters, first_text: str | None = None) -> tuple[str, str | None]:
    """Lines → (body with paragraphs separated by a blank line, page_ref).

    Within a page every line is its own paragraph. Across a page boundary the first line of
    the new page continues the previous paragraph (one space) unless the previous page ended
    with a blank line or with sentence-final punctuation.
    """
    paras: list[str] = []
    cur: str | None = None
    hard = False
    first_page: Page | None = None
    last_page: Page | None = None
    for i, ln in enumerate(lines):
        text = first_text if (i == 0 and first_text is not None) else ln.text
        if not text.strip():
            if cur is not None:
                paras.append(cur)
                cur = None
            hard = True
            continue
        if first_page is None:
            first_page = ln.page
        if cur is None:
            cur = text
        elif (
            ln.page is not last_page and ln.first_on_page and not hard and cur.rstrip()[-1:] not in _TERMINAL
        ):
            cur = cur.rstrip() + " " + text.lstrip()
            counters.add("page-join:space")
        else:
            if ln.page is not last_page:
                counters.add("page-join:paragraph")
            paras.append(cur)
            cur = text
        hard = False
        last_page = ln.page
    if cur is not None:
        paras.append(cur)
    out = []
    for para in paras:
        q = _HSPACE.sub(" ", para).strip()
        if q != para:
            counters.add("whitespace-normalised")
        if q:
            out.append(q)
    ref = None
    if first_page is not None and first_page.ref:
        ref = first_page.ref
        if (
            last_page is not None
            and last_page is not first_page
            and last_page.ref
            and last_page.ref != first_page.ref
        ):
            same_part = first_page.part == last_page.part and last_page.page_num is not None
            ref = (
                f"{first_page.ref}-{last_page.page_num}" if same_part else f"{first_page.ref}-{last_page.ref}"
            )
    return "\n\n".join(out), ref


def letters_only(text: str) -> str:
    return "".join(_ARABIC_LETTER.findall(strip_marks(text)))


def match_key(text: str) -> str:
    """Folded letters used to compare a heading line with a TOC title (never displayed)."""
    return letters_only(text).translate(_FOLD)


def root_like_title(title: str) -> bool:
    """A heading that names one root/word (one token of 2–6 letters). Section headings
    (كتاب …، باب …، فصل …) always have two or more tokens, so they never qualify."""
    t = title.strip().strip("[]()").strip()
    if not t or len(t.split()) != 1:
        return False
    if re.search(r"[^ء-ْٰٱ]", t):
        return False
    return 2 <= len(letters_only(t)) <= 6
