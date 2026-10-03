"""Pattern catalog (PLAN P3.3): cleaning, mention and example finding, mapping, and the built tables.

The unit tests need no data. The data tests read the pinned OpenITI files (data/raw/openiti-patterns) and a
dataset build (data/build/2026.10.0); they skip, with that reason, where either is absent, and fail
instead when JADHR_REQUIRE_DATA=1. Facts asserted here were read in the source text by hand: al-Shāfiya's
«الماضي» (printed pages 18–21 of al-ʿUthmān's edition: six meanings of أفعل, three of استفعل …), al-Kāfiya's
«اسم الفاعل» and «اسم المفعول» (pages 40–41), al-Raḍī's comment on «وللتعريض» (vol. 1, p. 88).
"""

from __future__ import annotations

import csv
import json
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

import pytest
import yaml
from jadhr_pipeline.patterns_catalog import STATUS, build_pattern_catalog
from jadhr_pipeline.patterns_catalog.mapping import (
    DAMMA,
    FATHA,
    KASRA,
    SUFFIX_CLASSES,
    SUKUN,
    _decompose,
    _transfer,
)
from jadhr_pipeline.patterns_catalog.mentions import find_examples, mention_at, pattern_norm, tokens
from jadhr_pipeline.patterns_catalog.parsers import SENSE_BOUNDARY, parse_radi
from jadhr_pipeline.patterns_catalog.text import clean_source, preclean

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("JADHR_RAW_DIR", REPO / "data" / "raw"))
BUILD = Path(os.environ.get("JADHR_BUILD_DIR", RAW.parent / "build" / "2026.10.0"))
REGISTRY = REPO / "data" / "patterns.yaml"
SHADDA = chr(0x0651)


# --- unit: cleaning ---------------------------------------------------------------------------------
KAFIYA_LIKE = """######OpenITI#
#META#Header#End#

### | AUTO [اسم الفاعل]

# :
# اسم الفاعل: ما اشتق من فعل (¬1) لمن قام به.
PageV01P040
# قال الفرزدق: - 13 - ما زلت أفتح أبوابا (1) %
"""


def test_extra_cleaning_rules() -> None:
    _, stats = preclean(KAFIYA_LIKE, ["auto-headings", "footnote-refs", "shahid-numbers", "hemistich-marks"])
    assert (stats["auto-headings"], stats["auto-headings-colon-lines"], stats["footnote-refs"]) == (1, 1, 2)
    assert (stats["shahid-numbers"], stats["hemistich-marks"]) == (1, 1)
    c = clean_source(
        KAFIYA_LIKE, "x.y.z-ara1", ["auto-headings", "footnote-refs", "shahid-numbers", "hemistich-marks"]
    )
    assert c.text == "[اسم الفاعل]\nاسم الفاعل: ما اشتق من فعل لمن قام به.\nقال الفرزدق: ما زلت أفتح أبوابا"
    assert c.is_heading(0)  # the editor's title is a heading paragraph, not an inline word
    assert c.locator(c.text.index("اسم الفاعل:"))["page"] == 40
    with pytest.raises(ValueError):
        preclean(KAFIYA_LIKE, ["no-such-rule"])


# --- unit: patterns named and examples given --------------------------------------------------------
def test_pattern_words() -> None:
    cases = {
        "ففعل": ("فعل", ["proclitic-peeled"]),
        "وفاعل": ("فاعل", ["proclitic-peeled"]),
        "فعلا": ("فعل", ["accusative-alef-dropped"]),
        "فعولا": ("فعول", ["accusative-alef-dropped"]),
        "استفعل": ("استفعل", []),
        "مفعول": ("مفعول", []),
        "فعيعيل": ("فعيعيل", []),
        "فعلل": ("فعلل", []),
    }
    for word, expected in cases.items():
        assert pattern_norm(word) == expected, word
    # «فعله» (its verb), «الفعل» (the verb), «للفاعل», «فعلته» and words that only share letters are not patterns
    for word in ("فعله", "الفعل", "للفاعل", "فعلته", "فلان", "عفل", "فعفل"):
        assert pattern_norm(word) is None, word
    toks = tokens("و ما عداه فعلى لفظ المفعول")
    assert mention_at(toks, 3) is None  # «فعلى لفظ» is «فـ + على», not the pattern
    toks = tokens("بمعنى الجوع على فعلى نحو")
    assert mention_at(toks, 3) == ("فعلى", [])


