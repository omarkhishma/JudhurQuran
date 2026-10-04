"""The books (PLAN P11.3a, D9, research 21 §4): a shelf of OpenITI versions read into the generic text model — its
headings a tree of chapters, its paragraphs passages — keeping only the author's text, by rules applied to every book
alike and counted, never by hand:

* the page markers (``PageV01P005``) and milestones (``ms12``) leave the text; a paragraph keeps the printed page it
  starts and ends on; a printed page is cited only where the version's markers pass the check (``page_trust``), else
  the citation is its section and paragraph;
* a number in brackets after Quranic words is the verse's number when those words end verse N of the Quran (or a
  quoted fragment of it holds them) — kept; any other «(N)», «[N]», ««N»» is the editor's footnote marker — taken out;
* «[البقرة: 164]» is the editor's reference to a verse — taken out of the text, kept as a link to the verse;
* any other «[…]» is the editor's (a restored word, a gloss) — kept as printed and marked as his, for the owner to
  decide (research 21 §4.4);
* a paragraph that is only the editor's number («[456]» in al-Shāfiʿī's Risāla, Shākir's numbering) leaves the text,
  its number kept on the paragraph that follows;
* an «### |EDITOR|» or «### |PARATEXT|» section is not the author's — left out;
* the version's own markup leaves the text by its family's conventions (``markup``): a page-end marker
  («PageEndV01P023»), a Quran-quotation tag («@QUR@014»), HTML left by a scrape (an anchor naming a verse becomes its
  link), a stray «#» or Latin letter glued to a word; the half-verse mark («%~%», and JK's «%») becomes a gap between
  the halves; in JK's versions its signs («< > ! + & $ | ^», «! 7 <») go, a «# | …» or «# > … <» line is a heading and
  a paragraph's opening number is the editor's; in Shamela-Ibāḍiyya's «^» is the printed «ﷺ»; in the Zaydiyya
  library's «=» opens a report.

A book without headings is read in runs of printed pages within each volume (a label of ours, said so)."""

from __future__ import annotations

import json
import re
import statistics
from bisect import bisect_right
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from itertools import pairwise
from pathlib import Path
from typing import Any

from jadhr_arabic import normalize

from .model import Chapter, Draft, Passage

HEADER_END = "#META#Header#End#"
_W = re.compile(r"[ء-غف-ي]+")
_PAGE = re.compile(r"PageV(\d+)P(\d+)")
_MILESTONE = re.compile(r"(?<![A-Za-z])ms\d+(?![A-Za-z])")
_HEADING = re.compile(r"^### (\|+)(EDITOR\||PARATEXT\|)?\s?(.*)$")
_ENTRY = re.compile(
    r"^### \$+\s?(.*)$"
)  # a biographical entry («### $ 1- امرؤ القيس»): a heading under the last one
_NUMBER = re.compile(r"(?P<open>[\(\[«])\s*¬?\s*(?P<n>[\d٠-٩]{1,4})\s*(?P<close>[\)\]»])")
_VERSE_REF = re.compile(
    r"\[\s*(?P<sura>[ء-ي ]{1,20}?)\s*:\s*(?P<a>[\d٠-٩]{1,3})(?:\s*[-–]\s*(?P<b>[\d٠-٩]{1,3}))?\s*\]"
)
_BRACKET = re.compile(r"\[[^\]\n]{1,80}\]")
_ONLY_NUMBER = re.compile(r"^\s*\[\s*([\d٠-٩]{1,4})\s*\]\s*$")
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
PAGE_RUN = 50  # a long book without headings or volumes: one chapter per this many printed pages
HEMISTICH = "\u2003"  # the gap between a verse's two halves, where the version marks them («%~%»)
_PAGE_END = re.compile(r"PageEndV\d+P\d+")
_QUOTE_TAG = re.compile(r"@QUR@\d+|@\s*\d+\s*@")
_ANCHOR = re.compile(r'(?:<\s*a?\s*|=)"(?P<ref>[^"<>]{1,40})"\s*>')
_TAG = re.compile(r"</?[A-Za-z][^<>\n]{0,200}>")
_JK_POETRY = re.compile(r"(?<!\S)%(?:\s+%)*(?!\S)")
_JK_MARKS = re.compile(r"(?<!\S)(?:[<>!+&$|^]+7?|7)(?:\s+(?:[<>!+&$|^]+7?|7))*(?!\S)")
_JK_HEADING = re.compile(r"^# \| ?(.+)$|^# > ([^<>]+?) <\s*$")
_OPENING_NUMBER = re.compile(r"^\s*(\d{1,5})\s+(?=\D)")
_STRAY_LATIN = re.compile(
    r"(?<![A-Za-z])[A-Za-z](?![A-Za-z])"
)  # a lone Latin letter: a scrape's, never the author's


