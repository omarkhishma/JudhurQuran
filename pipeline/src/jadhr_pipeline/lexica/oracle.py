"""OpenITI copies of the same editions as TEST ORACLES for the article splitters (never display text).

OpenITI texts are CC BY-NC-SA and carry no vowels (docs/research/06 Part 6), so nothing here reaches a
build output. Each file is read into a sequence of articles — heading key + words — using the
markup of that version:

* ``bar``     — "# |غ ل ط" heading lines (Tāj, JK007140, an independently tagged copy);
* ``alone``   — a heading alone on its line, "# علق" (al-ʿAyn, JK000930); "& باب … &" group titles;
* ``colon``   — a paragraph that opens with "# عهك :" (Tahdhīb, JK007040, which has no heading tags);
* ``bullet``  — "# • الأباءة…" (al-Qāmūs, Shamela0007283).

``boundary_precision`` then checks, for a sample of our entries, that an oracle article with the same
heading starts and ends with the same words — i.e. that both boundaries of our split are where the
oracle's annotators put them.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

from jadhr_arabic import strip_marks

from .quranidx import qtokens

_FOLD = str.maketrans(
    {"أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ٱ": "ء", "ى": "ي", "ة": "ه", "ا": "ء"}
)
_SECTION = re.compile(r"^#+\s*\|")


def heading_key(text: str) -> str:
    """Letters of a heading, hamza/alif folded (both sides of the comparison use it)."""
    return "".join(ch for ch in strip_marks(text).translate(_FOLD) if "ء" <= ch <= "ي")


@dataclass
class OracleArticle:
    key: str
    words: list[str]


_MILESTONES = re.compile(r"\s*(?:ms\d+|PageV\d+P\d+|@Q[BE]@)\s*")


def _body_lines(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    if "#META#Header#End#" in text:
        text = text.split("#META#Header#End#", 1)[1]
    out: list[str] = []
    for line in text.splitlines():
        line = _MILESTONES.sub(" ", line).rstrip()  # page and milestone tags, even inside a heading
        if line.startswith("~~") and out:
            out[-1] += " " + line[2:]
        else:
            out.append(line)
    return out


_ALONE = re.compile(r"^#\s+([ء-ي]{2,6}(?:\s*[،,]\s*[ء-ي]{2,6})*)\s*$")
_COLON = re.compile(r"^#\s+\(?([ء-ي]{2,6})\)?\s*:\s*(.*)$")
_BAR = re.compile(r"^#\s*\|\s*(.+?)\s*$")
_BULLET = re.compile(r"^#\s*•\s*(.*)$")


def read_oracle(path: Path, style: str) -> list[OracleArticle]:
    arts: list[OracleArticle] = []
    cur: OracleArticle | None = None
    for line in _body_lines(path):
        head: str | None = None
        rest = ""
        if style == "bar":
            m = _BAR.match(line)
            if m:
                content = m.group(1).strip(" .:،()")
                toks = strip_marks(content).split()
                # a Tāj heading: one root word, or its letters spaced ("غ ل ط", "ع ور"); JK also uses
                # "|" as a column mark inside body lines ("# | الشعر"), which must not count.
                spaced = 1 < len(toks) <= 6 and all(len(x) <= 2 for x in toks)
                if (
                    toks
                    and all(re.fullmatch("[ء-ي]+", x) for x in toks)
                    and (spaced or (len(toks) == 1 and len(toks[0]) <= 7))
                ):
                    head = content
                elif re.match(r"^[\d\s]*\(?\s*(?:باب|فصل|المقصد|الجزء|مقدمة|رموز)", strip_marks(content)):
                    cur = None  # a section title
                    continue
                else:  # JK also opens some body paragraphs with "# |"
                    line = "# " + content
        elif style == "alone":
            if "&" in line:
                cur = None
                continue
            m = _ALONE.match(line)
            if m:
                head = m.group(1).split("،")[0].split(",")[0]
        elif style == "colon":
            if _SECTION.match(line):
                cur = None
                continue
            m = _COLON.match(line)
            if m:
                head, rest = m.group(1), m.group(2)
        elif style == "bullet":
            if _SECTION.match(line):
                cur = None
                continue
            m = _BULLET.match(line)
            if m:
                rest = m.group(1)
                rest = re.sub(r"^\s*[وي]\s*:\s*", "", rest)
                head = (qtokens(rest) or [""])[0]
        else:
            raise ValueError(style)
        if head is not None:
            cur = OracleArticle(heading_key(head), qtokens(rest))
            arts.append(cur)
        elif cur is not None:
            cur.words.extend(qtokens(line))
    return arts


def _alike(a: list[str], b: list[str]) -> float:
    """Share of ``a``'s words found, in order, in ``b`` (longest common subsequence / len(a))."""
    if not a:
        return 0.0
    blocks = SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks()
    return sum(x.size for x in blocks) / len(a)


@dataclass
class Verdict:
    headword: str
    ok: bool
    start: float
    end: float
    reason: str


def boundary_precision(
    entries: list[tuple[list[str], str]],
    oracle: list[OracleArticle],
    *,
    sample: int = 50,
    seed: int = 3002,
    n: int = 8,
    threshold: float = 0.75,
    skip_head: bool = False,
) -> tuple[float, list[Verdict]]:
    """``entries`` are (headings, body) in split order — several headings for a combined article. A
    sampled entry is correct when an oracle article with one of its headings starts with our first ``n`` words and ends with our last ``n``
    words (each at least ``threshold`` of the words, in order, allowing a few extra oracle words).
    ``skip_head`` drops our body's printed header ("هقع: …") before comparing."""
    by_key: dict[str, list[OracleArticle]] = {}
    for art in oracle:
        by_key.setdefault(art.key, []).append(art)
    picks = random.Random(seed).sample(range(len(entries)), min(sample, len(entries)))
    verdicts: list[Verdict] = []
    for i in sorted(picks):
        heads, body = entries[i]
        head = " / ".join(heads)
        words = qtokens(body.split(":", 1)[1] if skip_head and ":" in body[:40] else body)
        cands = [c for h in heads for c in by_key.get(heading_key(h), [])]
        best = Verdict(
            head, False, 0.0, 0.0, "start or end differs" if cands else "no oracle article with this heading"
        )
        for c in cands:
            s = _alike(words[:n], c.words[: n + 4])
            e = _alike(words[-n:], c.words[-(n + 4) :])
            ok = s >= threshold and e >= threshold
            if ok or (s + e) > (best.start + best.end):
                best = Verdict(head, ok, round(s, 2), round(e, 2), "" if ok else "start or end differs")
            if ok:
                break
        verdicts.append(best)
    return sum(v.ok for v in verdicts) / len(verdicts), verdicts