def test_examples_and_sense_boundaries() -> None:
    t = "و فعل يكثر فيه العلل و الأحزان و أضدادها كسقم و مرض وبريء و حزن و فرح"
    ex = find_examples(t, tokens(t), 0, len(tokens(t)), noun=False)
    assert [e.items for e in ex] == [["سقم", "مرض", "بريء", "حزن", "فرح"]]
    t = "الآلة على مفعل و مفعال و مفعلة ك المحلب و المفتاح و المكسحة"
    ex = find_examples(t, tokens(t), 0, len(tokens(t)), noun=True)
    assert [e.items for e in ex] == [["المحلب", "المفتاح", "المكسحة"]]
    t = "و لصيرورته ذا كذا نحو أغد البعير و منه أحصد الزرع"
    ex = find_examples(t, tokens(t), 0, len(tokens(t)), noun=False)
    assert [x for e in ex for x in e.items] == ["أغد البعير", "أحصد الزرع"]
    t = "نحو ضاربته و شاركته و من ثم جاء غير المتعدي متعديا نحو كارمته و شاعرته و المتعدي إلى واحد"
    ex = find_examples(t, tokens(t), 0, len(tokens(t)), noun=False)
    assert [e.items for e in ex] == [["ضاربته", "شاركته"], ["كارمته", "شاعرته"]]
    t = "و أفعل للتعدية غالبا نحو أجلسته و للتعريض نحو أبعته و منه أحصد و بمعنى فعل نحو قلته"
    cuts = [m.start() for m in SENSE_BOUNDARY.finditer(t)]
    assert [t[c : c + 9] for c in cuts] == ["و للتعريض", "و بمعنى ف"]


def test_mapping_helpers() -> None:
    faa3iluun = "ف" + FATHA + "اع" + KASRA + "ل" + DAMMA + "ون"
    assert _decompose(faa3iluun) == ("ف" + FATHA + "اع" + KASRA + "ل", DAMMA + "ون")
    assert _decompose("ف" + FATHA + "ع" + SUKUN + "ل" + FATHA + "ان") is None  # فعلان is itself a pattern
    mihlab = "م" + KASRA + "ح" + SUKUN + "ل" + FATHA + "ب"
    assert _transfer("مفعل", mihlab) == "م" + KASRA + "ف" + SUKUN + "ع" + FATHA + "ل"
    assert _transfer("مفعال", mihlab) is None
    assert SUFFIX_CLASSES["nisba"][0] == KASRA + "ي" + SHADDA


RADI_LIKE = """######OpenITI#
#META#Header#End#
# قال: " وأفعل للتعدية غالبا نحو أجلسته، وللتعريض نحو أبعته " أقول: المعنى الغالب في أفعل النقل
~~قوله " وللتعريض " أي: تفيد الهمزة التعريض، ويسمج جعله حالا من قوله " أصله " أو من غيره
# قال " وفعل للتكثير " أقول: الأغلب فيه التكثير
"""


def test_radi_blocks_and_cues() -> None:
    c = clean_source(RADI_LIKE, "x.y.z-ara1")
    blocks = parse_radi(c)
    assert len(blocks) == 2
    first = blocks[0]
    assert c.text[first.matn[0] : first.matn[1]].startswith("وأفعل للتعدية")
    # «من قوله " أصله "» refers to a phrase inside a sentence: it does not open a new comment
    assert [c.text[s.cue[0] : s.cue[1]].strip() if s.cue else None for s in first.segments] == [
        None,
        "وللتعريض",
    ]
    assert c.text[first.segments[1].start : first.segments[1].end].endswith("أو من غيره")


