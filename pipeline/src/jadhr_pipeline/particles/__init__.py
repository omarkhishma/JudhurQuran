"""Particles and function words (PLAN P3.8): the classical works on particles, parsed into editor-side entries.

Two works, read from OpenITI release 2025.1.9 (registry ``data/particles.yaml``):

* Ibn Hishām (d. 761 AH), *Mughnī al-Labīb*, chapter one — an entry per headword in its letter sections;
* al-Murādī (d. 749 AH), *al-Janā al-Dānī* — an entry per particle of his five chapters, checked against the
  list each chapter opens with.

Tables (``build_particles``):

* ``particle_sources`` — the work, edition, OpenITI file and pin, licence and attribution;
* ``particle_entries`` — one row per headword: the heading as printed, the particle form(s), the mechanical
  link to corpus lemmas, affixes and pronouns (``mapping``), the count of senses the text states, the
  numbered lists found, the locator;
* ``particle_senses`` — the entry's text in reading order, every row a verbatim slice: ``intro`` (before the
  first numbered sense), ``sense`` (one numbered sense — «الأول: الظرفية …» — with its index, marker, label
  and list), ``note`` (a sub-heading such as «تنبيه» and the text under it). Together they cover the entry's
  text after its heading, word for word (the tests check it);
* ``particle_citations`` — every Quran quotation in a row, resolved to verse keys only when the Quran text
  decides (``relations.quran``: unique match → resolved, otherwise ambiguous/unresolved with candidates).

Every row is status ``extracted`` — never ``reviewed``; editors review in the workbench. Particles get no
root: nothing here assigns one.

Entry point: ``build_particles(raw, build_dir, registry)``; CLI ``python -m jadhr_pipeline.particles``.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import yaml

from ..relations.quran import Citation, QuranIndex
from .entries import PARSERS, Entry, is_subheading, paragraphs
from .mapping import LETTER_OF_NAME, ParticleMapper, heading_forms
from .structure import sense_label
from .text import Source, load_source

STATUS = "extracted"
ROW_KINDS = ("intro", "sense", "note")
_LETTERS = re.compile("[^ء-ي]")


class ParticlesError(ValueError):
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


def _trim(text: str, s: int, e: int) -> tuple[int, int]:
    while s < e and text[s] in " \n:،.-":
        s += 1
    while e > s and text[e - 1] in " \n":
        e -= 1
    return s, e


def _verse_list(cites: list[Citation]) -> list[str]:
    out: list[str] = []
    for c in cites:
        if c.status == "resolved":
            out += [k for k in c.verse_keys if k not in out]
    return out


class _Builder:
    def __init__(self, qi: QuranIndex, mapper: ParticleMapper) -> None:
        self.qi = qi
        self.mapper = mapper
        self.entries: list[dict[str, Any]] = []
        self.senses: list[dict[str, Any]] = []
        self.citations: list[dict[str, Any]] = []

    def _cite(self, src: Source, s: int, e: int, styles: frozenset[str]) -> list[Citation]:
        markup = [(a - s, b - s) for a, b in src.clean.quote_spans if s <= a and b <= e]
        return self.qi.find(src.text[s:e], styles, markup)

    def _map(self, cfg: dict[str, Any], src: Source, ent: Entry) -> tuple[dict[str, Any], str, str | None]:
        """(mapping row fields, the headword as printed or supplied, the heading's shape words)."""
        t = src.text
        overrides = {x["heading"]: x for x in cfg.get("letter_overrides") or ()}
        heading = t[ent.heading[0] : ent.heading[1]]
        if ent.supplied_headword:
            word, descriptor = ent.supplied_headword, None
        else:
            assert ent.form is not None
            word = t[ent.form[0] : ent.form[1]]
            descriptor = t[ent.form[1] : ent.heading[1]].strip() or None
        forms = ent.listed_as or heading_forms(word)
        letter = None
        if len(forms) == 1 and forms[0] in LETTER_OF_NAME:
            letter = LETTER_OF_NAME[forms[0]]
        if heading in overrides:
            letter = overrides[heading]["letter"]
        m = self.mapper.map(forms, descriptor or "", ent.letters, letter)
        row = m.as_dict()
        if heading in overrides:
            row["match_constraints"] = [
                *row["match_constraints"],
                f"letter: {overrides[heading]['evidence']}",
            ]
        return row, word, descriptor

    def add_source(self, src_cfg: dict[str, Any], src: Source, entries: list[Entry]) -> dict[str, Any]:
        sid = src_cfg["id"]
        t = src.text
        styles = frozenset(src_cfg.get("quote_styles") or ())
        cite_stats: Counter[str] = Counter()
        kinds: Counter[str] = Counter()
        mismatches: list[dict[str, Any]] = []
        uncovered: list[str] = []
        all_paras = paragraphs(t)
        for ent in entries:
            eid = f"{sid}:{ent.seq:03d}"
            mapping, word, descriptor = self._map(src_cfg, src, ent)
            # cut the entry's text after its heading into intro, numbered senses and sub-headed notes
            body = ent.heading[1]
            subs = [s for s, e in all_paras if body <= s < ent.end and is_subheading(src.clean, t, s, e)]
            cuts = sorted({s.start for s in ent.senses} | set(subs))
            rows: list[tuple[str, int, int, Any]] = []
            first = cuts[0] if cuts else ent.end
            a, b = _trim(t, body, first)
            if b > a:
                rows.append(("intro", a, b, None))
            by_start = {s.start: (i, s) for i, s in enumerate(ent.senses)}
            for i, c in enumerate(cuts):
                nxt = cuts[i + 1] if i + 1 < len(cuts) else ent.end
                a, b = _trim(t, c, nxt)
                if c in by_start:
                    rows.append(("sense", a, b, by_start[c]))
                elif b > a:
                    rows.append(("note", a, b, None))
            # every letter after the heading is in a row (rows are trimmed of spaces and punctuation only)
            covered = "".join(t[a:b] for _, a, b, _ in rows)
            if _LETTERS.sub("", covered) != _LETTERS.sub("", t[body : ent.end]):
                uncovered.append(eid)
            sense_ids: dict[int, str] = {}
            for n, (kind, a, b, sense) in enumerate(rows):
                rid = f"{eid}:{n:02d}"
                kinds[kind] += 1
                text = t[a:b]
                cites = self._cite(src, a, b, styles)
                for x in cites:
                    cite_stats[f"{x.kind}:{x.status}"] += 1
                    cite_stats[f"marked_by:{x.marked_by}"] += 1
                row: dict[str, Any] = {
                    "id": rid,
                    "entry_id": eid,
                    "source_id": sid,
                    "ordinal": n,
                    "kind": kind,
                    "list_no": None,
                    "list_depth": None,
                    "parent_id": None,
                    "sense_index": None,
                    "marker_ar": None,
                    "marker_noun_ar": None,
                    "label_ar": None,
                    "text_ar": text,
                    "verses": _verse_list(cites),
                    **src.pages.locator(a),
                    "notes": [],
                    "status": STATUS,
                }
                if kind == "sense":
                    i, s = sense
                    sense_ids[i] = rid
                    lab = sense_label(t, s)
                    row |= {
                        "list_no": s.list_no,
                        "list_depth": s.depth,
                        "parent_id": sense_ids.get(s.parent) if s.parent is not None else None,
                        "sense_index": s.index,
                        "marker_ar": s.marker,
                        "marker_noun_ar": s.marker_noun,
                        "label_ar": t[lab[0] : lab[1]] if lab else None,
                        "notes": s.notes,
                    }
                elif kind == "note":
                    head = text.split("\n", 1)[0]
                    row["label_ar"] = head if len(head.split()) <= 3 else None
                self.senses.append(row)
                for k, c in enumerate(cites, 1):
                    cr = {"id": f"{rid}:c{k:02d}", "sense_id": rid, "ordinal": k} | c.as_row(text)
                    cr["surah"] = int(c.verse_keys[0].split(":")[0]) if c.verse_keys else c.surah_hint
                    self.citations.append(cr)
            lists = [
                {
                    "no": lst.no,
                    "depth": lst.depth,
                    "parent_id": sense_ids.get(lst.parent) if lst.parent is not None else None,
                    "stated": lst.stated,
                    "stated_ar": t[lst.count_span[0] : lst.count_span[1]] if lst.count_span else None,
                    "noun_ar": lst.noun,
                    "lead_ar": t[lst.lead[0] : lst.lead[1]] or None,
                    "found": len(lst.items),
                }
                for lst in ent.lists
            ]
            first_list = lists[0] if lists else None
            stated = first_list["stated"] if first_list else None
            if first_list and stated is not None and stated != first_list["found"]:
                mismatches.append(
                    {"entry": eid, "headword": word, "stated": stated, "found": first_list["found"]}
                )
            self.entries.append(
                {
                    "id": eid,
                    "source_id": sid,
                    "seq": ent.seq,
                    "section_ar": ent.section,
                    "chapter_letters": ent.letters,
                    "heading_ar": t[ent.heading[0] : ent.heading[1]] if not ent.supplied_headword else None,
                    "headword_ar": word,
                    "headword_supplied": bool(ent.supplied_headword),
                    "headword_evidence_ar": ent.supplied_evidence,
                    "descriptor_ar": descriptor,
                    "listed_as_ar": ent.listed_as or None,
                    **mapping,
                    "stated_count": stated,
                    "stated_count_ar": first_list["stated_ar"] if first_list else None,
                    "sense_count": len(ent.senses),
                    "first_list_count": first_list["found"] if first_list else 0,
                    "lists": lists,
                    **src.pages.locator(ent.start),
                    "notes": ent.notes,
                    "status": STATUS,
                }
            )
        mine = [e for e in self.entries if e["source_id"] == sid]
        rows = [r for r in self.senses if r["source_id"] == sid]
        lists_all = [x for e in mine for x in e["lists"]]
        report: dict[str, Any] = {
            "status": "ok",
            "entries": len(mine),
            "entries_with_numbered_senses": sum(1 for e in mine if e["sense_count"]),
            "rows": dict(kinds),
            "senses": kinds["sense"],
            "rows_with_resolved_verse": sum(1 for r in rows if r["verses"]),
            "headwords_supplied": sum(1 for e in mine if e["headword_supplied"]),
            "lists": {
                "lists": len(lists_all),
                "with_stated_count": sum(1 for x in lists_all if x["stated"] is not None),
                "stated_equals_found": sum(
                    1 for x in lists_all if x["stated"] is not None and x["stated"] == x["found"]
                ),
                "entries_whose_first_list_states_a_count": sum(
                    1 for e in mine if e["stated_count"] is not None
                ),
                "first_list_stated_equals_found": sum(
                    1
                    for e in mine
                    if e["stated_count"] is not None and e["stated_count"] == e["first_list_count"]
                ),
                "first_list_mismatches": mismatches,
            },
            "mapping": {
                "mapped": sum(1 for e in mine if e["corpus_links"]),
                "unmapped": sum(1 for e in mine if not e["corpus_links"]),
                "with_lemma": sum(1 for e in mine if e["lemma_ids"]),
                "affix_only": sum(1 for e in mine if e["affix_tags"] and not e["lemma_ids"]),
                "pronoun": sum(1 for e in mine if any(x["kind"] == "pronoun" for x in e["corpus_links"])),
                "distinct_lemmas": len({k for e in mine for k in e["lemma_keys"]}),
                "by_method": dict(Counter(e["match_method"] or "unmapped" for e in mine).most_common()),
                "by_confidence": dict(
                    Counter(e["match_confidence"] or "unmapped" for e in mine).most_common()
                ),
                "unmapped_reasons": dict(
                    Counter(e["unmapped_reason"] for e in mine if not e["corpus_links"]).most_common()
                ),
                "unmapped_headwords": [e["headword_ar"] for e in mine if not e["corpus_links"]],
            },
            "citations": dict(sorted(cite_stats.items())),
            "notes": dict(Counter(n for e in mine for n in e["notes"]).most_common()),
            "coverage": {"entries_not_fully_covered": uncovered},
            "cleaning": dict(src.clean.stats),
        }
        if src.alignment:
            report["page_alignment"] = {k: v for k, v in src.alignment.items()}
        return report


def build_particles(
    raw: Path, build_dir: Path, registry: Path
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Parse every registered particle work into tables. ``raw`` is data/raw, ``build_dir`` a dataset build
    (verses, surahs, lemmas, words), ``registry`` data/particles.yaml."""
    reg = yaml.safe_load(registry.read_text(encoding="utf-8"))
    qi = QuranIndex(_jsonl(build_dir / "verses.jsonl"), _jsonl(build_dir / "surahs.jsonl"))
    mapper = ParticleMapper(_jsonl(build_dir / "lemmas.jsonl"), _jsonl(build_dir / "words.jsonl"))
    b = _Builder(qi, mapper)
    ot = reg["openiti"]
    sources_out: list[dict[str, Any]] = []
    report: dict[str, Any] = {
        "openiti_release": ot["release"],
        "openiti_commit": ot["commit"],
        "cleaning_rules": [r["id"] for r in reg["cleaning_rules"]],
        "mapping_rules": [r["id"] for r in reg["mapping_rules"]],
        "sources": {},
    }
    for src in sorted(reg["sources"], key=lambda s: s["sort_order"]):
        path = raw / src["file"]
        ps = src.get("page_source")
        missing = [f for f in [src["file"], ps["file"] if ps else None] if f and not (raw / f).exists()]
        if missing:
            report["sources"][src["id"]] = {"status": "missing-file", "files": missing}
            continue
        sha = _sha256(path)
        if sha != src["sha256"]:
            raise ParticlesError(f"{src['id']}: {src['file']} sha256 {sha} ≠ pinned {src['sha256']}")
        page_raw = None
        if ps:
            psha = _sha256(raw / ps["file"])
            if psha != ps["sha256"]:
                raise ParticlesError(f"{src['id']}: {ps['file']} sha256 {psha} ≠ pinned {ps['sha256']}")
            page_raw = (raw / ps["file"]).read_text(encoding="utf-8")
        if src["parser"] not in PARSERS:
            raise ParticlesError(f"{src['id']}: unknown parser {src['parser']!r}")
        s = load_source(src, path.read_text(encoding="utf-8"), page_raw)
        if s.alignment and s.alignment["letters_differing"] > (ps or {}).get("max_letters_differing", 0):
            raise ParticlesError(
                f"{src['id']}: text and page source differ in {s.alignment['letters_differing']} letters"
            )
        cfg = dict(src)
        entries = PARSERS[src["parser"]](s, cfg)
        rep = {"file_sha256": sha} | b.add_source(src, s, entries)
        if "_report" in cfg:
            rep |= cfg["_report"]
        report["sources"][src["id"]] = rep
        sources_out.append(
            {
                "id": src["id"],
                "sort_order": src["sort_order"],
                "title_ar": src["title_ar"],
                "title_en": src["title_en"],
                "author_ar": src["author_ar"],
                "author_en": src["author_en"],
                "death_hijri": src["death_hijri"],
                "death_ce": src["death_ce"],
                "edition_ar": src["edition_ar"],
                "edition_en": src["edition_en"],
                "scope_ar": src["scope_ar"],
                "scope_en": src["scope_en"],
                "openiti_uri": src["openiti_uri"],
                "page_uri": ps["openiti_uri"] if ps else src["openiti_uri"],
                "openiti_release": ot["release"],
                "openiti_commit": ot["commit"],
                "source_url": src["source_url"],
                "file_sha256": sha,
                "page_source_sha256": ps["sha256"] if ps else None,
                "licence": src["licence"],
                "licence_url": ot["licence_url"],
                "licence_clause": ot["licence_clause"],
                "redistributable": src["redistributable"],
                "attribution_ar": src["attribution_ar"],
                "attribution_en": src["attribution_en"],
                "use": src["use"],
            }
        )
    tables = {
        "particle_sources": sources_out,
        "particle_entries": b.entries,
        "particle_senses": b.senses,
        "particle_citations": b.citations,
    }
    for name, rows in tables.items():
        ids = [r["id"] for r in rows]
        if len(ids) != len(set(ids)):
            dup = [k for k, v in Counter(ids).items() if v > 1][:5]
            raise ParticlesError(f"{name}: duplicate ids {dup}")
    quotes = [x for x in b.citations if x["kind"] == "quote"]
    report["totals"] = {
        "entries": len(b.entries),
        "rows": len(b.senses),
        "senses": sum(1 for r in b.senses if r["kind"] == "sense"),
        "entries_mapped": sum(1 for e in b.entries if e["corpus_links"]),
        "entries_unmapped": sum(1 for e in b.entries if not e["corpus_links"]),
        "citations": len(b.citations),
        "quotes": len(quotes),
        "quotes_resolved": sum(1 for x in quotes if x["status"] == "resolved"),
        "quotes_ambiguous": sum(1 for x in quotes if x["status"] == "ambiguous"),
        "quotes_unresolved": sum(1 for x in quotes if x["status"] == "unresolved"),
        "surah_only": sum(1 for x in b.citations if x["kind"] == "surah"),
        "status": dict(Counter(r["status"] for r in b.senses)),
    }
    return tables, report


def write_tables(tables: dict[str, list[dict[str, Any]]], report: dict[str, Any], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in tables.items():
        with (out_dir / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
    (out_dir / "particles_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8"
    )


__all__ = ["ROW_KINDS", "STATUS", "ParticlesError", "build_particles", "write_tables"]
