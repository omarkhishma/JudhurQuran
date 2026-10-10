"""A model's files from its own repository at the pinned revision, each checked against its sha256 (D34): fetched once
into data/tools/models (gitignored), never at build or serving time.
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

from .encoder import sha256
from .models import Spec, folder


def fetch(spec: Spec, root: Path | None = None) -> Path:
    root = root or folder(spec)
    for rel, (digest, size) in spec.files.items():
        dest = root / rel
        if dest.exists() and dest.stat().st_size == size and sha256(dest) == digest:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        part = dest.with_name(dest.name + ".part")
        url = f"https://huggingface.co/{spec.repo}/resolve/{spec.revision}/{rel}"
        with urllib.request.urlopen(url) as r, part.open("wb") as out:  # a pinned https URL
            while block := r.read(1 << 20):
                out.write(block)
        got = sha256(part)
        if got != digest:
            part.unlink()
            raise RuntimeError(f"{spec.tag}: {rel} fetched with sha256 {got}, pinned {digest}")
        part.rename(dest)
    return root
