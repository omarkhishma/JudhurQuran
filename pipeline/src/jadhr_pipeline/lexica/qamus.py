"""al-Qāmūs al-Muḥīṭ (al-Fīrūzābādī, d. 817) from the Shamela typing of the Risāla edition (book 7283).

al-Qāmūs is arranged by the LAST radical (باب) and then the FIRST (فصل); the Risāla edition opens every
root with a bullet "•", and the root itself is never printed — "• الأَباءةُ، كَعَباءَة: القَصَبَةُ…".

Splitting (rule ``qamus-bullet-split``): every bullet starts an article, which runs to the next bullet
or section heading; the bullet itself is the edition's article mark and is not kept. Text before the
first bullet of a section (the author's preface) is not imported. In باب الواو والياء a bullet often
opens with «و:» or «ي:» (the root's weak letter); that stays in the body.

Root (rule ``qamus-root-alignment``): al-Zabīdī's Tāj is a commentary that follows al-Qāmūs article by
article, so each bullet is aligned to Tāj's root headings of the same باب and فصل — an
order-preserving alignment (dynamic programming) that scores each pair by
  * the Tāj root's letters appearing, in order, in the bullet's headword, and
  * the bullet's opening words appearing at the opening of Tāj's article, which quotes al-Qāmūs.
The aligned Tāj heading is the bullet's root-mapping key (``match_heads``; never displayed); the
headword is the bullet's first word as printed. Bullets with no Tāj partner are reported and mapped
from their own headword (usually no root). The closing section on particles (الألف اللينة) is not
aligned: particles have no root.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import strip_marks

from .quranidx import qtokens
from .registry import WorkSpec
from .shamela import Counters, Line, TocEntry, assemble
from .tocworks import RawArticle

BULLET = "•"
LETTER_NAMES = {
    "الهمزة": "ء", "الالف": "ء", "الباء": "ب", "التاء": "ت", "الثاء": "ث", "الجيم": "ج", "الحاء": "ح",
    "الخاء": "خ", "الدال": "د", "الذال": "ذ", "الراء": "ر", "الزاي": "ز", "الزاء": "ز", "السين": "س",
    "الشين": "ش", "الصاد": "ص", "الضاد": "ض", "الطاء": "ط", "الظاء": "ظ", "العين": "ع", "الغين": "غ",
    "الفاء": "ف", "القاف": "ق", "الكاف": "ك", "اللام": "ل", "الميم": "م", "النون": "ن", "الهاء": "ه",
    "الواو": "و", "الياء": "ي",
}  # fmt: skip
_FOLD = str.maketrans({"أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ٱ": "ء", "ى": "ي", "ة": "ه"})
# al-Qāmūs's order of the فصول (الواو before الهاء).
FASL_ORDER = "ءبتثجحخدذرزسشصضطظعغفقكلمنوهي"
_WEAK = "w"  # باب الواو والياء: last radical و or ي (or a final alif)
_HEADWORD = re.compile(r"^\s*(?:[وي]\s*:\s*)?([^\s،,:؛.()]+)")


def _letters(text: str) -> str:
    return "".join(ch for ch in strip_marks(text).translate(_FOLD) if "ء" <= ch <= "ي")


def _bab_class(ch: str) -> str:
    return _WEAK if ch in "ويا" else ("ء" if ch == "ء" else ch)


def section_letter(title: str) -> str | None:
    """'باب الهمزة' → ء, 'فَصْلُ العَيْن' → ع, 'باب الواو والياء' → w, 'باب الألف اللينة' → None."""
    t = strip_marks(title).translate(str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا"}))
    words = t.split()
    if len(words) < 2:
        return None
    if "الواو" in words and "والياء" in words:
        return _WEAK
    if words[1] == "الالف" and "اللينه" in t.replace("ة", "ه"):
        return None
    return LETTER_NAMES.get(words[1])


@dataclass
class _Bullet:
    bab: str | None
    fasl: str | None
    source_ref: str
    lines: list[Line] = field(default_factory=list)
    partner: int | None = None  # the Tāj article it is aligned to


def _taj_sections(taj: list[RawArticle]) -> dict[tuple[str, str], list[int]]:
    """Tāj article indexes by (باب class, فصل letter) from each root heading's own letters."""
    out: dict[tuple[str, str], list[int]] = {}
    for n, a in enumerate(taj):
        for head in a.match_heads or [a.headword]:
            k = _letters(head)
            if len(k) >= 2:
                out.setdefault((_bab_class(k[-1]), k[0]), []).append(n)
    for v in out.values():
        v[:] = sorted(set(v))
    return out


_WEAK_FOLD = str.maketrans({"و": "*", "ي": "*", "ا": "*"})


def _subsequence(root: str, word: str) -> bool:
    """The root's letters appear in order in the word; a weak radical may be written as و، ي or ا
    (حير in «حارَ», قول in «قالَ»)."""

    def sub(r: str, w: str) -> bool:
        it = iter(w)
        return all(ch in it for ch in r)

    return sub(root, word) or sub(root.translate(_WEAK_FOLD), word.translate(_WEAK_FOLD))


