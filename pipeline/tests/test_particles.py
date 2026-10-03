"""Particle entries (PLAN P3.8): cleaning, entry and sense parsing, the corpus links and the built tables.

The unit tests need no data. The data tests read the pinned OpenITI files (data/raw/openiti-particles) and
a dataset build (data/build/2026.10.0); they skip, with that reason, where either is absent, and fail
instead when JADHR_REQUIRE_DATA=1. Facts asserted here were read in the source text by hand: Ibn Hishām's
«في» («حرف جر له عشرة معان», printed page 223), «الباء المفردة» («حرف جر لأربعة عشر معنى», printed page
137 — checked on shamela.ws book 6972, page 126), «إن المكسورة الخفيفة» («ترد على أربعة أوجه»), «من» («تأتي
على خمسة عشر وجها»); al-Murādī's «في» («حرف جر، وله تسعة معان»), «من» («فغير الزائد له أربعة عشر معنى»),
the lists that open his five chapters, and the page of «وزاد ابن عصفور أن عن تكون اسما» (printed page 244 —
checked on shamela.ws book 26099, page 226).
"""

from __future__ import annotations

import itertools
import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

import pytest
import yaml
from jadhr_pipeline.particles import ROW_KINDS, STATUS, build_particles
from jadhr_pipeline.particles.mapping import Constraints, bare, heading_forms
from jadhr_pipeline.particles.structure import COUNT, count_value, parse_senses, sense_label
from jadhr_pipeline.particles.text import align_letters, load_source
from jadhr_pipeline.relations.openiti import clean

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("JADHR_RAW_DIR", REPO / "data" / "raw"))
BUILD = Path(os.environ.get("JADHR_BUILD_DIR", RAW.parent / "build" / "2026.10.0"))
REGISTRY = REPO / "data" / "particles.yaml"


# --- unit: cleaning, counts, lists, labels ------------------------------------------------------------
SAMPLE = """######OpenITI#
#META#Header#End#

# وأعني بالمفردات الحروف فإنها المحتاجة إلى ذلك & حرف الألف &
# الألف المفردة تأتي علي وجهين PageV01P016
# أحدهما أن تكون حرفا ينادى به القريب
# والثاني أن تكون للاستفهام نحو @QB@ أفي الله شك @QE@
~~& حرف الباء
~~&
# الباء المفردة حرف جر
"""


def test_inline_heading_marks_are_their_own_paragraphs() -> None:
    c = clean(SAMPLE, "x.y.z-ara1", inline_headings=True)
    paras = c.text.split("\n")
    assert paras[0] == "وأعني بالمفردات الحروف فإنها المحتاجة إلى ذلك"
    assert "حرف الألف" in paras and "حرف الباء" in paras
    assert "&" not in c.text
    assert c.stats["inline-heading-marks"] == 2
    assert c.is_heading(c.text.index("حرف الألف")) and not c.is_heading(c.text.index("الألف المفردة"))
    # without the rule (the relation seeds) the marks stay in the text
    assert "&" in clean(SAMPLE, "x.y.z-ara1").text


def test_count_statements() -> None:
    cases = {
        "ترد على أربعة أوجه": 4,
        "حرف جر لأربعة عشر معنى": 14,
        "حرف جر، وله تسعة معان:": 9,
        "ولها قسمان:": 2,
        "عن على ثلاثه أوجه": 3,
        "وللام الجارة اثنان وعشرون معنى": 22,
        "تأتي على خمسة عشر وجها": 15,
        "وفيها ثلاثة أقوال:": 3,
    }
    for text, n in cases.items():
        m = COUNT.search(text)
        assert m and count_value(m) == n, text
    assert COUNT.search("على وجه الأرض") is None


