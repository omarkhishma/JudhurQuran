"""al-Muyassar fi Gharib al-Qur'an (KFGQPC), PLAN P3.1: parsing the Complex's Word file and aligning each entry
to our word locations.

The unit tests need no data. The data tests read the pinned Word file (data/raw/lexica/kfgqpc-muyassar-gharib)
and a dataset build (data/build/2026.10.0); they skip, with that reason, where either is absent, and fail
instead when JADHR_REQUIRE_DATA=1. Facts asserted here were read in the Word file and the mushaf by hand: the
entries of 1:1, 2:2, 5:14, 5:101, 16:67, 30:49, 42:1–2, 53:19–20 and 73:18.
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

import pytest
import yaml
from jadhr_pipeline.meanings import STATUS, build_gharib
from jadhr_pipeline.meanings.docx import paragraphs
from jadhr_pipeline.meanings.gharib import Aligner, Item, ParseError, VerseTokens, _ayahs, _entries, parse

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("JADHR_RAW_DIR", REPO / "data" / "raw"))
BUILD = Path(os.environ.get("JADHR_BUILD_DIR", RAW.parent / "build" / "2026.10.0"))
REGISTRY = REPO / "data" / "gharib.yaml"
WORK = "kfgqpc-muyassar-gharib"
OB, CB = chr(0xFD3F), chr(0xFD3E)  # ﴿ ﴾


def N(x: Any) -> Any:
    """NFC throughout: typed Arabic literals are compared in canonical mark order (DECISIONS lesson)."""
    if isinstance(x, str):
        return unicodedata.normalize("NFC", x)
    if isinstance(x, (list, tuple)):
        return type(x)(N(v) for v in x)
    return x


# --- unit: parsing ----------------------------------------------------------------------------------
def test_entries_on_a_line() -> None:
    # two entries typed on one line are cut at the second bracketed phrase followed by a colon
    line = f"{OB}مِيثَٰقَهُمۡ{CB}: العهدَ المؤكَّدَ على طاعتي {OB}فَأَغۡرَيۡنَا{CB}: فأَلْقَيْنا."
    got = [(p, m, n) for _, p, m, n in _entries(line)]
    assert N(got) == N(
        [
            ("مِيثَٰقَهُمۡ", "العهدَ المؤكَّدَ على طاعتي", []),
            ("فَأَغۡرَيۡنَا", "فأَلْقَيْنا.", ["entry-on-same-line"]),
        ]
    )
    # a bracketed word right after a colon explains the same entry and stays in it
    line = f"{OB}ٱلسَّمَآءُ مُنفَطِرُۢ بِهِۦ{CB}: السَّماءُ مُتَصَدِّعَةٌ. وقيل: {OB}بِهِۦ{CB}: أي: باللهِ."
    (only,) = _entries(line)
    assert N(only[2]) == N(f"السَّماءُ مُتَصَدِّعَةٌ. وقيل: {OB}بِهِۦ{CB}: أي: باللهِ.")
    # a cited verse inside a meaning is not followed by a colon: it stays
    line = f"{OB}هَٰذَا{CB}: ما ذُكِرَ مِن قولِه تعالى: {OB}قَدۡ أَفۡلَحَ مَن تَزَكَّىٰ{CB} إِلى تَمامِ أَرْبَعِ آياتٍ."
    assert len(_entries(line)) == 1
    # no colon after the phrase: the meaning starts after the bracket, and says so
    (e,) = _entries(f"{OB}أَذٗى{CB} التطاولَ على المُعْطَى.")
    assert N(e[2:]) == N(("التطاولَ على المُعْطَى.", ["no-colon-after-phrase"]))


def test_verse_labels() -> None:
    assert _ayahs("2") == [2]
    assert _ayahs("1، 2") == [1, 2]
    assert _ayahs("20،19") == [19, 20]  # typed right to left


SURAHS = [{"number": 1, "name_ar": "الفاتحة"}, {"number": 2, "name_ar": "البقرة"}]


def test_parse_rules_and_counters() -> None:
    paras = [
        "سورة الفاتحة",
        f"(1) {OB}بِسۡمِ ٱللَّهِ{CB}: أبتدِئُ القراءةَ. \n{OB}ٱلرَّحۡمَٰنِ{CB}: ذي الرَّحمةِ.",
        "",
        "سورة البقرة",
        f"(67) {OB}سَكَرٗا{CB}: خَمْراً ",
        f"(وهذا امتنانٌ قبلَ التحريمِ) . \n{OB}وَرِزۡقًا حَسَنًا{CB}: كالتَّمْرِ.",
    ]
    counters: Counter[str] = Counter()
    items = parse(paras, SURAHS, counters)
    assert N([(i.surah, i.ayahs, i.phrase, i.meaning) for i in items]) == N(
        [
            (1, [1], "بِسۡمِ ٱللَّهِ", "أبتدِئُ القراءةَ."),
            (1, [1], "ٱلرَّحۡمَٰنِ", "ذي الرَّحمةِ."),
            (2, [67], "سَكَرٗا", "خَمْراً (وهذا امتنانٌ قبلَ التحريمِ) ."),
            (2, [67], "وَرِزۡقًا حَسَنًا", "كالتَّمْرِ."),
        ]
    )
    assert (items[2].paragraph, items[2].line, items[2].notes) == (4, 0, ["continuation-paragraph"])
    assert (items[3].paragraph, items[3].line) == (5, 1)
    assert counters == Counter(
        {
            "surah-heading": 2,
            "verse-number": 2,
            "phrase-brackets": 4,
            "continuation-paragraph": 1,
            "empty-paragraph": 1,
        }
    )


def test_parse_refuses_what_it_cannot_place() -> None:
    with pytest.raises(ParseError, match="not sūra 1"):
        parse(["سورة البقرة"], SURAHS, Counter())
    with pytest.raises(ParseError, match="before the first sūra"):
        parse([f"(1) {OB}x{CB}: y"], SURAHS, Counter())
    with pytest.raises(ParseError, match="sūra headings"):
        parse(["سورة الفاتحة", f"(1) {OB}بِسۡمِ{CB}: x"], SURAHS, Counter())


# --- unit: alignment --------------------------------------------------------------------------------
VERSES = [
    {"id": 1, "surah": 2, "ayah": 1, "key": "2:1", "page": 2},
    {"id": 2, "surah": 2, "ayah": 2, "key": "2:2", "page": 2},
    {"id": 3, "surah": 2, "ayah": 3, "key": "2:3", "page": 2},
]
TOKENS = [
    # 2:2 ذَٰلِكَ ٱلۡكِتَٰبُ لَا رَيۡبَۛ فِيهِۛ — with the pause marks of our display text
    *(
        {"verse_id": 2, "position": i, "text": t, "word_from": i, "word_to": i}
        for i, t in enumerate(["ذَٰلِكَ", "ٱلۡكِتَٰبُ", "لَا", "رَيۡبَۛ", "فِيهِۛ"], 1)
    ),
    # 2:3 أَوَلَمۡ يَرَوۡاْ وَٱلۡفُرۡقَانَ تُبۡدَ لَكُمۡ تُبۡدَ لَكُمۡ
    *(
        {"verse_id": 3, "position": i, "text": t, "word_from": i, "word_to": i}
        for i, t in enumerate(["أَوَلَمۡ", "يَرَوۡاْ", "وَٱلۡفُرۡقَانَ", "تُبۡدَ", "لَكُمۡ", "تُبۡدَ", "لَكُمۡ"], 1)
    ),
]


def _place(phrase: str, ayah: int, meaning: str = "x", al: Aligner | None = None) -> tuple[Any, Aligner]:
    al = al or Aligner(VerseTokens(VERSES, TOKENS))
    return al.place(Item(1, 2, [ayah], str(ayah), phrase, meaning, 0, 0)), al


def test_alignment_tiers() -> None:
    p, _ = _place("لَا رَيۡبَ فِيهِ", 2)  # pause marks aside, an exact match
    assert (p.locations, p.method, p.confidence) == (["2:2:3", "2:2:4", "2:2:5"], "exact", "exact")
    p, _ = _place("ٱلۡفُرۡقَانَ", 3)  # the verse word carries a conjunction the phrase leaves out
    assert (p.locations, p.method, p.confidence) == (["2:3:3"], "clitic", "high")
    p, _ = _place("أَوَ لَمۡ يَرَوۡاْ", 3)  # split differently
    assert (p.locations, p.method) == (["2:3:1", "2:3:2"], "spacing")
    p, _ = _place("ٱلۡكِتَٰبُ", 3)  # filed one verse late: found in 2:2, kept with the filed verse
    assert (p.locations, p.rekeyed_from, p.confidence) == (["2:2:2"], "2:3", "medium")
    p, _ = _place("غَيۡرِ", 2)
    assert (p.locations, p.method, p.notes) == ([], None, ["unaligned"])


def test_alignment_order_and_named_occurrence() -> None:
    # two entries for a phrase that occurs twice: the second takes the place after the first
    p1, al = _place("تُبۡدَ لَكُمۡ", 3)
    p2, _ = _place("تُبۡدَ لَكُمۡ", 3, al=al)
    assert (p1.locations, p2.locations) == (["2:3:4", "2:3:5"], ["2:3:6", "2:3:7"])
    assert p2.confidence == "medium" and "several-places-in-verse:order-chosen" in p2.notes
    # «(الثانية)» at the start of the meaning names the occurrence: the text decides
    p, _ = _place("تُبۡدَ لَكُمۡ", 3, meaning="(الثانية) : تَظْهَرْ لكم.")
    assert (p.locations, p.confidence, p.notes) == (
        ["2:3:6", "2:3:7"],
        "exact",
        ["several-places-in-verse:named-in-meaning"],
    )


# --- data -------------------------------------------------------------------------------------------
def _need_data() -> None:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    missing = [f["path"] for w in reg["works"] for f in w["files"] if not (RAW / f["path"]).exists()]
    missing += [
        str(BUILD / f) for f in ("verses.jsonl", "tokens.jsonl", "words.jsonl") if not (BUILD / f).exists()
    ]
    if missing:
        msg = f"gharib source or dataset build not available: {missing[:3]}"
        if os.environ.get("JADHR_REQUIRE_DATA") == "1":
            pytest.fail(msg)
        pytest.skip(msg)


@pytest.fixture(scope="module")
def built() -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    _need_data()
    return build_gharib(RAW, BUILD, REGISTRY)


def _rows(built: Any) -> list[dict[str, Any]]:
    return built[0]["gharib_meanings"]


def _at(built: Any, key: str) -> list[dict[str, Any]]:
    return [r for r in _rows(built) if key in r["verse_keys"] or f"{r['surah']}:{r['ayah_label']}" == key]


def test_counts_and_coverage(built) -> None:
    """The figures of the build report (and of the P3.1 handover), recomputed from the rows."""
    _, report = built
    rows = _rows(built)
    rep = report["works"][WORK]
    assert (len(rows), rep["entries"], rep["aligned"], rep["unaligned"]) == (11384, 11384, 11384, 0)
    assert Counter(r["match_method"] for r in rows) == {
        "exact": 10672,
        "letters": 624,
        "clitic": 76,
        "spacing": 11,
        "skeleton": 1,
    }
    assert Counter(r["match_confidence"] for r in rows) == {"exact": 10603, "high": 706, "medium": 75}
    assert rep["rules_applied"] == {
        "continuation-paragraph": 8,
        "empty-paragraph": 114,
        "entries-on-one-line": 12,
        "phrase-brackets": 11384,
        "phrase-brackets:no-colon": 14,
        "surah-heading": 114,
        "verse-number": 5089,
        "verse-number:two-verses": 2,
    }
    assert [x["filed"] for x in rep["rekeyed"]] == ["30:49"]
    with (BUILD / "words.jsonl").open(encoding="utf-8") as fh:
        words = [json.loads(line) for line in fh]
    covered = {loc for r in rows for loc in r["word_locations"]}
    assert len(words) == 77429 and len(covered) == 18108
    assert rep["coverage"]["word_occurrences"] == {"total": 77429, "covered": 18108, "pct": 23.39}
    content = [w for w in words if w["pos"] in ("N", "V", "ADJ", "PN")]
    assert sum(1 for w in content if w["location"] in covered) == 14306
    assert rep["coverage"]["content_word_occurrences"] == {"total": 50363, "covered": 14306, "pct": 28.41}
    assert rep["coverage"]["verses_with_a_meaning"] == {"total": 6236, "covered": 5091}


def test_hand_checked_entries(built) -> None:
    al_fatiha = _at(built, "1:1")
    assert N([(r["phrase_ar"], r["word_locations"], r["meaning_ar"]) for r in al_fatiha]) == N(
        [
            ("بِسۡمِ ٱللَّهِ", ["1:1:1", "1:1:2"], "أبتدِئُ القراءةَ مُسْتعيناً باللهِ."),
            ("ٱلرَّحۡمَٰنِ", ["1:1:3"], "ذي الرَّحمةِ العامَّةِ لجميع الخَلْقِ."),
            ("ٱلرَّحِيمِ", ["1:1:4"], "ذي الرَّحمةِ الخاصَّةِ بِالمؤمنين."),
        ]
    )
    assert al_fatiha[0]["locator"] == "MuyassarGhareeb.docx ¶2 l.1" and al_fatiha[0]["mushaf_page"] == 1
    # 2:2 — the file has no pause marks, our text does: still exact
    r = next(r for r in _at(built, "2:2") if N(r["phrase_ar"]) == N("لَا رَيۡبَ فِيهِ"))
    assert (r["word_locations"], r["match_method"]) == (["2:2:3", "2:2:4", "2:2:5"], "exact")
    # 5:14 — two entries typed on one line
    m = [r for r in _at(built, "5:14") if r["paragraph"] == 622 and r["line"] == 1]
    assert N([(r["phrase_ar"], r["meaning_ar"], r["word_locations"]) for r in m]) == N(
        [
            ("مِيثَٰقَهُمۡ", "العهدَ المؤكَّدَ على طاعتي", ["5:14:7"]),
            ("فَأَغۡرَيۡنَا", "فأَلْقَيْنا.", ["5:14:13"]),
        ]
    )
    # 5:101 — «(الثانية)»: the second «تُبۡدَ لَكُمۡ» of the verse, words 18–19
    r = next(r for r in _at(built, "5:101") if N(r["phrase_ar"]) == N("تُبۡدَ لَكُمۡ"))
    assert (r["word_locations"], r["match_confidence"]) == (["5:101:18", "5:101:19"], "exact")
    # 16:67 — the note the typist put in a paragraph of its own belongs to «سَكَرٗا»
    r = next(r for r in _at(built, "16:67") if N(r["phrase_ar"]) == N("سَكَرٗا"))
    assert (
        N(r["meaning_ar"]) == N("خَمْراً (وهذا امتنانٌ قبلَ التحريمِ) .") and "continuation-paragraph" in r["notes"]
    )
    # 30:49 — «بَعۡدَ مَوۡتِهَآ» is filed under 49 but stands in 50
    r = next(r for r in _rows(built) if r["rekeyed_from"])
    assert N((r["phrase_ar"], r["verse_keys"], r["word_locations"], r["match_confidence"])) == N(
        (
            "بَعۡدَ مَوۡتِهَآ",
            ["30:50"],
            ["30:50:9", "30:50:10"],
            "medium",
        )
    )
    # 42:1–2 «(1، 2)» and 53:19–20 «(20،19)» with ۞ between the two verses' words
    r = _at(built, "42:1")[0]
    assert (r["ayah_label"], r["verse_keys"], r["word_locations"]) == (
        "1، 2",
        ["42:1", "42:2"],
        ["42:1:1", "42:2:1"],
    )
    r = _at(built, "53:20")[0]
    assert (r["ayah_label"], r["word_locations"]) == ("20،19", ["53:19:2", "53:19:3", "53:20:1"])
    # 73:18 — «وقيل: ﴿بِهِۦ﴾: أي: باللهِ» stays in the entry it explains
    r = _at(built, "73:18")[0]
    assert N(r["phrase_ar"]) == N("ٱلسَّمَآءُ مُنفَطِرُۢ بِهِۦ")
    assert N(f"وقيل: {OB}بِهِۦ{CB}: أي: باللهِ") in N(r["meaning_ar"])


def test_rows_are_verbatim_and_point_into_the_quran(built) -> None:
    """Every phrase and meaning is the Word file's text (whitespace aside); every location is a Quran word; the
    words of an exact match are the phrase itself, pause marks aside; nothing is reviewed."""
    tables, _ = built
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    path = RAW / reg["works"][0]["files"][0]["path"]
    paras = paragraphs(path)
    flat = re.sub(r"\s+", " ", " ".join(paras))
    with (BUILD / "words.jsonl").open(encoding="utf-8") as fh:
        locations = {json.loads(line)["location"] for line in fh}
    for r in tables["gharib_meanings"]:
        assert r["status"] == STATUS and r["work_id"] == WORK
        assert re.sub(r"\s+", " ", r["meaning_ar"]) in flat, r["id"]
        assert OB + r["phrase_ar"] + CB in paras[r["paragraph"] - 1].split("\n")[r["line"] - 1], r["id"]
        assert set(r["word_locations"]) <= locations, r["id"]
        assert all(loc.rsplit(":", 1)[0] in r["verse_keys"] for loc in r["word_locations"])
    ids = [r["id"] for r in tables["gharib_meanings"]]
    assert len(ids) == len(set(ids))
    (work,) = tables["gharib_works"]
    assert work["id"] == WORK and work["redistributable"] is False and work["display_only"] is True


def test_registry_pins_and_licence() -> None:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    rule_ids = [r["id"] for r in reg["cleaning_rules"]]
    assert len(rule_ids) == len(set(rule_ids))
    lic = {
        e["id"]: e
        for e in yaml.safe_load((REPO / "data/licences.yaml").read_text(encoding="utf-8"))["licences"]
    }
    for w in reg["works"]:
        for f in w["files"]:
            assert re.fullmatch(r"[0-9a-f]{64}", f["sha256"])
        assert w["redistributable"] is False and w["display_only"] is True
        assert w["licence_clause"] in [c["quote"] for c in lic[w["id"]]["clauses"]]
        for k in ("attribution_ar", "attribution_en", "title_ar", "title_en", "publisher_ar", "publisher_en"):
            assert w[k] and unicodedata.is_normalized("NFC", w[k]), (w["id"], k)
