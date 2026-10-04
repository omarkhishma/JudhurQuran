"""Topics (P8.3, research 06 Part 3, D29): Quranpedia's tree read whole from its pinned dump and agreeing with its
per-verse file; QSAC's tags read without its verse text or translation; coverage per sūra; names kept as the source
spells them. Counts were measured on the dump of 2026-10-03 and match research 06."""

from __future__ import annotations

import os
import unicodedata
from pathlib import Path
from typing import Any

import pytest
import yaml
from jadhr_pipeline.topics import TopicsError, build_topics

REPO = Path(__file__).resolve().parents[2]
RAW = REPO / "data/raw"
BUILD = REPO / "data/build/2026.10.0"
REGISTRY = REPO / "data/topics.yaml"


@pytest.fixture(scope="module")
def built() -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    missing = [
        f["path"] for s in reg["sources"] for f in s["files"].values() if not (RAW / f["path"]).exists()
    ]
    if missing or not (BUILD / "verses.jsonl").exists():
        msg = f"topic sources or dataset build not available: {missing[:2]}"
        if os.environ.get("JADHR_REQUIRE_DATA") == "1":
            pytest.fail(msg)
        pytest.skip(msg)
    return build_topics(RAW, BUILD, REGISTRY)


def test_quranpedia_whole_and_agreeing_with_its_per_verse_file(built) -> None:
    tables, report = built
    qp = report["sources"]["quranpedia-topics"]
    assert (qp["topics"], qp["links"], qp["levels"]) == (6100, 19117, {0: 1516, 1: 4482, 2: 93, 3: 9})
    assert qp["per_verse_file"] == {"verses": 3673, "links": 19117, "not_in_index": 0, "index_not_in_file": 0}
    assert (qp["keys_dropped"], qp["parents_missing"]) == (0, 0)
    cov = qp["coverage"]
    assert (cov["verses"], cov["surahs_1_39"], cov["surahs_40_114"], cov["surahs_without"]) == (
        3673,
        "3669/4133",
        "4/2103",
        71,
    )
    topics = {t["id"]: t for t in tables["topics"]}
    # names as the source spells them: the stray mark in «الَّريش» kept and counted
    nfc = lambda x: unicodedata.normalize("NFC", x)  # noqa: E731  (a typed mark's order is not the file's)
    assert nfc(topics["qp:2951"]["name_ar"]) == nfc("الَّريش") and qp["names_with_stray_marks"] >= 1
    links = [x for x in tables["topic_links"] if x["source_id"] == "quranpedia-topics"]
    assert all(x["version"] == "2026-10-03" and x["id"] == f"{x['topic_id']}@{x['verse_key']}" for x in links)
    assert topics["qp:3"]["name_ar"] == "الرحيم" and topics["qp:3"]["parent_id"] == "qp:1"


def test_qsac_tags_without_its_text(built) -> None:
    tables, report = built
    q = report["sources"]["qsac"]
    assert (q["topics"], q["levels"], q["tags_used"], q["unknown"]) == (426, {0: 18, 1: 70, 2: 338}, 323, {})
    assert q["coverage"]["verses"] == 6236
    rows = [t for t in tables["topics"] if t["source_id"] == "qsac"]
    assert all(t["name_ar"] is None and t["name_en"] for t in rows)
    # the file's verse text and translation never reach a table (L1)
    for x in tables["topic_links"]:
        assert set(x) == {"id", "topic_id", "verse_key", "source_id", "version"}
    src = {s["id"]: s for s in tables["topic_sources"]}
    assert src["qsac"]["shown"] is False and src["quranpedia-topics"]["shown"] is True


def test_a_file_that_differs_is_refused(tmp_path: Path) -> None:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    reg["sources"][0]["files"]["index"]["sha256"] = "0" * 64
    bad = tmp_path / "topics.yaml"
    bad.write_text(yaml.safe_dump(reg, allow_unicode=True), encoding="utf-8")
    if not (RAW / reg["sources"][0]["files"]["index"]["path"]).exists():
        pytest.skip("topic dump not available")
    with pytest.raises(TopicsError):
        build_topics(RAW, BUILD, bad)
