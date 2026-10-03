"""Lexicon registry (data/lexica.yaml): load, validate, verify sha256 pins.

Ordering and identity are two different things:

* ``sort_order`` is the display order — the design lists the dictionaries by the author's death
  date (al-ʿAyn first, Lane last), and the registry refuses an order that contradicts ``death_ce``.
* ``id_block`` fixes entry ids (``id_block × 1,000,000 + position``). It never changes when a work
  is added or the display order moves, so ids already loaded or cited stay valid.

``kind`` is the design's dictionary kind (filter chips, article direction): ``earliest``
(al-ʿAyn), ``general``, ``root`` (Maqāyīs), ``interpretive`` (al-Mufradāt), ``english`` (Lane), and
``gharib`` for the verse-keyed Quran gharib works the design has no row for.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from itertools import pairwise
from pathlib import Path
from typing import Any

import yaml

WORK_FIELDS = (
    "id",
    "kind",
    "title_ar",
    "title_en",
    "author_ar",
    "author_en",
    "death_hijri",
    "death_ce",
    "lang",
    "edition_note",
    "source_url",
    "license",
    "attribution_ar",
    "attribution_en",
    "redistributable",
    "sort_order",
)
# Emitted in every work row; null when the registry does not set them (Lane has no Shamela id).
OPTIONAL_WORK_FIELDS = ("shamela_id",)
KINDS = {"earliest", "general", "root", "interpretive", "english", "gharib"}
FORMATS = {
    "shamela-toc",
    "shamela-lisan",
    "shamela-gharib",
    "perseus-lane",
    "shamela-taj",
    "shamela-qamus",
    "shamela-taqalib",
}
EDITOR_SUPPLEMENTS = {"keep", "unwrap", "drop"}


class LexiconRegistryError(ValueError):
    pass


@dataclass(frozen=True)
class WorkSpec:
    cfg: dict[str, Any]
    root: Path  # data/raw

    @property
    def id(self) -> str:
        return str(self.cfg["id"])

    @property
    def format(self) -> str:
        return str(self.cfg["format"])

    @property
    def kind(self) -> str:
        return str(self.cfg["kind"])

    @property
    def id_block(self) -> int:
        return int(self.cfg["id_block"])

    def path(self, rel: str) -> Path:
        return self.root / rel

    @property
    def dir(self) -> Path:
        return self.root / self.cfg["dir"]

    def manual_roots(self) -> dict[str, str | None]:
        out: dict[str, str | None] = {}
        for head, spec in (self.cfg.get("manual_roots") or {}).items():
            out[str(head)] = spec.get("root") if isinstance(spec, dict) else spec
        return out

    def work_row(self) -> dict[str, Any]:
        row = {f: self.cfg[f] for f in WORK_FIELDS}
        row.update({f: self.cfg.get(f) for f in OPTIONAL_WORK_FIELDS})
        return row


@dataclass(frozen=True)
class Registry:
    rules: dict[str, str]
    works: list[WorkSpec] = field(default_factory=list)

    def work(self, work_id: str) -> WorkSpec:
        for w in self.works:
            if w.id == work_id:
                return w
        raise KeyError(work_id)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_registry(raw: Path, registry: Path, *, verify: bool = True) -> Registry:
    data = yaml.safe_load(registry.read_text(encoding="utf-8"))
    rules = {r["id"]: r["description"] for r in data["cleaning_rules"]}
    works: list[WorkSpec] = []
    seen: set[str] = set()
    blocks: set[int] = set()
    orders: set[int] = set()
    for cfg in data["works"]:
        missing = [f for f in (*WORK_FIELDS, "format", "files", "id_block") if f not in cfg]
        if missing:
            raise LexiconRegistryError(f"{cfg.get('id')}: missing fields {missing}")
        if cfg["format"] not in FORMATS:
            raise LexiconRegistryError(f"{cfg['id']}: unknown format {cfg['format']}")
        if cfg["id"] in seen:
            raise LexiconRegistryError(f"duplicate work id {cfg['id']}")
        seen.add(cfg["id"])
        if cfg["lang"] not in ("ar", "en"):
            raise LexiconRegistryError(f"{cfg['id']}: lang must be ar|en")
        if cfg["kind"] not in KINDS:
            raise LexiconRegistryError(f"{cfg['id']}: kind must be one of {sorted(KINDS)}")
        if cfg["format"].startswith("shamela-") and not isinstance(cfg.get("shamela_id"), int):
            raise LexiconRegistryError(
                f"{cfg['id']}: a Shamela work needs its shamela_id (book_metadata.json)"
            )
        if cfg.get("editor_supplements", "keep") not in EDITOR_SUPPLEMENTS:
            raise LexiconRegistryError(
                f"{cfg['id']}: editor_supplements must be one of {sorted(EDITOR_SUPPLEMENTS)}"
            )
        for name, value, used in (
            ("id_block", cfg["id_block"], blocks),
            ("sort_order", cfg["sort_order"], orders),
        ):
            if not isinstance(value, int) or value < 1 or value in used:
                raise LexiconRegistryError(f"{cfg['id']}: {name} must be a unique positive integer")
            used.add(value)
        if verify:
            for f in cfg["files"]:
                p = raw / f["path"]
                if not p.exists():
                    raise LexiconRegistryError(f"{cfg['id']}: missing raw file {f['path']}")
                got = sha256_file(p)
                if got != f["sha256"]:
                    raise LexiconRegistryError(
                        f"{cfg['id']}: sha256 mismatch for {f['path']}: {got} != {f['sha256']}"
                    )
        works.append(WorkSpec(cfg=cfg, root=raw))
    works.sort(key=lambda w: int(w.cfg["sort_order"]))
    deaths = [(w.id, w.cfg["death_ce"]) for w in works]
    for (a, da), (b, db) in pairwise(deaths):
        if da is not None and db is not None and db < da:
            raise LexiconRegistryError(
                f"sort_order puts {b} (d. {db}) after {a} (d. {da}); order is by death date"
            )
    return Registry(rules=rules, works=works)
