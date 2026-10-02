"""Source pins: every file listed with a sha256 in data/sources.yaml must exist and match before a build.

A source that changes upstream (a corrected mushaf file, a new corpus release) must be a deliberate,
reviewed update of its pin — never something a build picks up silently.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import yaml


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_source_pins(raw: Path, sources_yaml: Path) -> dict[str, list[str]]:
    """Check every pinned file; raise listing all problems at once. Returns verified and unpinned paths."""
    sources = yaml.safe_load(sources_yaml.read_text(encoding="utf-8"))["sources"]
    verified: list[str] = []
    unpinned: list[str] = []
    problems: list[str] = []
    for src in sources:
        for f in src.get("files", []):
            path = raw / f["path"]
            if "sha256" not in f:
                unpinned.append(f["path"])
                continue
            if not path.exists():
                problems.append(f"{src['id']}: missing {f['path']}")
                continue
            got = sha256_file(path)
            if got != f["sha256"]:
                problems.append(f"{src['id']}: {f['path']} sha256 {got} ≠ pinned {f['sha256']}")
            else:
                verified.append(f["path"])
    if problems:
        raise ValueError("source pins do not match:\n  " + "\n  ".join(problems))
    return {"verified": verified, "unpinned": unpinned}
