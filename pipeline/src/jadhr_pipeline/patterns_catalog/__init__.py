"""Pattern catalog (PLAN P3.3): what each morphological pattern does, verbatim from named sarf works.

Sources (registry ``data/patterns.yaml``, OpenITI release 2025.1.9):

* Ibn al-Ḥājib, *al-Shāfiya* — the meanings of each verb form, one row per meaning with the book's
  examples (أبنية المزيد ومعانيها), the meanings of the three Form I paradigms, and the chapters on the
  ṣifa mushabbaha, the maṣdar and its patterns, the mīmī maṣdar, the noun of one act, the nouns of time and
  place, the noun of instrument, the diminutive and the nisba;
* Ibn al-Ḥājib, *al-Kāfiya* — the chapters al-Shāfiya defers to: the maṣdar, the active and passive
  participles (with the intensive forms), the ṣifa mushabbaha, the elative, the dual and the plurals;
* al-Raḍī al-Astarābādī, *Sharḥ al-Shāfiya* — his commentary on each of those matn passages, cut at his
  «قوله "…"» cues and linked to the al-Shāfiya rows it explains (``comments_on``).

Every row's text is a verbatim slice of the cleaned source (``text.clean_source``), with its locator
(OpenITI URI, printed volume and page, milestone), and status ``extracted`` — never ``reviewed``. Patterns
named in a row are mapped to our pattern slugs only mechanically (``mapping``), the method and confidence
stored per mention; uncertain mentions stay unmapped with their candidates and the reason.

Entry point: ``build_pattern_catalog(raw, build_dir, registry)``; CLI ``python -m jadhr_pipeline.patterns_catalog``.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import yaml
from jadhr_arabic import display_bare, normalize

from ..relations.openiti import Clean
from .mapping import (
    CONFIDENT,
    SUFFIX_CLASSES,
    VOWEL_NAMES,
    Decision,
    Oracles,
    PatternIndex,
    decide,
    eliminate,
    load_oracles,
    same_in_chapter,
)
from .mentions import TOKEN, Examples, Mention, Tok, find_examples, mention_at, pattern_norm, tokens
from .parsers import Block, Unit, parse_matn, parse_radi
from .text import clean_source

STATUS = "extracted"
KINDS = ("meaning", "inventory", "definition", "statement", "commentary")


class PatternCatalogError(ValueError):
    pass


def _jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# --- mentions in a row -----------------------------------------------------------------------------
# A noun chapter names target patterns («على مفعل»، «وهو (أفعل)»، «فاعلة ك العافية»), the verb paradigm a
# rule starts from («في فعل اللازم»، «و فعل نحو كرم على كرامة»), and patterns only in passing («ألف أفعال»).
_TARGET_BEFORE = {"على", "زنة", "وزن", "لفظ", "وهو", "هو", "إلا", "الا"}
_SOURCE_AFTER = {"اللازم", "المتعدي"}
_SOURCE_BEFORE = {"في", "من", "مما"}
_REFERENCE_BEFORE = {"ألف", "الف", "ياء", "واو", "تاء", "نون", "همزة", "ميم"}
_QUALIFIERS = {"غالبا", "قياسا", "مطردا", "كثيرا", "و"}


def _role(toks: list[Tok], idx: int, next_mention: int) -> str:
    prev = display_bare(toks[idx - 1].text) if idx > 0 else ""
    if prev == "و" and idx > 1 and display_bare(toks[idx - 2].text) in _TARGET_BEFORE:
        prev = display_bare(toks[idx - 2].text)
    nxt = display_bare(toks[idx + 1].text) if idx + 1 < len(toks) else ""
    if prev in _REFERENCE_BEFORE:
        return "reference"
    if prev in _TARGET_BEFORE:
        return "target"
    if nxt in _SOURCE_AFTER or prev in _SOURCE_BEFORE:
        return "source"
    seen_cue = False
    for tk in toks[idx + 1 : next_mention]:
        w = display_bare(tk.text)
        if w in ("نحو", "ك") or (len(w) > 2 and w[0] == "ك" and not seen_cue):
            seen_cue = True
        elif w == "على" and seen_cue:
            return "source"
    return "target"


def _noun_mentions(text: str, s: int, e: int, ignore: list[tuple[int, int]]) -> list[Mention]:
    """The patterns a noun-chapter row names, with the example list each one takes; an example list that
    follows no target pattern gives one ``example-only`` mention per item."""
    seg = text[s:e]
    toks = tokens(seg)
    events: list[tuple[int, int, Any]] = []  # (token index, 0 mention / 1 examples, payload)
    for idx, tk in enumerate(toks):
        if any(a <= s + tk.start < b for a, b in ignore):
            continue
        pn = mention_at(toks, idx)
        if pn:
            events.append((idx, 0, Mention(tk.text, pn[0], s + tk.start, s + tk.end, notes=list(pn[1]))))
    m_idx = [i for i, k, _ in events if k == 0]
    for idx, _, m in events:
        later = [j for j in m_idx if j > idx]
        m.role = _role(toks, idx, later[0] if later else len(toks))
    for ex in find_examples(seg, toks, 0, len(toks), noun=True):
        events.append((ex.cue, 1, ex))
    events.sort(key=lambda ev: (ev[0], ev[1]))
    out: list[Mention] = []
    run: list[tuple[int, Mention]] = []
    source: tuple[int, Mention] | None = None
    for idx, kind, payload in events:
        if kind == 0:
            m = payload
            if m.role == "source":
                source, run = (idx, m), []
            elif m.role == "target":
                between = [display_bare(t.text) for t in toks[run[-1][0] + 1 : idx]] if run else ["x"]
                run = [*run, (idx, m)] if run and all(w == "و" for w in between) else [(idx, m)]
                source = None
            out.append(m)
            continue
        ex: Examples = payload
        # a list belongs to the pattern it follows directly (qualifiers such as «غالبا» may stand between)
        last = run[-1][0] if run else source[0] if source else None
        gap = [display_bare(t.text) for t in toks[last + 1 : ex.cue]] if last is not None else ["x"]
        direct = all(w in _QUALIFIERS for w in gap)
        if direct and source is not None and not run and not source[1].examples:
            source[1].examples, source = list(ex.items), None
            continue
        if direct and run and not any(m.examples for _, m in run):
            if len(run) > 1 and len(ex.items) == len(run):
                for (_, m), it in zip(run, ex.items, strict=True):
                    m.examples = [it]
                    m.notes.append("parallel-examples")
            else:
                for _, m in run:
                    m.examples = list(ex.items)
            run = []
            continue
        run, source = [], None
        pos = s + toks[ex.first].start
        # «نحو ضارب على مضاربة»: the list before «على» gives the verb a rule starts from, not the noun
        verbs = ex.end < len(toks) and display_bare(toks[ex.end].text) == "على"
        for it in ex.items:
            out.append(
                Mention("", "", pos, pos, role="source-example" if verbs else "example-only", examples=[it])
            )
    return out


def _ignore_spans(text: str, phrases: list[str]) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    for ph in phrases:
        spans += [(m.start(), m.end()) for m in re.finditer(re.escape(ph), text)]
    return spans


def _examples_in(text: str, s: int, e: int, noun: bool, skip_first: bool = False) -> list[str]:
    toks = tokens(text[s:e])
    return [
        x for ex in find_examples(text[s:e], toks, 1 if skip_first else 0, len(toks), noun) for x in ex.items
    ]


@dataclass
class _Mapped:
    mention: Mention
    decision: Decision
    cls: str
    extra: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        m = self.mention
        return {
            "written": m.written or None,
            "pattern_ar": m.norm or None,
            "role": m.role,
            "class": self.cls,
            "start": m.start,
            "end": m.end,
            "examples": m.examples,
            "notes": m.notes,
            **self.decision.as_dict(),
            **self.extra,
        }


class _MatnMapper:
    def __init__(self, orc: Oracles) -> None:
        self.orc = orc
        self.pi = orc.pi

    def map_units(self, text: str, units: list[Unit], ignore: list[tuple[int, int]]) -> list[list[_Mapped]]:
        orc = self.orc
        # verb statements: one decision per statement, voted on by the examples of its first meaning (the
        # later meanings set the form beside its base: «بمعنى فعل نحو زلته و زيلته»), then elimination
        heads: dict[tuple[str, int], tuple[Mention, Decision]] = {}
        for u in units:
            key = (u.section, u.statement)
            if u.kind != "meaning" or key in heads or not u.head:
                continue
            pn = pattern_norm(text[u.head[0] : u.head[1]])
            assert pn is not None
            m = Mention(
                text[u.head[0] : u.head[1]], pn[0], u.head[0], u.head[1], role="head", notes=list(pn[1])
            )
            m.examples = _examples_in(text, u.head[1], u.end, noun=False)
            heads[key] = (m, decide(pn[0], m.examples, "V", None, orc))
        for section in {k[0] for k in heads}:
            eliminate([d for (sec, _), (_, d) in sorted(heads.items()) if sec == section])
        out: list[list[_Mapped]] = []
        groups: dict[tuple[str, str, str], list[Decision]] = defaultdict(list)
        for u in units:
            cfg = u.config
            cls = cfg.get("class", "N")
            tag = cfg.get("tag")
            for ov in cfg.get("overrides") or []:
                if ov["contains"] in text[u.start : u.end]:
                    tag = ov.get("tag")
            vowels = (cfg.get("vowel_rule") or {}).get("vowels", {})
            rule = {int(k): VOWEL_NAMES[v] for k, v in vowels.items()} or None
            if u.kind == "meaning":
                hm, hd = heads[(u.section, u.statement)]
                own = Mention(hm.written, hm.norm, hm.start, hm.end, role="head", notes=list(hm.notes))
                own.examples = _examples_in(text, u.start, u.end, noun=False, skip_first=u.sense == 1)
                out.append([_Mapped(own, hd, "V", {"statement_examples": hm.examples})])
                continue
            if u.kind == "inventory":
                toks = tokens(text[u.start : u.end])
                ms: list[_Mapped] = []
                for i, tk in enumerate(toks):
                    pn = mention_at(toks, i)
                    if pn:
                        mm = Mention(tk.text, pn[0], u.start + tk.start, u.start + tk.end, role="inventory")
                        mm.notes = list(pn[1])
                        ms.append(_Mapped(mm, decide(pn[0], [], cls, None, orc, use_examples=False), cls))
                ex = _examples_in(text, u.start, u.end, noun=False)
                if ex:
                    ms.append(
                        _Mapped(
                            Mention("", "", u.start, u.start, role="examples", examples=ex), Decision(), cls
                        )
                    )
                out.append(ms)
                continue
            ms = []
            for m in _noun_mentions(text, u.start, u.end, ignore):
                if m.role == "example-only":
                    ms.append(_Mapped(m, decide(None, m.examples, cls, tag, orc), cls))
                elif m.role == "source-example":
                    ms.append(_Mapped(m, Decision(reason="verb-example"), "V"))
                elif m.role in ("source", "reference"):
                    mcls = "V" if m.role == "source" else cls
                    ms.append(_Mapped(m, decide(m.norm, [], mcls, None, orc, use_examples=False), mcls))
                else:
                    d = decide(m.norm, m.examples, cls, tag, orc, rule)
                    groups[(u.section, cls, normalize(m.norm))].append(d)
                    ms.append(_Mapped(m, d, cls))
            ms += self._class_rules(text, u)
            out.append(ms)
        same_in_chapter(groups)
        return out

    def _class_rules(self, text: str, u: Unit) -> list[_Mapped]:
        """A chapter's rule for a whole class («ومن غير الثلاثي على صيغة المضارع بميم مضمومة وكسر ما قبل
        الآخر»): the base patterns of the lemmas our corpus tags with that class from an augmented verb."""
        out: list[_Mapped] = []
        for cr in u.config.get("class_rules") or []:
            at = text.find(cr["quote"], u.start, u.end)
            if at < 0:
                continue
            slugs = sorted(self.pi.augmented.get(cr["tag"], set()))
            m = Mention("", "", at, at + len(cr["quote"]), role="class-rule", notes=[f"tag:{cr['tag']}"])
            for s in slugs:
                d = Decision(slug=s, method="class-rule", confidence="high", candidates=slugs)
                out.append(_Mapped(m, d, "N"))
        return out


def _row_base(src: dict[str, Any], c: Clean, seq: int, start: int) -> dict[str, Any]:
    return {"id": f"{src['id']}:{seq:04d}", "source_id": src["id"], "seq": seq, **c.locator(start)}


_TARGET_ROLES = ("head", "target", "example-only", "class-rule")


def _summarise(row: dict[str, Any], mapped: list[_Mapped], pi: PatternIndex, notes: list[str]) -> None:
    """Row-level mapping: the confident slugs of the row's target mentions, how they were found, and — when
    nothing is mapped — why, from the first pattern the row names."""
    mentions = [m.as_dict() for m in mapped]
    targets = [m for m in mentions if m["role"] in _TARGET_ROLES]
    hits = (
        [m for m in targets if m["slug"] and m["confidence"] in CONFIDENT]
        if row["kind"] != "inventory"
        else []
    )
    slugs = list(dict.fromkeys(m["slug"] for m in hits))
    named = [m for m in targets if m["role"] != "example-only"] or targets
    head = named[0] if named else None
    row["pattern_ar"] = next((m["pattern_ar"] for m in named if m["pattern_ar"]), None)
    row["pattern_slugs"] = slugs
    row["inflected_slugs"] = pi.inflected_of(slugs)
    forms = {pi.patterns[s].form_number for s in slugs if pi.patterns[s].cls == "V"}
    row["form_number"] = forms.pop() if len(forms) == 1 else None
    row["match_method"] = "+".join(dict.fromkeys(m["method"] for m in hits)) or None
    row["match_confidence"] = (
        ("medium" if any(m["confidence"] == "medium" for m in hits) else "high") if hits else None
    )
    row["match_candidates"] = head["candidates"] if head else []
    if row["kind"] == "inventory":
        row["unmapped_reason"] = "inventory"
    elif slugs:
        row["unmapped_reason"] = None
        unresolved = [m for m in targets if not m["slug"] and m["role"] in ("head", "target")]
        if any(m["reason"] != "not-a-quranic-pattern" for m in unresolved):
            notes.append("named-pattern-unresolved")
    else:
        row["unmapped_reason"] = head["reason"] if head else "no-pattern-named"
    ex: list[str] = []
    for m in mentions:
        for x in m["examples"]:
            if x not in ex:
                ex.append(x)
    row["examples_ar"] = ex
    row["mentions"] = mentions


def _canon(s: str) -> str:
    """A matn passage for aligning two typings of it: normalised, a spaced «و» joined to its word, one
    space between words, nothing but letters."""
    t = re.sub(r"(?<!\S)و (?=\S)", "و", normalize(s))
    return " ".join(TOKEN.findall(t))


def _contained(a: str, b: str) -> float:
    """Share of ``a`` found in ``b`` in order, counting only runs of four characters or more — two typings
    of one passage differ by slips («للتعدية غالبا» / «للتعددية غلبا») that break a single long run."""
    if not a:
        return 0.0
    blocks = SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks()
    return sum(m.size for m in blocks if m.size >= 4) / len(a)


def build_pattern_catalog(
    raw: Path, build_dir: Path, registry: Path
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Parse every registered work into the catalog tables. ``raw`` is data/raw, ``build_dir`` a dataset
    build (patterns, lemmas, words), ``registry`` data/patterns.yaml."""
    reg = yaml.safe_load(registry.read_text(encoding="utf-8"))
    patterns = _jsonl(build_dir / "patterns.jsonl")
    lemmas = _jsonl(build_dir / "lemmas.jsonl")
    orc = load_oracles(build_dir, patterns, lemmas)
    pi = orc.pi
    mapper = _MatnMapper(orc)
    ot = reg["openiti"]
    rows: list[dict[str, Any]] = []
    sources_out: list[dict[str, Any]] = []
    cleaned: dict[str, Clean] = {}
    report: dict[str, Any] = {
        "openiti_release": ot["release"],
        "openiti_commit": ot["commit"],
        "cleaning_rules": [r["id"] for r in reg["cleaning_rules"]],
        "searched": [{"work_ar": s["work_ar"], "result": s["result"]} for s in reg.get("searched", [])],
        "sources": {},
    }
    for src in sorted(reg["sources"], key=lambda s: s["sort_order"]):
        sid = src["id"]
        path = raw / src["file"]
        if not path.exists():
            report["sources"][sid] = {"status": "missing-file", "file": src["file"]}
            continue
        sha = _sha256(path)
        if sha != src["sha256"]:
            raise PatternCatalogError(f"{sid}: {src['file']} sha256 {sha} ≠ pinned {src['sha256']}")
        c = clean_source(
            path.read_text(encoding="utf-8"), src["openiti_uri"], src.get("extra_cleaning") or []
        )
        cleaned[sid] = c
        if src["parser"] == "matn":
            src_rows, rep = _matn_rows(src, c, mapper, pi)
        elif src["parser"] == "radi":
            target = src["comments_on"]
            if target not in cleaned:
                raise PatternCatalogError(f"{sid}: comments on {target}, which is not built first")
            src_rows, rep = _radi_rows(src, c, [r for r in rows if r["source_id"] == target])
        else:
            raise PatternCatalogError(f"{sid}: unknown parser {src['parser']!r}")
        rows += src_rows
        report["sources"][sid] = {"status": "ok", "file_sha256": sha, **rep, "cleaning": dict(c.stats)}
        sources_out.append(_source_row(src, ot, sha))
    ids = [r["id"] for r in rows]
    if len(ids) != len(set(ids)):
        raise PatternCatalogError(f"duplicate row ids: {[k for k, v in Counter(ids).items() if v > 1][:5]}")
    report["coverage"] = coverage(rows, pi, lemmas)
    report["editor_worklist"] = editor_worklist(rows, pi)
    report["totals"] = {
        "rows": len(rows),
        "by_source": dict(Counter(r["source_id"] for r in rows)),
        "by_kind": dict(Counter(r["kind"] for r in rows)),
        "by_section": dict(Counter(r["section"] for r in rows if r["kind"] != "commentary")),
        "mapped_rows": sum(1 for r in rows if r["pattern_slugs"] or r["suffix_slugs"]),
        "status": dict(Counter(r["status"] for r in rows)),
    }
    return {"pattern_sources": sources_out, "pattern_functions": rows}, report


