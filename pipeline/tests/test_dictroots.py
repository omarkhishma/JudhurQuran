"""The dictionary's roots (P11.1): each heading reaches a root by what the lexica write and attest, never a guess;
what the evidence cannot settle stays as written with its candidates; every Quranic root is in the dictionary."""

from __future__ import annotations

import json

from jadhr_pipeline.lexica.dictroots import build_dict_roots, heads_of, resolve
from jadhr_pipeline.release import REPO

ATTESTED = {"ردد", "سمو", "ءسل", "سير", "سور", "قبعثر", "عقق", "قعع", "رضو"}


def test_each_rule_on_its_own_heading() -> None:
    assert resolve("علم", ATTESTED).rule == "as-written" and resolve("علم", ATTESTED).roots == ["علم"]
    assert resolve("رد", ATTESTED).roots == ["ردد"] and resolve("رد", ATTESTED).rule == "two-letter-doubled"
    assert resolve("سما", ATTESTED).roots == ["سمو"] and resolve("سما", ATTESTED).rule == "alif-weak"
    assert resolve("اسل", ATTESTED).roots == ["ءسل"] and resolve("اسل", ATTESTED).rule == "alif-hamza"
    assert resolve("قبعثر", ATTESTED).rule == "as-written"
    # the evidence points two ways: kept as written, both named
    sar = resolve("سار", ATTESTED)
    assert sar.rule == "ambiguous" and sar.roots == ["سار"] and set(sar.candidates) == {"سير", "سور"}
    # a medial alif may be a hamza: the hamza reading is one of the candidates when it is attested
    assert set(resolve("سار", ATTESTED | {"سءر"}).candidates) == {"سير", "سور", "سءر"}
    assert resolve("راس", {"رءس"}).roots == ["رءس"] and resolve("راس", {"رءس"}).rule == "alif-hamza"
    # nothing attests it: kept as written, never made up
    assert resolve("غظ", ATTESTED).rule == "unresolved" and resolve("غظ", ATTESTED).roots == ["غظ"]
    assert resolve("رضا", ATTESTED).roots == ["رضو"]
    # letters, function words and phrases are headings, not roots
    for h in ("ذ", "لا", "في", "الهبعة", "عبدالله"):
        assert resolve(h, ATTESTED).rule == "heading" and resolve(h, ATTESTED).roots == [], h


def test_headings_are_read_as_printed() -> None:
    assert heads_of("[وعد]", None) == ["وعد"]
    assert heads_of("ز ر ن ك", None) == ["زرنك"]
    assert heads_of("عق، قع", None) == ["عق", "قع"]
    assert heads_of("عفنقس، وعقنفس", None) == ["عفنقس", "عقنفس"]
    assert heads_of("ignored", ["سمو"]) == ["سمو"]  # the parser's heading wins (al-Qāmūs's Tāj root)


def test_a_combined_heading_links_each_root_and_quranic_roots_are_all_there() -> None:
    entries = [
        {"id": 1, "work_id": "ayn", "headword": "عق، قع", "displayable": False, "root_key": None},
        {"id": 2, "work_id": "lisan", "headword": "عقق", "displayable": False, "root_key": None},
        {"id": 3, "work_id": "lisan", "headword": "قعع", "displayable": False, "root_key": None},
        {"id": 4, "work_id": "lisan", "headword": "زلل", "displayable": True, "root_key": "زلل"},
        {"id": 5, "work_id": "taj", "headword": "سَمَا", "displayable": False, "root_key": None},
    ]
    quran = [{"key": "زلل"}, {"key": "زلزل"}, {"key": "سمو"}]
    rows, report = build_dict_roots(entries, quran, ["ayn", "lisan", "taj"])
    assert entries[0]["dict_roots"] == ["عقق", "قعع"] and entries[0]["dict_rule"] == "two-letter-doubled"
    by = {r["key"]: r for r in rows}
    assert by["عقق"]["lexica"] == ["ayn", "lisan"] and by["عقق"]["quran_root"] is None
    assert (
        entries[4]["dict_roots"] == ["سمو"]
        and by["سمو"]["quran_root"] == "سمو"
        and by["سمو"]["display"] == "سمو"
    )
    # every Quranic root has its row: one no lexicon files on its own letters points to where they do
    assert by["زلزل"]["articles"] == 0 and by["زلزل"]["filed_under"] == "زلل"
    assert report["quranic"] == 3


def test_the_dictionary_on_the_build() -> None:
    build = REPO / "data/build/2026.10.0"
    roots = [
        json.loads(line) for line in (build / "dict_roots.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    quran = [json.loads(line) for line in (build / "roots.jsonl").read_text(encoding="utf-8").splitlines()]
    report = json.loads((build / "report.json").read_text(encoding="utf-8"))["dictionary"]
    # every Quranic root, and thousands beyond the Quran
    assert {r["quran_root"] for r in roots if r["quran_root"]} == {q["key"] for q in quran}
    outside = sum(1 for r in roots if not r["quran_root"])
    assert outside > 10_000 and report["outside_the_quran"] == outside
    keys = [r["key"] for r in roots]
    assert len(keys) == len(set(keys)) and all(2 <= r["letters"] <= 5 for r in roots)
    # every article reached a root, or is a heading said to be one, or waits for review as written
    rules = report["articles_by_rule"]
    entries = sum(1 for _ in (build / "lexicon_entries.jsonl").open(encoding="utf-8"))
    assert sum(rules.values()) == entries
    assert rules["heading"] < 0.01 * entries and rules["ambiguous"] + rules["unresolved"] < 0.02 * entries
    by = {r["key"]: r for r in roots}
    assert len(by["علم"]["lexica"]) == 9 and by["زلزل"]["filed_under"] == "زلل"