def family(version: str) -> str:
    """The library a version came from, by its id («…Shamela0007798-ara1» → Shamela, «…JK001496-ara1» → JK): its
    markup follows that library's conventions."""
    m = re.match(r"[A-Za-z]+", version.rsplit(".", 1)[-1])
    return m.group(0) if m else ""


def markup(text: str, fam: str, stats: Counter[str]) -> tuple[str, dict[str, Any]]:
    """The version's markup out of a paragraph, by its family's conventions (module docstring), each rule counted."""
    extra: dict[str, Any] = {}

    def sub(rule: str, pattern: re.Pattern[str] | str, repl: Any, t: str) -> str:
        t, n = re.subn(pattern, repl, t)
        if n:
            stats[rule] += n
        return t

    text = sub("page-end-markers", _PAGE_END, " ", text)
    text = sub("quote-tags", _QUOTE_TAG, " ", text)
    anchors = [m.group("ref") for m in _ANCHOR.finditer(text)]
    if anchors:
        extra["anchors"] = anchors
    text = sub("html-tags", _ANCHOR, " ", text)
    text = sub("html-tags", _TAG, " ", text)
    text = sub("hemistichs", r"%~%", f" {HEMISTICH} ", text)
    if fam == "JK":
        m = _OPENING_NUMBER.match(text)
        if m:
            extra["editor_number"] = m.group(1)
            text = text[m.end() :]
            stats["jk-paragraph-numbers"] += 1
        text = sub("hemistichs", _JK_POETRY, f" {HEMISTICH} ", text)

        def sign(m: re.Match[str]) -> str:
            if re.search(r"[^\d\s]", m.group(0)):
                stats["jk-signs"] += 1
                return " "
            return m.group(0)

        text = _JK_MARKS.sub(sign, text)
        text = sub("jk-signs", r"\^", " ", text)
    if fam == "ShamIbadiyya":
        text = sub("honorific-signs", r"\^", "ﷺ", text)
        text = sub("ibadiyya-bars", r"\|+", " ", text)
    if fam == "Zaydiyya":
        text = sub("report-signs", r"\s*=\s*", " ", text)
    text = sub("stray-hashes", r"#", " ", text)
    text = sub("stray-latin-letters", _STRAY_LATIN, "", text)
    return text, extra