# --- data -------------------------------------------------------------------------------------------
def _need_data() -> None:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    missing = [s["file"] for s in reg["sources"] if not (RAW / s["file"]).exists()]
    missing += [
        str(BUILD / f) for f in ("patterns.jsonl", "lemmas.jsonl", "words.jsonl") if not (BUILD / f).exists()
    ]
    if missing:
        msg = f"pattern catalog sources or dataset build not available: {missing[:3]}"
        if os.environ.get("JADHR_REQUIRE_DATA") == "1":
            pytest.fail(msg)
        pytest.skip(msg)


@pytest.fixture(scope="module")
def built() -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    _need_data()
    return build_pattern_catalog(RAW, BUILD, REGISTRY)


def _rows(tables: dict[str, list[dict[str, Any]]], **eq: Any) -> list[dict[str, Any]]:
    return [r for r in tables["pattern_functions"] if all(r[k] == v for k, v in eq.items())]


def _jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def test_counts_match_the_report(built) -> None:
    """The figures in the build report (and in the P3.3 handover) — recomputed here from the rows."""
    tables, report = built
    rows = tables["pattern_functions"]
    assert Counter(r["source_id"] for r in rows) == {"shafiya": 71, "kafiya": 16, "radi-shafiya": 85}
    assert Counter(r["kind"] for r in rows) == {
        "meaning": 37,
        "inventory": 7,
        "statement": 34,
        "definition": 9,
        "commentary": 85,
    }
    assert report["totals"]["rows"] == len(rows) == 172
    radi = report["sources"]["radi-shafiya"]
    assert (radi["quotation_blocks"], radi["blocks_aligned"], radi["matn_rows_with_commentary"]) == (
        208,
        28,
        71,
    )
    assert radi["matn_rows_without_commentary"] == []
    assert radi["segments"] == {"block-opening": 22, "cue-aligned": 59, "cue-not-in-matn-edition": 4}
    # coverage, recomputed from the rows and patterns.jsonl
    pats = {p["slug"]: p for p in _jsonl(BUILD / "patterns.jsonl")}
    direct = {s for r in rows if r["kind"] != "commentary" for s in r["pattern_slugs"]}
    base = {s for r in rows if r["kind"] != "commentary" for s in r["inflected_slugs"]} - direct
    suffix = {s for r in rows if r["kind"] != "commentary" for s in r["suffix_slugs"]}
    total = sum(p["occurrences"] for p in pats.values())
    expected = {
        "direct": (direct, 52, 28733),
        "direct_or_base": (direct | base, 121, 30561),
        "any": (direct | base | suffix, 150, 30914),
    }
    cov = report["coverage"]
    assert (cov["our_patterns"], cov["patterned_occurrences"]) == (228, total) == (228, 39897)
    for tier, (slugs, n, occ) in expected.items():
        got = (len(slugs), sum(pats[s]["occurrences"] for s in slugs))
        assert got == (n, occ) == (cov[tier]["patterns"], cov[tier]["occurrences"]), tier


