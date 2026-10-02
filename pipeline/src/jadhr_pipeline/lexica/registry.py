"""Lexicon registry (data/lexica.yaml): load, validate, verify sha256 pins."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

WORK_FIELDS = (
    "id",
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
FORMATS = {"shamela-toc", "shamela-lisan", "shamela-gharib", "perseus-lane"}


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
        return str(self.cfg.get("kind", "lexicon"))

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
        return {f: self.cfg[f] for f in WORK_FIELDS}


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
    for cfg in data["works"]:
        missing = [f for f in (*WORK_FIELDS, "format", "files") if f not in cfg]
        if missing:
            raise LexiconRegistryError(f"{cfg.get('id')}: missing fields {missing}")
        if cfg["format"] not in FORMATS:
            raise LexiconRegistryError(f"{cfg['id']}: unknown format {cfg['format']}")
        if cfg["id"] in seen:
            raise LexiconRegistryError(f"duplicate work id {cfg['id']}")
        seen.add(cfg["id"])
        if cfg["lang"] not in ("ar", "en"):
            raise LexiconRegistryError(f"{cfg['id']}: lang must be ar|en")
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
    return Registry(rules=rules, works=works)
