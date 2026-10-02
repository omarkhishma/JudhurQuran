"""Seeds for the editorial relation table (PLAN P8.4) and the wujūh senses (P3.1).

Four classical works, read from OpenITI release 2025.1.9 (registry ``data/relations.yaml``):

* Ibn al-Jawzī, *Nuzhat al-Aʿyun al-Nawāẓir* and al-Dāmaghānī, *Iṣlāḥ al-Wujūh* — one ``wujuh_sense`` row
  per sense the author lists for a word, with the verses he cites for it;
* al-ʿAskarī, *al-Furūq al-Lughawiyya* — one ``furuq_contrast`` row per «الفرق بين X وY» entry;
* Ibn al-Anbārī, *al-Aḍdād* — one ``didd`` row per word he lists as carrying two opposite senses;
* ``near_synonym_candidate`` rows derived mechanically from the two above: the term pairs of a furūq entry
  whose words map to different Quranic roots, and a wujūh sense whose one-word label maps to another root
  («الخوف … والثاني: العلم» → خوف ~ علم in the verses cited for that sense). They point at the row they come
  from (``derived_from``).

Every row is a verbatim slice of the cleaned source (``openiti.clean``), carries its locator (OpenITI URI,
printed page, milestone), and has status ``extracted`` — never ``reviewed``; editors review in the
workbench. Headwords are mapped to Quranic roots and lemmas only mechanically (``lexmap``), with the method
stored. Quotations are resolved to verse keys only when the Quran text decides (``quran``).

Entry point: ``build_relations(raw, build_dir, registry)``; CLI ``python -m jadhr_pipeline.relations``.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import yaml
from jadhr_arabic import normalize, skeleton

from .lexmap import HeadwordMapper, Mapping
from .openiti import Clean, clean
from .parsers import PARSERS, Entry, Part
from .quran import Citation, QuranIndex

TYPES = ("wujuh_sense", "furuq_contrast", "didd", "near_synonym_candidate")
STATUS = "extracted"


class RelationsError(ValueError):
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


# A sense's label is the phrase right after its ordinal: «والثاني: العلم. ومنه قوله تعالى …» → «العلم».
_LABEL_END = re.compile(
    r"[.،؛\n(]|\s(?:ومنه|منه|قوله|كقوله|وقوله|فذلك|وذلك|قال|وقال|ومثله|ونظيره|نظيره|في سورة)(?=\s|$)"
)
_LABEL_START = re.compile(r"^[\[(]?\S+(?:\s+(?:عشر|عشرة|والعشرون|منها|منهما|منه))?[\])]?\s*[:\-–]?\s*")
_GLOSS_LINK = re.compile(r"\s(?:بمعنى|يعني|أي)\s")
_LITERAL = re.compile(r"(?:نفسه|نفسها|بعينه|بعينها|بعينة)$")


def sense_label(text: str, marker: str | None) -> tuple[int, int] | None:
    """The span of a sense's label inside the sense text (verbatim), or None when no short label leads it."""
    start = 0
    if marker:
        m = _LABEL_START.match(text)
        if not m:
            return None
        start = m.end()
    m_end = _LABEL_END.search(text, start)
    end = m_end.start() if m_end else len(text)
    label = text[start:end].strip()
    if not label or len(label.split()) > 8:
        return None
    s = text.index(label, start)
    return s, s + len(label)


def _same_root_word(a: str, b: str) -> bool:
    """Loosely the same word: one consonantal skeleton (article off) is a subsequence of the other."""

    def sk(x: str) -> str:
        x = normalize(x)
        return skeleton(x[2:] if x.startswith("ال") else x)

    def subseq(x: str, y: str) -> bool:
        it = iter(y)
        return all(ch in it for ch in x)

    sa, sb = sk(a), sk(b)
    return bool(sa and sb) and (subseq(sa, sb) or subseq(sb, sa))


def _verse_list(cites: list[Citation]) -> list[str]:
    out: list[str] = []
    for c in cites:
        for k in c.verse_keys:
            if c.status == "resolved" and k not in out:
                out.append(k)
    return out


def _cite_rows(cand_id: str, text: str, cites: list[Citation]) -> list[dict[str, Any]]:
    rows = []
    for n, c in enumerate(cites, 1):
        row = {"id": f"{cand_id}:c{n:02d}", "candidate_id": cand_id, "ordinal": n} | c.as_row(text)
        row["surah"] = int(c.verse_keys[0].split(":")[0]) if c.verse_keys else c.surah_hint
        rows.append(row)
    return rows


