"""Verse cross-references: the verses Ibn Kathīr cites while explaining a verse (PLAN P3.9, D25).

Our own extraction, read from the build's ``work_passages.jsonl`` (work ``ibn-kathir``: the editor's
inline footnotes are already stripped, the single-bracket references the edition prints after each
cited verse remain, e.g. ``﴿…﴾ [مَرْيَمَ: ٩٣-٩٥]``).

Two methods, each recorded on the row:

* ``reference`` — the edition's bracketed reference after a quote: sūra name (vocalised, misspelt, an
  alternative name, or «الآية» meaning a sūra named in the sentence) and verse numbers (Arabic-Indic or
  Western digits; single, lists, ranges, reversed ranges, several sūras in one bracket). The cited span
  is then checked against the quote in front of it.
* ``quote`` — a ﴿…﴾ quote of three or more words with no reference, found at exactly one place in the
  Quran outside the passage's own verses. Repeated phrases (found in several places) are not guessed.

A citation of a verse inside the passage's own range is the verse being explained, not a
cross-reference, and is dropped (counted). Rows are produced for every verse of the passage's range.
"""

from __future__ import annotations

import random
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from .quran import QuranIndex, SurahNames, match_key, to_ascii_digits

WORK_ID = "ibn-kathir"
SOURCE_ID = "ibn-kathir-crossrefs"

_QUOTE = re.compile(r"﴿([^﴿﴾]*)﴾")
_REF = re.compile(r"\[([^\[\]:]{1,40}):([^\[\]]{1,60})\]")
_AYAH_WORDS = {"ايه", "ايتان", "ايتين", "ايات"}
_SURAH_MENTION = re.compile(r"(?:سُورَةِ|سورة|سُورَةُ)\s+\"?([^\s:،.\"]+(?:\s+[^\s:،.\"]+)?)")
_CONF_RANK = {"high": 3, "medium": 2, "low": 1}


@dataclass
class Citation:
    passage_id: int
    span: tuple[int, int]  # passage verse range (ids)
    to_from: int
    to_to: int
    method: str
    confidence: str
    quote: str | None
    reference: str | None
    quote_check: str | None
    resolution: str
    mentions: int = 1
    extra: dict[str, Any] = field(default_factory=dict)


def parse_reference(tail: str) -> list[tuple[str | None, int, int]] | None:
    """The verse groups in a reference tail («٩٣-٩٥», «١، ٢», «٣٠، ٣١، ص: ٧٣، ٧٤», «١٩٦: ١٩٧»).
    Each group is (sūra name for a new group or None for the bracket's own name, from, to)."""
    groups: list[tuple[str | None, int, int]] = []
    cur: str | None = None
    for raw_tok in re.split(r"[،,]", to_ascii_digits(tail)):
        tok = raw_tok.strip()
        if not tok:
            continue
        if ":" in tok:
            left, right = tok.split(":", 1)
            if re.fullmatch(r"\s*\d+\s*", left) and re.fullmatch(r"\s*\d+\s*", right):
                a, b = int(left), int(right)  # «١٩٦: ١٩٧» is a range
                groups.append((cur, min(a, b), max(a, b)))
                continue
            if re.search(r"\d", left):
                return None
            cur, tok = left.strip(), right.strip()
        if re.fullmatch(r"\d+", tok):
            groups.append((cur, int(tok), int(tok)))
        elif m := re.fullmatch(r"(\d+)\s*[-–_ـ]+\s*(\d+)", tok):
            a, b = int(m.group(1)), int(m.group(2))
            groups.append((cur, min(a, b), max(a, b)))  # reversed ranges come from RTL typing
        elif m := re.fullmatch(r"(\d+)\s+(\d+)", tok):
            for n in (int(m.group(1)), int(m.group(2))):
                groups.append((cur, n, n))
        else:
            return None
    return groups or None


def _merge(groups: list[tuple[int, int, int]]) -> list[tuple[int, int, int]]:
    """Adjacent groups of one sūra become one range (١، ٢ → 1–2; a list typed right-to-left, ٧، ٦,
    is sorted first)."""
    out: list[tuple[int, int, int]] = []
    for s, a, b in sorted(set(groups)):
        if out and out[-1][0] == s and out[-1][2] + 1 == a:
            out[-1] = (s, out[-1][1], b)
        else:
            out.append((s, a, b))
    return out


