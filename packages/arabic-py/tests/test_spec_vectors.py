"""The shared normalisation vectors (packages/arabic-spec/vectors.json) — the TypeScript twin runs the same file."""

import json
from pathlib import Path

import pytest
from jadhr_arabic import display_bare, normalize, strip_marks

VECTORS = json.loads(
    (Path(__file__).resolve().parents[2] / "arabic-spec" / "vectors.json").read_text(encoding="utf-8")
)["cases"]


def test_vectors_present() -> None:
    assert len(VECTORS) >= 30


@pytest.mark.parametrize("case", VECTORS, ids=[c["name"] for c in VECTORS])
def test_vector(case: dict[str, str]) -> None:
    assert strip_marks(case["input"]) == case["strip_marks"]
    assert display_bare(case["input"]) == case["display_bare"]
    assert normalize(case["input"]) == case["normalize"]
