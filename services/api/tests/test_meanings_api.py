"""Meanings through the API (P3.1): al-Muyassar per word occurrence and al-Mufradāt per lemma, verbatim from
the build, with their credit. Expectations come from the build and other endpoints, never typed in."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jadhr_api.main import app

REPO = Path(__file__).resolve().parents[3]
BUILD = REPO / "data/build/2026.10.0"

if not (BUILD / "gharib_meanings.jsonl").exists():
    if os.environ.get("JADHR_REQUIRE_DATA"):
        raise RuntimeError(f"meaning layers missing from {BUILD} (run `uv run jadhr-pipeline build`)")
    pytest.skip("meaning layers not built", allow_module_level=True)

client = TestClient(app)


def jsonl(name: str) -> list[dict]:
    with (BUILD / f"{name}.jsonl").open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


MEANINGS = jsonl("gharib_meanings")
SUBS = jsonl("mufradat_subentries")
SENSES = jsonl("mufradat_senses")


@pytest.mark.parametrize("i", [0, 500, 5000, 11000])
def test_a_word_carries_al_muyassar_for_its_place_verbatim(i: int) -> None:
    m = MEANINGS[i]
    loc = m["word_locations"][0]
    slug = get(f"/api/v1/locations/{loc}/word")["slug"]
    occ = get(f"/api/v1/words/{slug}", at=loc, limit=0)["occurrence"]
    expected = [x for x in MEANINGS if loc in x["word_locations"]]
    assert [x["id"] for x in occ["meanings_here"]] == [
        x["id"] for x in sorted(expected, key=lambda x: x["seq"])
    ]
    got = next(x for x in occ["meanings_here"] if x["id"] == m["id"])
    assert got["meaning_ar"] == m["meaning_ar"] and got["phrase_ar"] == m["phrase_ar"]
    assert got["display_only"] is True and got["attribution_ar"] and got["status"] == "extracted"


def test_al_mufradat_gives_its_sub_entries_and_numbered_senses_for_a_lemma() -> None:
    lemmas = {x["key"]: x for x in jsonl("lemmas")}
    with_senses = {s["subentry_id"] for s in SENSES}
    sub = next(
        s
        for s in SUBS
        if s["lemma_key"] and s["id"] in with_senses and lemmas.get(s["lemma_key"], {}).get("slug")
    )
    key = sub["lemma_key"]
    w = get(f"/api/v1/words/{lemmas[key]['slug']}", limit=0)
    m = w["mufradat"]
    expected = [s for s in SUBS if s["lemma_key"] == key or key in s["lemma_keys"]]
    assert [s["id"] for s in m["subentries"]] == [
        s["id"] for s in sorted(expected, key=lambda s: (s["entry_id"], s["seq"]))
    ]
    got = next(s for s in m["subentries"] if s["id"] == sub["id"])
    assert got["text_ar"] == sub["text_ar"]
    assert [x["text_ar"] for x in got["senses"]] == [
        x["text_ar"]
        for x in sorted(
            (x for x in SENSES if x["subentry_id"] == sub["id"]),
            key=lambda x: (x["list_no"], x["sense_index"]),
        )
    ]
    assert m["work"]["id"] == "mufradat" and m["work"]["attribution_ar"]


def test_a_lemma_al_mufradat_does_not_treat_has_none() -> None:
    lemmas = jsonl("lemmas")
    mapped = {s["lemma_key"] for s in SUBS} | {k for s in SUBS for k in s["lemma_keys"]}
    lem = next(x for x in lemmas if x["key"] not in mapped and x.get("slug"))
    assert get(f"/api/v1/words/{lem['slug']}", limit=0)["mufradat"] is None