def _preceding_quote(text: str, pos: int) -> tuple[str | None, int]:
    """The ﴿…﴾ quote that ends right before position pos (only spaces/punctuation between)."""
    j = pos - 1
    while j >= 0 and text[j] in " \t\n.,،؛:":
        j -= 1
    if j < 0 or text[j] != "﴾" or pos - j > 4:
        return None, -1
    i = text.rfind("﴿", 0, j)
    if i == -1:
        return None, -1
    return text[i + 1 : j], i


class Extractor:
    def __init__(self, quran: QuranIndex) -> None:
        self.q = quran
        self.names = SurahNames(quran.surah_name)
        self.stats: Counter[str] = Counter()

    def _span(self, s: int, a: int, b: int) -> tuple[int, int] | None:
        x, y = self.q.verse_id(s, a), self.q.verse_id(s, b)
        return (x, y) if x and y else None

    def _overlaps(self, span: tuple[int, int], quote: str) -> bool:
        """Is the quote found in the Quran at a place that overlaps the cited span (same sūra)?"""
        return any(h.verse_from <= span[1] and h.verse_to >= span[0] for h in self.q.locate(quote))

    def _resolve_by_numbers(self, a: int, b: int, quote: str | None) -> list[tuple[int, int, int]]:
        if not quote:
            return []
        hits = []
        for s in range(1, 115):
            span = self._span(s, a, b)
            if span and self.q.contains(*span, quote):
                hits.append((s, a, b))
        return hits

    def passage(self, p: dict) -> list[Citation]:
        text: str = p["text"]
        own = (p["verse_from"], p["verse_to"])
        cites: list[Citation] = []
        used_quotes: set[int] = set()
        for m in _REF.finditer(text):
            name, tail = m.group(1).strip(), m.group(2)
            if not re.search(r"[0-9٠-٩]", tail):
                continue
            self.stats["references_seen"] += 1
            groups = parse_reference(tail)
            if groups is None:
                self.stats["references_unparsed"] += 1
                continue
            quote, qpos = _preceding_quote(text, m.start())
            if qpos >= 0:
                used_quotes.add(qpos)
            resolved: list[tuple[int, int, int]] = []
            how = set()
            ok = True
            for gname, a, b in groups:
                nm = gname or name
                key = match_key(nm).replace(" ", "")
                s, h = (None, "ayah-word") if key in _AYAH_WORDS else self.names.resolve(nm)
                if s is None:
                    hits = self._resolve_by_numbers(a, b, quote)
                    if len({h[0] for h in hits}) == 1:
                        resolved.append(hits[0])
                        how.add("numbers+quote")
                        continue
                    ok = False
                    break
                resolved.append((s, a, b))
                how.add(h)
            if not ok:
                self.stats["references_unresolved"] += 1
                continue
            resolved = _merge(resolved)
            if quote and len(resolved) > 1 and len({g[0] for g in resolved}) == 1:
                # «٣٣، ٣٥» around a quote that runs through 33–35: the list stands for the range
                whole = (resolved[0][0], resolved[0][1], resolved[-1][2])
                span = self._span(*whole)
                parts_fail = not any(
                    self.q.contains(*self._span(*g), quote) for g in resolved if self._span(*g)
                )
                if span and parts_fail and self.q.contains(*span, quote):
                    resolved = [whole]
                    how.add("list-as-range")
            for s, a, b in resolved:
                span = self._span(s, a, b)
                if span is None:
                    self.stats["references_out_of_range"] += 1
                    continue
                if span[0] <= own[1] and span[1] >= own[0]:
                    self.stats["references_self"] += 1
                    continue
                check = self.q.contains(*span, quote) if quote else None
                if quote and check is None and len(resolved) > 1:
                    # several groups in one bracket: the quote may belong to another group
                    check = next(
                        (
                            c
                            for c in (
                                self.q.contains(*self._span(*g), quote) for g in resolved if self._span(*g)
                            )
                            if c
                        ),
                        None,
                    )
                    check = f"other-group:{check}" if check else None
                if quote and check is None and self._overlaps(span, quote):
                    check = "overlap"  # the quote runs past the cited verse into its neighbour
                if "numbers+quote" in how or quote is None:
                    conf = "medium"
                elif check is None:
                    conf = "low"
                elif check in ("exact", "loose") and how <= {"name", "variant"}:
                    conf = "high"
                else:
                    conf = "medium"
                self.stats[f"references_{conf}"] += 1
                cite = Citation(
                    p["id"],
                    own,
                    span[0],
                    span[1],
                    "reference",
                    conf,
                    quote,
                    m.group(0),
                    check,
                    "+".join(sorted(how)),
                )
                if conf == "low" and quote:
                    # the edition's verse number is wrong for its own quote: say where the quote is
                    hits = self.q.locate(quote)
                    if len(hits) == 1:
                        a_, b_ = self.q.key(hits[0].verse_from), self.q.key(hits[0].verse_to)
                        cite.extra["quote_found_at"] = a_ if a_ == b_ else f"{a_}-{b_.split(':')[1]}"
                cites.append(cite)
        for qm in _QUOTE.finditer(text):
            if qm.start() in used_quotes:
                continue
            quote = qm.group(1)
            words = match_key(quote).split()
            if len(words) < 3:
                continue
            self.stats["quotes_seen"] += 1
            hits = self.q.locate(quote)
            if not hits:
                self.stats["quotes_not_found"] += 1
                continue
            if any(h.verse_from <= own[1] and h.verse_to >= own[0] for h in hits):
                self.stats["quotes_self"] += 1
                continue
            if len(hits) > 1:
                self.stats["quotes_ambiguous"] += 1
                continue
            h = hits[0]
            level = h.level
            conf = (
                ("high" if len(words) >= 4 else "medium")
                if level == "exact"
                else ("medium" if level == "loose" else "low")
            )
            self.stats[f"quotes_{conf}"] += 1
            cites.append(
                Citation(
                    p["id"],
                    own,
                    h.verse_from,
                    h.verse_to,
                    "quote",
                    conf,
                    quote,
                    None,
                    level,
                    f"unique-{level}",
                )
            )
        # one citation per cited span per passage: the reference beats a bare quote, then confidence
        best: dict[tuple[int, int], Citation] = {}
        for c in cites:
            k = (c.to_from, c.to_to)
            cur = best.get(k)
            if cur is None:
                best[k] = c
                continue
            cur.mentions += 1
            if (c.method == "reference", _CONF_RANK[c.confidence]) > (
                cur.method == "reference",
                _CONF_RANK[cur.confidence],
            ):
                c.mentions = cur.mentions
                best[k] = c
        return list(best.values())


