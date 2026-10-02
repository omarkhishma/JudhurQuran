"""Tāj al-ʿArūs (al-Zabīdī, d. 1205) from the Shamela typing of the Kuwait edition (book 7030).

Splitting (rule ``taj-article-split``). The TOC lists the root headings in the printed order. An
article starts at a printed heading that is the next expected TOC title (within a look-ahead):

* a TOC span at a heading position — at a line start, or inline in the volumes whose pages carry no
  line breaks ("…شَدِيد.<span>ر ح م</span>(الرَّحْمَة)"). A span glued inside a word
  ("بخلافِ<span> أَثأْ</span>تُه") is a misplaced anchor: it is ignored and its text stays;
* a plain line that is only the heading ("أثأ") — the printed heading of an entry whose anchor the
  typist misplaced.

Section headings (باب، فصل، الجزء، المقصد، رموز…) close the running article; their prose is not
imported (``front-matter-skipped``). TOC "titles" that are running text marked by mistake stay in the
text. Expected titles never found are reported; their text stays, unchanged, in the previous article.

Cleaning:

* ``heading-separator-dropped`` — the colon printed right after a heading ("أبأ⏎: ( الأَبَاءَةُ…")
  goes with the heading, which becomes ``headword``.
* ``taj-headword-markers-removed`` — the typing turned the sign printed before each headword into
  ﴿, ﴾ or ! (alternating; 3–22 per 1,000 letters): "( ﴿الأَبَاءَةُ، كَعَبَاءَةٍ: القَصَبَةُ) ، … (ج﴾ أَبَاءٌ)".
  Quran quotations use the same brackets, so a ﴿…﴾ span is KEPT when it reads as a quotation: a
  sūra:āya reference follows it; or a citation introduces it (تعالى، عز وجل، التنزيل، قُرئ… ending in a
  colon or after a verb of citing, with no full stop in between — "إلى الله تعالى." is a eulogy); or
  its words alone follow the Quran (60% of its word pairs occur inside one verse, and it does not
  straddle al-Qāmūs's parentheses). Spans are chosen together — no overlaps, best total score — so a
  marker inside a quotation is still removed. Every other ﴿ ﴾ and every ! is removed, with the space
  the conversion put beside it.

Root articles the TOC does not list are typed like Lisān's headings ("صرخَ: (الصَّرْخَة…"); one is
split when the word shares the article's first and last radical and its first two radicals sort
between the neighbouring headings. Two headings over one text ("ظوأ" then "وظيأ") make one article
whose ``match_heads`` carry both.

Typing defects that are NOT edited (counted under ``stats`` for review): empty ``[]`` where a
honorific glyph was lost, Quran quotations whose text was lost to a font code («٧. ٠٢٥ …»), and
«(سقط: …)» notes of the digital edition.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import strip_marks

from .quranidx import QuranPairs, qtokens
from .registry import WorkSpec
from .shamela import Counters, Line, TocEntry, assemble, match_key
from .tocworks import RawArticle

OPEN, CLOSE = "﴿", "﴾"  # ﴿ … ﴾
SECTION_WORDS = {"الجزء", "باب", "فصل", "المقصد", "مقدمة", "رموز", "بقية", "تتمة", "خاتمة", "فهرس", "تنبيه"}
LOOKAHEAD_SPAN = 40  # a span names its TOC entry exactly: skipped titles are headings with no anchor
LOOKAHEAD_LINE = 4  # a bare line is matched by its letters only
_ARABIC_WORD = re.compile("^[ء-يٱ]+$")
_LETTERISH = re.compile("[ء-يً-ْٰٱ]")
_SEPARATOR = re.compile(r"^\s*:\s*")


def _tokens(title: str) -> list[str]:
    return strip_marks(title).strip().strip("()[] ").split()


def classify_title(title: str) -> str:
    """``section`` (باب/فصل/الجزء/front matter), ``article`` (a root heading) or ``stray`` (text)."""
    toks = _tokens(title)
    # A one-word title is a root even when it is a section word: the roots فصل and بسم have articles.
    if not toks or "﷽" in title or (len(toks) >= 2 and (toks[0] in SECTION_WORDS or toks[0] == "بسم")):
        return "section"
    if toks == ["مقدمة"]:
        return "section"
    if not all(_ARABIC_WORD.match(t) for t in toks):
        return "stray"
    if all(len(t) <= 2 for t in toks) and sum(len(t) for t in toks) <= 7:  # spaced: "ر ح م", "ع ور"
        return "article"
    if (len(toks) == 1 and len(toks[0]) <= 10) or (len(toks) == 2 and all(len(t) <= 8 for t in toks)):
        return "article"  # "أبأ", "بابونج", the closing particles "الواو المفردة"
    return "stray"


# --- headword markers ----------------------------------------------------------------------------

_REF = re.compile(r"^\s{0,2}[\(\[]\s*[^\d٠-٩()\[\]:]{2,30}:\s*[٠-٩\d]")
_CUE = re.compile(r"(?:تعالي|﷿|وجل|التنزيل|القران|العزيز|الايه|قري|قرا|قراه|ثناوه|سبحانه)[\s:]*$")
_CUE_FOLD = str.maketrans({"ى": "ي", "ة": "ه", "أ": "ا", "إ": "ا", "آ": "ا", "ء": "", "ؤ": "و", "ئ": "ي"})
# "تعالى" also closes a eulogy ("إلى الله تعالى"): a citation needs a colon or a verb of citing.
_CITING = re.compile(r"^[وفكبل]{0,2}(?:قول\w*|قال|قالوا|يقول|قري|قرا|قراه|قرات|يقرا)$")
_MARKER_CHARS = OPEN + CLOSE + "!"


@dataclass(frozen=True)
class _Quote:
    start: int
    end: int
    score: float
    reason: str


def _quote_candidates(p: str, quran: QuranPairs) -> list[_Quote]:
    brackets = [i for i, ch in enumerate(p) if ch in (OPEN, CLOSE)]
    out: list[_Quote] = []
    for a, i in enumerate(brackets):
        if p[i] != OPEN:
            continue
        before = strip_marks(re.sub(f"[{_MARKER_CHARS}]", "", p[max(0, i - 50) : i])).translate(_CUE_FOLD)
        before = re.sub("[^ء-ي﷿:.؛، ]", " ", before)  # a full stop or comma ends the cue
        cue = bool(_CUE.search(before)) and (
            before.rstrip().endswith(":") or any(_CITING.match(t) for t in before.split())
        )
        for b, j in enumerate(brackets[a + 1 :], start=a + 1):
            if p[j] != CLOSE:
                continue
            inner = re.sub(f"[{_MARKER_CHARS}]", "", p[i + 1 : j])
            toks = qtokens(inner)
            n = len(toks)
            if n > 40:
                break
            if n == 0:
                continue
            share = quran.share(toks)
            letters = sum(len(t) for t in toks)
            ref = bool(_REF.match(p[j + 1 : j + 45]))
            # Recognised by its words alone, a quotation must not straddle al-Qāmūs's parentheses —
            # a marker pair cut through the matn does — and most of its word pairs must be Quranic.
            bare = not (cue or ref)
            straddles = inner.count("(") != inner.count(")")
            if bare and re.search(r"[()]", inner):
                share = 0.0
            match = (n >= 3 and share >= (0.6 if bare else 0.5)) or (n == 2 and share == 1.0 and letters >= 9)
            # After a citation, a span cut through al-Qāmūs's parentheses must still read as Quran
            # ("وقرئ ( ﴿تزور) ومعنى الكل…" is a reading whose closing bracket was a marker).
            cited = cue and n <= 25 and (not straddles or share >= 0.5 or n <= 2)
            if not (match or ref or cited):
                continue
            internal = b - a - 1
            score = (3 * share if match else 0) + (2 if ref else 0) + (1.5 if cue else 0) - 0.25 * internal
            if score <= 0:
                continue
            reason = "quran-text" if match else "reference" if ref else "citation-formula"
            out.append(_Quote(i, j, score, reason))
    return out


def _best_quotes(cands: list[_Quote]) -> list[_Quote]:
    """Weighted interval scheduling: non-overlapping quotations with the best total score."""
    cands = sorted(cands, key=lambda q: (q.end, q.start))
    best: list[tuple[float, list[_Quote]]] = [(0.0, [])]
    ends = [-1]
    for q in cands:
        # last chosen-set index whose interval ends before q starts
        lo, hi = 0, len(ends) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if ends[mid] < q.start:
                lo = mid
            else:
                hi = mid - 1
        take = (best[lo][0] + q.score, [*best[lo][1], q])
        keep = best[-1]
        best.append(take if take[0] > keep[0] else keep)
        ends.append(q.end)
    return best[-1][1]


def strip_headword_markers(body: str, quran: QuranPairs, counters: Counters) -> str:
    out_paras = []
    for p in body.split("\n\n"):
        if not any(ch in p for ch in _MARKER_CHARS):
            out_paras.append(p)
            continue
        quotes = _best_quotes(_quote_candidates(p, quran))
        keep = {q.start for q in quotes} | {q.end for q in quotes}
        for q in quotes:
            counters.add(f"taj-quotation-brackets-kept:{q.reason}")
        remove = {i for i, ch in enumerate(p) if ch in _MARKER_CHARS and i not in keep}
        out: list[str] = []
        skip_space = False
        for i, ch in enumerate(p):
            if i in remove:
                counters.add("taj-headword-markers-removed")
                counters.add("taj-headword-markers-removed:" + ("exclamation" if ch == "!" else "bracket"))
                prev = out[-1] if out else ""
                nxt = p[i + 1] if i + 1 < len(p) else ""
                if nxt == " " and prev in ("", " ", "(", OPEN, "["):
                    skip_space = True
                elif prev == " " and len(out) >= 2 and out[-2] in ("(", OPEN, "["):
                    out.pop()
                continue
            if skip_space and ch == " ":
                skip_space = False
                continue
            skip_space = False
            out.append(ch)
        out_paras.append(re.sub(" {2,}", " ", "".join(out)).strip())
    return "\n\n".join(x for x in out_paras if x)


# --- splitting -----------------------------------------------------------------------------------


@dataclass
class _Open:
    headword: str
    source_ref: str
    heads: list[str]
    lines: list[Line] = field(default_factory=list)

    def has_text(self) -> bool:
        """Letters after the heading (a lone ":" or "،" between two headings is not text)."""
        return any(re.search("[ء-ي]", ln.text) for ln in self.lines)


def _heading_position(text: str, start: int, end: int, span_text: str) -> str | None:
    """``start`` when nothing but marks, digits or punctuation precedes the span on its line (a stray
    "." or «٣ -» numbering is part of the heading line); ``waw`` for the second heading of a combined
    article ("ظوأ⏎و<span>ظيأ</span>"); None for an anchor inside running text or glued into a word."""
    if end < len(text) and _LETTERISH.match(text[end]) and not span_text[-1:].isspace():
        return None
    left = strip_marks(text[:start])
    if not re.search("[ء-ي]", left):
        return "start"
    if left.strip() == "و":
        return "waw"
    return None


# A root article the TOC does not list, typed like Lisān's headings: "صرخَ: (الصَّرْخَة: …" — the root,
# a colon, then al-Qāmūs's text in parentheses (markers may sit between).
_UNTAGGED = re.compile("^\\s*([ء-ي][ء-يً-ْ]{2,10})\\s*:\\s*(?=[﴿﴾! ]*\\()")
_ORDER = "ءبتثجحخدذرزسشصضطظعغفقكلمنهوي"
_ORDER_FOLD = str.maketrans({"أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ا": "ء", "ى": "ي", "ة": "ه"})
_NOT_ROOTS = {
    "قلت",
    "قءل",
    "قيل",
    "قوله",
    "يقءل",
    "قءلو",
    "وقءل",
    "وقيل",
    "ءي",
    "يعني",
    "ومنه",
    "قءلوء",
    "ويروي",
    "يروي",
}


def _okey(text: str) -> str:
    return "".join(ch for ch in strip_marks(text).translate(_ORDER_FOLD) if ch in _ORDER)


def _untagged_heading(token: str, current: str, nxt: str | None) -> bool:
    """A line-initial "X:" is a root heading the TOC missed when X shares the current article's first
    radical (فصل) and last radical (باب; و/ي as one weak class) and its first two radicals sort
    between the current heading and the next TOC heading of the same فصل (two radicals only: Tāj
    interleaves quadriliterals, "صربخ" before "صرخ")."""
    c, x = _okey(current), _okey(token)
    if not (3 <= len(x) <= 5) or x.startswith("ءل") or x in _NOT_ROOTS or len(c) < 2 or x == c:
        return False

    def cls(ch: str) -> str:
        return "w" if ch in "وي" else ch

    def r2(s: str) -> list[int]:
        return [_ORDER.index(ch) for ch in s[:2]]

    if x[0] != c[0] or cls(x[-1]) != cls(c[-1]) or r2(x) < r2(c):
        return False
    if nxt:
        n = _okey(nxt)
        if n and n[0] == x[0] and r2(x) > r2(n):
            return False
    return True


_BROKEN_EMPTY_BRACKET = re.compile(r"\[[ \t]*\n\n[ \t]*\]")
_DEFECTS = {
    "typing-defect:empty-brackets": re.compile(r"\[\s*\]"),
    "typing-defect:quran-font-code": re.compile("[٠-٩]+\\. [٠-٩]{3}"),
    "typing-defect:saqt-note": re.compile(r"\(سقط"),
}


def split_taj(
    spec: WorkSpec, lines: list[Line], toc: dict[int, TocEntry], counters: Counters, quran: QuranPairs
) -> tuple[list[RawArticle], dict[str, Any]]:
    sid = spec.cfg["shamela_id"]
    entries = sorted(toc.values(), key=lambda e: e.order)
    kinds = {e.shamela_title_id: classify_title(e.title) for e in entries}
    first_bab = next(
        i
        for i, e in enumerate(entries)
        if kinds[e.shamela_title_id] == "section" and e.title.startswith("باب")
    )
    expected = [e for e in entries[first_bab:] if kinds[e.shamela_title_id] == "article"]
    pos_of = {e.shamela_title_id: n for n, e in enumerate(expected)}
    exp_keys = [match_key(e.title) for e in expected]
    sections = {tid for tid, k in kinds.items() if k == "section"}
    counters.add(
        "taj-article-split:stray-toc-titles-kept-as-text", sum(1 for k in kinds.values() if k == "stray")
    )

    out: list[RawArticle] = []
    not_found: list[str] = []
    k = 0
    current: _Open | None = None
    skipped = 0

    def close() -> None:
        nonlocal current
        if current is None:
            return
        body, ref = assemble(current.lines, counters)
        sep = _SEPARATOR.match(body)
        if sep and sep.group(0).strip():
            counters.add("heading-separator-dropped")
            body = body[sep.end() :]
        # A lost honorific glyph left "[" and "]" on two lines: the line break is not the text's.
        body, n = _BROKEN_EMPTY_BRACKET.subn("[]", body)
        counters.add("whitespace-normalised:line-break-in-empty-brackets", n)
        body = strip_headword_markers(body, quran, counters)
        for name, pat in _DEFECTS.items():
            counters.add(name, len(pat.findall(body)))
        if not re.search("[ء-ي]", body):
            body = ""  # a heading followed only by "،" or ":" before the next heading: no article text
        heads = current.heads if len(current.heads) > 1 else None
        out.append(RawArticle(current.headword, body, ref, current.source_ref, match_heads=heads))
        current = None

    def accept(idx: int, combined: bool = False) -> None:
        nonlocal k, current
        not_found.extend(e.title for e in expected[k:idx])
        k = idx + 1
        e = expected[idx]
        title = e.title.strip()
        if combined and current is not None and not current.has_text():
            counters.add("taj-article-split:combined-heading")
            current.headword += " و" + title
            current.heads.append(title)
            return
        close()
        current = _Open(title, f"shamela:{sid}:toc-{e.shamela_title_id}", [title])

    def emit(ln: Line, start: int, end: int) -> None:
        nonlocal skipped
        text = ln.text[start:end]
        if start == 0 and end == len(ln.text):
            seg = ln
        elif not text.strip():
            return
        else:
            seg = Line(text, ln.page, ln.first_on_page and start == 0, [])
        if current is not None:
            current.lines.append(seg)
        else:
            skipped += len(text)

    for i, ln in enumerate(lines):
        pos = 0
        handled = False
        # Two TOC entries are sometimes anchored on one heading (nested spans): take the one that
        # comes first in the TOC, so the look-ahead never jumps past the next heading.
        spans = sorted(ln.spans, key=lambda s: (s.start, pos_of.get(s.toc_id or -1, 10**9)))
        for sp in spans:
            if sp.start < pos or sp.toc_id is None:
                if sp.toc_id in pos_of:
                    counters.add("taj-article-split:second-anchor-on-one-heading")
                continue
            end = sp.start + len(sp.text)
            where = _heading_position(ln.text, sp.start, end, sp.text) if pos == 0 else None
            if sp.toc_id in pos_of:
                idx = pos_of[sp.toc_id]
                if where is None:
                    counters.add("taj-article-split:anchor-in-running-text")
                    continue
                if not (k <= idx < k + LOOKAHEAD_SPAN):
                    counters.add("taj-article-split:anchor-out-of-order")
                    continue
                if ln.text[: sp.start].strip():
                    counters.add("heading-separator-dropped:prefix-on-heading-line")
                accept(idx, combined=where == "waw")
                pos, handled = end, True
            elif sp.toc_id in sections and where == "start":
                close()
                counters.add("front-matter-skipped:section-headings")
                pos, handled = end, True
        if not handled and not ln.spans:
            t = ln.text.strip()
            if t and classify_title(t) == "article":
                key = match_key(t)
                j = next(
                    (j for j in range(k, min(k + LOOKAHEAD_LINE, len(expected))) if exp_keys[j] == key), None
                )
                if j is not None:
                    counters.add("taj-article-split:plain-heading-line")
                    accept(j)
                    continue
            m = _UNTAGGED.match(ln.text)
            if m and current is not None and current.has_text():
                nxt = expected[k].title if k < len(expected) else None
                if _untagged_heading(m.group(1), current.heads[-1], nxt):
                    counters.add("taj-article-split:untagged-heading")
                    close()
                    head = m.group(1)
                    current = _Open(head, f"shamela:{sid}:page-{ln.page.shamela_page_id}:line-{i}", [head])
                    current.lines.append(Line(ln.text[m.end() :], ln.page, False, []))
                    continue
        emit(ln, pos, len(ln.text))
    close()
    not_found.extend(e.title for e in expected[k:])
    counters.add("front-matter-skipped:chars", skipped)
    counters.add("toc-heading-not-found", len(not_found))
    counters.add("taj-article-split", len(out))
    return out, {"expected_articles": len(expected), "toc_headings_not_found": not_found}