def _pair_score(bullet_head: str, bullet_words: list[str], root: str, taj_words: set[str]) -> float:
    w = _letters(bullet_head)
    w = w[2:] if w.startswith("ال") and len(w) > 3 else w
    r = _letters(root)
    if _subsequence(r, w) or _subsequence(r.replace("ء", ""), w.replace("ء", "")):
        s_letters = 1.0
    elif set(r.replace("ء", "")) <= set(w):
        s_letters = 0.5
    else:
        s_letters = 0.0
    head = bullet_words[:6]
    s_text = sum(1 for x in head if x in taj_words) / len(head) if head else 0.0
    return s_letters + 2.0 * s_text


def _align(bullets: list[tuple[str, list[str]]], roots: list[tuple[str, set[str]]]) -> list[int | None]:
    """Order-preserving alignment maximising the summed pair score (pairs below 1.0 are not matches)."""
    n, m = len(bullets), len(roots)
    score = [[0.0] * (m + 1) for _ in range(n + 1)]
    back: list[list[tuple[int, int, bool]]] = [[(0, 0, False)] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            best = (score[i - 1][j], (i - 1, j, False))
            if score[i][j - 1] > best[0]:
                best = (score[i][j - 1], (i, j - 1, False))
            s = _pair_score(bullets[i - 1][0], bullets[i - 1][1], roots[j - 1][0], roots[j - 1][1])
            if s >= 1.0 and score[i - 1][j - 1] + s > best[0]:
                best = (score[i - 1][j - 1] + s, (i - 1, j - 1, True))
            score[i][j], back[i][j] = best
        # j == 0 column: bullets with no root left
    out: list[int | None] = [None] * n
    i, j = n, m
    while i > 0 and j > 0:
        pi, pj, matched = back[i][j]
        if matched:
            out[i - 1] = j - 1
        i, j = pi, pj
    return out


def split_qamus(
    spec: WorkSpec,
    lines: list[Line],
    toc: dict[int, TocEntry],
    counters: Counters,
    taj: list[RawArticle],
) -> tuple[list[RawArticle], dict[str, Any]]:
    sid = spec.cfg["shamela_id"]
    bab: str | None = None
    fasl: str | None = None
    started = False
    bullets: list[_Bullet] = []
    current: _Bullet | None = None
    skipped = 0
    for i, ln in enumerate(lines):
        pos = 0
        for sp in ln.spans:
            if sp.toc_id is None or sp.toc_id not in toc:
                continue
            title = toc[sp.toc_id].title
            words = strip_marks(title).split()
            if not words:
                continue
            head = words[0].replace("ـ", "")
            if head.startswith("باب"):
                bab, fasl, started = section_letter(title), None, True
                if bab is None and "الالف" in strip_marks(title).replace("أ", "ا"):
                    fasl = None
            elif head.startswith("فصل"):
                fasl = section_letter(title)
            else:
                continue
            if current is not None:  # a section heading closes the running article
                if ln.text[pos : sp.start].strip():
                    current.lines.append(
                        Line(ln.text[pos : sp.start], ln.page, ln.first_on_page and pos == 0, [])
                    )
                bullets.append(current)
                current = None
            counters.add("front-matter-skipped:section-headings")
            pos = sp.start + len(sp.text)
        rest = ln.text[pos:]
        parts = rest.split(BULLET)
        for k, part in enumerate(parts):
            if k == 0:
                if current is not None:
                    seg = (
                        ln
                        if (pos == 0 and len(parts) == 1)
                        else Line(part, ln.page, ln.first_on_page and pos == 0, [])
                    )
                    if seg is ln or part.strip():
                        current.lines.append(seg)
                else:
                    skipped += len(part)
                continue
            if current is not None:
                bullets.append(current)
            if not started:
                counters.add("qamus-bullet-split:bullet-before-the-dictionary")
            if k > 1 or (k == 1 and parts[0].strip()):
                counters.add("qamus-bullet-split:bullet-inside-a-line")
            current = _Bullet(bab, fasl, f"shamela:{sid}:page-{ln.page.shamela_page_id}:line-{i}:bullet-{k}")
            current.lines.append(Line(part, ln.page, False, []))
    if current is not None:
        bullets.append(current)

    counters.add("qamus-bullet-split", len(bullets))
    counters.add("front-matter-skipped:chars", skipped)

    # Alignment to Tāj, section by section. A فصل missing from the typing's headings (فصل الذال of
    # باب الباء) leaves its bullets in the previous فصل, so each section is aligned against the Tāj
    # roots from its own letter up to the next فصل that is present.
    taj_sec = _taj_sections(taj)
    taj_words = [set(qtokens(a.body)[:40]) for a in taj]
    taj_root = [(a.match_heads or [a.headword])[0] for a in taj]
    heads = [_head_of(b.lines) for b in bullets]
    opening = [qtokens(" ".join(ln.text for ln in b.lines[:6]))[:8] for b in bullets]
    by_section: dict[tuple[str, str], list[int]] = {}
    for n, b in enumerate(bullets):
        if b.bab is not None and b.fasl is not None:
            by_section.setdefault((b.bab, b.fasl), []).append(n)
    present: dict[str, set[str]] = {}
    for bb, ff in by_section:
        present.setdefault(bb, set()).add(ff)
    splits: list[tuple[int, int, int]] = []  # (bullet, line index, Tāj article) for bullets the typing lost
    for (bb, ff), idxs in by_section.items():
        letters = [ff]
        for ch in FASL_ORDER[FASL_ORDER.index(ff) + 1 :] if ff in FASL_ORDER else []:
            if ch in present[bb]:
                break
            letters.append(ch)
        if len(letters) > 1:
            counters.add("qamus-root-alignment:sections-with-a-missing-fasl-heading")
        cands = [t for ch in letters for t in taj_sec.get((bb, ch), [])]
        roots = [(taj_root[t], taj_words[t]) for t in cands]
        match = _align([(heads[n], opening[n]) for n in idxs], roots)
        used: dict[int, int] = {}  # candidate position → bullet
        for n, j in zip(idxs, match, strict=True):
            if j is not None:
                bullets[n].partner = cands[j]
                used[j] = n
        # Tāj sometimes orders two roots the other way round (د ي ن before دهمن): a leftover bullet
        # takes an unused root of its section when letters and text both agree.
        for n in idxs:
            if bullets[n].partner is not None:
                continue
            scored = [
                (_pair_score(heads[n], opening[n], *roots[j]), j) for j in range(len(cands)) if j not in used
            ]
            best = max(scored, default=(0.0, -1))
            if best[0] >= 2.0:
                bullets[n].partner = cands[best[1]]
                used[best[1]] = n
                counters.add("qamus-root-alignment:out-of-order")
        # A bullet the typing lost ("الشَّجَرُ والشِّجَرُ…" opens a line with no "•"): inside the bullet
        # aligned to the previous Tāj root, the line whose first word carries the unused root's letters
        # and whose opening words open Tāj's article (which quotes al-Qāmūs) starts that root's article.
        for j in range(len(cands)):
            if j in used:
                continue
            prev = max((p for p in used if p < j), default=None)
            if prev is None:
                continue
            owner = used[prev]
            r = _letters(taj_root[cands[j]])
            for li in range(1, len(bullets[owner].lines)):
                w = qtokens(bullets[owner].lines[li].text)
                if len(w) < 4:
                    continue
                first = _letters(w[0])
                first = first[2:] if first.startswith("ال") and len(first) > 3 else first
                hits = sum(1 for x in w[:6] if x in taj_words[cands[j]])
                if r[:1] == first[:1] and _subsequence(r, first) and hits >= 4:
                    splits.append((owner, li, cands[j]))
                    used[j] = -1
                    break

    out: list[_Bullet] = []
    by_owner: dict[int, list[tuple[int, int]]] = {}
    for owner, li, t in splits:
        by_owner.setdefault(owner, []).append((li, t))
    for n, b in enumerate(bullets):
        cuts = sorted(by_owner.get(n, []))
        if not cuts:
            out.append(b)
            continue
        bounds = [0, *[li for li, _ in cuts], len(b.lines)]
        for k in range(len(bounds) - 1):
            piece = _Bullet(b.bab, b.fasl, b.source_ref, b.lines[bounds[k] : bounds[k + 1]])
            if k == 0:
                piece.partner = b.partner
            else:
                ln = piece.lines[0]
                piece.source_ref = (
                    f"shamela:{sid}:page-{ln.page.shamela_page_id}:lost-bullet-{taj_root[cuts[k - 1][1]]}"
                )
                piece.partner = cuts[k - 1][1]
                counters.add("qamus-bullet-split:lost-bullet-recovered")
            out.append(piece)

    arts: list[RawArticle] = []
    unaligned: list[str] = []
    for b in out:
        body, ref = assemble(b.lines, counters)
        head = _head_of(b.lines)
        match_heads = (
            list(taj[b.partner].match_heads or [taj[b.partner].headword]) if b.partner is not None else None
        )
        if b.partner is None and b.bab is not None:
            unaligned.append(head)
        arts.append(RawArticle(head, body, ref, b.source_ref, match_heads=match_heads))
    aligned = sum(1 for b in out if b.partner is not None)
    counters.add("qamus-root-alignment", aligned)
    counters.add("qamus-root-alignment:unaligned", len(unaligned))
    counters.add("qamus-root-alignment:particles-not-aligned", sum(1 for b in out if b.bab is None))
    return arts, {
        "bullets": len(bullets),
        "aligned_to_taj": aligned,
        "unaligned_bullets": unaligned,
        "lost_bullets_recovered": [taj_root[t] for _, _, t in splits],
    }


def _head_of(lines: list[Line]) -> str:
    text = next((ln.text for ln in lines if ln.text.strip()), "")
    m = _HEADWORD.match(text)
    return m.group(1) if m else ""