class _Builder:
    def __init__(self, qi: QuranIndex, mapper: HeadwordMapper) -> None:
        self.qi = qi
        self.mapper = mapper
        self.entries: list[dict[str, Any]] = []
        self.candidates: list[dict[str, Any]] = []
        self.citations: list[dict[str, Any]] = []

    def citations_for(
        self, c: Clean, part_start: int, part_end: int, styles: frozenset[str]
    ) -> list[Citation]:
        markup = [
            (s - part_start, e - part_start) for s, e in c.quote_spans if part_start <= s and e <= part_end
        ]
        return self.qi.find(c.text[part_start:part_end], styles, markup)

    def map_headword(self, src: dict[str, Any], ent: Entry) -> Mapping:
        if ent.letters:
            return self.mapper.map_spaced(ent.letters)
        word = ent.terms[0] if ent.terms else ent.headword
        if src["parser"] == "addad":
            word = re.sub(r"^(?:قد|قولهم)\s+", "", word.strip())
        return self.mapper.map_word(word, conj=src["parser"] == "addad")

    def add_source(self, src: dict[str, Any], c: Clean, entries: list[Entry]) -> dict[str, Any]:
        sid = src["id"]
        styles = frozenset(src.get("quote_styles") or ())
        t = c.text
        methods: Counter[str] = Counter()
        reasons: Counter[str] = Counter()
        roots: set[str] = set()
        cite_stats: Counter[str] = Counter()
        senses_with_verse = 0
        parts_total = 0
        pairs: set[tuple[str, str]] = set()
        mismatches = []
        for ent in entries:
            eid = f"{sid}:{ent.seq:04d}"
            hm = self.map_headword(src, ent)
            methods[hm.method or "unmapped"] += 1
            if hm.root_key:
                roots.add(hm.root_key)
            else:
                reasons[hm.reason or "unknown"] += 1
            loc = c.locator(ent.start)
            stated_text = (
                t[ent.stated_count_span[0] : ent.stated_count_span[1]] if ent.stated_count_span else None
            )
            self.entries.append(
                {
                    "id": eid,
                    "source_id": sid,
                    "seq": ent.seq,
                    "printed_number": ent.printed_number,
                    "heading_ar": t[ent.heading[0] : ent.heading[1]],
                    "headword_ar": ent.headword,
                    "terms_ar": ent.terms,
                    "letters_ar": ent.letters,
                    **hm.as_dict(),
                    "stated_count": ent.stated_count,
                    "stated_count_ar": stated_text,
                    "sense_count": len(ent.parts) if src["kind"] == "wujuh" else None,
                    "intro_ar": t[ent.intro[0] : ent.intro[1]]
                    if ent.intro and ent.intro[1] > ent.intro[0]
                    else None,
                    "section_ar": ent.section,
                    **loc,
                    "notes": ent.notes,
                    "status": STATUS,
                }
            )
            if src["kind"] == "wujuh" and ent.stated_count is not None and ent.stated_count != len(ent.parts):
                mismatches.append(
                    {
                        "entry": eid,
                        "headword": ent.headword,
                        "stated": ent.stated_count,
                        "found": len(ent.parts),
                    }
                )
            for p in ent.parts:
                parts_total += 1
                cand = self._candidate(src, c, ent, eid, hm, p, styles, cite_stats)
                if cand["verses"]:
                    senses_with_verse += 1
                if src["kind"] == "furuq":
                    for a, b in self._furuq_synonyms(src, c, ent, cand):
                        pairs.add((a, b))
        n_entries = len(entries)
        report: dict[str, Any] = {
            "status": "ok",
            "entries": n_entries,
            "entries_with_printed_number": sum(1 for e in entries if e.printed_number),
            "rows": parts_total,
            "rows_with_resolved_verse": senses_with_verse,
            "headword_mapping": {
                "mapped_to_root": sum(1 for e in self.entries if e["source_id"] == sid and e["root_key"]),
                "lemma_only": sum(
                    1 for e in self.entries if e["source_id"] == sid and e["lemma_key"] and not e["root_key"]
                ),
                "with_lemma": sum(1 for e in self.entries if e["source_id"] == sid and e["lemma_key"]),
                "unmapped": sum(1 for e in self.entries if e["source_id"] == sid and not e["root_key"]),
                "distinct_roots": len(roots),
                "by_method": dict(methods.most_common()),
                "unmapped_reasons": dict(reasons.most_common()),
            },
            "citations": dict(sorted(cite_stats.items())),
            "notes": dict(Counter(n for e in entries for n in e.notes).most_common()),
            "cleaning": dict(c.stats),
        }
        if src["kind"] == "wujuh":
            stated = [e for e in entries if e.stated_count is not None]
            report["senses"] = {
                "entries_with_stated_count": len(stated),
                "stated_equals_found": sum(1 for e in stated if e.stated_count == len(e.parts)),
                "entries_without_senses": sum(1 for e in entries if not e.parts),
                "mismatches": mismatches,
            }
        if src["kind"] == "furuq":
            with_text = [e for e in entries if e.parts]
            both = [
                r
                for r in self.candidates
                if r["source_id"] == sid
                and r["type"] == "furuq_contrast"
                and r["root_key"]
                and r["target_root_key"]
            ]
            report["furuq"] = {
                "entries_with_text": len(with_text),
                "group_headings": n_entries - len(with_text),
                "entries_with_two_terms": sum(1 for e in with_text if len(e.terms) >= 2),
                "both_terms_mapped": len(both),
                "first_two_terms_root_pairs": len(
                    {
                        tuple(sorted((r["root_key"], r["target_root_key"])))
                        for r in both
                        if r["root_key"] != r["target_root_key"]
                    }
                ),
                "distinct_root_pairs": len(pairs),
                "distinct_roots_in_pairs": len({x for p in pairs for x in p}),
            }
        return report

    def _candidate(
        self,
        src: dict[str, Any],
        c: Clean,
        ent: Entry,
        eid: str,
        hm: Mapping,
        p: Part,
        styles: frozenset[str],
        cite_stats: Counter[str],
    ) -> dict[str, Any]:
        t = c.text
        text = t[p.start : p.end]
        kind = src["kind"]
        typ = {"wujuh": "wujuh_sense", "furuq": "furuq_contrast", "addad": "didd"}[kind]
        if kind == "wujuh":
            # a second numbered list in one entry restarts its ordinals: «…:s01-l2»
            cid = f"{eid}:s{p.index:02d}" + (f"-l{p.list_no}" if p.list_no > 1 else "")
        else:
            cid = f"{eid}:r"
        cites = self.citations_for(c, p.start, p.end, styles)
        for x in cites:
            cite_stats[f"{x.kind}:{x.status}"] += 1
            cite_stats[f"marked_by:{x.marked_by}"] += 1
        target_ar = None
        tm = Mapping()
        if kind == "furuq" and len(ent.terms) >= 2:
            target_ar = ent.terms[1]
            tm = self.mapper.map_word(target_ar)
        label = sense_label(text, p.marker) if kind == "wujuh" else None
        row = {
            "id": cid,
            "type": typ,
            "source_id": src["id"],
            "entry_id": eid,
            **c.locator(p.start),
            "headword_ar": ent.headword,
            "target_ar": target_ar,
            "terms_ar": ent.terms if kind == "furuq" else None,
            **hm.as_dict(),
            **tm.as_dict("target_"),
            "sense_index": p.index if kind == "wujuh" else None,
            "sense_marker_ar": p.marker,
            "sense_list": p.list_no if kind == "wujuh" else None,
            "sense_label_ar": text[label[0] : label[1]] if label else None,
            "text_ar": text,
            "verses": _verse_list(cites),
            "derived_from": None,
            "derivation": None,
            "status": STATUS,
        }
        self.candidates.append(row)
        self.citations += _cite_rows(cid, text, cites)
        if kind == "wujuh" and label and hm.root_key:
            self._wujuh_synonym(src, c, ent, row, text, label, hm)
        return row

    def _wujuh_synonym(
        self,
        src: dict[str, Any],
        c: Clean,
        ent: Entry,
        sense: dict[str, Any],
        text: str,
        label: tuple[int, int],
        hm: Mapping,
    ) -> None:
        """«والثاني: العلم» under الخوف → خوف ~ علم, in the verses cited for that sense."""
        lab = text[label[0] : label[1]]
        s, e = label
        g = _GLOSS_LINK.search(lab)
        words = lab.split()
        if g:  # «الأب بمعنى الجد», «الإثم يعني الشرك»
            s = label[0] + g.end()
        elif len(words) == 2 and self.mapper.map_word(words[0]).root_key == hm.root_key:
            s = label[0] + lab.index(words[1], len(words[0]))  # «الإتيان الدنو»: the word, then its sense
        elif len(words) > 1:
            return
        target = text[s:e].strip()
        if len(target.split()) != 1 or _LITERAL.search(target) or _same_root_word(target, ent.headword):
            return
        tm = self.mapper.map_word(target)
        if not tm.root_key or tm.root_key == hm.root_key:
            return
        n = sum(1 for r in self.candidates if r["derived_from"] == sense["id"]) + 1
        self.candidates.append(
            sense
            | {
                "id": f"{sense['id']}:n{n}",
                "type": "near_synonym_candidate",
                "target_ar": target,
                **tm.as_dict("target_"),
                "sense_label_ar": text[label[0] : label[1]],
                "text_ar": target,
                "derived_from": sense["id"],
                "derivation": "wujuh-sense-label",
            }
        )

    def _furuq_synonyms(
        self, src: dict[str, Any], c: Clean, ent: Entry, row: dict[str, Any]
    ) -> list[tuple[str, str]]:
        """Every two terms of a furūq heading whose words map to different Quranic roots."""
        maps = [(term, self.mapper.map_word(term)) for term in ent.terms]
        out: list[tuple[str, str]] = []
        n = 0
        for i in range(len(maps)):
            for j in range(i + 1, len(maps)):
                (a, ma), (b, mb) = maps[i], maps[j]
                if not ma.root_key or not mb.root_key or ma.root_key == mb.root_key:
                    continue
                n += 1
                pair = tuple(sorted((ma.root_key, mb.root_key)))
                out.append(pair)  # type: ignore[arg-type]
                self.candidates.append(
                    row
                    | {
                        "id": f"{row['id']}:n{n}",
                        "type": "near_synonym_candidate",
                        "headword_ar": a,
                        "target_ar": b,
                        **ma.as_dict(),
                        **mb.as_dict("target_"),
                        "text_ar": c.text[ent.heading[0] : ent.heading[1]],
                        "verses": [],
                        "derived_from": row["id"],
                        "derivation": "furuq-heading-pair",
                    }
                )
        return out