@dataclass
class Quran:
    """What the rules ask of the Quran: which ayah numbers end with which two words, which carry which word pairs,
    and the sūras by name."""

    ends: set[tuple[int, str]]
    pairs: set[tuple[int, str]]
    suras: dict[str, int]
    sizes: dict[int, int] = field(default_factory=dict)  # a sūra's count of verses
    words: dict[tuple[int, int], set[str]] = field(default_factory=dict)  # a verse's words and word pairs

    @classmethod
    def load(cls, verses: list[dict[str, Any]], surahs: list[dict[str, Any]]) -> Quran:
        ends: set[tuple[int, str]] = set()
        pairs: set[tuple[int, str]] = set()
        sizes: dict[int, int] = {}
        words: dict[tuple[int, int], set[str]] = defaultdict(set)
        for v in verses:
            sizes[v["surah"]] = max(sizes.get(v["surah"], 0), v["ayah"])
            for col in ("text_imlaei", "norm_plain"):
                ws = _W.findall(normalize(v.get(col) or ""))
                if len(ws) >= 2:
                    ends.add((v["ayah"], " ".join(ws[-2:])))
                pairs |= {(v["ayah"], f"{a} {b}") for a, b in pairwise(ws)}
                words[(v["surah"], v["ayah"])] |= set(ws) | {f"{a} {b}" for a, b in pairwise(ws)}
        suras = {normalize(s["name_ar"]): s["number"] for s in surahs}
        suras |= {
            normalize("ال" + s["name_ar"])
            if not s["name_ar"].startswith("ال")
            else normalize(s["name_ar"][2:]): s["number"]
            for s in surahs
        }
        return cls(ends, pairs, suras, sizes, dict(words))

    def verse_number(self, before: str, n: int, quoted: bool) -> bool:
        ws = _W.findall(normalize(before))[-2:]
        key = " ".join(ws)
        return len(ws) == 2 and ((n, key) in self.ends or (quoted and (n, key) in self.pairs))

    def quotes(self, before: str, sura: int, a: int, b: int) -> bool:
        """Whether the words before a reference are those of the verses it names: their last two words a pair of
        one of them, or a quotation closed on a word of one («{ق} [ق: 1]»)."""
        ws = _W.findall(normalize(before))
        closed = before.rstrip()[-1:] in ("}", ")", "﴾", "»")
        for x in range(a, b + 1):
            have = self.words.get((sura, x), set())
            if (len(ws) >= 2 and f"{ws[-2]} {ws[-1]}" in have) or (closed and ws and ws[-1] in have):
                return True
        return False


@dataclass
class Para:
    text: str
    pages: list[tuple[int, int]] = field(default_factory=list)  # the printed page it starts on and ends on
    heading: int | None = None  # the chapter it falls under (an index into the chapters)
    number: str | None = None  # the editor's number for it, where he numbers paragraphs
    marks: list[tuple[int, int]] = field(default_factory=list)  # the page markers it held, in order


def _raw_parts(raw: str, fam: str = "") -> tuple[list[tuple[int, str, bool]], list[Para]]:
    """The headings (level, title, the author's?) and the paragraphs, in order, page markers still in. A marker that
    stands in a heading, between paragraphs or in a section left out still closes its page: it joins the paragraph
    before it (a paragraph of no text where there is none), so the markers keep their order. No word of the author's
    is lost to a line's form: a line opening «#» without its space («#، وإن كان») starts a paragraph, a line of words
    without «~~» or opening «# ~~» (LAL's way) continues the one before it. In JK's versions a «# > … <» line is a
    heading under the last, and a «# | …» line one under that."""
    body = raw.split(HEADER_END, 1)[1]
    heads: list[tuple[int, str, bool]] = []
    paras: list[Para] = []
    excluded_level: int | None = None
    current: Para | None = None

    def keep_marks(line: str) -> None:
        marks = " ".join(m.group(0) for m in _PAGE.finditer(line))
        if not marks:
            return
        if not paras:
            paras.append(Para(""))
        paras[-1].text += " " + marks

    last_level = 0
    jk_level: int | None = None
    for line in body.splitlines():
        jk = _JK_HEADING.match(line) if fam == "JK" and excluded_level is None else None
        if jk and _W.search(_PAGE.sub(" ", line)):
            keep_marks(line)
            if jk.group(2) is not None:
                jk_level = last_level + 1
                heads.append((jk_level, jk.group(2), True))
            else:
                heads.append(((jk_level or last_level) + 1, jk.group(1), True))
            current = None
            continue
        entry = _ENTRY.match(line)
        if entry and excluded_level is None:
            keep_marks(line)
            heads.append((last_level + 1, entry.group(1), True))
            current = None
            continue
        m = _HEADING.match(line)
        if m:
            level = len(m.group(1))
            keep_marks(line)
            if m.group(2):
                excluded_level = level
                current = None
                continue
            if excluded_level is not None and level <= excluded_level:
                excluded_level = None
            if excluded_level is not None:
                continue
            heads.append((level, m.group(3), True))
            last_level, jk_level = level, None
            current = None
            continue
        if excluded_level is not None or line.startswith("#META"):
            keep_marks(line)
            continue
        if line.startswith("# ~~") and current is not None:
            current.text += " " + line[4:]
        elif line.startswith("#"):
            current = Para(line[1:].lstrip(" "), heading=len(heads) - 1 if heads else None)
            paras.append(current)
        elif line.startswith("~~") and current is not None:
            current.text += " " + line[2:]
        elif _W.search(_PAGE.sub(" ", line)):
            if current is None:
                current = Para(line.lstrip("~ "), heading=len(heads) - 1 if heads else None)
                paras.append(current)
            else:
                current.text += " " + line
        else:
            keep_marks(line)
    return heads, paras