def build_crossrefs(
    passages: list[dict], quran: QuranIndex
) -> tuple[list[dict[str, Any]], list[Citation], dict[str, Any]]:
    ex = Extractor(quran)
    cites: list[Citation] = []
    n_pass = 0
    for p in passages:
        if p["work_id"] != WORK_ID:
            continue
        n_pass += 1
        cites += ex.passage(p)
    rows: list[dict[str, Any]] = []
    for c in cites:
        for v in range(c.span[0], c.span[1] + 1):
            rows.append(
                {
                    "id": len(rows) + 1,
                    "work_id": WORK_ID,
                    "passage_id": c.passage_id,
                    "from_verse": v,
                    "to_verse": c.to_from,
                    "to_verse_end": c.to_to,
                    "method": c.method,
                    "confidence": c.confidence,
                    "quote": c.quote,
                    "reference": c.reference,
                    "quote_check": c.quote_check,
                    "resolution": c.resolution,
                    "mentions": c.mentions,
                    "quote_found_at": c.extra.get("quote_found_at"),
                    "source_id": SOURCE_ID,
                }
            )
    report: dict[str, Any] = {
        "passages": n_pass,
        "citations": len(cites),
        "rows": len(rows),
        "by_method": dict(Counter(c.method for c in cites)),
        "by_confidence": dict(Counter(f"{c.method}:{c.confidence}" for c in cites)),
        "extraction": dict(sorted(ex.stats.items())),
        "verses_with_crossrefs": len({r["from_verse"] for r in rows}),
        "verses_cited": len({v for c in cites for v in range(c.to_from, c.to_to + 1)}),
    }
    return rows, cites, report


