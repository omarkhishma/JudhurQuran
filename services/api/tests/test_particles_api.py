"""Particle entries through the API (P3.8): linked by lemma or by this occurrence's affix, senses verbatim in
the author's order, with the source's credit. Expectations come from the build and other endpoints."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jadhr_api.main import app

REPO = Path(__file__).resolve().parents[3]
BUILD = REPO / "data/build/2026.10.0"

if not (BUILD / "particle_entries.jsonl").exists():
    if os.environ.get("JADHR_REQUIRE_DATA"):
        raise RuntimeError(f"particle entries missing from {BUILD} (run `uv run jadhr-pipeline build`)")
    pytest.skip("particle entries not built", allow_module_level=True)

client = TestClient(app)


def jsonl(name: str) -> list[dict]:
    with (BUILD / f"{name}.jsonl").open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


ENTRIES = jsonl("particle_entries")
SENSES = jsonl("particle_senses")


def test_fi_is_linked_to_its_entries_by_lemma_and_never_given_a_root() -> None:
    w = get("/api/v1/words/fi", limit=0)
    assert w["root"] is None
    expected = [e["id"] for e in ENTRIES if "fi" in e["lemma_slugs"]]
    got = [p["id"] for p in w["particles"] if p["via"]["kind"] == "lemma"]
    assert sorted(got) == sorted(expected) and expected


def test_an_occurrence_with_the_prefix_wa_reaches_the_waw_entries_through_its_tag() -> None:
    # 2:30:1 is وَإِذْ: resumption wa + the adverb idh
    segs = get("/api/v1/words/idh", at="2:30:1", limit=0)["occurrence"]["segments"]
    tag = next(s["label"]["tag"] for s in segs if s["kind"] == "prefix")
    w = get("/api/v1/words/idh", at="2:30:1", limit=0)
    by_affix = [p for p in w["particles"] if p["via"]["kind"] == "affix"]
    assert {p["id"] for p in by_affix} == {e["id"] for e in ENTRIES if tag in e["affix_tags"]}
    assert all(p["via"]["label"]["tag"] == tag for p in by_affix)
    # without a place in the text, only the lemma links remain
    assert all(p["via"]["kind"] == "lemma" for p in get("/api/v1/words/idh", limit=0)["particles"])


def test_an_entry_returns_every_sense_verbatim_in_order_with_its_source() -> None:
    e = max(ENTRIES, key=lambda x: x["sense_count"])
    got = get(f"/api/v1/particles/{e['id']}")
    expected = sorted((s for s in SENSES if s["entry_id"] == e["id"]), key=lambda s: s["ordinal"])
    assert [s["id"] for s in got["senses"]] == [s["id"] for s in expected]
    assert [s["text_ar"] for s in got["senses"]] == [s["text_ar"] for s in expected]
    assert sum(1 for s in got["senses"] if s["kind"] == "sense") == e["sense_count"]
    assert got["source"]["attribution_ar"] and got["source"]["licence"]
    assert client.get("/api/v1/particles/nope:000").status_code == 404