def test_verb_form_meanings(built) -> None:
    """al-Shāfiya, «الماضي»: each statement's meanings, its mapping, and how the mapping was found."""
    tables, report = built
    st = report["sources"]["shafiya"]["verb_statements"]
    got = {k: (v["pattern_ar"], v["meanings"], v["slug"], v["method"]) for k, v in st.items()}
    assert got == {
        "verb-forms#1": ("فعل", 2, "fa3ala", "elimination"),  # ففعل لمعان كثيرة / و باب المغالبة
        "verb-forms#2": ("فعل", 2, "fa3ila", "examples"),  # العلل والأحزان / الألوان والعيوب والحلي
        "verb-forms#3": ("فعل", 1, "fa3ula", "examples"),  # لأفعال الطبائع
        "verb-forms#4": ("أفعل", 6, "2af3ala", "as-written"),
        "verb-forms#5": ("فعل", 4, "fa33ala", "examples"),
        "verb-forms#6": ("فاعل", 3, "faa3ala", "as-written"),
        "verb-forms#7": ("تفاعل", 4, "tafaa3ala", "as-written"),
        "verb-forms#8": ("تفعل", 6, "tafa33ala", "as-written"),
        "verb-forms#9": ("انفعل", 2, "infa3ala", "as-written"),
        "verb-forms#10": ("افتعل", 4, "ifta3ala", "as-written"),
        "verb-forms#11": ("استفعل", 3, "istaf3ala", "as-written"),
    }
    assert (
        sum(v["meanings"] for v in st.values())
        == len(_rows(tables, source_id="shafiya", kind="meaning"))
        == 37
    )
    # the votes that decided the Form I paradigms: the book's examples as Quranic verbs
    assert st["verb-forms#2"]["votes"] == {"fa3ila": 2}  # مرض، فرح
    assert st["verb-forms#3"]["votes"] == {"fa3ula": 1}  # حسن
    assert st["verb-forms#5"]["votes"] == {"fa33ala": 2}  # غلقت (وغلقت الأبواب)، قطعت


def test_afala_six_meanings(built) -> None:
    tables, _ = built
    rows = sorted(
        _rows(tables, source_id="shafiya", section="verb-forms", statement_index=4), key=lambda r: r["seq"]
    )
    openings = [
        "و أفعل للتعدية غالبا",
        "و للتعريض",
        "و لصيرورته ذا كذا",
        "و لوجوده على صفة",
        "و للسلب",
        "و بمعنى فعل",
    ]
    assert [r["sense_index"] for r in rows] == [1, 2, 3, 4, 5, 6]
    for r, opening in zip(rows, openings, strict=True):
        assert r["text_ar"].startswith(opening), r["text_ar"]
        assert (r["pattern_slugs"], r["form_number"], r["match_method"]) == (["2af3ala"], 4, "as-written")
        assert (r["page_vol"], r["page"]) == (1, 19)
    assert [r["examples_ar"] for r in rows] == [
        ["أجلسته"],
        ["أبعته"],
        ["أغد البعير", "أحصد الزرع"],
        ["أحمدته", "أبخلته"],
        ["أشكيته"],
        ["قلته", "أقلته"],
    ]


def test_istafala_three_meanings(built) -> None:
    tables, _ = built
    rows = sorted(
        _rows(tables, source_id="shafiya", section="verb-forms", statement_index=11), key=lambda r: r["seq"]
    )
    assert [r["text_ar"].split("\n")[0] for r in rows] == [
        "و استفعل للسؤال غالبا إما صريحا نحو استكتبته أو تقديرا نحو استخرجته",
        "و للتحول نحو استحجر الطين و",
        "و بمعنى فعل نحو قر و استقر",
    ]
    assert rows[1]["text_ar"].endswith("(إن البغاث بأرضنا تستنسر)")  # the verse line stays with its meaning
    assert {(tuple(r["pattern_slugs"]), r["form_number"]) for r in rows} == {(("istaf3ala",), 10)}