Page = tuple[int, int]


def fixed_pages(marks: list[Page]) -> tuple[list[Page | None], int, int]:
    """Each marker's page as the version's own sequence bears it out. The longest rising run of its markers is the
    spine; a run of markers off it — a slip («34» between 342 and 344), an unnumbered page («0») — is read as the pages
    its neighbours on the spine leave room for when they leave room for exactly as many, and is otherwise unknown.
    Returns the pages and how many were read so and how many are left unknown."""
    n = len(marks)
    tails: list[Page] = []
    tails_at: list[int] = []
    before = [-1] * n
    for i, m in enumerate(marks):
        if m[1] == 0:
            continue
        k = bisect_right(tails, m)
        if k == len(tails):
            tails.append(m)
            tails_at.append(i)
        else:
            tails[k], tails_at[k] = m, i
        before[i] = tails_at[k - 1] if k else -1
    spine: set[int] = set()
    i = tails_at[-1] if tails_at else -1
    while i >= 0:
        spine.add(i)
        i = before[i]
    out: list[Page | None] = [m if i in spine else None for i, m in enumerate(marks)]
    read = unknown = 0
    i = 0
    while i < n:
        if i in spine:
            i += 1
            continue
        j = i
        while j < n and j not in spine:
            j += 1
        a, b = (marks[i - 1] if i else None), (marks[j] if j < n else None)
        if a and b and a[0] == b[0] and b[1] - a[1] - 1 == j - i:
            out[i:j] = [(a[0], a[1] + 1 + k) for k in range(j - i)]
            read += j - i
        else:
            unknown += j - i
        i = j
    return out, read, unknown


def paged(paras: list[Para]) -> tuple[Counter[Page], list[Page | None], int, int]:
    """Each paragraph's first and last printed page, its markers out of its text; the words on each page. A marker
    closes the page whose text stands before it («PageV01P049» ends page 49), so the text after a paragraph's last
    marker is on the page the next marker closes — read from the end of the book back, each marker's page as
    ``fixed_pages`` reads it. A paragraph whose first page is unknown has no pages."""
    marks = [(int(v), int(n)) for p in paras for v, n in _PAGE.findall(p.text)]
    fixed, read, unknown = fixed_pages(marks)
    words: Counter[Page] = Counter()
    after: Page | None = None
    k = len(fixed)
    for p in reversed(paras):
        parts = _PAGE.split(p.text)
        texts = parts[0::3]
        p.marks = [(int(v), int(n)) for v, n in zip(parts[1::3], parts[2::3], strict=True)]
        k -= len(p.marks)
        on = [*fixed[k : k + len(p.marks)], after]
        lettered = []
        for t, pg in zip(texts, on, strict=True):
            n = len(_W.findall(t))
            if n and pg is not None:
                words[pg] += n
            if n:
                lettered.append(pg)
        first, last = (lettered[0], lettered[-1]) if lettered else (None, None)
        p.pages = [first, *([last] if last else [])] if first else []
        if p.marks:
            after = on[0]
        p.text = _PAGE.sub(" ", p.text)
    return words, fixed, read, unknown


