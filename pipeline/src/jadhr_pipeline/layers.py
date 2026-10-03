"""Derived layers built on top of a dataset build (PLAN P3.9, P8.4/P3.1).

The Quran knowledge layers (sūra cards, Makki/Madani notes, occasions of revelation, cross-references,
entity candidates) and the relation seeds (wujūh senses, furūq contrasts, aḍdād) read the core tables
of the build, so they run after it and write into the same directory. Their sources, licences and
attribution are written beside them (`knowledge_sources.jsonl`, `relation_sources.jsonl`) so every row
the reader shows can name what it came from.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

from .knowledge import build_knowledge
from .patterns_catalog import build_pattern_catalog
from .relations import build_relations

SOURCE_FIELDS = (
    "id",
    "kind",
    "use",
    "title_ar",
    "title_en",
    "version",
    "url",
    "license",
    "license_ar",
    "license_url",
    "attribution_ar",
    "attribution_en",
)


def _write(out: Path, name: str, rows: list[dict[str, Any]]) -> None:
    with (out / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")


def build_layers(
    raw: Path,
    out: Path,
    knowledge_registry: Path,
    relations_registry: Path,
    patterns_registry: Path | None = None,
) -> dict[str, Any]:
    """Build the layers into ``out`` and merge their reports into ``out/report.json``: the Quran knowledge
    layers, the relation seeds and, when its registry is given, the pattern catalog (P3.3)."""
    report = json.loads((out / "report.json").read_text(encoding="utf-8"))

    tables, k_report = build_knowledge(raw, out, knowledge_registry)
    for name, rows in tables.items():
        _write(out, name, rows)
    reg = yaml.safe_load(knowledge_registry.read_text(encoding="utf-8"))
    # evaluation-only sources (QurSim) never reach a table, a page or the API
    _write(
        out,
        "knowledge_sources",
        [{k: s.get(k) for k in SOURCE_FIELDS} for s in reg["sources"] if s.get("use") != "evaluation-only"],
    )

    r_tables, r_report = build_relations(raw, out, relations_registry)
    missing = [k for k, v in r_report["sources"].items() if v.get("status") == "missing-file"]
    if missing:
        raise FileNotFoundError(f"relation sources missing from data/raw: {missing}")
    for name, rows in r_tables.items():
        _write(out, name, rows)

    p_tables: dict[str, list[dict[str, Any]]] = {}
    if patterns_registry is not None:
        p_tables, p_report = build_pattern_catalog(raw, out, patterns_registry)
        missing = [k for k, v in p_report["sources"].items() if v.get("status") == "missing-file"]
        if missing:
            raise FileNotFoundError(f"pattern catalog sources missing from data/raw: {missing}")
        for name, rows in p_tables.items():
            _write(out, name, rows)
        report["patterns_catalog"] = {k: p_report[k] for k in ("totals", "coverage") if k in p_report}

    report["knowledge"] = k_report
    report["relations"] = r_report
    report.setdefault("counts", {}).update(
        {name: len(rows) for name, rows in tables.items()}
        | {name: len(rows) for name, rows in r_tables.items()}
        | {name: len(rows) for name, rows in p_tables.items()}
    )
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    return {
        "knowledge": k_report.get("counts"),
        "relations": r_report.get("totals"),
        "patterns_catalog": {name: len(rows) for name, rows in p_tables.items()},
    }