def test_lists_nesting_gender_and_colons() -> None:
    t = (
        "حرف جر، وله ثلاثة معان:\n"
        "الأول: الظرفية، نحو كذا. وهي قسمان: أحدهما حقيقي. والآخر مجازي.\n"
        "الثاني: المصاحبة. وتجيء على وجهين:\n"
        "أحدها الفاعل\n"
        "والثانية متعدية لاثنين\n"
        "والثاني المفعول\n"
        "الثالث: التعليل."
    )
    senses, lists, notes = parse_senses(t, 0, len(t), [])
    by = [(s.list_no, s.index, s.marker) for s in senses]
    # «الثاني:» with its colon continues «الأول:», not «أحدهما» (no colon) opened inside the first sense;
    # «والثانية» (feminine) does not continue «أحدها», «والثاني» does; «الثالث:» returns to the first list
    assert by == [
        (1, 1, "الأول"),
        (2, 1, "أحدهما"),
        (1, 2, "الثاني"),
        (3, 1, "أحدها"),
        (3, 2, "والثاني"),
        (1, 3, "الثالث"),
    ]
    assert notes == ["ordinal «والثانية» outside a list it continues: left in the text"]
    assert (lists[0].stated, lists[1].stated, lists[2].stated) == (3, 2, 2)
    assert (lists[1].depth, lists[1].parent) == (1, 0)
    assert (lists[2].depth, lists[2].parent) == (0, None)
    # texts are slices and rows do not overlap
    assert all(t[s.start : s.end] for s in senses)
    assert all(a.end <= b.start for a, b in itertools.pairwise(senses))
    lab = sense_label(t, senses[0])
    assert lab and t[lab[0] : lab[1]] == "الظرفية"


def test_heading_constraints_and_forms() -> None:
    c = Constraints.read("المكسورة الخفيفة", None)
    assert (c.first_vowel, c.shadda) == ("kasra", False)
    c = Constraints.read("بفتح الهمزة والتشديد", 4)
    assert (c.first_vowel, c.shadda, c.letters) == ("fatha", True, 4)
    c = Constraints.read("بلام مشددة مفتوحة أو مكسورة", None)  # the lām's, not the word's first vowel
    assert (c.first_vowel, c.shadda) == (None, None)
    assert Constraints.read("بالمد", None).madda
    assert heading_forms("هو وهي وهم") == ["هو", "هي", "هم"]
    assert heading_forms("إذ ما") == ["إذ ما"]
    assert heading_forms("وا") == ["وا"]
    # comparison spelling: dotless final yā', the mushaf's madda sign, a word-initial آ kept
    assert bare("فِى") == "في" and bare("أَلَآ") == "ألا" and bare("آدَم") == "آدم"
    assert bare(unicodedata.normalize("NFC", "لَوْلَآ")) == "لولا"


def test_letter_alignment() -> None:
    a = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي" * 4
    b = a[:30] + "ق" + a[31:70] + a[71:]  # one letter changed, one dropped
    blocks = align_letters(a, b, window=8)
    matched = sum(blk.size for blk in blocks)
    assert matched >= len(a) - 2
    assert blocks[0].a == 0 and blocks[0].b == 0


# --- data -------------------------------------------------------------------------------------------
def _need_data() -> None:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    files = [s["file"] for s in reg["sources"]] + [
        s["page_source"]["file"] for s in reg["sources"] if s.get("page_source")
    ]
    missing = [f for f in files if not (RAW / f).exists()]
    missing += [
        str(BUILD / f) for f in ("verses.jsonl", "lemmas.jsonl", "words.jsonl") if not (BUILD / f).exists()
    ]
    if missing:
        msg = f"particle sources or dataset build not available: {missing[:3]}"
        if os.environ.get("JADHR_REQUIRE_DATA") == "1":
            pytest.fail(msg)
        pytest.skip(msg)


@pytest.fixture(scope="module")
def built() -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    _need_data()
    return build_particles(RAW, BUILD, REGISTRY)


def _entry(tables: dict[str, Any], eid: str) -> dict[str, Any]:
    return next(e for e in tables["particle_entries"] if e["id"] == eid)


def _rows(
    tables: dict[str, Any], eid: str, kind: str = "sense", list_no: int | None = 1
) -> list[dict[str, Any]]:
    return [
        r
        for r in tables["particle_senses"]
        if r["entry_id"] == eid and r["kind"] == kind and (list_no is None or r["list_no"] == list_no)
    ]


