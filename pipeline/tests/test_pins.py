"""Source pins: the real registry verifies, and any drift or missing file fails loudly."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml
from jadhr_pipeline.pins import sha256_file, verify_source_pins

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("JADHR_RAW_DIR", REPO / "data" / "raw"))  # same switch as conftest.py


def test_every_pinned_source_file_matches() -> None:
    result = verify_source_pins(RAW, REPO / "data/sources.yaml")
    assert len(result["verified"]) >= 18 and result["unpinned"] == []


def _registry(tmp: Path, sha: str) -> Path:
    reg = tmp / "sources.yaml"
    reg.write_text(yaml.safe_dump({"sources": [{"id": "x", "files": [{"path": "f.txt", "sha256": sha}]}]}))
    return reg


def test_drifted_file_fails(tmp_path: Path) -> None:
    (tmp_path / "f.txt").write_text("original")
    reg = _registry(tmp_path, sha256_file(tmp_path / "f.txt"))
    assert verify_source_pins(tmp_path, reg)["verified"] == ["f.txt"]
    (tmp_path / "f.txt").write_text("changed upstream")
    with pytest.raises(ValueError, match="sha256"):
        verify_source_pins(tmp_path, reg)


def test_missing_file_fails(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="missing"):
        verify_source_pins(tmp_path, _registry(tmp_path, "0" * 64))