def evaluate_precision(cites: list[Citation], quran: QuranIndex, n: int = 100, seed: int = 20261003) -> dict:
    """Precision on a seeded random sample: does the cited span contain the quote in front of it?
    Sampled among reference citations that carry a quote (a bare-quote citation contains its quote by
    construction, so it would only inflate the number); the whole population is reported as well."""
    pool = [c for c in cites if c.method == "reference" and c.quote]
    rng = random.Random(seed)
    sample = rng.sample(pool, min(n, len(pool)))

    def ok(c: Citation) -> bool:
        return quran.contains(c.to_from, c.to_to, c.quote or "") is not None

    def overlap(c: Citation) -> bool:
        return ok(c) or any(
            h.verse_from <= c.to_to and h.verse_to >= c.to_from for h in quran.locate(c.quote or "")
        )

    good = sum(ok(c) for c in sample)
    good_overlap = sum(overlap(c) for c in sample)
    misses = [
        {
            "passage_id": c.passage_id,
            "cited": f"{quran.key(c.to_from)}-{quran.key(c.to_to)}",
            "reference": c.reference,
            "quote": c.quote,
            "quote_runs_into_neighbour": overlap(c),
        }
        for c in sample
        if not ok(c)
    ]
    population_good = sum(ok(c) for c in pool)
    population_overlap = sum(overlap(c) for c in pool)
    return {
        "method": (
            "seeded random sample of reference citations that carry a quote; a pair is correct when the "
            "cited span contains the quote (normalised: exact, loose, skeleton, or ≥80% of its words in order); "
            "'with_overlap' also accepts a quote that starts in the cited verse and runs into its neighbour"
        ),
        "seed": seed,
        "sample_size": len(sample),
        "correct": good,
        "precision": round(good / len(sample), 4) if sample else None,
        "correct_with_overlap": good_overlap,
        "precision_with_overlap": round(good_overlap / len(sample), 4) if sample else None,
        "misses": misses,
        "population": len(pool),
        "population_correct": population_good,
        "population_precision": round(population_good / len(pool), 4) if pool else None,
        "population_precision_with_overlap": round(population_overlap / len(pool), 4) if pool else None,
    }


def qursim_agreement(rows: list[dict[str, Any]], qursim_csv_text: str, quran: QuranIndex) -> dict[str, Any]:
    """Agreement with QurSim (evaluation only, never output): directed (source verse → target verse)
    pairs. Ours are expanded over each cited span; a QurSim pair whose source shares a passage with
    one of ours is counted at the passage level too, because Ibn Kathīr comments on verse groups."""
    ours = {(r["from_verse"], t) for r in rows for t in range(r["to_verse"], r["to_verse_end"] + 1)}
    qs: dict[tuple[int, int], int] = {}
    for line in qursim_csv_text.splitlines()[1:]:
        parts = line.split(",")
        if len(parts) < 7 or not parts[1].strip().isdigit():
            continue
        a = quran.verse_id(int(parts[1]), int(parts[2]))
        b = quran.verse_id(int(parts[3]), int(parts[4]))
        if a and b:
            qs[(a, b)] = int(parts[6]) if parts[6].strip().isdigit() else -1
    inter = ours & set(qs)
    by_rel = Counter(qs[k] for k in inter)
    total_rel = Counter(qs.values())
    unordered_ours = {tuple(sorted(k)) for k in ours}
    unordered_qs = {tuple(sorted(k)) for k in qs}
    return {
        "qursim_pairs": len(qs),
        "our_pairs": len(ours),
        "both": len(inter),
        "qursim_recall": round(len(inter) / len(qs), 4) if qs else None,
        "share_of_ours_in_qursim": round(len(inter) / len(ours), 4) if ours else None,
        "recall_by_relevance": {
            str(k): f"{by_rel.get(k, 0)}/{v} ({by_rel.get(k, 0) / v:.1%})"
            for k, v in sorted(total_rel.items())
        },
        "unordered_recall": round(len(unordered_ours & unordered_qs) / len(unordered_qs), 4)
        if unordered_qs
        else None,
    }