def test_counts_match_the_report(built) -> None:
    """The figures in the build report (and in the P3.8 handover) — recomputed here from the rows."""
    tables, report = built
    expected = {
        # source: (entries, numbered senses, intro rows, note rows, entries linked to the corpus)
        "mughni": (100, 555, 100, 77, 66),
        "jana-dani": (98, 689, 98, 43, 65),
    }
    for sid, (n_ent, n_sense, n_intro, n_note, n_mapped) in expected.items():
        ents = [e for e in tables["particle_entries"] if e["source_id"] == sid]
        rows = [r for r in tables["particle_senses"] if r["source_id"] == sid]
        got = (
            len(ents),
            sum(1 for r in rows if r["kind"] == "sense"),
            sum(1 for r in rows if r["kind"] == "intro"),
            sum(1 for r in rows if r["kind"] == "note"),
            sum(1 for e in ents if e["corpus_links"]),
        )
        assert got == (n_ent, n_sense, n_intro, n_note, n_mapped), sid
        rep = report["sources"][sid]
        assert (rep["entries"], rep["senses"], rep["mapping"]["mapped"]) == (n_ent, n_sense, n_mapped)
        assert rep["coverage"]["entries_not_fully_covered"] == []
    quotes = [c for c in tables["particle_citations"] if c["kind"] == "quote"]
    tot = report["totals"]
    assert (len(quotes), tot["quotes"]) == (1836, 1836)
    assert sum(1 for c in quotes if c["status"] == "resolved") == tot["quotes_resolved"] == 1500
    assert sum(1 for c in quotes if c["status"] == "ambiguous") == tot["quotes_ambiguous"] == 170
    assert sum(1 for c in quotes if c["status"] == "unresolved") == tot["quotes_unresolved"] == 166


def test_mughni_fi_and_ba(built) -> None:
    tables, _ = built
    fi = next(
        e for e in tables["particle_entries"] if e["source_id"] == "mughni" and e["headword_ar"] == "في"
    )
    assert (fi["stated_count"], fi["stated_count_ar"], fi["first_list_count"], fi["page"]) == (
        10,
        "له عشرة معان",
        10,
        223,
    )
    labels = [r["label_ar"] for r in _rows(tables, fi["id"])]
    assert labels == [
        "الظرفية", "المصاحبة", "التعليل", "الاستعلاء", "مرادفة الباء",
        "مرادفة إلى", "مرادفة من", "المقايسة", "التعويض", "التوكيد",
    ]  # fmt: skip
    senses = _rows(tables, fi["id"])
    assert "7:38" in senses[1]["verses"]  # ادخلوا في أمم
    assert "20:71" in senses[3]["verses"]  # ولأصلبنكم في جذوع النخل
    ba = next(
        e
        for e in tables["particle_entries"]
        if e["source_id"] == "mughni" and e["heading_ar"] == "الباء المفردة"
    )
    assert (ba["stated_count"], ba["first_list_count"], ba["page"]) == (14, 14, 137)
    assert [r["label_ar"] for r in _rows(tables, ba["id"])][:3] == ["الإلصاق", "التعدية", "الاستعانة"]
    assert ba["affix_tags"] == ["bi+"] and ba["match_method"] == "affix-form"


def test_mughni_in_and_min(built) -> None:
    tables, _ = built
    ents = [e for e in tables["particle_entries"] if e["source_id"] == "mughni"]
    khafifa = next(e for e in ents if e["heading_ar"] == "إن المكسورة الخفيفة")
    assert (khafifa["stated_count"], khafifa["first_list_count"]) == (4, 4)
    first = _rows(tables, khafifa["id"])[0]
    assert first["label_ar"] == "أن تكون شرطية"
    assert {"8:38", "8:19"} <= set(first["verses"])  # إن ينتهوا يغفر لهم؛ وإن تعودوا نعد
    min_ = next(e for e in ents if e["headword_ar"] == "من" and e["stated_count"] == 15)
    assert min_["first_list_count"] == 15
    assert [r["label_ar"] for r in _rows(tables, min_["id"])][:2] == ["ابتداء الغاية", "التبعيض"]


