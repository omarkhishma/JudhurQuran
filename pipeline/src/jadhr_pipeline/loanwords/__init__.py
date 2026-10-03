"""Loanwords (PLAN P3.7a): al-Suyūṭī's *al-Muhadhdhab fī-mā waqaʿa fī al-Qurʾān min al-muʿarrab*, parsed into
editor-side rows.

One work, read from OpenITI release 2025.1.9 (registry ``data/loanwords.yaml``; the version choice and its
evidence are there and in the build report → ``versions``).

Tables (``build_loanwords``):

* ``loanword_sources`` — the work, edition, OpenITI file and pins, the cross-check files, licence and
  attribution;
* ``loanword_passages`` — every slice of the text that is not an entry, verbatim with its printed page(s) and
  milestone: the introduction paragraph by paragraph (each with the view it belongs to, the text's own words
  for that view and who holds it, and the names the passage gives to who speaks), the chapter headings, the
  closing count and verses, the colophon, and the set-aside copies of entries the typing repeats (each with
  the entry it repeats and the languages it names);
* ``loanword_entries`` — one row per word of the list in the book's order under its letter chapter: heading
  and headword as printed (and what a misspelt heading reads), the entry's text verbatim (its slices, where a
  set-aside block interrupts it), printed page(s), milestone, the languages its text names with the matched
  words, and a summary of its Quran links or, when nothing is linked, the candidates and the reason;
* ``loanword_links`` — one row per link from a headword (or a word of a several-word heading) to a Quran lemma
  or to the sūra-opening letters, with method, spelling level, confidence, scope, occurrences and the quoted
  phrases behind it.

Together the passages and the entries cover the cleaned text letter for letter (``coverage`` in the report;
the tests rebuild it). Every row is status ``extracted`` — never ``reviewed``.

Entry point: ``build_loanwords(raw, build_dir, registry)``; CLI ``python -m jadhr_pipeline.loanwords``.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import yaml

from .linking import CONTENT_POS, QuranLinker, link_parts, spell
from .structure import Heading, find_languages, language_forms, parse, speakers, unrecognised_language_words
from .text import Source, compare_other_edition, compare_same_typing, load_source

STATUS = "extracted"
# Groups of the registry's language forms that name a language (or a people's speech). «بلغتهم» (unnamed)
# and the markers «معرب»، «أعجمي» are kept on the entry but name none.
NAMING_GROUPS = ("foreign", "region", "arabic-dialect")
PASSAGE_SECTIONS = ("introduction", "chapter", "conclusion", "colophon", "set-aside")
_LETTERS = re.compile("[ء-ي]")


class LoanwordsError(ValueError):
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


def _letters(s: str) -> str:
    return "".join(_LETTERS.findall(s))


class _Builder:
    def __init__(
        self, reg: dict[str, Any], src_cfg: dict[str, Any], src: Source, linker: QuranLinker
    ) -> None:
        self.reg = reg
        self.cfg = src_cfg
        self.src = src
        self.t = src.text
        self.linker = linker
        self.forms = language_forms(reg["languages"])
        self.sid = src_cfg["id"]
        self.slip_reads = {x["printed"]: x for x in src_cfg.get("heading_slips") or ()}
        self.entries: list[dict[str, Any]] = []
        self.passages: list[dict[str, Any]] = []
        self.links: list[dict[str, Any]] = []
        self.unrecognised: list[dict[str, Any]] = []
        self.not_language_words = {x["word"] for x in reg.get("not_language_words") or ()}

    # -- helpers -------------------------------------------------------------------------------------------
    def _langs(self, a: int, b: int, base: int) -> list[dict[str, Any]]:
        found = find_languages(self.t, a, b, self.forms)
        for w in unrecognised_language_words(self.t, a, b, found):
            if w not in self.not_language_words:
                self.unrecognised.append({"word_ar": w, "page": self.src.page_at(a)})
        return [x | {"start": x["start"] - base, "end": x["end"] - base} for x in found]

    def _locator(self, s: int, e: int) -> dict[str, Any]:
        return self.src.locator(s, e)

    # -- entries ---------------------------------------------------------------------------------------------
    def add_entries(self, parsed_entries: list[Any]) -> None:
        unbracketed = {h["headword"]: h for h in self.cfg.get("unbracketed_headings") or ()}
        variant = re.compile(r"قراءة من قرأ|قرئ")
        for ent in parsed_entries:
            eid = f"{self.sid}:{ent.seq:03d}"
            h: Heading = ent.heading
            t = self.t
            headword = t[h.word[0] : h.word[1]]
            slip = self.slip_reads.get(headword)
            reads = slip["reads"] if slip else None
            # the entry's text: its slices, joined by a paragraph break where a set-aside block stood
            text_ar = "\n".join(t[s:e] for s, e in ent.segments)
            base_of: list[int] = []
            pos = 0
            for s, e in ent.segments:
                base_of.append(s - pos)
                pos += (e - s) + 1
            langs: list[dict[str, Any]] = []
            segments = []
            for k, (s, e) in enumerate(ent.segments):
                start = h.end if k == 0 else s
                langs += self._langs(start, e, base_of[k])
                segments.append({"text_ar": t[s:e], "offsets": [s, e], **self._locator(s, e)})
            heading_in_text = (h.start - ent.segments[0][0], h.end - ent.segments[0][0])
            # links, word by word
            parts = link_parts(reads or headword)
            part_rows = []
            entry_links = []
            candidates: list[dict[str, Any]] = []
            reasons = []
            for part in parts:
                res = self.linker.link_part(part, text_ar, [heading_in_text])
                skipped = None
                fw = self.linker.function_word(part) if len(parts) > 1 else None
                if (
                    len(parts) > 1
                    and res.links
                    and all(x.lemma_pos is not None and x.lemma_pos not in CONTENT_POS for x in res.links)
                ):
                    fw = res.links[0].lemma_pos
                if fw:
                    skipped = f"«{part}» is a function word ({fw}) inside the heading: not linked"
                    res.links = []
                part_rows.append(
                    {
                        "part_ar": part,
                        "linked": bool(res.links),
                        "function_word": bool(skipped),
                        "reason": skipped or res.reason,
                    }
                )
                if res.links:
                    entry_links += res.links
                elif not skipped:
                    candidates += [c | {"part_ar": part} for c in res.candidates]
                    reasons.append(f"«{part}»: {res.reason}")
            content_parts = [p for p in part_rows if not p["function_word"]]
            n_linked = sum(1 for p in content_parts if p["linked"])
            if n_linked == len(content_parts) and n_linked:
                status = "linked"
            elif n_linked:
                status = "partial"
            elif candidates:
                status = "candidates"
            else:
                status = "unlinked"
            for k, link in enumerate(entry_links, 1):
                self.links.append(
                    {
                        "id": f"{eid}:l{k}",
                        "entry_id": eid,
                        "source_id": self.sid,
                        "headword_ar": headword,
                        "part_ar": link.part_ar,
                        "kind": link.kind,
                        "lemma_id": link.lemma_id,
                        "lemma_key": link.lemma_key,
                        "lemma_ar": link.lemma_ar,
                        "lemma_pos": link.lemma_pos,
                        "method": link.method,
                        "level": link.level,
                        "confidence": link.confidence,
                        "scope": link.scope,
                        "locations": link.locations,
                        "verse_keys": link.verse_keys,
                        "evidence": link.evidence,
                        "excluded": link.excluded,
                        "status": STATUS,
                    }
                )
            notes = []
            if slip:
                notes.append(f"heading slip: «{headword}» reads «{reads}» ({slip['evidence']})")
            if "[" in text_ar:
                notes.append("the text holds the editor's square brackets as printed")
            if variant.search(text_ar):
                notes.append("the entry speaks of a variant reading (قراءة)")
            if len(ent.segments) > 1:
                notes.append(
                    "a set-aside block interrupts the entry: its text is the slices before and after"
                )
            for d in self.cfg.get("known_differences") or ():
                if d["entry"] == headword:
                    notes.append(d["note"])
            for s in self.cfg.get("slips") or ():
                if s.get("where") == headword:
                    notes.append(
                        f"typing slip «{s['printed']}»"
                        + (f" for «{s['reads']}»" if s.get("reads") else "")
                        + f" ({s['evidence']})"
                    )
            style_ev = unbracketed.get(headword)
            self.entries.append(
                {
                    "id": eid,
                    "source_id": self.sid,
                    "seq": ent.seq,
                    "chapter_ar": ent.chapter,
                    "chapter_seq": ent.chapter_seq,
                    "heading_ar": t[h.start : h.end],
                    "headword_ar": headword,
                    "headword_reads_ar": reads,
                    "heading_style": h.style,
                    "heading_registered": bool(style_ev),
                    "text_ar": text_ar,
                    "segments": segments,
                    **self._locator(ent.segments[0][0], ent.segments[-1][1]),
                    "pages": sorted({p for s in segments for p in s["pages"]}),
                    "languages": langs,
                    "language_keys": list(
                        dict.fromkeys(x["key"] for x in langs if x["group"] in NAMING_GROUPS)
                    ),
                    "said_non_arabic": any(x["group"] == "marker" for x in langs),
                    "link_status": status,
                    "lemma_ids": list(
                        dict.fromkeys(x.lemma_id for x in entry_links if x.lemma_id is not None)
                    ),
                    "link_methods": list(dict.fromkeys(x.method for x in entry_links)),
                    "quran_verses": sorted(
                        {v for x in entry_links for v in x.verse_keys},
                        key=lambda v: tuple(map(int, v.split(":"))),
                    ),
                    "parts": part_rows if len(parts) > 1 else None,
                    "candidates": candidates,
                    "unlinked_reason": "; ".join(reasons) or None,
                    "set_aside_copy_ids": [],
                    "notes": notes,
                    "status": STATUS,
                }
            )

    # -- passages --------------------------------------------------------------------------------------------
    def add_passages(self, parsed_passages: list[Any]) -> None:
        views = {v["id"]: v for v in (self.cfg.get("introduction") or {}).get("views") or []}
        copy_of = {x["copy"]: x for x in self.cfg.get("copy_of") or ()}
        by_head = {}
        for e in self.entries:
            by_head.setdefault(spell(e["headword_ar"]), e)
            if e["headword_reads_ar"]:
                by_head.setdefault(spell(e["headword_reads_ar"]), e)
        prev_speakers: list[dict[str, Any]] = []
        prev_text = ""
        for ordinal, ps in enumerate(parsed_passages, 1):
            pid = f"{self.sid}:p{ordinal:03d}"
            t = self.t
            text_ar = t[ps.start : ps.end]
            spk = []
            if ps.section in ("introduction", "conclusion", "colophon") and ps.kind != "editorial-heading":
                spk = [
                    x | {"start": x["start"] - ps.start, "end": x["end"] - ps.start}
                    for x in speakers(t, ps.start, ps.end)
                ]
            introduced_by = None
            if ps.section == "conclusion" and prev_text.rstrip().endswith(":") and prev_speakers:
                introduced_by = prev_speakers[-1]["who_ar"]
            row: dict[str, Any] = {
                "id": pid,
                "source_id": self.sid,
                "ordinal": ordinal,
                "section": ps.section,
                "kind": ps.kind,
                "view_id": ps.view_id,
                "view_stated_as_ar": views[ps.view_id]["stated_as"] if ps.view_id else None,
                "view_held_by_ar": views[ps.view_id]["held_by"] if ps.view_id else None,
                "speakers": spk,
                "introduced_by_ar": introduced_by,
                "text_ar": text_ar,
                "offsets": [ps.start, ps.end],
                **self._locator(ps.start, ps.end),
                "copy_of_entry_id": None,
                "copy_heading_ar": None,
                "copy_headword_ar": None,
                "set_aside_block": None,
                "languages": [],
                "notes": [],
                "status": STATUS,
            }
            if ps.kind == "colophon":
                row["notes"].append((self.cfg.get("conclusion") or {}).get("colophon_note"))
            if ps.kind == "editorial-heading":
                ev = next(x["evidence"] for x in self.cfg["editorial_headings"] if x["text"] == text_ar)
                row["notes"].append(f"an editor's heading, not the author's words ({ev})")
            if ps.copy is not None:
                row["set_aside_block"] = ps.copy.block_id
                if ps.copy.heading is not None:
                    hw = t[ps.copy.heading.word[0] : ps.copy.heading.word[1]]
                    row["copy_heading_ar"] = t[ps.copy.heading.start : ps.copy.heading.end]
                    row["copy_headword_ar"] = hw
                    target = copy_of.get(hw, {}).get("entry", hw)
                    ent = by_head.get(spell(target))
                    if ent is None:
                        raise LoanwordsError(f"set-aside copy «{hw}» repeats no entry")
                    row["copy_of_entry_id"] = ent["id"]
                    ent["set_aside_copy_ids"].append(pid)
                    if hw in copy_of:
                        row["notes"].append(f"repeats «{target}»: {copy_of[hw]['evidence']}")
                    row["languages"] = self._langs(ps.copy.heading.end, ps.end, ps.start)
                row["notes"].append(
                    "set aside: a block of the base typing the re-typed pages repeat (registry set_aside)"
                )
            row["notes"] = [n for n in row["notes"] if n]
            self.passages.append(row)
            prev_speakers, prev_text = spk, text_ar

    # -- coverage -------------------------------------------------------------------------------------------
    def coverage(self) -> dict[str, Any]:
        spans = [tuple(s["offsets"]) for e in self.entries for s in e["segments"]]
        spans += [tuple(p["offsets"]) for p in self.passages]
        spans.sort()
        overlaps = [(a, b) for a, b in itertools.pairwise(spans) if b[0] < a[1]]
        outside = []
        pos = 0
        for s, e in [*spans, (len(self.t), len(self.t))]:
            gap = self.t[pos:s]
            if _letters(gap):
                outside.append({"offset": pos, "text": gap})
            pos = max(pos, e)
        total = len(_letters(self.t))
        inside = sum(len(_letters(self.t[s:e])) for s, e in spans)
        return {
            "letters_in_text": total,
            "letters_in_rows": inside,
            "letters_outside_rows": [x["text"] for x in outside],
            "overlapping_rows": len(overlaps),
        }


def build_loanwords(
    raw: Path, build_dir: Path, registry: Path
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Parse the registered work into tables. ``raw`` is data/raw, ``build_dir`` a dataset build (lemmas,
    words, roots), ``registry`` data/loanwords.yaml."""
    reg = yaml.safe_load(registry.read_text(encoding="utf-8"))
    ot = reg["openiti"]
    report: dict[str, Any] = {
        "openiti_release": ot["release"],
        "openiti_commit": ot["commit"],
        "cleaning_rules": [r["id"] for r in reg["cleaning_rules"]],
        "mapping_rules": [r["id"] for r in reg["mapping_rules"]],
        "sources": {},
    }
    linker: QuranLinker | None = None
    tables: dict[str, list[dict[str, Any]]] = {
        "loanword_sources": [],
        "loanword_passages": [],
        "loanword_entries": [],
        "loanword_links": [],
    }
    for src_cfg in sorted(reg["sources"], key=lambda s: s["sort_order"]):
        files = [(src_cfg["file"], src_cfg["sha256"]), (src_cfg["card_file"], src_cfg["card_sha256"])]
        for x in src_cfg.get("cross_check") or ():
            files += [(x["file"], x["sha256"]), (x["card_file"], x["card_sha256"])]
        missing = [f for f, _ in files if not (raw / f).exists()]
        if missing:
            report["sources"][src_cfg["id"]] = {"status": "missing-file", "files": missing}
            continue
        for f, sha in files:
            got = _sha256(raw / f)
            if got != sha:
                raise LoanwordsError(f"{src_cfg['id']}: {f} sha256 {got} ≠ pinned {sha}")
        if linker is None:
            linker = QuranLinker(
                _jsonl(build_dir / "lemmas.jsonl"),
                _jsonl(build_dir / "words.jsonl"),
                _jsonl(build_dir / "roots.jsonl"),
            )
        src = load_source(src_cfg, (raw / src_cfg["file"]).read_text(encoding="utf-8"))
        # version check: the same typing (letters and page markers) and the other edition (word hunks)
        versions: dict[str, Any] = {}
        for x in src_cfg.get("cross_check") or ():
            other = (raw / x["file"]).read_text(encoding="utf-8")
            if x["role"] == "same-typing":
                cmp = compare_same_typing(src.clean, other, x["openiti_uri"])
                if cmp["letters_differing"] > x["max_letters_differing"]:
                    raise LoanwordsError(
                        f"{x['openiti_uri']}: {cmp['letters_differing']} letters differ, more than {x['max_letters_differing']}"
                    )
                if cmp["page_markers_at_the_same_letter"] != len(src.clean.pages):
                    raise LoanwordsError(f"{x['openiti_uri']}: page markers stand elsewhere than the text's")
            else:
                cmp = compare_other_edition(src.clean, other, x["openiti_uri"])
            versions[x["role"]] = cmp
        parsed = parse(src.text, src_cfg)
        b = _Builder(reg, src_cfg, src, linker)
        b.add_entries(parsed.entries)
        b.add_passages(parsed.passages)
        cov = b.coverage()
        # the author's own count: entries − his six repeats − the two some count = his 117
        ac = src_cfg.get("author_count") or {}
        heads = [e["headword_ar"] for e in b.entries]
        named = [*ac.get("repeats", []), *ac.get("counted_by_some", [])]
        missing_named = [w for w in named if w not in heads]
        ents = b.entries
        lk = b.links
        report["sources"][src_cfg["id"]] = {
            "status": "ok",
            "file_sha256": src_cfg["sha256"],
            "entries": len(ents),
            "entries_by_chapter": dict(Counter(e["chapter_ar"] for e in ents)),
            "headings": dict(Counter(e["heading_style"] for e in ents)),
            "headings_registered": sum(1 for e in ents if e["heading_registered"]),
            "entries_interrupted_by_a_set_aside_block": [
                e["headword_ar"] for e in ents if len(e["segments"]) > 1
            ],
            "passages": dict(Counter(f"{p['section']}:{p['kind']}" for p in b.passages)),
            "introduction_views": {
                v: sum(1 for p in b.passages if p["view_id"] == v)
                for v in dict.fromkeys(p["view_id"] for p in b.passages if p["view_id"])
            },
            "set_aside": {
                bid: {
                    "copies": [
                        {
                            "headword_ar": p["copy_headword_ar"],
                            "repeats": p["copy_of_entry_id"],
                            "page": p["page"],
                            "language_keys": list(
                                dict.fromkeys(x["key"] for x in p["languages"] if x["group"] in NAMING_GROUPS)
                            ),
                        }
                        for p in b.passages
                        if p["set_aside_block"] == bid and p["kind"] == "copy"
                    ],
                    "letters": sum(
                        len(_letters(p["text_ar"])) for p in b.passages if p["set_aside_block"] == bid
                    ),
                }
                for bid, _, _ in parsed.blocks
            },
            "author_count": {
                "stated": ac.get("stated"),
                "entries": len(ents),
                "named_repeats_and_counted_by_some": len(named),
                "named_not_found": missing_named,
                "entries_less_named": len(ents) - len(named),
                "agrees": not missing_named and len(ents) - len(named) == ac.get("stated"),
            },
            "languages": {
                "entries_naming_a_language": sum(1 for e in ents if e["language_keys"]),
                "entries_naming_none": [e["headword_ar"] for e in ents if not e["language_keys"]],
                "entries_said_non_arabic_only": [
                    e["headword_ar"] for e in ents if not e["language_keys"] and e["said_non_arabic"]
                ],
                "entries_by_language": dict(
                    Counter(k for e in ents for k in e["language_keys"]).most_common()
                ),
                "mentions_by_language": dict(
                    Counter(x["key"] for e in ents for x in e["languages"]).most_common()
                ),
                "slip_forms_matched": [
                    {"entry": e["headword_ar"], "matched_ar": x["matched_ar"]}
                    for e in ents
                    for x in e["languages"]
                    if x["slip_evidence"]
                ],
                "unrecognised_language_words": b.unrecognised,
                "copies_naming_what_their_entry_does_not": [
                    {
                        "entry": e["headword_ar"],
                        "copy": p["id"],
                        "only_in_copy": sorted(
                            {x["key"] for x in p["languages"] if x["group"] in NAMING_GROUPS}
                            - set(e["language_keys"])
                        ),
                    }
                    for e in ents
                    for p in b.passages
                    if p["id"] in e["set_aside_copy_ids"]
                    and {x["key"] for x in p["languages"] if x["group"] in NAMING_GROUPS}
                    - set(e["language_keys"])
                ],
            },
            "links": {
                "entries_linked": sum(1 for e in ents if e["link_status"] == "linked"),
                "entries_partly_linked": [e["headword_ar"] for e in ents if e["link_status"] == "partial"],
                "entries_with_candidates_only": sum(1 for e in ents if e["link_status"] == "candidates"),
                "entries_unlinked": sum(1 for e in ents if e["link_status"] == "unlinked"),
                "links": len(lk),
                "by_method": dict(Counter(x["method"].split(":")[0] for x in lk).most_common()),
                "by_method_and_level": dict(Counter(x["method"] for x in lk).most_common()),
                "by_confidence": dict(Counter(x["confidence"] for x in lk).most_common()),
                "by_scope": dict(Counter(x["scope"] for x in lk).most_common()),
                "by_kind": dict(Counter(x["kind"] for x in lk).most_common()),
                "distinct_lemmas": len({x["lemma_id"] for x in lk if x["lemma_id"] is not None}),
                # a headword that is one form of a larger corpus lemma: the claim may concern only some of
                # its occurrences («صلوات» 22:40 in the lemma of «صلاة»; «يصدون» 43:57 among ten) — for editors
                "form_scope": [
                    {
                        "entry": x["entry_id"],
                        "headword_ar": x["headword_ar"],
                        "lemma_ar": x["lemma_ar"],
                        "form_occurrences": len(x["locations"] or ()),
                        "lemma_occurrences": linker.lemmas[x["lemma_id"]].get("occurrences"),
                    }
                    for x in lk
                    if x["scope"] == "form"
                ],
                "not_linked": [
                    {
                        "entry": e["id"],
                        "headword_ar": e["headword_ar"],
                        "status": e["link_status"],
                        "reason": e["unlinked_reason"],
                        "candidates": [
                            f"{c['lemma_ar']} ({c['pos']}, {c['found_by']})" for c in e["candidates"]
                        ],
                    }
                    for e in ents
                    if e["link_status"] not in ("linked",)
                ],
                "not_linked_by_reason": dict(
                    Counter(
                        re.sub(r"^«[^»]+»: ", "", r)
                        for e in ents
                        if e["link_status"] != "linked" and e["unlinked_reason"]
                        for r in e["unlinked_reason"].split("; ")
                    ).most_common()
                ),
            },
            "slips": [
                {k: s.get(k) for k in ("printed", "reads", "where", "evidence")} | {"applied": False}
                for s in src_cfg.get("slips") or ()
            ]
            + [
                {
                    "printed": s["printed"],
                    "reads": s["reads"],
                    "where": "heading",
                    "evidence": s["evidence"],
                    "applied": "headword_reads_ar only",
                }
                for s in src_cfg.get("heading_slips") or ()
            ],
            "known_differences": src_cfg.get("known_differences") or [],
            "coverage": cov,
            "cleaning": dict(src.clean.stats) | src.precleaning,
            "versions": versions,
        }
        tables["loanword_entries"] += b.entries
        tables["loanword_passages"] += b.passages
        tables["loanword_links"] += b.links
        tables["loanword_sources"].append(
            {
                "id": src_cfg["id"],
                "sort_order": src_cfg["sort_order"],
                "title_ar": src_cfg["title_ar"],
                "title_en": src_cfg["title_en"],
                "author_ar": src_cfg["author_ar"],
                "author_en": src_cfg["author_en"],
                "death_hijri": src_cfg["death_hijri"],
                "death_ce": src_cfg["death_ce"],
                "edition_ar": src_cfg["edition_ar"],
                "edition_en": src_cfg["edition_en"],
                "scope_ar": src_cfg["scope_ar"],
                "scope_en": src_cfg["scope_en"],
                "openiti_uri": src_cfg["openiti_uri"],
                "page_uri": src_cfg["openiti_uri"],
                "openiti_release": ot["release"],
                "openiti_commit": ot["commit"],
                "source_url": src_cfg["source_url"],
                "file_sha256": src_cfg["sha256"],
                "cross_check": [
                    {"role": x["role"], "openiti_uri": x["openiti_uri"], "sha256": x["sha256"]}
                    for x in src_cfg.get("cross_check") or ()
                ],
                "licence": src_cfg["licence"],
                "licence_url": ot["licence_url"],
                "licence_clause": ot["licence_clause"],
                "corpus_citation": ot["corpus_citation"],
                "redistributable": src_cfg["redistributable"],
                "attribution_ar": src_cfg["attribution_ar"],
                "attribution_en": src_cfg["attribution_en"],
                "use": src_cfg["use"],
            }
        )
    for name, rows in tables.items():
        ids = [r["id"] for r in rows]
        if len(ids) != len(set(ids)):
            dup = [k for k, v in Counter(ids).items() if v > 1][:5]
            raise LoanwordsError(f"{name}: duplicate ids {dup}")
    ents = tables["loanword_entries"]
    report["totals"] = {
        "entries": len(ents),
        "passages": len(tables["loanword_passages"]),
        "introduction_passages": sum(
            1 for p in tables["loanword_passages"] if p["section"] == "introduction"
        ),
        "links": len(tables["loanword_links"]),
        "entries_linked": sum(1 for e in ents if e["link_status"] == "linked"),
        "entries_partly_linked": sum(1 for e in ents if e["link_status"] == "partial"),
        "entries_not_linked": sum(1 for e in ents if e["link_status"] in ("candidates", "unlinked")),
        "entries_naming_a_language": sum(1 for e in ents if e["language_keys"]),
        "status": dict(
            Counter(
                r["status"]
                for name in ("loanword_entries", "loanword_passages", "loanword_links")
                for r in tables[name]
            )
        ),
    }
    report["shortfalls"] = _shortfalls(report)
    return tables, report