def clean(text: str, quran: Quran, stats: Counter[str], fam: str = "") -> tuple[str, dict[str, Any]]:
    """The author's text of a paragraph, with what was taken out or marked, by the rules (module docstring)."""
    meta: dict[str, Any] = {}
    text, extra = markup(text, fam, stats)
    if extra.get("editor_number"):
        meta["editor_number"] = extra["editor_number"]
    text = _MILESTONE.sub(" ", text)
    quoted_spans = [(m.start(), m.end()) for m in re.finditer(r"@QB@.*?@QE@", text)]
    stats["quran-quotes"] += len(quoted_spans)
    text = text.replace("@QB@", " ").replace("@QE@", " ")
    text, n = re.subn(r"@", " ", text)  # any other «@» is a scrape's
    if n:
        stats["stray-ats"] += n
    # the editor's references to verses: out of the text, kept as links
    refs = []

    def ref(m: re.Match[str]) -> str:
        name = normalize(m.group("sura").strip())
        sura = quran.suras.get(name)
        if sura is None:
            return m.group(0)
        a = int(m.group("a").translate(_DIGITS))
        b = int((m.group("b") or m.group("a")).translate(_DIGITS))
        # a verse the sūra does not have («[النازعات: 56]» of 46) is the editor's slip: left as he printed it
        if not 1 <= a <= b <= quran.sizes.get(sura, 0):
            stats["verse-refs-unknown"] += 1
            return m.group(0)
        # «ص» is also the editor's «page» («[ص : 440]»): a one-letter sūra only where its verse's words stand before
        if len(name) == 1 and not quran.quotes(text[max(0, m.start() - 120) : m.start()], sura, a, b):
            stats["verse-refs-one-letter-unquoted"] += 1
            return m.group(0)
        refs.append([sura, a, b])
        stats["verse-refs"] += 1
        return " "

    text = _VERSE_REF.sub(ref, text)
    # a scrape's anchor naming a verse («<a "التوبة 113">»): its link
    for a in extra.get("anchors", []):
        m = re.match(r"\s*([ء-ي ]+?)\s*:?\s*(\d{1,3})\s*$", a)
        sura = quran.suras.get(normalize(m.group(1))) if m else None
        if m and sura and 1 <= int(m.group(2)) <= quran.sizes.get(sura, 0):
            refs.append([sura, int(m.group(2)), int(m.group(2))])
            stats["anchor-refs"] += 1
    if refs:
        meta["quran_refs"] = refs

    # numbers in brackets: a verse's number kept, an editor's footnote marker out
    def number(m: re.Match[str]) -> str:
        n = int(m.group("n").translate(_DIGITS))
        before = text[max(0, m.start() - 120) : m.start()]
        quoted = before.rstrip()[-1:] in (")", "}", "﴾", "»", "*")
        if m.group("open") == "(" and quran.verse_number(before, n, quoted):
            stats["verse-numbers"] += 1
            return m.group(0)
        stats["footnote-markers"] += 1
        return " "

    text = _NUMBER.sub(number, text)
    # any other bracket is the editor's: kept as printed, marked
    spans = []
    for m in _BRACKET.finditer(text):
        spans.append([m.start(), m.end()])
    if spans:
        stats["editor-brackets"] += len(spans)
    text = re.sub(r"[ \t]+", " ", text).replace(" ،", "،").replace(" .", ".").strip()
    if spans:
        meta["editor"] = [[m.start(), m.end()] for m in _BRACKET.finditer(text)]
    return text, meta