def test_core_patterns_map_to_our_slugs(built) -> None:
    """فاعل، مفعول، فعيل، استفعل as the books write them, and the slug each maps to (and how)."""
    tables, _ = built

    def mention(row_id: str, written: str) -> dict[str, Any]:
        row = next(r for r in tables["pattern_functions"] if r["id"] == row_id)
        return next(m for m in row["mentions"] if m["pattern_ar"] == written)

    fa = next(
        r for r in _rows(tables, source_id="kafiya", section="active-participle") if r["pattern_ar"] == "فاعل"
    )
    assert fa["text_ar"].startswith("وصيغته من الثلاثي المجرد على فاعل")
    m = mention(fa["id"], "فاعل")
    assert (m["slug"], m["method"], m["confidence"], m["candidates"]) == (
        "faa3il",
        "as-written",
        "high",
        ["faa3il"],
    )
    # the same row's «ومن غير الثلاثي على صيغة المضارع بميم مضمومة …» maps the augmented verbs' participles
    assert {"muf3il", "mufa33il", "mufta3il", "mustaf3il"} <= set(fa["pattern_slugs"])
    maf = next(
        r
        for r in _rows(tables, source_id="kafiya", section="passive-participle")
        if r["pattern_ar"] == "مفعول"
    )
    m = mention(maf["id"], "مفعول")
    assert (m["slug"], m["method"], m["examples"]) == ("maf3uul", "as-written", ["مضروب"])
    # «فعيل» in the diminutive: three candidates by letters; the chapter's own rule («يضم أوله و يفتح ثانية»)
    dim = next(
        r for r in _rows(tables, source_id="shafiya", section="diminutive") if r["pattern_ar"] == "فعيل"
    )
    m = mention(dim["id"], "فعيل")
    assert (m["candidates"], m["slug"], m["method"]) == (
        ["fa3iil", "fi33iil", "fu3ayl"],
        "fu3ayl",
        "section-vowel-rule",
    )
    # fa'iil itself: «عليم» among the intensive forms, read alike by the Quran and Lane
    inten = _rows(tables, source_id="kafiya", section="intensive")[0]
    m = next(x for x in inten["mentions"] if x["examples"] == ["عليم"])
    assert (m["slug"], m["method"], m["voters"]) == (
        "fa3iil",
        "example-only",
        {"quran": ["fa3iil"], "lane": ["fa3iil"]},
    )
    ist = _rows(tables, source_id="shafiya", section="verb-forms", statement_index=11)[0]
    assert ist["mentions"][0]["candidates"] == ["istaf3ala"]


def test_unresolved_stays_unmapped(built) -> None:
    """Nothing uncertain is guessed: the elative «أفعل» (our af'al and af'ul share its letters) and the
    noun of one act «فعلة» on a single lexicon reading stay unmapped, with candidates and reason."""
    tables, report = built
    el = _rows(tables, source_id="kafiya", section="elative", kind="definition")[0]
    assert el["text_ar"] == "اسم التفضيل: ما اشتق من فعل لموصوف بزيادة على غيره، وهو (أفعل)."
    assert (el["pattern_slugs"], el["unmapped_reason"], el["match_candidates"]) == (
        [],
        "ambiguous",
        ["2af3al", "2af3ul"],
    )
    marra = _rows(tables, source_id="shafiya", section="marra")[0]
    m = next(x for x in marra["mentions"] if x["pattern_ar"] == "فعلة")
    assert (m["slug"], m["reason"], m["votes"]) == (None, "one-lexicon-vote", {"fi3lah": 1})
    assert any(w["row"] == marra["id"] for w in report["editor_worklist"])


def test_rows_are_verbatim_and_sourced(built) -> None:
    """Every row's text is a slice of its source file after the documented cleaning, re-run here on the
    pinned file; every written mention slices back to itself; nothing is marked reviewed."""
    tables, _ = built
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    sources = {s["id"]: s for s in reg["sources"]}
    cleaned = {
        sid: clean_source(
            (RAW / s["file"]).read_text(encoding="utf-8"), s["openiti_uri"], s.get("extra_cleaning") or []
        )
        for sid, s in sources.items()
    }
    assert {r["id"] for r in tables["pattern_sources"]} == set(sources)
    ids = [r["id"] for r in tables["pattern_functions"]]
    assert len(ids) == len(set(ids))
    pats = {p["slug"] for p in _jsonl(BUILD / "patterns.jsonl")}
    for r in tables["pattern_functions"]:
        text = cleaned[r["source_id"]].text
        assert r["status"] == STATUS and r["text_ar"] and r["text_ar"] in text, r["id"]
        assert r["locator"].startswith(f"urn:cts:arabicLit:{sources[r['source_id']]['openiti_uri']}:")
        assert re.fullmatch(r"ms\d{2,3}", r["milestone"] or "ms00")
        assert set(r["pattern_slugs"]) | set(r["inflected_slugs"]) | set(r["suffix_slugs"]) <= pats
        assert all(x in r["text_ar"] for x in r["examples_ar"]), r["id"]
        for m in r["mentions"]:
            if m["written"]:
                assert text[m["start"] : m["end"]] == m["written"], (r["id"], m)
            if m["slug"]:
                assert m["confidence"] in ("high", "medium")
    for r in _rows(tables, kind="commentary"):
        assert r["comments_on"] and all(c.startswith("shafiya:") for c in r["comments_on"])
        assert set(r["comments_on"]) <= set(ids)
        if r["cue_ar"]:
            assert f'"{r["cue_ar"]}"' in r["text_ar"]