def test_jana_fi_min_and_chapter_lists(built) -> None:
    tables, report = built
    ents = [e for e in tables["particle_entries"] if e["source_id"] == "jana-dani"]
    fi = next(e for e in ents if e["headword_ar"] == "في")
    assert (fi["stated_count"], fi["stated_count_ar"], fi["first_list_count"]) == (9, "وله تسعة معان", 9)
    assert fi["chapter_letters"] == 2 and fi["section_ar"] == "الباب الثاني في الثنائي"
    senses = _rows(tables, fi["id"])
    assert [r["label_ar"] for r in senses][:4] == ["الظرفية", "المصاحبة", "التعليل", "المقايسة"]
    assert {"2:203", "2:179"} <= set(senses[0]["verses"])  # واذكروا الله في أيام معدودات؛ ولكم في القصاص حياة
    assert senses[6]["verses"] == ["14:9"]  # فردوا أيديهم في أفواههم
    min_ = next(e for e in ents if e["headword_ar"] == "من" and e["stated_count"] == 14)
    assert min_["first_list_count"] == 14
    lists = report["sources"]["jana-dani"]["chapter_lists"]
    assert [(v["letters"], v["item_count"], v["stated"]) for v in lists.values()] == [
        (1, 14, 14),
        (2, 33, 33),
        (3, 36, 36),
        (4, 19, 19),
        (5, 3, 3),
    ]
    assert not any(v.get("not_found") for v in lists.values())
    # every listed particle has its entry; the pronouns he treats together share one
    assert sum(len(e["listed_as_ar"]) for e in ents) == 105
    assert next(e for e in ents if e["headword_ar"] == "هو وهي وهم")["listed_as_ar"] == ["هو", "هي", "هم"]


def test_corpus_links(built) -> None:
    """في، مِن، إنّ، لا link to their lemmas; the heading's shape words and al-Murādī's chapters decide
    between إنْ and إنّ; content words of the same spelling are only candidates."""
    tables, _ = built
    ents = tables["particle_entries"]

    def find(sid: str, **kw: Any) -> dict[str, Any]:
        return next(e for e in ents if e["source_id"] == sid and all(e[k] == v for k, v in kw.items()))

    for sid in ("mughni", "jana-dani"):
        fi = find(sid, headword_ar="في")
        assert (fi["lemma_keys"], fi["match_confidence"]) == (["fiY"], "exact")
        assert fi["corpus_pos"] == {"P": 1701}
        la = find(sid, headword_ar="لا")
        assert la["lemma_keys"] == ["laA"] and set(la["corpus_pos"]) == {"NEG", "PRO"}
        min_ = next(e for e in ents if e["source_id"] == sid and e["headword_ar"] == "من" and e["lemma_keys"])
        assert "min" in min_["lemma_keys"] and min_["match_confidence"] == "shared-form"
    inna = find("mughni", heading_ar="إن المكسورة المشددة")
    assert (inna["lemma_keys"], inna["match_method"]) == (["<in~"], "lemma-form+shape-words")
    assert [x["key"] for x in inna["match_excluded"]] == ["<in"]
    inna = find("jana-dani", headword_ar="إن", chapter_letters=3)
    assert (inna["lemma_keys"], inna["match_method"]) == (["<in~"], "lemma-form+letter-count")
    in_ = find("jana-dani", headword_ar="إن", chapter_letters=2)
    assert in_["lemma_keys"] == ["<in"]
    idhan = find("jana-dani", headword_ar="إذن")
    assert idhan["lemma_keys"] == ["<i*FA"] and idhan["match_method"].startswith("lemma-form:tanwin-alif")
    khala = find("jana-dani", headword_ar="خلا")
    assert not khala["corpus_links"] and khala["homograph_lemma_keys"] == ["xalaA"]
    assert khala["unmapped_reason"] == "only content words share this spelling in the corpus"
    huwa = find("jana-dani", headword_ar="هو وهي وهم")
    assert [x["kind"] for x in huwa["corpus_links"]] == ["pronoun"] * 3
    waw = find("jana-dani", headword_ar="الواو")
    assert "w:CONJ+" in waw["affix_tags"] and not waw["lemma_keys"]
    shin = find("jana-dani", headword_ar="الشين")
    assert not shin["corpus_links"] and shin["unmapped_reason"].startswith("no corpus affix")
    # particles get no root: no row carries one
    assert not any("root" in k for e in ents for k in e)