def page_trust(
    pages: list[Page | None],
    words: list[int],
    turath: dict[str, Any] | None,
    follows_print: bool | None = None,
) -> tuple[bool, list[dict[str, Any]]]:
    """Whether a version's printed pages may be cited: its card does not say they leave the print, no more than 2% of
    its markers are left unknown by ``fixed_pages`` and the rest rise, a page holds a plausible count of words, and
    where turath maps the print the sampled pages agree (research 21 §4.2). Each reason against comes as a code with
    its numbers, for a page to say in its own language."""
    why: list[dict[str, Any]] = []
    if follows_print is False:
        why.append({"why": "card"})
    if len(pages) < 10:
        why.append({"why": "markers", "n": len(pages)})
    unknown = sum(1 for p in pages if p is None)
    if unknown > 0.02 * len(pages):
        why.append({"why": "unknown", "n": unknown, "of": len(pages)})
    known = [p for p in pages if p is not None]
    backs = sum(1 for a, b in pairwise(known) if b < a)
    if backs:
        why.append({"why": "backs", "n": backs})
    if words:
        med = statistics.median(words)
        if not 40 <= med <= 1500:
            why.append({"why": "median", "n": round(med)})
    if (
        turath
        and turath.get("pages_tested")
        and turath.get("both_ends_match", 0) < 0.8 * turath["pages_tested"]
    ):
        why.append({"why": "turath", "n": turath["both_ends_match"], "of": turath["pages_tested"]})
    return not why, why