def test_radi_comment_on_tarid(built) -> None:
    """al-Raḍī's «قوله " وللتعريض "» explains al-Shāfiya's second meaning of أفعل."""
    tables, _ = built
    row = next(
        r for r in _rows(tables, source_id="radi-shafiya") if (r["cue_ar"] or "").strip() == "وللتعريض"
    )
    target = next(r for r in tables["pattern_functions"] if r["id"] == row["comments_on"][0])
    assert row["comments_on"] == [target["id"]] and target["text_ar"] == "و للتعريض نحو أبعته"
    assert row["text_ar"].startswith('قوله " وللتعريض " أي: تفيد الهمزة')
    assert (row["page_vol"], row["page"], row["pattern_slugs"]) == (1, 88, ["2af3ala"])


def test_registry_pins_and_licence() -> None:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    assert reg["openiti"]["release"] == "2025.1.9"
    assert re.fullmatch(r"[0-9a-f]{40}", reg["openiti"]["commit"])
    assert reg["openiti"]["licence"] == "CC BY-NC-SA 4.0"
    rule_ids = [r["id"] for r in reg["cleaning_rules"]]
    assert len(rule_ids) == len(set(rule_ids))
    for s in reg["sources"]:
        assert re.fullmatch(r"[0-9a-f]{64}", s["sha256"])
        assert s["file"].startswith("openiti-patterns/data/") and s["file"].endswith(s["openiti_uri"])
        assert reg["openiti"]["commit"] in s["source_url"] and s["source_url"].endswith(s["openiti_uri"])
        assert set(s.get("extra_cleaning") or []) <= set(rule_ids)
        assert s["page_numbering"] in ("matches-print", "unverified")
        for k in ("attribution_ar", "attribution_en", "title_ar", "title_en", "edition_ar", "edition_en"):
            assert s[k] and unicodedata.is_normalized("NFC", s[k]), (s["id"], k)
        for sec in s.get("sections") or []:
            assert not sec.get("suffix_class") or sec["suffix_class"] in SUFFIX_CLASSES
    shadha = next(x for x in reg["searched"] if x["work_ar"] == "شذا العرف في فن الصرف")
    assert shadha["result"] == "not in OpenITI" and shadha["death_hijri"] == 1351


def test_shadha_is_not_in_the_release() -> None:
    """The absence the registry records, re-checked on the pinned catalogue — with a positive control
    (al-Shāfiya is found the same way), so a wrong path or field cannot pass as absence."""
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    path = RAW / reg["openiti"]["catalogue"]["file"]
    if not path.exists():
        msg = f"OpenITI catalogue not available: {path}"
        if os.environ.get("JADHR_REQUIRE_DATA") == "1":
            pytest.fail(msg)
        pytest.skip(msg)
    csv.field_size_limit(1 << 30)
    with path.open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh, delimiter="\t"))
    assert len(rows) == 14107

    def hits(*needles: str) -> list[str]:
        return [
            r["version_uri"]
            for r in rows
            if any(n in r["title_ar"] or n in r["author_ar"] or n in r["version_uri"] for n in needles)
        ]

    assert hits(
        "الشافية في علم التصريف"
    ) and "0646IbnCumarIbnHajibKurdi.ShafiyaFiCilmTasrif.JK001223-ara1" in hits("الشافية في علم")
    assert hits("شذا العرف", "حملاوي", "Hamlawi", "Hamalawi") == []
