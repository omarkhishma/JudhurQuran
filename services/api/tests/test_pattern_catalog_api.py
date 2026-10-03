"""The pattern catalog through the API (P3.3): every row verbatim from the build, matched to the pattern it
names or inflects, with al-Raḍī's commentary and the source's attribution. Expectations come from the build."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jadhr_api.main import app

REPO = Path(__file__).resolve().parents[3]
BUILD = REPO / "data/build/2026.10.0"

if not (BUILD / "pattern_functions.jsonl").exists():
    if os.environ.get("JADHR_REQUIRE_DATA"):
        raise RuntimeError(f"pattern catalog missing from {BUILD} (run `uv run jadhr-pipeline build`)")
    pytest.skip("pattern catalog not built", allow_module_level=True)

client = TestClient(app)


def jsonl(name: str) -> list[dict]:
    with (BUILD / f"{name}.jsonl").open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


ROWS = jsonl("pattern_functions")
BY_ID = {r["id"]: r for r in ROWS}


def classical(slug: str) -> dict:
    r = client.get(f"/api/v1/patterns/{slug}")
    assert r.status_code == 200, r.text[:200]
    return r.json()["classical"]


@pytest.mark.parametrize("slug", ["faa3il", "maf3uul", "2af3ala", "istaf3ala"])
def test_each_pattern_gets_exactly_the_rows_that_name_or_inflect_it(slug: str) -> None:
    c = classical(slug)
    expected = {
        r["id"]
        for r in ROWS
        if r["kind"] != "commentary"
        and (slug in r["pattern_slugs"] or slug in r["inflected_slugs"] or slug in r["suffix_slugs"])
    }
    assert {r["id"] for r in c["rows"]} == expected and expected
    for r in c["rows"]:
        src = BY_ID[r["id"]]
        assert (
            r["text_ar"] == src["text_ar"] and r["locator"] == src["locator"] and r["status"] == "extracted"
        )
        assert r["via"] == (
            "direct"
            if slug in src["pattern_slugs"]
            else "inflected"
            if slug in src["inflected_slugs"]
            else "suffix"
        )
        assert {c["id"] for c in r["commentary"]} == {
            x["id"] for x in ROWS if x["kind"] == "commentary" and r["id"] in x["comments_on"]
        }
    # direct rows come first
    vias = [r["via"] for r in c["rows"]]
    assert vias == sorted(vias, key=["direct", "inflected", "suffix"].index)
    assert {s["id"] for s in c["sources"]} == {r["source_id"] for r in c["rows"]} | {
        x["source_id"] for r in c["rows"] for x in r["commentary"]
    }
    assert all(s["attribution_ar"] and s["attribution_en"] and s["licence"] for s in c["sources"])


def test_form_iv_carries_its_meanings_from_al_shafiya() -> None:
    meanings = [
        r for r in classical("2af3ala")["rows"] if r["kind"] == "meaning" and r["source_id"] == "shafiya"
    ]
    assert len(meanings) == sum(
        1
        for r in ROWS
        if r["kind"] == "meaning" and r["source_id"] == "shafiya" and "2af3ala" in r["pattern_slugs"]
    )
    assert any("للتعدية" in r["text_ar"] for r in meanings)


def test_a_pattern_no_book_names_has_no_rows() -> None:
    named = {s for r in ROWS for s in r["pattern_slugs"] + r["inflected_slugs"] + r["suffix_slugs"]}
    patterns = client.get("/api/v1/patterns").json()
    patterns = patterns["data"] if isinstance(patterns, dict) else patterns
    unnamed = next(p["slug"] for p in patterns if p["slug"] not in named)
    assert classical(unnamed) == {"rows": [], "sources": []}