def book(
    raw: Path, spec: dict[str, Any], quran: Quran, turath: dict[str, Any] | None, stats: Counter[str]
) -> Draft:
    """One book of the shelf as a draft of the generic model."""
    text = (raw / spec["file"]).read_text(encoding="utf-8")
    fam = family(spec["version"])
    heads, paras = _raw_parts(text, fam)
    words_per_page, pages, read, unknown = paged(paras)
    stats[f"{spec['slug']}:page-markers-read-between-neighbours"] += read
    stats[f"{spec['slug']}:page-markers-unknown"] += unknown
    # the editor's paragraph numbers («[456]»): out of the text, kept on the paragraph that follows
    kept: list[Para] = []
    pending: str | None = None
    for p in paras:
        only = _ONLY_NUMBER.match(p.text)
        if only:
            pending = only.group(1).translate(_DIGITS)
            stats[f"{spec['slug']}:editor-paragraph-numbers"] += 1
            continue
        if pending:
            p.number, pending = pending, None
        kept.append(p)
    # a paragraph of no words (only a page marker, «# PageV21P122» in al-Ṭabarī) is no passage: its marker has done
    # its work in the paging
    paras = [p for p in kept if _W.search(p.text)]
    bc = card(text, spec)
    trusted, why = page_trust(pages, list(words_per_page.values()), turath, bc["follows_print"])
    stats[f"{spec['slug']}:pages-{'trusted' if trusted else 'untrusted'}"] += 1
    # chapters: the headings, or the volumes, or runs of pages
    chapters: list[Chapter] = []
    index_of: dict[int, int] = {}
    if heads:
        open_at: dict[int, int] = {}
        for i, (level, title, _) in enumerate(heads):
            parent = next((open_at[lv] for lv in sorted(open_at, reverse=True) if lv < level), None)
            index_of[i] = len(chapters)
            chapters.append(Chapter(_clean_title(title) or "—", "", min(level, 9), parent))
            open_at = {lv: ix for lv, ix in open_at.items() if lv < level} | {level: len(chapters) - 1}
        orphans = [p for p in paras if p.heading is None]
        if orphans:
            # what stands before the first heading: an opening of its own, labelled so
            chapters.insert(0, Chapter("", "", 1, None, {"label": "opening"}))
            for k in index_of:
                index_of[k] += 1
            for c in chapters[1:]:
                if c.parent is not None:
                    c.parent += 1
    else:
        volumes = sorted({pg[0] for p in paras for pg in p.pages}) or [1]
        runs: dict[tuple[int, int], int] = {}
        for p in paras:
            v, n = p.pages[0] if p.pages else (volumes[0], 0)
            key = (v, n // PAGE_RUN)
            if key not in runs:
                runs[key] = len(chapters)
                chapters.append(
                    Chapter(
                        "",
                        "",
                        1,
                        None,
                        {"label": "pages", "volume": v, "pages_from": max(1, key[1] * PAGE_RUN)},
                    )
                )
            p.heading = -1 - runs[key]
    passages: list[Passage] = []
    on_page: Counter[tuple[int, int]] = Counter()
    for n, p in enumerate(paras, start=1):
        if p.heading is None:
            ci = 0
        elif p.heading < 0:
            ci = -1 - p.heading
        else:
            ci = index_of[p.heading]
        body, meta = clean(p.text, quran, stats, fam)
        if p.pages:
            meta["pages"] = [[v, pg] for v, pg in p.pages]
            # its place among the paragraphs that open on its first page: «١/٣، ف٢» is page 3's second
            on_page[p.pages[0]] += 1
            meta["on_page"] = on_page[p.pages[0]]
        if p.number:
            meta["editor_number"] = p.number
        passages.append(Passage(ci, str(n), body, meta))
    # where the editor numbers the paragraphs (Lowry's Risāla), a paragraph he left unnumbered falls under the number
    # before it: a section of his, by which the book is cited where its pages are not
    numbered = sum(1 for x in passages if x.meta.get("editor_number"))
    by_number = bool(passages) and numbered >= 0.5 * len(passages)
    if by_number:
        last = None
        for x in passages:
            if x.meta.get("editor_number"):
                last = x.meta["editor_number"]
            elif last:
                x.meta["editor_section"] = last
    stats[f"{spec['slug']}:paragraphs"] = len(passages)
    stats[f"{spec['slug']}:chapters"] = len(chapters)
    return Draft(
        slug=spec["slug"],
        uri=f"book:{spec['work']}",
        kind="book",
        title_ar=bc["title_ar"],
        title_en=spec["title_en"],
        author_ar=bc["author_ar"],
        author_en=spec["author_en"],
        meta_ar=bc["edition_ar"],
        meta_en=None,
        era_year=spec.get("era_year"),
        source_id="openiti-books",
        info={
            "death_ah": spec["death_ah"],
            "work": spec["work"],
            "version": spec["version"],
            "genre": spec["genre"],
            "short_title_ar": bc["short_title_ar"],
            "author_full_ar": bc["author_full_ar"],
            "edition": bc["edition"],
            "follows_print": bc["follows_print"],
            "pages_trusted": trusted,
            "numbered_by_editor": by_number,
            "pages_why": why,
            "volumes": len({p[0] for p in pages if p}) or None,
            "page_markers": len(pages),
            "page_markers_read": read,
            "page_markers_unknown": unknown,
        },
        chapters=chapters,
        passages=passages,
    )


def _clean_title(s: str) -> str:
    """A heading as the reader sees it: no page marker, milestone or quotation tag, no Latin word (a version's flag,
    «CHECK»), no half-verse mark; JK's sūra heading «1 ( سورة الصافات ) 1» is the sūra's name."""
    s = _PAGE.sub(" ", s)
    s = _MILESTONE.sub(" ", s)
    s = s.replace("@QB@", " ").replace("@QE@", " ").replace("%~%", " ")
    s = _TAG.sub(" ", s)
    s = re.sub(r"(?<![A-Za-z])[A-Za-z]+(?![A-Za-z])", " ", s)
    s = re.sub(r"\s+", " ", s).strip(" -")
    m = re.fullmatch(r"(\d+)\s*\(\s*(.+?)\s*\)\s*\1", s)
    return m.group(2) if m else s


_FIELD = re.compile(r"#META#\s+(\d{3}\.\w+)\s*::\s*(.*)$|#META#\s+([^:\n]{1,30}?)\s*:\s*(.*)$")
_DIED = re.compile(r"\s*\(\s*(?:ال)?المتو?فى[^)]*\)?\s*$")
_ARABIC = re.compile(r"[ء-ي]")
_NONE = ("", "NODATA", "NOTGIVEN", "n/a")


def header(raw_text: str) -> dict[str, str]:
    """A version's header fields, the first of each name: OpenITI's numbered ones («020.BookTITLE :: …») and the
    Shamela or LAL cards' Arabic ones («الكتاب: …», «العنوان: …»)."""
    out: dict[str, str] = {}
    for line in raw_text.split(HEADER_END, 1)[0].splitlines():
        m = _FIELD.match(line)
        if m:
            key, value = (m.group(1), m.group(2)) if m.group(1) else (m.group(3), m.group(4))
            out.setdefault(key.strip(), value.strip())
    return out


def _field(meta: dict[str, str], *keys: str) -> str | None:
    for k in keys:
        v = (meta.get(k) or "").split("¶")[0].strip(" :")
        if v not in _NONE:
            return v
    return None


def card(raw_text: str, spec: dict[str, Any]) -> dict[str, Any]:
    """The book's card, read by one rule for every version: its title as its own header gives it (else the
    catalogue's first), its short title, its author's short name (the header's, else the catalogue's) and full name
    with no «(المتوفى…)» after it, its edition's fields as printed, and whether its card says the page numbers follow
    the print («ترقيم الصفحات موافق للمطبوع») or not."""
    meta = header(raw_text)
    title = (
        _field(meta, "020.BookTITLE", "010.BookTITLE", "العنوان", "الكتاب")
        or spec["title_ar"].split("::")[0].strip()
    )
    short = _field(meta, "029.BookTITLEalt", "011.BookSHORTTITLE") or title
    catalogue = spec["author_ar"] if _ARABIC.search(spec["author_ar"] or "") else None
    full = spec.get("author_full_ar") or _field(meta, "010.AuthorNAME", "001.AuthorNAME", "المؤلف") or ""
    author = (
        _field(meta, "010.AuthorAKA", "002.AuthorSHORTNAME") or catalogue or _field(meta, "المؤلف") or full
    )
    edition = {
        k: v
        for k, v in {
            "editor": _field(meta, "040.EdEDITOR", "المحقق", "تحقيق"),
            "number": _field(meta, "041.EdNUMBER", "041.EdNumber"),
            "publisher": _field(meta, "043.EdPUBLISHER", "013.EdPUBLISHER", "الناشر"),
            "place": _field(meta, "044.EdPLACE"),
            "year": _field(meta, "045.EdYEAR"),
            "volumes": _field(meta, "022.BookVOLS", "014.BookVOLS"),
        }.items()
        if v
    }
    statement = re.search(r"ترقيم الصفحات[^¶\n]*", raw_text.split(HEADER_END, 1)[0])
    return {
        "title_ar": title,
        "short_title_ar": short,
        "author_ar": _DIED.sub("", author).strip(" ،,"),
        "author_full_ar": _DIED.sub("", full).strip(" ،,") or None,
        "edition": edition,
        "edition_ar": edition_text(edition),
        "follows_print": None if not statement else "غير موافق" not in statement.group(0),
    }


def edition_text(e: dict[str, str]) -> str | None:
    """The edition in one line, its fields as printed: «تحقيق …، الطبعة …، الناشر، المكان، السنة»."""
    parts = []
    if e.get("editor"):
        ed = e["editor"]
        parts.append(ed if re.match(r"(تحقيق|شرح|تجميع|جمع|ترتيب|ضبط)", ed) else f"تحقيق {ed}")
    if e.get("number"):
        parts.append(e["number"] if e["number"].startswith("الطبعة") else f"الطبعة {e['number']}")
    if e.get("publisher"):
        parts.append(e["publisher"])
    if e.get("place") and e["place"] not in e.get("publisher", ""):
        parts.append(e["place"])
    if e.get("year") and e["year"] not in e.get("number", ""):
        parts.append(e["year"])
    return "، ".join(parts) or None


def build_books(
    raw: Path, registry: Path, verses: list[dict[str, Any]], surahs: list[dict[str, Any]]
) -> tuple[list[Draft], dict[str, Any]]:
    import yaml

    reg = yaml.safe_load(registry.read_text(encoding="utf-8"))
    quran = Quran.load(verses, surahs)
    turath_file = raw / reg.get("turath_check", "")
    turath = (
        json.loads(turath_file.read_text(encoding="utf-8"))
        if reg.get("turath_check") and turath_file.exists()
        else {}
    )
    stats: Counter[str] = Counter()
    drafts = [book(raw, spec, quran, turath.get(spec["version"]), stats) for spec in reg["books"]]
    return drafts, dict(sorted(stats.items()))