def build_relations(
    raw: Path, build_dir: Path, registry: Path
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Parse every registered work into relation tables. ``raw`` is data/raw, ``build_dir`` a dataset
    build (roots, lemmas, words, verses, surahs), ``registry`` data/relations.yaml."""
    reg = yaml.safe_load(registry.read_text(encoding="utf-8"))
    verses = _jsonl(build_dir / "verses.jsonl")
    surahs = _jsonl(build_dir / "surahs.jsonl")
    roots = _jsonl(build_dir / "roots.jsonl")
    lemmas = _jsonl(build_dir / "lemmas.jsonl")
    words = _jsonl(build_dir / "words.jsonl")
    qi = QuranIndex(verses, surahs)
    mapper = HeadwordMapper(roots, lemmas, words)
    b = _Builder(qi, mapper)
    ot = reg["openiti"]
    sources_out: list[dict[str, Any]] = []
    report: dict[str, Any] = {
        "openiti_release": ot["release"],
        "openiti_commit": ot["commit"],
        "cleaning_rules": [r["id"] for r in reg["cleaning_rules"]],
        "sources": {},
    }
    for src in sorted(reg["sources"], key=lambda s: s["sort_order"]):
        path = raw / src["file"]
        if not path.exists():
            report["sources"][src["id"]] = {"status": "missing-file", "file": src["file"]}
            continue
        sha = _sha256(path)
        if sha != src["sha256"]:
            raise RelationsError(f"{src['id']}: {src['file']} sha256 {sha} ≠ pinned {src['sha256']}")
        if src["parser"] not in PARSERS:
            raise RelationsError(f"{src['id']}: unknown parser {src['parser']!r}")
        c = clean(path.read_text(encoding="utf-8"), src["openiti_uri"])
        entries = PARSERS[src["parser"]](c)
        report["sources"][src["id"]] = {"file_sha256": sha} | b.add_source(src, c, entries)
        sources_out.append(
            {
                "id": src["id"],
                "kind": src["kind"],
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
                "licence": src["licence"],
                "licence_url": ot["licence_url"],
                "licence_clause": ot["licence_clause"],
                "redistributable": src["redistributable"],
                "attribution_ar": src["attribution_ar"],
                "attribution_en": src["attribution_en"],
            }
        )
    tables = {
        "relation_sources": sources_out,
        "relation_entries": b.entries,
        "relation_candidates": b.candidates,
        "relation_citations": b.citations,
    }
    ids = [r["id"] for r in b.candidates]
    if len(ids) != len(set(ids)):
        dup = [k for k, v in Counter(ids).items() if v > 1][:5]
        raise RelationsError(f"duplicate candidate ids: {dup}")
    quotes = [x for x in b.citations if x["kind"] == "quote"]
    report["totals"] = {
        "entries": len(b.entries),
        "candidates": len(b.candidates),
        "by_type": dict(Counter(r["type"] for r in b.candidates).most_common()),
        "citations": len(b.citations),
        "quotes": len(quotes),
        "quotes_resolved": sum(1 for x in quotes if x["status"] == "resolved"),
        "quotes_ambiguous": sum(1 for x in quotes if x["status"] == "ambiguous"),
        "quotes_unresolved": sum(1 for x in quotes if x["status"] == "unresolved"),
        "surah_only": sum(1 for x in b.citations if x["kind"] == "surah"),
        "status": dict(Counter(r["status"] for r in b.candidates)),
    }
    return tables, report


def write_tables(tables: dict[str, list[dict[str, Any]]], report: dict[str, Any], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in tables.items():
        with (out_dir / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
    (out_dir / "relations_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8"
    )


__all__ = ["STATUS", "TYPES", "RelationsError", "build_relations", "sense_label", "write_tables"]
