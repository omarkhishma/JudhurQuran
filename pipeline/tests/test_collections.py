"""Curated sets (PLAN P5.2, COL-Q03): every item answers its set's rule, the words the copy names are there,
and the copy's computed numbers are computed — checked against the build, never typed in."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
import yaml
from jadhr_pipeline.collections import CONTENT_POS, build_collections

REPO = Path(__file__).resolve().parents[2]
BUILD = Path(os.environ.get("JADHR_BUILD_DIR", REPO / "data" / "build" / "2026.10.0"))
REGISTRY = REPO / "data" / "collections.yaml"


def _jsonl(name: str) -> list[dict]:
    with (BUILD / name).open(encoding="utf-8") as fh:
        return [json.loads(x) for x in fh]


@pytest.mark.skipif(not (BUILD / "lemmas.jsonl").exists(), reason="no built dataset")
def test_every_item_answers_its_rule_and_the_copy_names_only_what_is_there() -> None:
    tables, report = build_collections(BUILD, REGISTRY)
    reg = {c["id"]: c for c in yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))["collections"]}
    lemmas = {x["id"]: x for x in _jsonl("lemmas.jsonl")}
    roots = {r["id"]: r["key"] for r in _jsonl("roots.jsonl")}
    patterns = {p["id"]: p["slug"] for p in _jsonl("patterns.jsonl")}
    # whole-word claims only (scope "lemma"): a claim about one place or form is not a claim about the word
    loans = {
        x["lemma_id"]
        for x in _jsonl("loanword_links.jsonl")
        if x["kind"] == "lemma" and x["scope"] == "lemma"
    }
    by_set: dict[str, list[dict]] = {}
    for it in tables["collection_items"]:
        by_set.setdefault(it["collection_id"], []).append(lemmas[it["lemma_id"]])
    assert set(by_set) == set(reg) and report["collections"] == len(reg)
    content = lambda x: x["root_id"] is not None or x["pos"] in CONTENT_POS  # noqa: E731
    for sid, items in by_set.items():
        rule = reg[sid]["rule"]
        for x in items:
            if "root" in rule:
                assert roots[x["root_id"]] in rule["root"]
            elif "patterns" in rule:
                assert patterns[x["pattern_id"]] in rule["patterns"]
                assert not rule.get("derivation") or x["derivation"] == rule["derivation"]
                assert not rule.get("pos") or x["pos"] in rule["pos"]
            elif rule.get("frequent"):
                assert content(x)
            elif rule.get("function_words"):
                assert not content(x) and x["root_id"] is None  # particles get no root (law L3)
            elif rule.get("loanwords"):
                assert x["id"] in loans
        assert {m for m in reg[sid].get("mentions", [])} <= {x["slug"] for x in items}
        assert not set(reg[sid].get("exclude", [])) & {x["slug"] for x in items}
        # most frequent first
        assert [x["occurrences"] for x in items] == sorted((x["occurrences"] for x in items), reverse=True)
    # the ع ل م set is the whole family
    ilm_root = next(k for k, v in roots.items() if v == "علم")
    assert len(by_set["ilm"]) == sum(1 for x in lemmas.values() if x["root_id"] == ilm_root)


@pytest.mark.skipif(not (BUILD / "lemmas.jsonl").exists(), reason="no built dataset")
def test_coverage_is_the_share_of_the_qurans_words() -> None:
    tables, _ = build_collections(BUILD, REGISTRY)
    words = _jsonl("words.jsonl")
    for s in tables["collections"]:
        ids = {i["lemma_id"] for i in tables["collection_items"] if i["collection_id"] == s["id"]}
        n = sum(1 for w in words if w["lemma_id"] in ids)
        assert s["occurrences"] == n and s["coverage"] == round(n / len(words), 4), s["id"]


def test_a_copy_that_names_a_word_its_rule_does_not_yield_fails_the_build(tmp_path: Path) -> None:
    if not (BUILD / "lemmas.jsonl").exists():
        pytest.skip("no built dataset")
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    reg["collections"] = [{**reg["collections"][1], "mentions": ["ilm"]}]  # doers naming a word not on فاعل
    bad = tmp_path / "collections.yaml"
    bad.write_text(yaml.safe_dump(reg, allow_unicode=True), encoding="utf-8")
    with pytest.raises(ValueError, match="names"):
        build_collections(BUILD, bad)
