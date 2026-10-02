"""Lisan al-Arab article splitter (rule ``lisan-article-split``).

The Shamela text of Lisan has headings only for باب/فصل — and those headings are not reliable
(missing فصل headings, "فصل الشين" over a سين section, a حرف heading typed as فصل). Articles
therefore have to be found in the running text. Every article opens on a new line with its
headword followed by a colon ("أَبَأَ: …", "دَيَنَ: …"), and Lisan is arranged in a strict
order: by the LAST radical (باب), then alphabetically by the headword (فصل = first radical,
then the following letters).

Algorithm:

1. Candidates are line-initial tokens "X:" whose letter skeleton has 2–6 letters.
2. Each candidate gets the sort key (last radical class, letters…) of Lisan's arrangement
   (alif and hamza rank together; a final و/ي/ا/ى falls in the merged weak باب).
3. The article starts are the heaviest non-decreasing subsequence of candidate keys in the
   dictionary body, each skeleton weighing 1 in total across its occurrences. Quoted lines that happen to start with "word:" ("قَالَ:", "وَيُرْوَى:")
   break the order and are rejected; the report counts them.
4. A one-letter line "ث: الثَّاءُ مِنَ الْحُرُوفِ…" (the letter description that opens each
   باب) starts its own entry; a heading ends the running article.

Splitting only inserts boundaries; text is never moved or edited. Bodies begin with the
printed "headword:" line. The particle articles of the closing الألف اللينة section are headed
by TOC titles and are taken as such.

This fixes the merged articles of earlier community splits (عين inside عون, ولي inside وشي,
دين inside دون, حفظ inside حظظ…).
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

from .shamela import Counters, Line, TocEntry, assemble

ALPHABET = "ءبتثجحخدذرزسشصضطظعغفقكلمنهوي"
RANK = {ch: i for i, ch in enumerate(ALPHABET)}
RANK["ا"] = RANK["ء"]
WEAK_RANK = RANK["و"]

_FOLD = str.maketrans(
    {
        "\u0623": "\u0621",
        "\u0625": "\u0621",
        "\u0622": "\u0621",
        "\u0624": "\u0621",
        "\u0626": "\u0621",
        "\u0671": "\u0621",
        "\u0649": "\u064a",
        "\u0629": "\u0647",
    }
)
_HEADWORD = re.compile(r"^[ \t]*([\u0621-\u064a\u064b-\u0652\u0670\u0671]{1,16})[ \t]*:")
_MARKS = re.compile(r"[\u064b-\u0652\u0670]")


def skeleton(token: str) -> str:
    return "".join(ch for ch in _MARKS.sub("", token).translate(_FOLD) if ch in RANK)


def sort_key(s: str) -> tuple[int, int]:
    """(باب, فصل): last-radical class, then first radical. Order inside a فصل is not used —
    Lisan interleaves quadriliterals with their triliteral neighbours."""
    last = s[-1]
    bab = WEAK_RANK if last in "ويا" else RANK[last]
    return (bab, RANK[s[0]])


@dataclass
class LisanArticle:
    headword: str
    body: str
    page_ref: str | None
    source_ref: str


def _heaviest_chain(keys: Sequence[tuple[int, int]], weights: Sequence[float]) -> list[int]:
    """Indices of the maximum-weight non-decreasing subsequence of ``keys`` (Fenwick tree over
    the key ranks, O(n log n)). Ties prefer the earlier chain end, so the result is deterministic."""
    ranks = {k: r for r, k in enumerate(sorted(set(keys)), start=1)}
    size = len(ranks)
    tree: list[tuple[float, int]] = [(0.0, -1)] * (size + 1)  # (best weight, chain end index)

    def query(r: int) -> tuple[float, int]:
        best = (0.0, -1)
        while r > 0:
            if tree[r][0] > best[0]:
                best = tree[r]
            r -= r & -r
        return best

    def update(r: int, val: tuple[float, int]) -> None:
        while r <= size:
            if val[0] > tree[r][0]:
                tree[r] = val
            r += r & -r

    prev = [-1] * len(keys)
    best_end = (0.0, -1)
    for i, k in enumerate(keys):
        r = ranks[k]
        w, j = query(r)
        prev[i] = j
        total = w + weights[i]
        update(r, (total, i))
        if total > best_end[0]:
            best_end = (total, i)
    out: list[int] = []
    i = best_end[1]
    while i != -1:
        out.append(i)
        i = prev[i]
    return out[::-1]


def _not_a_root(s: str) -> bool:
    if "ا" in s[1:-1]:
        return True
    return len(s) >= 4 and (s.startswith("ال") or s[1:].startswith("ال"))


def _fine(s: str) -> tuple[int, ...]:
    return tuple(RANK[ch] for ch in s)


def _misfit(p: int, s: str, others: list[int], skel: list[str]) -> int:
    """How many neighbours in the run are out of alphabetical order if ``s`` starts at ``p``."""
    fs = _fine(s)
    bad = sum(1 for q in others if q < p and _fine(skel[q]) > fs)
    bad += sum(1 for q in others if q > p and _fine(skel[q]) < fs)
    return bad


def _dedupe(lnds: list[int], skel: list[str], keys: list[tuple[int, int]]) -> list[int]:
    """Within each run of equal (باب, فصل) keys keep one position per skeleton."""
    out: list[int] = []
    run: list[int] = []

    def flush() -> None:
        groups: dict[str, list[int]] = {}
        for p in run:
            groups.setdefault(skel[p], []).append(p)
        chosen = set()
        for s, ps in groups.items():
            if len(ps) == 1:
                chosen.add(ps[0])
                continue
            others = sorted(p for p in run if skel[p] != s)
            scored = [(_misfit(p, s, others, skel), p) for p in ps]
            chosen.add(min(scored)[1])
        out.extend(p for p in run if p in chosen)

    for p in lnds:
        if run and keys[p] != keys[run[-1]]:
            flush()
            run = []
        run.append(p)
    if run:
        flush()
    return out


def split_lisan(
    lines: list[Line], toc: dict[int, TocEntry], counters: Counters, shamela_id: int
) -> list[LisanArticle]:
    def title_of(ln: Line) -> TocEntry | None:
        sl = ln.span_line
        if sl is None or sl.toc_id is None:
            return None
        return toc.get(sl.toc_id)

    titles = {i: t for i, ln in enumerate(lines) if (t := title_of(ln)) is not None}
    # Dictionary body: from the first فصل heading to the closing الألف اللينة section (TOC title "ا").
    start = next(i for i, t in sorted(titles.items()) if t.title.startswith("فصل"))
    end = next(
        (i for i, t in sorted(titles.items()) if i > start and t.title == "ا" and t.parent_title is None),
        len(lines),
    )

    raw_cands: list[tuple[int, str]] = []
    letter_starts: list[int] = []
    for i in range(start, end):
        if i in titles:
            continue
        m = _HEADWORD.match(lines[i].text)
        if not m:
            continue
        s = skeleton(m.group(1))
        if len(s) == 1:
            letter_starts.append(i)
        elif 2 <= len(s) <= 6:
            raw_cands.append((i, s))
    # Not a root headword: a plain alif inside the word (قال، صار، عامر) or a definite article
    # (الغرقئ، والوجء) — quotation formulas and quoted words that happen to open a line.
    cands = [(i, s) for i, s in raw_cands if not _not_a_root(s)]
    counters.add("lisan-article-split:candidates", len(raw_cands))
    counters.add("lisan-article-split:rejected-not-a-root-form", len(raw_cands) - len(cands))
    keys = [sort_key(s) for _, s in cands]
    # Each skeleton is worth 1 in total, shared by its occurrences: a headword that opens its
    # article once outweighs a quotation formula ("وَيُرْوَى:") repeated on many lines.
    freq = Counter(s for _, s in cands)
    lnds = _heaviest_chain(keys, [1.0 / freq[s] for _, s in cands])
    counters.add("lisan-article-split:rejected-out-of-order", len(cands) - len(lnds))
    # A name or word quoted at a line start inside its own (باب, فصل) run fits the order too
    # ("عمر:", "ثعلب:"). Keep one start per skeleton per run: the occurrence that best fits the
    # alphabetical order between its neighbours.
    keep_pos = _dedupe(lnds, [s for _, s in cands], keys)
    counters.add("lisan-article-split:rejected-repeated-in-run", len(lnds) - len(keep_pos))
    starts = sorted({cands[j][0] for j in keep_pos} | set(letter_starts))
    start_set = set(starts)

    articles: list[LisanArticle] = []
    skipped = sum(len(ln.text) for ln in lines[:start])
    i = start
    while i < end:
        if i not in start_set:
            skipped += len(lines[i].text)
            i += 1
            continue
        j = i + 1
        while j < end and j not in start_set and j not in titles:
            j += 1
        m = _HEADWORD.match(lines[i].text)
        head = m.group(1) if m else lines[i].text.split(":")[0].strip()
        body, ref = assemble(lines[i:j], counters)
        page = lines[i].page
        articles.append(
            LisanArticle(head, body, ref, f"shamela:{shamela_id}:page-{page.shamela_page_id}:line-{i}")
        )
        i = j
    # Closing section: particles, each headed by a TOC title standing on its own line. Inline
    # TOC anchors in this section stay part of the running text.
    cur: tuple[str, int, int] | None = None  # (headword, toc id, first line)
    for i in range(end, len(lines) + 1):
        t = titles.get(i) if i < len(lines) else None
        if i == len(lines) or t is not None:
            if cur is not None:
                head, tid, first = cur
                body, ref = assemble(lines[first:i], counters)
                articles.append(LisanArticle(head, body, ref, f"shamela:{shamela_id}:toc-{tid}"))
                cur = None
            if t is not None and (t.parent_title == "ا" or (t.title == "ا" and t.parent_title is None)):
                cur = (t.title.strip(), t.shamela_title_id, i + 1)
            continue
        if cur is None:
            skipped += len(lines[i].text)
    counters.add("front-matter-skipped:chars", skipped)
    counters.add("lisan-article-split", len(articles))
    return articles
