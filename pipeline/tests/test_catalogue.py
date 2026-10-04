"""The catalogue (P11.3a): the D9 gate over OpenITI's primary-version metadata, recounted here from the file by a
reading of its own; every shelf book found in it; names and titles as the metadata gives them, without its
«(المتوفى…)»; the poets before Islam said so, never dated."""

from __future__ import annotations

from functools import cache
from itertools import pairwise
from typing import Any

import yaml
from jadhr_pipeline.ecosystem.catalogue import build_catalogue, era_year
from jadhr_pipeline.release import REPO

RAW = REPO / "data/raw"
REG = yaml.safe_load((REPO / "data/books.yaml").read_text(encoding="utf-8"))


@cache
def _built() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return build_catalogue(RAW / REG["catalogue"], {b["version"]: b["slug"] for b in REG["books"]})


def test_the_gate_lets_in_the_works_of_authors_dead_by_1374_without_uncorrected_ocr() -> None:
    lines = (RAW / REG["catalogue"]).read_text(encoding="utf-8").splitlines()
    head = lines[0].split("\t")
    col = {k: head.index(k) for k in ("version_uri", "language", "subcorpus", "uncorrected_OCR", "date")}
    expected = set()
    for line in lines[1:]:
        f = line.split("\t")
        arabic = f[col["language"]] == "ara" and f[col["subcorpus"]] == "ara"
        if arabic and f[col["uncorrected_OCR"]] == "False" and float(f[col["date"]]) <= 1374:
            expected.add(f[col["version_uri"]])
    rows, report = _built()
    assert {w["version"] for w in rows} == expected and report["in"] == len(expected)
    assert report["in"] + sum(report["kept_out"].values()) == report["arabic_works"]
    assert [w["id"] for w in rows] == list(range(1, len(rows) + 1))
    assert all(a["death_ah"] <= b["death_ah"] for a, b in pairwise(rows))


def test_every_shelf_book_is_in_the_catalogue_with_its_slug() -> None:
    rows, report = _built()
    shelf = {w["version"]: w["shelf"] for w in rows if w["shelf"]}
    assert shelf == {b["version"]: b["slug"] for b in REG["books"]} and report["on_the_shelf"] == len(
        REG["books"]
    )


def test_names_and_dates_as_the_metadata_gives_them() -> None:
    rows, _ = _built()
    assert all(w["title_ar"] and w["author_ar"] and "المتوفى" not in w["author_ar"] for w in rows)
    assert all("::" not in w["title_ar"] for w in rows)
    poets = [w for w in rows if w["before_islam"]]
    assert poets and all(w["death_ah"] == 1 and w["era_year"] is None for w in poets)
    tabari = next(w for w in rows if w["work"] == "0310Tabari.JamicBayan")
    assert tabari["era_year"] == era_year(310) == 922 and tabari["shamela_id"] == 7798
    assert all((w["shamela_id"] is not None) == w["library_id"].startswith("Shamela0") for w in rows)
    assert next(w for w in rows if w["library_id"] == "Shamela0007528BK2")["shamela_id"] == 7528
