"""Classical lexica and Quran-gharib works: verbatim import, root mapping, verse alignment.

Entry point::

    build_lexica(raw, registry, roots, words=None, surahs=None)
        -> (lexicon_works, lexicon_entries, gharib_glosses, report)

``raw`` is data/raw, ``registry`` data/lexica.yaml, ``roots`` the 1,642 canonical root rows
(fields ``key``, ``letters``; ``occurrences`` breaks ties). ``words`` (words.jsonl rows) and
``surahs`` (surahs.jsonl rows) are needed for the gharib work and for recognising Quran quotations
in Tāj; when omitted they are read from ``data/build/<latest>/`` next to ``raw``.

Research, licences and rationale: docs/research/02-arabic-lexica.md.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from .gharib import WordIndex, build_glosses, parse_items
from .lane import read_lane
from .lisan import split_lisan
from .qamus import split_qamus
from .quranidx import QuranPairs
from .registry import Registry, WorkSpec, load_registry
from .rootmap import Match, RootMatcher
from .shamela import Counters, load_pages, load_toc, read_lines
from .taj import split_taj
from .taqalib import split_taqalib
from .tocworks import RawArticle, segment_toc_work

__all__ = ["build_lexica", "load_registry", "work_articles"]

ID_STRIDE = 1_000_000  # entry id = id_block * ID_STRIDE + position in the work (deterministic, stable)


def _latest_build(raw: Path) -> Path:
    builds = sorted(p for p in (raw.parent / "build").iterdir() if p.is_dir())
    if not builds:
        raise FileNotFoundError("no data/build/<version> directory for words/surahs")
    return builds[-1]


def _jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.open(encoding="utf-8")]


def _split_counters(counters: Counters, rules: dict[str, str]) -> dict[str, dict[str, int]]:
    """Counters whose name (before ':') is a registry cleaning rule → rules_applied; the rest → stats."""
    applied: dict[str, int] = {}
    stats: dict[str, int] = {}
    for name, n in sorted(counters.c.items()):
        (applied if name.split(":", 1)[0] in rules else stats)[name] = n
    return {"rules_applied": applied, "stats": stats}


class _Context:
    """What one build shares between works: the Quran words (loaded once, on demand) and parsed works
    that another work aligns to (al-Qāmūs reads Tāj's root list)."""

    def __init__(self, raw: Path, reg: Registry, words: list[dict] | None, surahs: list[dict] | None) -> None:
        self.raw, self.reg = raw, reg
        self._words, self._surahs = words, surahs
        self._quran: QuranPairs | None = None
        self.parsed: dict[str, tuple[list[RawArticle], dict[str, Any], Counters]] = {}

    def words(self) -> list[dict]:
        if self._words is None:
            self._words = _jsonl(_latest_build(self.raw) / "words.jsonl")
        return self._words

    def surahs(self) -> list[dict]:
        if self._surahs is None:
            self._surahs = _jsonl(_latest_build(self.raw) / "surahs.jsonl")
        return self._surahs

    def quran(self) -> QuranPairs:
        if self._quran is None:
            self._quran = QuranPairs(self.words())
        return self._quran

    def articles(self, spec: WorkSpec) -> tuple[list[RawArticle], dict[str, Any], Counters]:
        if spec.id not in self.parsed:
            counters = Counters()
            arts, extra = _articles(spec, counters, self)
            self.parsed[spec.id] = (arts, extra, counters)
        return self.parsed[spec.id]


def _articles(spec: WorkSpec, counters: Counters, ctx: _Context) -> tuple[list[RawArticle], dict[str, Any]]:
    fmt = spec.format
    if fmt == "perseus-lane":
        lane = read_lane(spec.path(spec.cfg["files"][0]["path"]), counters)
        arts = [RawArticle(e.headword, e.body, e.page_ref, e.source_ref) for e in lane]
        return arts, {"lane_tokens": [e.tokens for e in lane], "lane_words": [e.words for e in lane]}
    pages = load_pages(spec.dir)
    toc = load_toc(spec.dir)
    lines = read_lines(
        pages,
        spec.cfg["footnote_marker"],
        counters,
        join_broken_spans=bool(spec.cfg.get("join_broken_spans")),
    )
    if fmt == "shamela-toc":
        return segment_toc_work(spec, lines, toc, counters)
    if fmt == "shamela-lisan":
        lisan = split_lisan(lines, toc, counters, spec.cfg["shamela_id"])
        return [RawArticle(a.headword, a.body, a.page_ref, a.source_ref) for a in lisan], {}
    if fmt == "shamela-taj":
        return split_taj(spec, lines, toc, counters, ctx.quran())
    if fmt == "shamela-taqalib":  # al-ʿAyn, Tahdhīb: permutation groups
        return split_taqalib(spec, lines, toc, counters)
    if fmt == "shamela-qamus":  # aligned to the root list of the commentary that follows it (Tāj)
        taj_articles, _, _ = ctx.articles(ctx.reg.work(spec.cfg["align_with"]))
        return split_qamus(spec, lines, toc, counters, taj_articles)
    raise ValueError(f"{spec.id}: format {fmt} is not a lexicon format")


def _map_roots(
    spec: WorkSpec,
    arts: list[RawArticle],
    extra: dict[str, Any],
    matcher: RootMatcher,
    occurrences: dict[str, int] | None = None,
) -> list[Match]:
    manual = spec.manual_roots()
    lane_tokens: list[list[str]] | None = extra.get("lane_tokens")
    heads: list[list[str]] = (
        lane_tokens if lane_tokens is not None else [a.match_heads or [a.headword] for a in arts]
    )
    # Pass 1: strict/manual, to know which roots already have a strict article in this work.
    occ = occurrences or {}
    per_head = [[matcher.match(h, manual, set()) for h in hs] for hs in heads]
    own = Counter(  # roots with an article of their own (one heading)
        c.root_key for cands in per_head if len(cands) == 1 for c in cands if c.match in ("strict", "manual")
    )
    first: list[Match] = []
    for cands in per_head:
        strict = [c for c in cands if c.match in ("strict", "manual")]
        if len(strict) > 1 and spec.format == "shamela-taqalib":
            # an article headed by two roots ("خور _ خير", al-Azharī's weak roots) is filed under the one
            # without an article of its own in this work, else the one more frequent in the Quran
            # (stable: else the first). Other works keep the first heading's root.
            strict.sort(key=lambda c: (own[c.root_key] > 0, -occ.get(c.root_key or "", 0)))
        first.append(strict[0] if strict else Match(None, None))
    strict_roots = {m.root_key for m in first if m.match in ("strict", "manual") and m.root_key}
    # Pass 2: loose matching for the rest.
    out: list[Match] = []
    for hs, m in zip(heads, first, strict=True):
        if m.match is not None:
            out.append(m)
            continue
        best = Match(None, None)
        for h in hs:
            cand = matcher.match(h, manual, strict_roots)
            if cand.root_key is not None:
                best = cand
                break
            if cand.suppressed and not best.suppressed:
                best = cand
        out.append(best)
    return out


def work_articles(
    raw: Path, registry: Path, work_id: str, words: list[dict] | None = None, surahs: list[dict] | None = None
) -> tuple[list[RawArticle], dict[str, Any]]:
    """One work's split articles before root mapping (with ``match_heads`` for combined headings) —
    for quality checks such as the OpenITI boundary oracle. Empty articles are kept here."""
    reg = load_registry(raw, registry, verify=False)
    arts, extra, _ = _Context(raw, reg, words, surahs).articles(reg.work(work_id))
    return arts, extra


def build_lexica(
    raw: Path,
    registry: Path,
    roots: list[dict],
    words: list[dict] | None = None,
    surahs: list[dict] | None = None,
) -> tuple[list[dict], list[dict], list[dict], dict]:
    reg: Registry = load_registry(raw, registry)
    ctx = _Context(raw, reg, words, surahs)
    matcher = RootMatcher(roots)
    works_out: list[dict[str, Any]] = []
    entries_out: list[dict[str, Any]] = []
    glosses_out: list[dict[str, Any]] = []
    report: dict[str, Any] = {
        "rules": reg.rules,
        "works": {},
        "review": [],
        "review_suppressed": [],
        "coverage": {},
    }
    root_keys = {r["key"] for r in roots}

    for spec in reg.works:
        counters = Counters()
        works_out.append(spec.work_row())
        base = spec.id_block * ID_STRIDE
        wrep: dict[str, Any] = {"format": spec.format}

        if spec.format == "shamela-gharib":
            ws, ss = ctx.words(), ctx.surahs()
            pages = load_pages(spec.dir)
            toc = load_toc(spec.dir)
            lines = read_lines(pages, spec.cfg["footnote_marker"], counters)
            items = parse_items(spec, lines, toc, ss, counters)
            rows, grep = build_glosses(
                spec,
                items,
                WordIndex(ws),
                {int(s["number"]): int(s["verse_count"]) for s in ss},
                counters,
                base,
            )
            glosses_out += rows
            wrep.update(grep)
            wrep.update(_split_counters(counters, reg.rules))
            report["works"][spec.id] = wrep
            continue

        arts, extra, counters = ctx.articles(spec)
        dropped_empty = [a.headword for a in arts if not a.body.strip()]
        keep = [i for i, a in enumerate(arts) if a.body.strip()]
        arts = [arts[i] for i in keep]
        if "lane_tokens" in extra:
            extra["lane_tokens"] = [extra["lane_tokens"][i] for i in keep]
            extra["lane_words"] = [extra["lane_words"][i] for i in keep]
        matches = _map_roots(
            spec, arts, extra, matcher, {r["key"]: int(r.get("occurrences") or 0) for r in roots}
        )
        unmatched: list[dict[str, Any]] = []
        lane_tokens = extra.get("lane_tokens")
        lane_words = extra.get("lane_words")
        for n, (a, m) in enumerate(zip(arts, matches, strict=True), start=1):
            eid = base + n
            if m.root_key is not None and m.root_key not in root_keys:
                raise ValueError(f"{spec.id}: mapped to unknown root {m.root_key}")
            entries_out.append(
                {
                    "id": eid,
                    "work_id": spec.id,
                    "root_key": m.root_key,
                    "headword": a.headword,
                    "match": m.match,
                    "body": a.body,
                    "core_meaning": a.core_meaning,
                    "page_ref": a.page_ref,
                    "source_ref": a.source_ref,
                    # the headings it is filed under, for the dictionary's roots (lexica/dictroots.py); not loaded
                    "heads": lane_tokens[n - 1] if lane_tokens is not None else a.match_heads,
                    # Lane's words, paragraph by paragraph (lexica/lane_words.py); not loaded
                    **({"lane_words": lane_words[n - 1]} if lane_words is not None else {}),
                }
            )
            if m.match is None and m.suppressed:
                report["review_suppressed"].append(
                    {
                        "entry_id": eid,
                        "work_id": spec.id,
                        "headword": a.headword,
                        "suppressed_candidates": list(m.suppressed),
                        "reason": "the work already has a strict article for this root",
                    }
                )
            if m.match in ("loose", "manual"):
                report["review"].append(
                    {
                        "entry_id": eid,
                        "work_id": spec.id,
                        "headword": a.headword,
                        "root_key": m.root_key,
                        "match": m.match,
                        "confidence": m.confidence if m.match == "loose" else "manual",
                        "rule": m.rule,
                        "alternatives": list(m.alternatives),
                        "suppressed_candidates": list(m.suppressed),
                        "ambiguous": m.ambiguous,
                        "page_ref": a.page_ref,
                    }
                )
            if m.root_key is None:
                unmatched.append({"entry_id": eid, "headword": a.headword})
        counts = Counter(m.match for m in matches)
        strict_roots = {m.root_key for m in matches if m.match == "strict"}
        any_roots = {m.root_key for m in matches if m.root_key}
        occ_total = sum(int(r.get("occurrences") or 0) for r in roots)
        occ = {r["key"]: int(r.get("occurrences") or 0) for r in roots}
        wrep.update(
            {
                "entries": len(arts),
                "dropped_empty_articles": dropped_empty,
                "match_counts": {str(k): v for k, v in counts.items()},
                "roots_strict": len(strict_roots),
                "roots_any": len(any_roots),
                "coverage_strict_pct": round(100 * len(strict_roots) / len(roots), 2),
                "coverage_any_pct": round(100 * len(any_roots) / len(roots), 2),
                "coverage_strict_occurrence_pct": round(
                    100 * sum(occ[k] for k in strict_roots) / occ_total, 2
                )
                if occ_total
                else None,
                "coverage_any_occurrence_pct": round(100 * sum(occ[k] for k in any_roots) / occ_total, 2)
                if occ_total
                else None,
                "roots_without_entry": sorted(root_keys - any_roots, key=lambda k: -occ.get(k, 0)),
                "unmatched_articles": len(unmatched),
                "unmatched_headwords": [u["headword"] for u in unmatched],
            }
        )
        wrep.update({k: v for k, v in extra.items() if k not in ("lane_tokens", "lane_words")})
        wrep.update(_split_counters(counters, reg.rules))
        report["works"][spec.id] = wrep

    # Cross-work coverage
    by_root: dict[str, set[str]] = defaultdict(set)
    for e in entries_out:
        if e["root_key"]:
            by_root[e["root_key"]].add(e["work_id"])
    report["coverage"] = {
        "roots_total": len(roots),
        "roots_with_any_entry": len(by_root),
        "roots_with_any_arabic_entry": sum(1 for ws in by_root.values() if ws - {"lane"}),
        "roots_with_no_entry": sorted(root_keys - set(by_root)),
    }
    # Reduplicated quadriliterals (زلزل، وسوس) are filed by the lexicographers under the
    # geminate root (زلل، وسس); offer that as a display fallback, never as a mapping.
    fallbacks = {}
    for k in report["coverage"]["roots_with_no_entry"]:
        if len(k) == 4 and k[0] == k[2] and k[1] == k[3] and (k[0] + k[1] + k[1]) in by_root:
            fallbacks[k] = k[0] + k[1] + k[1]
    report["coverage"]["display_fallbacks"] = fallbacks
    report["review_count"] = len(report["review"])
    report["review_suppressed_count"] = len(report["review_suppressed"])
    report["review_by_confidence"] = dict(Counter(r["confidence"] for r in report["review"]))
    return works_out, entries_out, glosses_out, report