def _source_row(src: dict[str, Any], ot: dict[str, Any], sha: str) -> dict[str, Any]:
    return {
        "id": src["id"],
        "role": src["role"],
        "comments_on": src.get("comments_on"),
        "sort_order": src["sort_order"],
        "title_ar": src["title_ar"],
        "title_en": src["title_en"],
        "author_ar": src["author_ar"],
        "author_en": src["author_en"],
        "death_hijri": src["death_hijri"],
        "death_ce": src["death_ce"],
        "edition_ar": src["edition_ar"],
        "edition_en": src["edition_en"],
        "openiti_uri": src["openiti_uri"],
        "openiti_release": ot["release"],
        "openiti_commit": ot["commit"],
        "source_url": src["source_url"],
        "file_sha256": sha,
        "page_numbering": src["page_numbering"],
        "licence": src["licence"],
        "licence_url": ot["licence_url"],
        "licence_clause": ot["licence_clause"],
        "redistributable": src["redistributable"],
        "attribution_ar": src["attribution_ar"],
        "attribution_en": src["attribution_en"],
    }


def _matn_rows(
    src: dict[str, Any], c: Clean, mapper: _MatnMapper, pi: PatternIndex
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    text = c.text
    units, missing = parse_matn(c, src["sections"])
    if missing:
        raise PatternCatalogError(f"{src['id']}: chapter heading(s) not found: {missing}")
    for sec in src["sections"]:
        rule = sec.get("vowel_rule")
        if rule and rule["quote"] not in text:
            raise PatternCatalogError(f"{src['id']}: vowel rule quote not in the text: {rule['quote']}")
        for cr in sec.get("class_rules") or []:
            if cr["quote"] not in text:
                raise PatternCatalogError(f"{src['id']}: class rule quote not in the text: {cr['quote']}")
    ignore = _ignore_spans(text, src.get("ignore_phrases") or [])
    mapped = mapper.map_units(text, units, ignore)
    rows: list[dict[str, Any]] = []
    for seq, (u, ms) in enumerate(zip(units, mapped, strict=True), 1):
        row = _row_base(src, c, seq, u.start)
        row.update(
            {
                "section": u.section,
                "heading_ar": u.heading_ar,
                "kind": u.kind,
                "statement_index": u.statement,
                "sense_index": u.sense,
            }
        )
        notes = list(u.notes)
        _summarise(row, ms, pi, notes)
        suffixes = SUFFIX_CLASSES[u.config["suffix_class"]] if u.config.get("suffix_class") else None
        row["suffix_slugs"] = pi.with_suffix(list(suffixes)) if suffixes else []
        if suffixes and not row["pattern_slugs"]:
            row["match_method"], row["match_confidence"], row["unmapped_reason"] = (
                "suffix-class",
                "high",
                None,
            )
        row.update(
            {
                "text_ar": text[u.start : u.end],
                "comments_on": [],
                "cue_ar": None,
                "notes": notes,
                "status": STATUS,
            }
        )
        rows.append(_order(row))
    statements: dict[str, dict[str, Any]] = {}
    for r in rows:
        if r["kind"] == "meaning":
            head = r["mentions"][0]
            st = statements.setdefault(
                f"{r['section']}#{r['statement_index']}",
                {
                    "pattern_ar": r["pattern_ar"],
                    "meanings": 0,
                    "slug": head["slug"],
                    "method": head["method"],
                    "confidence": head["confidence"],
                    "candidates": head["candidates"],
                    "votes": head["votes"],
                },
            )
            st["meanings"] += 1
    rep = {
        "rows": len(rows),
        "by_section": dict(Counter(r["section"] for r in rows)),
        "by_kind": dict(Counter(r["kind"] for r in rows)),
        "verb_statements": statements,
        "verb_statement_methods": dict(Counter(s["method"] or "unmapped" for s in statements.values())),
        "mentions": _mention_stats(rows),
    }
    return rows, rep


def _mention_stats(rows: list[dict[str, Any]]) -> dict[str, Any]:
    ms = [m for r in rows for m in r["mentions"] if m["role"] in _TARGET_ROLES and r["kind"] != "inventory"]
    return {
        "total": len(ms),
        "mapped": sum(1 for m in ms if m["slug"]),
        "by_method": dict(Counter(m["method"] or "unmapped" for m in ms).most_common()),
        "by_confidence": dict(Counter(m["confidence"] or "none" for m in ms).most_common()),
        "unmapped_reasons": dict(Counter(m["reason"] for m in ms if not m["slug"]).most_common()),
        "source_paradigms": sum(1 for r in rows for m in r["mentions"] if m["role"] == "source"),
    }


_ORDER = (
    "id", "source_id", "seq", "section", "heading_ar", "kind", "statement_index", "sense_index", "pattern_ar",
    "pattern_slugs", "inflected_slugs", "suffix_slugs", "form_number", "match_method", "match_confidence",
    "match_candidates", "unmapped_reason", "text_ar", "examples_ar", "mentions", "comments_on", "cue_ar",
    "locator", "page_vol", "page", "milestone", "notes", "status",
)  # fmt: skip


def _order(row: dict[str, Any]) -> dict[str, Any]:
    missing = set(_ORDER) ^ set(row)
    if missing:
        raise PatternCatalogError(f"row {row.get('id')}: columns differ from the schema: {sorted(missing)}")
    return {k: row[k] for k in _ORDER}


def _radi_rows(
    src: dict[str, Any], c: Clean, matn_rows: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Align al-Raḍī's quotation blocks to the al-Shāfiya rows, then emit one row per comment segment."""
    text = c.text
    blocks = parse_radi(c)
    block_text = [_canon(text[b.matn[0] : b.matn[1]]) for b in blocks]
    block_words = [set(bt.split()) for bt in block_text]
    assigned: dict[int, list[dict[str, Any]]] = defaultdict(list)
    unaligned: list[str] = []
    last = 0
    for r in sorted(matn_rows, key=lambda x: x["seq"]):
        rc = _canon(r["text_ar"])
        words = rc.split()
        # a cheap pass first: only blocks that share a third of the row's words are compared closely
        scores = [
            _contained(rc, bt) if words and sum(w in bw for w in words) * 3 >= len(words) else 0.0
            for bt, bw in zip(block_text, block_words, strict=True)
        ]
        best = max(scores, default=0.0)
        if best < 0.6:
            unaligned.append(r["id"])
            continue
        # the commentary follows the matn in order: of the blocks that hold the row about as well as the
        # best one, take the first at or after the previous row's block
        near = [i for i, s in enumerate(scores) if s >= best - 0.05]
        bi = next((i for i in near if i >= last), near[0])
        assigned[bi].append(r)
        last = bi
    rows: list[dict[str, Any]] = []
    cue_stats: Counter[str] = Counter()
    seq = 0
    for bi in sorted(assigned):
        b: Block = blocks[bi]
        targets = sorted(assigned[bi], key=lambda r: r["seq"])
        for sg in b.segments:
            notes: list[str] = []
            on = targets
            cue = text[sg.cue[0] : sg.cue[1]] if sg.cue else None
            if cue:
                cc = _canon(cue)
                scored = [(_contained(cc, _canon(r["text_ar"])), -r["seq"], r) for r in targets]
                score, _, hit = max(scored, key=lambda x: (x[0], x[1]))
                if score >= 0.6:
                    on = [hit]
                    cue_stats["cue-aligned"] += 1
                else:
                    notes.append("cue-not-in-matn-edition")
                    cue_stats["cue-not-in-matn-edition"] += 1
            else:
                cue_stats["block-opening"] += 1
            seq += 1
            row = _row_base(src, c, seq, sg.start)
            slugs: list[str] = []
            for r in on:
                slugs += [s for s in r["pattern_slugs"] if s not in slugs]
            confs = {r["match_confidence"] for r in on if r["pattern_slugs"]}
            suffix = sorted({s for r in on for s in r["suffix_slugs"]})
            row.update(
                {
                    "section": on[0]["section"],
                    "heading_ar": on[0]["heading_ar"],
                    "kind": "commentary",
                    "statement_index": on[0]["statement_index"],
                    "sense_index": on[0]["sense_index"],
                    "pattern_ar": on[0]["pattern_ar"],
                    "pattern_slugs": slugs,
                    "inflected_slugs": sorted({s for r in on for s in r["inflected_slugs"]} - set(slugs)),
                    "suffix_slugs": suffix,
                    "form_number": on[0]["form_number"] if len(on) == 1 else None,
                    "match_method": "via-commented-row" if slugs or suffix else None,
                    "match_confidence": ("medium" if "medium" in confs else "high")
                    if slugs
                    else ("high" if suffix else None),
                    "match_candidates": [],
                    "unmapped_reason": None if slugs or suffix else "commented-row-unmapped",
                    "text_ar": text[sg.start : sg.end],
                    "examples_ar": [],
                    "mentions": [],
                    "comments_on": [r["id"] for r in on],
                    "cue_ar": cue,
                    "notes": notes,
                    "status": STATUS,
                }
            )
            rows.append(_order(row))
    rep = {
        "rows": len(rows),
        "quotation_blocks": len(blocks),
        "blocks_aligned": len(assigned),
        "matn_rows_with_commentary": sum(len(v) for v in assigned.values()),
        "matn_rows_without_commentary": unaligned,
        "segments": dict(cue_stats),
    }
    return rows, rep


def _tier_name(slug: str, direct: set[str], base: set[str], suffix: set[str]) -> str:
    for name, group in (("direct", direct), ("via-base", base), ("suffix-only", suffix)):
        if slug in group:
            return name
    return "none"


def editor_worklist(rows: list[dict[str, Any]], pi: PatternIndex) -> list[dict[str, Any]]:
    """Every pattern a matn row names (or exemplifies) that stays unmapped, with the candidates and what the
    oracles said — the editors' list, the most frequent Quranic candidates first."""
    out = []
    for r in rows:
        if r["kind"] in ("commentary", "inventory"):
            continue
        for m in r["mentions"]:
            if m["role"] not in ("head", "target", "example-only") or m["slug"]:
                continue
            # the patterns in play: the candidates, the ones voted for, the oracles' readings of an example
            named = set(m["candidates"]) | set(m["voters"])
            named |= {s for v in m["voters"].values() for s in v}
            occ = max((pi.patterns[s].occurrences for s in named if s in pi.patterns), default=0)
            out.append(
                {
                    "row": r["id"],
                    "section": r["section"],
                    "pattern_ar": m["pattern_ar"],
                    "examples": m["examples"],
                    "reason": m["reason"],
                    "candidates": m["candidates"],
                    "voters": m["voters"],
                    "max_candidate_occurrences": occ,
                }
            )
    return sorted(out, key=lambda x: -x["max_candidate_occurrences"])


def coverage(rows: list[dict[str, Any]], pi: PatternIndex, lemmas: list[dict[str, Any]]) -> dict[str, Any]:
    """Which of our Quranic patterns have at least one sourced function text, weighted by occurrences."""
    direct: dict[str, set[str]] = defaultdict(set)
    suffix: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        if r["kind"] == "commentary":
            continue
        for s in r["pattern_slugs"]:
            direct[s].add(r["id"])
        for s in r["suffix_slugs"]:
            suffix[s].add(r["id"])
    pats = pi.patterns
    base = {s for s, p in pats.items() if s not in direct and p.base in direct}
    total_occ = sum(p.occurrences for p in pats.values())
    all_occ = sum(lm["occurrences"] for lm in lemmas)

    def tier(covered: set[str]) -> dict[str, Any]:
        occ = sum(pats[s].occurrences for s in covered)
        return {
            "patterns": len(covered),
            "share_of_patterns": round(len(covered) / len(pats), 4),
            "occurrences": occ,
            "share_of_patterned_occurrences": round(occ / total_occ, 4),
            "share_of_all_lemma_occurrences": round(occ / all_occ, 4),
        }

    d = set(direct)
    db = d | base
    anyc = db | set(suffix)
    per = []
    for s, p in sorted(pats.items(), key=lambda kv: -kv[1].occurrences):
        per.append(
            {
                "slug": s,
                "ar": p.ar,
                "occurrences": p.occurrences,
                "lemma_count": p.lemma_count,
                "direct_rows": len(direct.get(s, ())),
                "via_base": p.base if s in base else None,
                "suffix_rows": len(suffix.get(s, ())),
                "covered": _tier_name(s, d, base, set(suffix)),
            }
        )
    return {
        "our_patterns": len(pats),
        "patterned_occurrences": total_occ,
        "all_lemma_occurrences": all_occ,
        "direct": tier(d),
        "direct_or_base": tier(db),
        "any": tier(anyc),
        "uncovered_top": [x for x in per if x["covered"] == "none"][:40],
        "per_pattern": per,
    }


def write_tables(tables: dict[str, list[dict[str, Any]]], report: dict[str, Any], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in tables.items():
        with (out_dir / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
    (out_dir / "patterns_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8"
    )


__all__ = ["KINDS", "STATUS", "PatternCatalogError", "build_pattern_catalog", "coverage", "write_tables"]
