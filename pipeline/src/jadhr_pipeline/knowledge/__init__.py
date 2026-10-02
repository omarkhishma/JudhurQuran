"""The Quran side of the encyclopedia (PLAN P3.9): sūra cards, Makki/Madani per verse, occasions of
revelation, verse cross-references and an entity seed — each layer read from pinned raw sources listed
in ``data/knowledge.yaml`` and returned as rows that carry the id of the source they come from.

    tables, report = build_knowledge(raw, build_dir, registry)

``raw`` is ``data/raw`` (licensed downloads, gitignored); ``build_dir`` is a built dataset
(``data/build/<version>``: verses, surahs, words, lemmas, work_passages); ``registry`` is
``data/knowledge.yaml``. Nothing here generates religious content: every text is a source's own words,
verbatim; what we add is structure (verse keys, separated footnotes, extracted counts), each with the
method and confidence that produced it.

CLI: ``uv run python -m jadhr_pipeline.knowledge build OUT_DIR`` (writes one JSONL per table and
``report.json``) and ``… fetch-wikidata`` (refreshes the pinned Wikidata responses; network).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .asbab import build_asbab
from .crossrefs import build_crossrefs, evaluate_precision, qursim_agreement
from .entities import match_entities, pn_candidates
from .places import build_verse_places
from .quran import QuranIndex, read_jsonl
from .registry import load_registry, verify_pins
from .surahs import build_surah_cards

TABLES = ("surah_cards", "verse_places", "asbab", "verse_crossrefs", "entity_candidates")
OPTIONAL_SOURCES = {"wikidata", "qursim"}


def build_knowledge(
    raw: Path, build_dir: Path, registry: Path
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    reg = load_registry(registry)
    pins = verify_pins(raw, reg, optional=OPTIONAL_SOURCES)
    quran = QuranIndex.load(build_dir)
    surahs = read_jsonl(build_dir / "surahs.jsonl")
    surah_types = {s["number"]: s["revelation_place"] for s in surahs}
    report: dict[str, Any] = {
        "pins": {"verified": len(pins["verified"]), "missing_optional": pins["missing_optional"]}
    }

    tanzil_meta = reg.path(raw, "tanzil-metadata", "quran-data.xml")
    tc_db = reg.path(raw, "tafsircenter-quran-db", "quran.db")
    cards, report["surah_cards"] = build_surah_cards(tanzil_meta, tc_db)

    places, report["verse_places"] = build_verse_places(
        reg.path(raw, "tanzil-revelation-order", "revelation_order.html"), tc_db, quran, surah_types
    )
    # the study's own conclusion on a disputed sūra, next to the Egyptian classification on the card
    study = {p["surah"]: p["period"] for p in places if p["scope"] == "surah" and p["role"] == "preferred"}
    for c in cards:
        c["tc_study_preferred_period"] = study.get(c["surah"])
    report["surah_cards"]["tc_study_preferred_differs_from_tanzil"] = [
        c["surah"]
        for c in cards
        if c["tc_study_preferred_period"]
        and c["tc_study_preferred_period"] != {"meccan": "makki", "medinan": "madani"}[c["place"]]
    ]

    asbab, report["asbab"] = build_asbab(
        tc_db,
        reg.path(raw, "wahidi-asbab-openiti", "Shamela0011314-ara1"),
        reg.path(raw, "suyuti-lubab-openiti", "JK000436-ara1"),
        quran,
    )

    passages = read_jsonl(build_dir / "work_passages.jsonl")
    crossrefs, cites, report["verse_crossrefs"] = build_crossrefs(passages, quran)
    report["verse_crossrefs"]["precision"] = evaluate_precision(cites, quran)
    qursim = raw / reg.sources["qursim"]["files"][0]["path"]
    report["verse_crossrefs"]["qursim"] = (
        qursim_agreement(crossrefs, qursim.read_text(encoding="utf-8-sig"), quran)
        if qursim.exists()
        else "qursim file absent"
    )

    wd_dir = raw / "wikidata-quran-entities"
    entities, report["entity_candidates"] = match_entities(
        pn_candidates(build_dir), wd_dir if wd_dir.exists() else None
    )

    tables = {
        "surah_cards": cards,
        "verse_places": places,
        "asbab": asbab,
        "verse_crossrefs": crossrefs,
        "entity_candidates": entities,
    }
    known = set(reg.sources)
    for name, rows in tables.items():
        for r in rows:
            ids = r.get("source_ids") or [r["source_id"]]
            unknown = [i for i in ids if i not in known]
            if unknown:
                raise ValueError(f"{name}: row cites unregistered source {unknown}")
    report["counts"] = {k: len(v) for k, v in tables.items()}
    return tables, report
