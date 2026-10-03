"""Relation seeds (PLAN P8.4, P3.1): cleaning, structure parsing, verse resolution and the built tables.

The unit tests need no data. The data tests read the pinned OpenITI files (data/raw/openiti-relations) and
a dataset build (data/build/2026.10.0); they skip, with that reason, where either is absent, and fail
instead when JADHR_REQUIRE_DATA=1. Facts asserted here were read in the source text by hand: Ibn
al-Jawzī's «باب الخوف» (printed page 279), al-ʿAskarī's three fear entries, al-Dāmaghānī's «ب ر ه ن»,
Ibn al-Anbārī's «القرء».
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

import pytest
import yaml
from jadhr_pipeline.relations import STATUS, TYPES, build_relations, sense_label
from jadhr_pipeline.relations.numerals import COUNT, count_value, ordinal_rx
from jadhr_pipeline.relations.openiti import clean
from jadhr_pipeline.relations.parsers import split_terms

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("JADHR_RAW_DIR", REPO / "data" / "raw"))
BUILD = Path(os.environ.get("JADHR_BUILD_DIR", RAW.parent / "build" / "2026.10.0"))
REGISTRY = REPO / "data" / "relations.yaml"


# --- unit: cleaning ---------------------------------------------------------------------------------
SAMPLE = """######OpenITI#
#META# 020.BookTITLE	:: x
#META#Header#End#

# | ( 115 - باب الخوف )
# أحدها : الخوف نفسه . ومنه قوله تعالى في آل عمران : | @QB@ ويستبشرون
~~بالذين @QE@ ، وفي الأعراف : ^ ( وادعوه خوفا ) ^ . | PageV01P278
# والثاني : ( 52 / أ ) العلم ms068 .
### | CHECK [13-89]
# 8 -

### | AUTO والقرء

#  من الأضداد ، و

### | AUTO الفلذ