def _shortfalls(report: dict[str, Any]) -> list[str]:
    out = []
    for sid, rep in report["sources"].items():
        if rep.get("status") != "ok":
            out.append(f"{sid}: {rep.get('status')} {rep.get('files')}")
            continue
        lk = rep["links"]
        for x in lk["not_linked"]:
            out.append(f"{sid}: «{x['headword_ar']}» not linked ({x['status']}): {x['reason']}")
        for x in rep["languages"]["entries_naming_none"]:
            out.append(f"{sid}: «{x}» names no language in its text")
        for x in rep["languages"]["unrecognised_language_words"]:
            out.append(
                f"{sid}: «{x['word_ar']}» (p. {x['page']}) looks like a language name but names none this registry knows"
            )
        for x in rep["languages"]["copies_naming_what_their_entry_does_not"]:
            out.append(
                f"{sid}: the set-aside copy of «{x['entry']}» names {x['only_in_copy']}, the entry does not"
            )
        if rep["coverage"]["letters_outside_rows"]:
            out.append(f"{sid}: letters outside any row: {rep['coverage']['letters_outside_rows']}")
        if not rep["author_count"]["agrees"]:
            out.append(f"{sid}: entries do not meet the author's own count: {rep['author_count']}")
    return out


def write_tables(tables: dict[str, list[dict[str, Any]]], report: dict[str, Any], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in tables.items():
        with (out_dir / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
    (out_dir / "loanwords_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8"
    )


__all__ = ["NAMING_GROUPS", "PASSAGE_SECTIONS", "STATUS", "LoanwordsError", "build_loanwords", "write_tables"]