def test_rows_are_verbatim_sourced_and_located(built) -> None:
    """Every row's text and every heading is a slice of its source after the documented cleaning, re-run
    here on the pinned file; locators name the version whose page markers give the printed page."""
    tables, _ = built
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    sources = {s["id"]: s for s in reg["sources"]}
    texts = {}
    for sid, s in sources.items():
        ps = s.get("page_source")
        page_raw = (RAW / ps["file"]).read_text(encoding="utf-8") if ps else None
        texts[sid] = load_source(s, (RAW / s["file"]).read_text(encoding="utf-8"), page_raw).text
    assert {r["id"] for r in tables["particle_sources"]} == set(sources)
    for e in tables["particle_entries"]:
        s = sources[e["source_id"]]
        uri = s["page_source"]["openiti_uri"] if s.get("page_source") else s["openiti_uri"]
        assert e["locator"].startswith(f"urn:cts:arabicLit:{uri}:1.")
        assert e["heading_ar"] is None or e["heading_ar"] in texts[e["source_id"]]
        assert e["headword_supplied"] == (e["heading_ar"] is None)
        assert e["status"] == STATUS
    for r in tables["particle_senses"]:
        assert r["kind"] in ROW_KINDS and r["status"] == STATUS
        assert r["text_ar"] and r["text_ar"] in texts[r["source_id"]], r["id"]
        assert re.fullmatch(r"ms\d{3}", r["milestone"])
        if r["kind"] == "sense":
            assert r["marker_ar"] and r["text_ar"].startswith(r["marker_ar"])
            assert r["label_ar"] is None or r["label_ar"] in r["text_ar"]
    # printed pages, checked on shamela.ws: book 26099 page 1 is printed page 19 (the introduction), page 226
    # is printed 244 («وزاد ابن عصفور …»); the Mughnī's «الباء المفردة» is on printed 137 (book 6972, page 126)
    s = sources["jana-dani"]
    jana = load_source(
        s,
        (RAW / s["file"]).read_text(encoding="utf-8"),
        (RAW / s["page_source"]["file"]).read_text(encoding="utf-8"),
    )
    assert jana.pages.locator(jana.text.index("وزاد ابن عصفور أن عن تكون اسما"))["page"] == 244
    assert jana.pages.locator(jana.text.index("بسم الله الرحمن الرحيم"))["page"] == 19


def test_citations_point_into_rows_and_the_quran(built) -> None:
    tables, _ = built
    rows = {r["id"]: r for r in tables["particle_senses"]}
    with (BUILD / "verses.jsonl").open(encoding="utf-8") as fh:
        verse_keys = {json.loads(line)["key"] for line in fh}
    for x in tables["particle_citations"]:
        r = rows[x["sense_id"]]
        if x["kind"] == "quote":
            assert r["text_ar"][x["start"] : x["end"]] == x["quote"]
        assert set(x["verse_keys"]) <= verse_keys
        assert all(set(k) <= verse_keys for k in x["candidates"])
        assert (x["status"] == "resolved") == bool(x["verse_keys"])
        if x["status"] == "resolved":
            assert set(x["verse_keys"]) <= set(r["verses"])
    for r in rows.values():
        assert set(r["verses"]) <= verse_keys


def test_registry_pins_and_licence(built) -> None:
    _, report = built
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    rel = yaml.safe_load((REPO / "data" / "relations.yaml").read_text(encoding="utf-8"))
    assert reg["openiti"]["commit"] == rel["openiti"]["commit"]  # the release the relation seeds pin
    assert reg["openiti"]["licence"] == "CC BY-NC-SA 4.0"
    assert reg["openiti"]["licence_clause"] == rel["openiti"]["licence_clause"]
    for s in reg["sources"]:
        pins = [(s["file"], s["sha256"], s["openiti_uri"])]
        if s.get("page_source"):
            ps = s["page_source"]
            pins.append((ps["file"], ps["sha256"], ps["openiti_uri"]))
        for f, sha, uri in pins:
            assert re.fullmatch(r"[0-9a-f]{64}", sha)
            assert f.startswith("openiti-particles/data/") and f.endswith(uri)
        assert reg["openiti"]["commit"] in s["source_url"] and s["source_url"].endswith(s["openiti_uri"])
        for k in (
            "attribution_ar",
            "attribution_en",
            "title_ar",
            "title_en",
            "edition_ar",
            "edition_en",
            "use",
        ):
            assert s[k] and unicodedata.is_normalized("NFC", s[k]), (s["id"], k)
    # al-Murādī's text and its page source are one typing: two letters differ, as the registry says
    align = report["sources"]["jana-dani"]["page_alignment"]
    assert align["letters_differing"] == 2 and align["page_markers"] == 605
