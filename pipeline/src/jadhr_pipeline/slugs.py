"""Stable, collision-free slugs for lemmas and patterns (PLAN P1.3b).

Citations and shared links point at slugs, so a slug never changes once issued. The registries in
``data/registry/`` are append-only: an existing key keeps its slug forever; a new key gets the
romanised form of its Arabic, with ``-2``, ``-3``… when that is taken. A key that disappears from a
later release keeps its line (a tombstone), so its slug is never reissued to something else.

Two romanisations:

* lemmas — readable (``kitab``, ``ilm``, ``rahma``): ʿayn and hamza dropped, long vowels written once;
* patterns — injective over the pattern letters (``faa3il``, ``maf3uul``, ``fa3aalah``): ʿayn is
  ``3``, hamza ``2``, long vowels doubled, tāʾ marbūṭa ``h``. The design's own keys collide
  (``fa3ala`` names both فَعَلَ and فَعَالَة); these do not.
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

from jadhr_arabic.romanise import slug_lemma as lemma_base_slug
from jadhr_arabic.romanise import slug_pattern as pattern_base_slug

__all__ = ["SlugRegistry", "assign_all", "lemma_base_slug", "pattern_base_slug"]


class SlugRegistry:
    """Append-only key → slug map stored as a two-column TSV."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.by_key: dict[str, str] = {}
        self.issued: set[str] = set()
        self.added: list[tuple[str, str]] = []
        if path.exists():
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if not line or line.startswith("#"):
                    continue
                key, slug = line.split("\t")
                if key in self.by_key or slug in self.issued:
                    raise ValueError(f"{path}:{n}: duplicate key or slug {key!r} → {slug!r}")
                self.by_key[key] = slug
                self.issued.add(slug)

    def assign(self, key: str, base: str) -> str:
        if key in self.by_key:
            return self.by_key[key]
        slug, n = base, 1
        while slug in self.issued:
            n += 1
            slug = f"{base}-{n}"
        self.by_key[key] = slug
        self.issued.add(slug)
        self.added.append((key, slug))
        return slug

    def save(self, header: str) -> None:
        if not self.added and self.path.exists():
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        lines = [f"# {header}", "# Append-only: an issued slug never changes and is never reissued."]
        lines += [f"{k}\t{s}" for k, s in self.by_key.items()]
        self.path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def assign_all(registry: SlugRegistry, items: Iterable[tuple[str, str]]) -> dict[str, str]:
    """Assign slugs to (key, base) pairs in the given order (put the most frequent first)."""
    return {key: registry.assign(key, base) for key, base in items}
