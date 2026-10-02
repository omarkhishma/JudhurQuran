"""Slug registries are append-only: an issued slug never changes and is never reissued (PLAN P1.3b)."""

from __future__ import annotations

from pathlib import Path

import pytest
from jadhr_pipeline.slugs import SlugRegistry

REPO = Path(__file__).resolve().parents[2]


def test_existing_keys_keep_their_slug(tmp_path: Path) -> None:
    reg = SlugRegistry(tmp_path / "r.tsv")
    assert reg.assign("kitaAb", "kitab") == "kitab"
    assert reg.assign("kitaAb2", "kitab") == "kitab-2"
    reg.save("test")
    again = SlugRegistry(tmp_path / "r.tsv")
    # a later release romanises differently: the issued slug still wins
    assert again.assign("kitaAb", "kitaab") == "kitab"
    assert again.assign("new", "kitab") == "kitab-3"


def test_registry_refuses_duplicates(tmp_path: Path) -> None:
    p = tmp_path / "r.tsv"
    p.write_text("a\tx\nb\tx\n", encoding="utf-8")
    with pytest.raises(ValueError, match="duplicate"):
        SlugRegistry(p)


@pytest.mark.parametrize("name", ["lemma-slugs.tsv", "pattern-slugs.tsv"])
def test_committed_registries_are_well_formed(name: str) -> None:
    reg = SlugRegistry(REPO / "data/registry" / name)
    assert len(reg.by_key) > 0
    assert all(s and s == s.lower() and " " not in s for s in reg.by_key.values())
