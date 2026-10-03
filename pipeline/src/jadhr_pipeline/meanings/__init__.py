"""Meanings (PLAN P3.1, decision D6): the sourced material behind the panel's «المعاني» section.

Builders, each ``(raw, build_dir, registry) -> (tables, report)``, with a CLI that writes JSONL
(``python -m jadhr_pipeline.meanings gharib <out_dir>``):

* ``build_gharib`` — a contextual Arabic meaning per Quranic phrase from the King Fahd Complex's «الميسر في غريب
  القرآن الكريم», read from the Complex's own Word file and aligned to our word locations (``gharib.py``;
  registry ``data/gharib.yaml``). Tables ``gharib_works`` and ``gharib_meanings``.

Every row is a verbatim slice of its source with a locator and status ``extracted`` — never ``reviewed``;
editors review in the workbench (P3.0). Mappings are mechanical and store their method and confidence; what
the text does not decide is left unmapped with a reason, never guessed (L2, L3).
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

import yaml

from .docx import paragraphs
from .gharib import STATUS, ParseError, VerseTokens, build_rows, parse

__all__ = ["STATUS", "GharibRegistryError", "ParseError", "build_gharib", "write_tables"]

WORK_FIELDS = (
    "id",
    "sort_order",
    "format",
    "lang",
    "title_ar",
    "title_en",
    "publisher_ar",
    "publisher_en",
    "version",
    "source_url",
    "download_url",
    "licence",
    "licence_clause",
    "licence_url",
    "redistributable",
    "display_only",
    "attribution_ar",
    "attribution_en",
)
FORMATS = {"kfgqpc-gharib-docx"}
_CONTENT_POS = {"N", "V", "ADJ", "PN"}


class GharibRegistryError(ValueError):
    pass


def _jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_gharib_registry(raw: Path, registry: Path) -> dict[str, Any]:
    reg = yaml.safe_load(registry.read_text(encoding="utf-8"))
    rules = [r["id"] for r in reg["cleaning_rules"]]
    if len(rules) != len(set(rules)):
        raise GharibRegistryError("duplicate cleaning rule ids")
    seen: set[str] = set()
    for w in reg["works"]:
        missing = [f for f in (*WORK_FIELDS, "files") if f not in w]
        if missing:
            raise GharibRegistryError(f"{w.get('id')}: missing fields {missing}")
        if w["format"] not in FORMATS:
            raise GharibRegistryError(f"{w['id']}: unknown format {w['format']}")
        if w["id"] in seen:
            raise GharibRegistryError(f"duplicate work id {w['id']}")
        seen.add(w["id"])
        for f in w["files"]:
            p = raw / f["path"]
            if not p.exists():
                raise GharibRegistryError(f"{w['id']}: missing raw file {f['path']}")
            got = sha256_file(p)
            if got != f["sha256"]:
                raise GharibRegistryError(
                    f"{w['id']}: sha256 mismatch for {f['path']}: {got} != {f['sha256']}"
                )
    return reg


def _coverage(words: list[dict[str, Any]], covered: set[str]) -> dict[str, Any]:
    def share(rows: list[dict[str, Any]]) -> dict[str, Any]:
        n = len(rows)
        k = sum(1 for w in rows if w["location"] in covered)
        return {"total": n, "covered": k, "pct": round(100 * k / n, 2) if n else None}

    rooted = [w for w in words if w.get("root_id")]
    content = [w for w in words if w.get("pos") in _CONTENT_POS]
    verses = {f"{w['surah']}:{w['ayah']}" for w in words}
    with_meaning = {loc.rsplit(":", 1)[0] for loc in covered}
    return {
        "word_occurrences": share(words),
        "rooted_word_occurrences": share(rooted),
        "content_word_occurrences": share(content),
        "verses_with_a_meaning": {"total": len(verses), "covered": len(with_meaning & verses)},
    }


def build_gharib(
    raw: Path, build_dir: Path, registry: Path
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Parse and align every registered gharib work. ``raw`` is data/raw, ``build_dir`` a dataset build
    (verses, tokens, words, surahs), ``registry`` data/gharib.yaml."""
    reg = load_gharib_registry(raw, registry)
    verses = _jsonl(build_dir / "verses.jsonl")
    surahs = _jsonl(build_dir / "surahs.jsonl")
    tokens = _jsonl(build_dir / "tokens.jsonl")
    words = _jsonl(build_dir / "words.jsonl")
    vt = VerseTokens(verses, tokens)
    works_out: list[dict[str, Any]] = []
    meanings: list[dict[str, Any]] = []
    report: dict[str, Any] = {"cleaning_rules": [r["id"] for r in reg["cleaning_rules"]], "works": {}}
    rule_ids = set(report["cleaning_rules"])
    for w in sorted(reg["works"], key=lambda w: int(w["sort_order"])):
        f = w["files"][0]
        path = raw / f["path"]
        counters: Counter[str] = Counter()
        paras = paragraphs(path)
        items = parse(paras, surahs, counters)
        rows, rep = build_rows(w, items, vt, path.name)
        covered = {loc for r in rows for loc in r["word_locations"]}
        rep = {
            "file_sha256": f["sha256"],
            "paragraphs": len(paras),
            "rules_applied": {k: v for k, v in sorted(counters.items()) if k.split(":", 1)[0] in rule_ids},
            **rep,
            "coverage": _coverage(words, covered),
        }
        unknown = [k for k in counters if k.split(":", 1)[0] not in rule_ids]
        if unknown:
            raise GharibRegistryError(f"{w['id']}: counters without a registry rule: {unknown}")
        report["works"][w["id"]] = rep
        meanings += rows
        works_out.append(
            {k: w[k] for k in WORK_FIELDS if k != "format"}
            | {"prepared_by_note": w.get("prepared_by_note"), "file": f["path"], "file_sha256": f["sha256"]}
        )
    # Together with Ibn Qutaybah's glosses (lexica), when the build carries them
    covered_all = {loc for r in meanings for loc in r["word_locations"]}
    gg = build_dir / "gharib_glosses.jsonl"
    if gg.exists():
        qutayba = {loc for r in _jsonl(gg) for loc in r.get("word_locations") or ()}
        report["coverage_with_ibn_qutaybah"] = _coverage(words, covered_all | qutayba)
    ids = [r["id"] for r in meanings]
    if len(ids) != len(set(ids)):
        raise GharibRegistryError("duplicate gharib meaning ids")
    report["totals"] = {
        "works": len(works_out),
        "meanings": len(meanings),
        "aligned": sum(1 for r in meanings if r["word_locations"]),
        "status": dict(Counter(r["status"] for r in meanings)),
    }
    return {"gharib_works": works_out, "gharib_meanings": meanings}, report


def write_tables(
    tables: dict[str, list[dict[str, Any]]], report: dict[str, Any], out_dir: Path, report_name: str
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in tables.items():
        with (out_dir / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
    (out_dir / report_name).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