# ة: قطعة
"""


def test_clean_rules_and_locators() -> None:
    c = clean(SAMPLE, "x.y.z-ara1")
    assert c.text == (
        "(115 - باب الخوف)\n"
        "أحدها: الخوف نفسه. ومنه قوله تعالى في آل عمران: ويستبشرون بالذين، وفي الأعراف: (وادعوه خوفا).\n"
        "والثاني: العلم.\n"
        "8 - والقرء من الأضداد، والفلذة: قطعة"
    )
    # the quote tags are gone but their spans are kept
    spans = [c.text[s:e].strip() for s, e in c.quote_spans]
    assert "ويستبشرون بالذين" in spans and "(وادعوه خوفا)" in spans
    # the page marker closes page 278: text before it is on 278, text after it on the next page
    assert c.locator(c.text.index("أحدها"))["page"] == 278
    assert c.locator(c.text.index("والثاني"))["page"] == 279
    assert c.locator(c.text.index("والثاني"))["milestone"] == "ms068"
    assert [c.text[a:b] for a, b in c.auto_spans] == ["والقرء", "الفلذ"]
    assert c.stats["folio-marks"] == 1 and c.stats["annotator-lines-dropped"] == 1
    assert c.is_heading(0)


def test_counts_and_ordinals() -> None:
    cases = {
        "على وجهين": 2,
        "على خمسة أوجه": 5,
        "على أربعة عشر وجها": 14,
        "على أحد عشر وجها": 11,
        "على عشرين وجها": 20,
        "على اثني عشر وجها": 12,
    }
    for text, n in cases.items():
        m = COUNT.search(text)
        assert m and count_value(m) == n, text
    assert COUNT.search("على وجه الأرض") is None
    assert ordinal_rx(2).search("… وفيها.\nوالثاني: العلم")
    assert ordinal_rx(2).search("حدود الله، والثاني: العلم")
    assert ordinal_rx(2).search("(والثاني): الصنم")
    assert ordinal_rx(1).search("[أحدها]: الريح")
    assert not ordinal_rx(2).search("الثاني عشر: كذا")  # the twelfth is not the second
    assert ordinal_rx(5, loose=True).search("ونحوه كثيرالخامس الثقل")
    assert not ordinal_rx(5).search("ونحوه كثيرالخامس الثقل")


def test_split_terms_and_label() -> None:
    assert split_terms("الخوف والحذر والخشية والفزع") == ["الخوف", "الحذر", "الخشية", "الفزع"]
    assert split_terms("الجسم والجرم وما يقرب من ذلك") == ["الجسم", "الجرم"]
    assert split_terms("الصفة منه وبين الصفة للسيد") == ["الصفة منه", "الصفة للسيد"]
    t = "والثاني: العلم. ومنه قوله تعالى في البقرة"
    s, e = sense_label(t, "والثاني")
    assert t[s:e] == "العلم"
    t = "فوجه منها الأثقال بمعنى الزاد والمتاع قوله تعالى في سورة النحل"
    s, e = sense_label(t, "فوجه منها")
    assert t[s:e] == "الأثقال بمعنى الزاد والمتاع"


# --- data -------------------------------------------------------------------------------------------
def _need_data() -> None:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    missing = [s["file"] for s in reg["sources"] if not (RAW / s["file"]).exists()]
    missing += [str(BUILD / f) for f in ("verses.jsonl", "lemmas.jsonl") if not (BUILD / f).exists()]
    if missing:
        msg = f"relation sources or dataset build not available: {missing[:3]}"
        if os.environ.get("JADHR_REQUIRE_DATA") == "1":
            pytest.fail(msg)
        pytest.skip(msg)


@pytest.fixture(scope="module")
def built() -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    _need_data()
    return build_relations(RAW, BUILD, REGISTRY)


def _by(rows: list[dict[str, Any]], key: str = "id") -> dict[str, dict[str, Any]]:
    return {r[key]: r for r in rows}


def test_counts_match_the_report(built) -> None:
    """The figures in the build report (and in the P8.4 handover) — recomputed here from the rows."""
    tables, report = built
    ents, cands = tables["relation_entries"], tables["relation_candidates"]
    expected = {
        # source: (entries, rows of its own type, entries mapped to a Quranic root, distinct roots)
        "nuzha": (321, 1659, 295, 268),
        "damghani": (493, 2345, 464, 426),
        "askari-furuq": (939, 920, 714, 350),
        "anbari-addad": (355, 355, 188, 162),
    }
    own = {
        "nuzha": "wujuh_sense",
        "damghani": "wujuh_sense",
        "askari-furuq": "furuq_contrast",
        "anbari-addad": "didd",
    }
    for sid, (n_ent, n_rows, n_mapped, n_roots) in expected.items():
        e = [x for x in ents if x["source_id"] == sid]
        r = [x for x in cands if x["source_id"] == sid and x["type"] == own[sid]]
        got = (
            len(e),
            len(r),
            sum(1 for x in e if x["root_key"]),
            len({x["root_key"] for x in e if x["root_key"]}),
        )
        assert got == (n_ent, n_rows, n_mapped, n_roots), sid
        rep = report["sources"][sid]
        assert (rep["entries"], rep["rows"], rep["headword_mapping"]["mapped_to_root"]) == (
            n_ent,
            n_rows,
            n_mapped,
        )
    senses = report["sources"]["nuzha"]["senses"]
    assert (senses["entries_with_stated_count"], senses["stated_equals_found"]) == (315, 310)
    senses = report["sources"]["damghani"]["senses"]
    assert (senses["entries_with_stated_count"], senses["stated_equals_found"]) == (493, 478)
    quotes = [c for c in tables["relation_citations"] if c["kind"] == "quote"]
    assert len(quotes) == report["totals"]["quotes"]
    assert sum(1 for c in quotes if c["status"] == "resolved") == report["totals"]["quotes_resolved"]


def test_ibn_jawzi_khawf_senses(built) -> None:
    """«باب الخوف»: five senses — الخوف نفسه، العلم، الظن، القتال، النكبة — each with the verses he cites."""
    tables, _ = built
    ent = next(
        e for e in tables["relation_entries"] if e["source_id"] == "nuzha" and e["headword_ar"] == "الخوف"
    )
    assert ent["printed_number"] == "115" and ent["page"] == 279 and ent["stated_count"] == 5
    assert (ent["root_key"], ent["match_method"]) == ("خوف", "lemma")
    senses = sorted(
        (
            c
            for c in tables["relation_candidates"]
            if c["entry_id"] == ent["id"] and c["type"] == "wujuh_sense"
        ),
        key=lambda c: c["sense_index"],
    )
    labels = [c["sense_label_ar"] for c in senses]
    assert labels[:4] == ["الخوف نفسه", "العلم", "الظن", "القتال"]
    assert labels[4].startswith("النكبة")
    expected_verses = [
        {"3:170", "7:56", "32:16"},  # ويستبشرون … ألا خوف عليهم؛ وادعوه خوفا وطمعا؛ يدعون ربهم خوفا وطمعا
        {"4:3", "4:128", "6:51"},  # فإن خفتم ألا تعدلوا؛ وإن امرأة خافت؛ وأنذر به الذين يخافون
        {"2:229"},  # إلا أن يخافا ألا يقيما حدود الله
        {"33:19"},  # فإذا جاء الخوف … فإذا ذهب الخوف
        {"4:83"},  # وإذا جاءهم أمر من الأمن أو الخوف أذاعوا به
    ]
    for c, verses in zip(senses, expected_verses, strict=True):
        assert verses <= set(c["verses"]), c["id"]
        assert c["status"] == STATUS
    # «العلم» as a sense of الخوف seeds a near-synonym candidate خوف ~ علم in the verses of that sense
    syn = [c for c in tables["relation_candidates"] if c["derived_from"] == senses[1]["id"]]
    assert [(c["root_key"], c["target_root_key"]) for c in syn] == [("خوف", "علم")]


def test_askari_fear_entries(built) -> None:
    tables, _ = built
    furuq = [c for c in tables["relation_candidates"] if c["type"] == "furuq_contrast"]
    pairs = {(c["headword_ar"], c["target_ar"]): c for c in furuq}
    for a, b, rb in (("الخوف", "الخشية", "خشي"), ("الخوف", "الرهبة", "رهب"), ("الخوف", "الوجل", "وجل")):
        c = pairs[(a, b)]
        assert (c["root_key"], c["target_root_key"]) == ("خوف", rb)
        assert c["text_ar"].startswith("أن ")
    khashya = pairs[("الخوف", "الخشية")]
    assert {"16:50", "13:21", "20:94"} <= set(khashya["verses"])  # يخافون ربهم من فوقهم … إني خشيت
    # «الذين إذا ذكر الله وجلت قلوبهم» stands in 8:2 and 22:35 alike: kept ambiguous, not guessed
    wajal = [x for x in tables["relation_citations"] if x["candidate_id"] == pairs[("الخوف", "الوجل")]["id"]]
    assert any(
        x["status"] == "ambiguous" and sorted(map(tuple, x["candidates"])) == [("22:35",), ("8:2",)]
        for x in wajal
    )


def test_damghani_and_addad_entries(built) -> None:
    tables, _ = built
    ents = tables["relation_entries"]
    burhan = next(e for e in ents if e["source_id"] == "damghani" and e["heading_ar"] == "ب ر ه ن على وجهين")
    assert (burhan["root_key"], burhan["match_method"], burhan["stated_count"], burhan["sense_count"]) == (
        "برهن",
        "root-letters",
        2,
        2,
    )
    rows = [
        c
        for c in tables["relation_candidates"]
        if c["entry_id"] == burhan["id"] and c["type"] == "wujuh_sense"
    ]
    assert [sorted(c["verses"]) for c in rows] == [["21:24", "27:64"], ["12:24", "28:32"]]
    qur = next(e for e in ents if e["source_id"] == "anbari-addad" and e["printed_number"] == "8")
    assert (qur["headword_ar"], qur["root_key"]) == ("والقرء", "قرأ")
    didd = next(c for c in tables["relation_candidates"] if c["entry_id"] == qur["id"])
    assert didd["type"] == "didd" and didd["text_ar"].startswith("والقرء من الأضداد")


def test_rows_are_verbatim_and_sourced(built) -> None:
    """Every row's text is a slice of its source file after the documented cleaning, re-run here on the
    pinned file; every row names a registered source; nothing is marked reviewed."""
    tables, _ = built
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    sources = {s["id"]: s for s in reg["sources"]}
    cleaned = {
        sid: clean(
            (RAW / s["file"]).read_text(encoding="utf-8"),
            s["openiti_uri"],
            footnote_refs=bool(s.get("footnote_refs")),
        ).text
        for sid, s in sources.items()
    }
    assert {r["id"] for r in tables["relation_sources"]} == set(sources)
    for e in tables["relation_entries"]:
        assert e["source_id"] in sources
        assert e["heading_ar"] in cleaned[e["source_id"]]
        if e["intro_ar"]:
            assert e["intro_ar"] in cleaned[e["source_id"]]
        assert e["locator"].startswith(f"urn:cts:arabicLit:{sources[e['source_id']]['openiti_uri']}:")
    for c in tables["relation_candidates"]:
        assert c["source_id"] in sources and c["type"] in TYPES
        assert c["status"] == STATUS
        assert c["text_ar"] and c["text_ar"] in cleaned[c["source_id"]], c["id"]
        assert re.fullmatch(r"ms\d{3}", c["milestone"] or "ms000")
    ids = [c["id"] for c in tables["relation_candidates"]]
    assert len(ids) == len(set(ids))


def test_citations_point_into_rows_and_the_quran(built) -> None:
    tables, _ = built
    cands = _by(tables["relation_candidates"])
    with (BUILD / "verses.jsonl").open(encoding="utf-8") as fh:
        verse_keys = {json.loads(line)["key"] for line in fh}
    for x in tables["relation_citations"]:
        c = cands[x["candidate_id"]]
        if x["kind"] == "quote":
            assert c["text_ar"][x["start"] : x["end"]] == x["quote"]
        assert set(x["verse_keys"]) <= verse_keys
        assert all(set(k) <= verse_keys for k in x["candidates"])
        assert (x["status"] == "resolved") == bool(x["verse_keys"])
        if x["status"] == "resolved":
            assert set(x["verse_keys"]) <= set(c["verses"])
    for c in tables["relation_candidates"]:
        assert set(c["verses"]) <= verse_keys


def test_registry_pins_and_licence() -> None:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    assert reg["openiti"]["release"] == "2025.1.9"
    assert re.fullmatch(r"[0-9a-f]{40}", reg["openiti"]["commit"])
    assert reg["openiti"]["licence"] == "CC BY-NC-SA 4.0"
    rule_ids = [r["id"] for r in reg["cleaning_rules"]]
    assert len(rule_ids) == len(set(rule_ids))
    for s in reg["sources"]:
        assert re.fullmatch(r"[0-9a-f]{64}", s["sha256"])
        # OpenITI names a few files with their format's extension (….mARkdown)
        assert s["file"].startswith("openiti-relations/data/") and s["file"].removesuffix(
            ".mARkdown"
        ).endswith(s["openiti_uri"])
        assert reg["openiti"]["commit"] in s["source_url"]
        for k in ("attribution_ar", "attribution_en", "title_ar", "title_en", "edition_ar", "edition_en"):
            assert s[k] and unicodedata.is_normalized("NFC", s[k]), (s["id"], k)


def test_fields_are_chapters_and_their_members_the_words_they_name(built) -> None:
    """P8.4c: al-Thaʿālibī's faṣls and Ibn Sīda's headings as fields; a member is a word the chapter names, mapped to its
    Quranic root, with the sentence that names it. Counts measured on the build; the examples read in the books."""
    tables, report = built
    cands, ents = tables["relation_candidates"], _by(tables["relation_entries"])
    for sid, (n_fields, n_members, n_roots) in {
        "fiqh-lugha": (140, 479, 369),
        "mukhassas": (404, 513, 299),
    }.items():
        rows = [r for r in cands if r["source_id"] == sid]
        assert {r["type"] for r in rows} == {"field_member"}
        got = (
            sum(1 for e in ents.values() if e["source_id"] == sid),
            len(rows),
            len({r["root_key"] for r in rows}),
        )
        assert got == (n_fields, n_members, n_roots), sid
        f = report["sources"][sid]["fields"]
        assert (f["fields"], f["members_kept"], f["distinct_roots"]) == got
        # the row is the work's own words, cut at its full stop, and names the member
        for r in rows:
            assert r["headword_ar"] in r["text_ar"] and r["root_key"] and r["status"] == "extracted"
    # «كل ما علاك فأظلك فهو سماء», the first faṣl, on the words the Quran uses
    first = next(r for r in cands if r["source_id"] == "fiqh-lugha" and r["headword_ar"] == "سماء")
    assert first["text_ar"] == "كل ما علاك فأظلك فهو سماء" and first["root_key"] == "سمو"
    assert first["sense_label_ar"] == "فيما نطق به القرآن من ذلك وجاء تفسيره عن ثقات الأئمة"
    assert ents[first["entry_id"]]["section_ar"].startswith("الباب الأول في الكليات")
    beast = next(r for r in cands if r["source_id"] == "fiqh-lugha" and r["headword_ar"] == "سبع")
    assert beast["sense_label_ar"] == "في ذكر ضروب من الحيوان" and beast["text_ar"].endswith("فهو سبع")
    # the edition's footnote numbers are gone from the words (footnote-refs); Sirr al-ʿArabiyya is not read
    assert report["sources"]["fiqh-lugha"]["cleaning"]["footnote-refs"] > 0
    assert not any(
        re.search("[\u0621-\u064a]\\d", r["text_ar"]) for r in cands if r["source_id"] == "fiqh-lugha"
    )
    assert not any(
        "سر العربية" in (e["section_ar"] or "") for e in ents.values() if e["source_id"] == "fiqh-lugha"
    )
    # al-Mukhaṣṣaṣ: only a word that is a Quranic noun's spelling exactly, never its metalanguage; its place in the book
    m = [r for r in cands if r["source_id"] == "mukhassas"]
    assert {r["match_confidence"] for r in m} == {"exact"} and not any(
        r["headword_ar"] in ("الجمع", "الإنسان") for r in m
    )
    secret = next(r for r in m if r["headword_ar"] == "النجوى")
    assert secret["sense_label_ar"] == "باب السر" and secret["text_ar"].startswith("أبو زيد، النجوى")
    sources = _by(tables["relation_sources"])
    assert (
        sources["mukhassas"]["shown_extracted"] is False and sources["fiqh-lugha"]["shown_extracted"] is True
    )
