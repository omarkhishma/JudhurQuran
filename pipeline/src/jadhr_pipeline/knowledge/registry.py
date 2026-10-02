"""The knowledge-layer source registry (``data/knowledge.yaml``): every file pinned by sha256, with its
licence quoted verbatim and the attribution to display in Arabic and English. A build refuses to read a
file whose hash drifted, and every output row carries a ``source_id`` that must exist here."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from ..pins import sha256_file


class RegistryError(ValueError):
    pass


@dataclass(frozen=True)
class Registry:
    sources: dict[str, dict[str, Any]]
    cleaning_rules: dict[str, str]

    def path(self, raw: Path, source_id: str, name: str) -> Path:
        """The pinned file of a source whose path ends with ``name``."""
        for f in self.sources[source_id].get("files", []):
            if f["path"].endswith(name):
                return raw / f["path"]
        raise RegistryError(f"{source_id}: no pinned file ending in {name}")


def load_registry(path: Path) -> Registry:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    sources = {s["id"]: s for s in data["sources"]}
    if len(sources) != len(data["sources"]):
        raise RegistryError("duplicate source id in knowledge registry")
    for s in sources.values():
        for key in ("title_ar", "title_en", "license", "attribution_ar", "attribution_en", "use"):
            if not s.get(key):
                raise RegistryError(f"{s['id']}: missing {key}")
    rules = {r["id"]: r["description"] for r in data.get("cleaning_rules", [])}
    return Registry(sources, rules)


def verify_pins(raw: Path, reg: Registry, *, optional: set[str] = frozenset()) -> dict[str, Any]:
    """Every pinned file must exist and match. Sources in ``optional`` may be absent as a whole
    (reported, not fatal); a present file that drifted is always fatal."""
    verified: list[str] = []
    missing: list[str] = []
    problems: list[str] = []
    for sid, src in reg.sources.items():
        for f in src.get("files", []):
            p = raw / f["path"]
            if not p.exists():
                (missing if sid in optional else problems).append(f"{sid}: missing {f['path']}")
                continue
            got = sha256_file(p)
            if got != f["sha256"]:
                problems.append(f"{sid}: {f['path']} sha256 {got} ≠ pinned {f['sha256']}")
            else:
                verified.append(f["path"])
    if problems:
        raise RegistryError("knowledge source pins do not match:\n  " + "\n  ".join(problems))
    return {"verified": verified, "missing_optional": missing}
