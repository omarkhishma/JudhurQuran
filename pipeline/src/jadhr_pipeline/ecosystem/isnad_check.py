"""The isnād/matn split measured against Sanadset v5 (research 21 §3): a cross-check, never shown, never copied —
Sanadset's boundaries are read off its own text and carried onto ours by aligning the words.

Sanadset follows another convention (the Companion's «قال» and the reported actor go to its isnād), so the measure
compares what both conventions share: where the reported content begins once the words that introduce it (قال، أن،
the Prophet's mention, the honorifics) are passed over on both sides, in words; and whether the chain's last narrator
is the same name. A Sanadset row that falls inside our record's comment (the chains al-Tirmidhī cites after a hadith) is
left out, as is al-Nasāʾī, whose Sunan in Sanadset is the Kubrā, not our Mujtabā.

Needs pyarrow (the workspace's dev group); the build never runs it."""

from __future__ import annotations

import ast
import difflib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from jadhr_arabic import normalize

from .isnad import Split, known_names, split

SANADSET = "sanadset-650k/sanadset-v5-subset-six-books.parquet"
BOOKS = {
    "صحيح البخاري": "bukhari",
    "صحيح مسلم": "muslim",
    "سنن أبي داود": "abudawud",
    "جامع الترمذي": "tirmidhi",
    "سنن ابن ماجه": "ibnmajah",
    "موطأ مالك رواية يحيى الليثي": "malik",
}
ALL = ["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik"]
_INTRODUCERS = frozenset(
    normalize(w)
    for w in [
        "قال",
        "قالت",
        "قالا",
        "يقول",
        "تقول",
        "فقال",
        "سمعت",
        "سمع",
        "أن",
        "أنه",
        "أنها",
        "رسول",
        "الله",
        "النبي",
        "نبي",
        "صلى",
        "عليه",
        "وسلم",
        "السلام",
        "رضي",
        "عنه",
        "عنها",
        "عنهما",
        "عن",
    ]
)
_W = re.compile(r"[ء-غف-ي]+")


def _words(s: str) -> list[str]:
    return _W.findall(normalize(s))


def _content(ws: list[str], i: int) -> int:
    while i < len(ws) and ws[i] in _INTRODUCERS:
        i += 1
    return i


def records(raw: Path) -> dict[str, list[dict[str, Any]]]:
    return {
        b: [
            h
            for h in json.loads(
                (raw / f"fawazahmed0-hadith-api/editions/ara-{b}.json").read_text(encoding="utf-8")
            )["hadiths"]
            if (h["text"] or "").strip()
        ]
        for b in ALL
    }


def splits(recs: dict[str, list[dict[str, Any]]]) -> dict[str, list[Split | None]]:
    """Both passes over every collection: the names the chains use, then every record read with them."""
    first = [(h["text"], split(h["text"], b)) for b in ALL for h in recs[b]]
    known = known_names(first)
    return {b: [split(h["text"], b, known) for h in recs[b]] for b in ALL}


def measure(raw: Path) -> dict[str, dict[str, Counter[str]]]:
    """Per book and rule: rows compared (``n``), the content's start exact / within 2 / within 5 words, the last
    narrator the same (``companion=`` of ``companion n``)."""
    import pyarrow.parquet as pq

    recs = records(raw)
    ours = splits(recs)
    rows = pq.read_table(raw / SANADSET).to_pylist()
    out: dict[str, dict[str, Counter[str]]] = {}
    for book_ar, b in BOOKS.items():
        words = [_words(h["text"]) for h in recs[b]]
        index: dict[tuple[str, ...], list[int]] = defaultdict(list)
        for k, ws in enumerate(words):
            for g in {tuple(ws[i : i + 5]) for i in range(len(ws) - 4)}:
                index[g].append(k)
        by_rule: dict[str, Counter[str]] = defaultdict(Counter)
        for r in rows:
            if r["Book"] != book_ar:
                continue
            their = _words(re.sub(r"</?[A-Z]+>", " ", r["Hadith"]))
            matn = _words(r["Matn"] or "")
            grams = {tuple(matn[i : i + 5]) for i in range(len(matn) - 4)}
            if len(grams) < 2:
                continue
            votes = Counter(k for g in grams for k in index.get(g, ()))
            if not votes or votes.most_common(1)[0][1] / len(grams) < 0.5:
                continue
            k = votes.most_common(1)[0][0]
            h, s, ws = recs[b][k], ours[b][k], words[k]
            rule = s.rule if s else "none"
            if s is None or s.matn is None:
                by_rule[rule]["no matn"] += 1
                continue
            start = len(their) - len(matn)
            mapped = None
            for a, bb, size in difflib.SequenceMatcher(None, their, ws, autojunk=False).get_matching_blocks():
                if a <= start < a + size:
                    mapped = bb + start - a
                    break
            if mapped is None:
                by_rule[rule]["unmapped"] += 1
                continue
            if s.comment and mapped >= len(_words(h["text"][: s.comment[0]])):
                by_rule[rule]["in our comment"] += 1
                continue
            d = abs(_content(ws, len(_words(h["text"][: s.matn[0]]))) - _content(ws, mapped))
            c = by_rule[rule]
            c["n"] += 1
            c["exact"] += d == 0
            c["within 2"] += d <= 2
            c["within 5"] += d <= 5
            try:
                sanad = ast.literal_eval(r["Sanad"]) if isinstance(r["Sanad"], str) else r["Sanad"]
            except (ValueError, SyntaxError):
                sanad = None
            if sanad and s.names:
                last = " ".join(_words(sanad[-1])).removeprefix("و")
                mine = " ".join(_words(h["text"][s.names[-1][0] : s.names[-1][1]])).removeprefix("و")
                c["companion n"] += 1
                c["companion="] += bool(last and mine and (last in mine or mine in last))
        out[b] = dict(by_rule)
    return out


def summary(m: dict[str, dict[str, Counter[str]]]) -> dict[str, dict[str, float]]:
    """Per book, over all its rules: the shares the research reports."""
    out = {}
    for b, rules in m.items():
        t: Counter[str] = Counter()
        for c in rules.values():
            t.update(c)
        n = max(t["n"], 1)
        out[b] = {
            "n": t["n"],
            "exact": round(t["exact"] / n, 3),
            "within 2": round(t["within 2"] / n, 3),
            "within 5": round(t["within 5"] / n, 3),
            "companion": round(t["companion="] / max(t["companion n"], 1), 3),
        }
    return out
