"""Loanwords (PLAN P3.7a): al-Suyūṭī's al-Muhadhdhab — cleaning, structure, languages, Quran links, the tables.

The unit tests need no data. The data tests read the pinned OpenITI files (data/raw/openiti-loanwords) and a
dataset build (data/build/2026.10.0); they skip, with that reason, where either is absent, and fail instead
when JADHR_REQUIRE_DATA=1. Facts asserted here were read in the source files by hand: «أباريق» opens «حرف
الهمزة» on printed page 33 («PageV01P032» closes page 32 just before the chapter heading) and cites al-Thaʿālibī
and Abū Ḥātim («حكى الثعالبي في فقه اللغة وأبو حاتم اللغوي في كتاب الزينة أنها فارسية»); «ابلعي» quotes
«وقيل يا أرض ابلعي ماءك» (11:44); «آزر» quotes «وإذ قال إبراهيم لأبيه آزر» (6:74); «درى» is cut by the
base-typing block on page 58 and goes on on page 59 («وكذا قال أبو القاسم …»); the author's count closes the
book («فتمت بدونها مائة لفظة وسبع عشرة لفظة»).
"""

from __future__ import annotations

import hashlib
import itertools
import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

import pytest
import yaml
from jadhr_pipeline.loanwords import NAMING_GROUPS, STATUS, build_loanwords
from jadhr_pipeline.loanwords.linking import LEVELS, key_at, link_parts, marked, spell
from jadhr_pipeline.loanwords.structure import (
    bracketed_headings,
    find_languages,
    language_forms,
    sentence_start,
    speakers,
)
from jadhr_pipeline.loanwords.text import load_source, preclean
from jadhr_pipeline.relations.openiti import clean

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("JADHR_RAW_DIR", REPO / "data" / "raw"))
BUILD = Path(os.environ.get("JADHR_BUILD_DIR", RAW.parent / "build" / "2026.10.0"))
REGISTRY = REPO / "data" / "loanwords.yaml"
LETTERS = re.compile("[ء-ي]")


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def _reg() -> dict[str, Any]:
    return yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))


# --- unit -------------------------------------------------------------------------------------------------
SAMPLE = """######OpenITI#
#META#Header#End#

# | 1 ( حرف الهمزة ) 1
# ( أباريق ) : حكى الثعالبي أنها فارسية . | وقال الجواليقي : ( الأبريق
~~فارسي معرب ) . | PageV01P033 سجين : ذكر ' أبو حاتم ' أنه غير عربي .
"""


def test_preclean_pipe_paragraphs_and_name_marks() -> None:
    pre, stats = preclean(SAMPLE, {"pipe-paragraphs", "name-marks"})
    assert stats == {"pipe-paragraphs": 2, "name-marks": 2}
    c = clean(pre, "x.y.z-ara1")
    paras = c.text.split("\n")
    assert paras[0] == "1 (حرف الهمزة) 1"  # the heading bar is left to the cleaner
    assert paras[1] == "(أباريق): حكى الثعالبي أنها فارسية."
    assert paras[2] == "وقال الجواليقي: (الأبريق فارسي معرب)."
    assert paras[3] == "سجين: ذكر أبو حاتم أنه غير عربي."
    assert [p for _, _, p in c.pages] == [33]
    # letters are untouched: only bars, apostrophes and whitespace differ from the plain cleaning
    plain = clean(SAMPLE, "x.y.z-ara1").text
    assert LETTERS.findall(c.text) == LETTERS.findall(plain)


def test_sentence_starts_and_headings() -> None:
    t = "1 (حرف الهمزة) 1\n(أباريق): حكى. (أب): قال: (الأب): الحشيش.\nقال:\n(سجيل) بالفارسية. ) آنية (: وفي"
    heads = bracketed_headings(t, 0, len(t))
    got = [(t[h.word[0] : h.word[1]], h.style) for h in heads]
    # «(الأب)» follows a colon after «قال», «(سجيل)» a paragraph break after «قال:»: quotations, not headings
    assert got == [("أباريق", "brackets"), ("أب", "brackets"), ("آنية", "reversed-brackets")]
    assert sentence_start("أفريقية.: (القيوم)", len("أفريقية.: "))
    assert not sentence_start("قال: (الأب)", len("قال: "))


def test_language_forms_match_words_with_spans() -> None:
    forms = language_forms(_reg()["languages"])
    t = "قال: (سيناء) بالنبيطية: الحسن، والدبا بلسان العبرية والسريانية، وقال أبو علي الفارسي (كلمة أعجمية)."
    found = find_languages(t, 0, len(t), forms)
    assert [(x["key"], x["matched_ar"], bool(x["slip_evidence"])) for x in found] == [
        ("nabataean", "بالنبيطية", True),
        ("hebrew", "بلسان العبرية", False),
        ("syriac", "والسريانية", False),
        ("muarrab", "أعجمية", False),
    ]  # «الفارسي» alone is Abū ʿAlī's nisba, not Persian
    assert all(t[x["start"] : x["end"]] == x["matched_ar"] for x in found)
    t2 = "قال: يقال إنه بلغة ( النبط ) كذا"
    assert [x["matched_ar"] for x in find_languages(t2, 0, len(t2), forms)] == ["بلغة ( النبط"]


def test_spelling_levels() -> None:
    assert key_at("exact", "إصرى") == key_at("exact", "إِصۡرِي")  # a final yā' with or without its dots
    assert key_at("exact", "استبرق") != key_at("exact", "إِسْتَبْرَق")
    assert key_at("initial-alif", "استبرق") == key_at("initial-alif", "إِسْتَبْرَق")
    assert key_at("exact", "متكئا") != key_at("exact", "متكأ")
    assert key_at("hamza-seat", "متكئا") == key_at("hamza-seat", "متكأ")
    assert key_at("hamza-seat", "منساة") != key_at("hamza-seat", "منسأة")
    assert key_at("normalised", "منساة") == key_at("normalised", "منسأة")
    assert LEVELS == ("exact", "initial-alif", "hamza-seat", "normalised")
    # a lemma stored as alif + madda sign keeps its initial «آ» (built from parts, not typed)
    decomposed = "ا" + chr(0x653) + "زَر"
    assert spell(decomposed) == "آزر" and spell("آزَرَ") == "آزر"
    assert link_parts("الأولى والآخرة") == ["الأولى", "الآخرة"] and link_parts("هيت لك") == ["هيت", "لك"]


def test_marked_quotations() -> None:
    t = "في قوله تعالى: أوبي معه قال: سبحي. وعن ابن جريج قال الحواريون الغاسلون. سمعت (حمل بعير) قال"
    assert marked(t, t.index("أوبي"), t.index("أوبي") + len("أوبي معه"))  # after «قوله تعالى»
    assert marked(t, t.index("حمل"), t.index("حمل") + len("حمل بعير"))  # in brackets
    s = t.index("قال الحواريون")
    assert not marked(t, s, s + len("قال الحواريون"))  # the author's own prose


def test_speakers() -> None:
    t = "وقال ابن فارس لو كان فيه. ونقل الثعلبي رحمه الله. ثم رأيت ابن النقيب صرح بذلك فقال: قلت وأيضا"
    got = [(x["kind"], x["who_ar"]) for x in speakers(t, 0, len(t))]
    assert got == [("named", "ابن فارس"), ("named", "الثعلبي"), ("named", "ابن النقيب"), ("author", "قلت")]


# --- data ---------------------------------------------------------------------------------------------------
def _need_data() -> None:
    reg = _reg()
    s = reg["sources"][0]
    files = [s["file"], s["card_file"]] + [f for x in s["cross_check"] for f in (x["file"], x["card_file"])]
    missing = [f for f in files if not (RAW / f).exists()]
    missing += [
        str(BUILD / f) for f in ("lemmas.jsonl", "words.jsonl", "roots.jsonl") if not (BUILD / f).exists()
    ]
    if missing:
        msg = f"loanword sources or dataset build not available: {missing[:3]}"
        if os.environ.get("JADHR_REQUIRE_DATA") == "1":
            pytest.fail(msg)
        pytest.skip(msg)


@pytest.fixture(scope="module")
def built() -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    _need_data()
    return build_loanwords(RAW, BUILD, REGISTRY)


@pytest.fixture(scope="module")
def text() -> str:
    _need_data()
    s = _reg()["sources"][0]
    return load_source(s, (RAW / s["file"]).read_text(encoding="utf-8")).text


@pytest.fixture(scope="module")
def corpus() -> dict[str, Any]:
    _need_data()
    words = {}
    with (BUILD / "words.jsonl").open(encoding="utf-8") as fh:
        for line in fh:
            w = json.loads(line)
            words[w["location"]] = {"lemma_id": w["lemma_id"], "pos": w["pos"]}
    with (BUILD / "lemmas.jsonl").open(encoding="utf-8") as fh:
        lemmas = {x["id"]: x for x in map(json.loads, fh)}
    return {"words": words, "lemmas": lemmas}


def _entry(tables: dict[str, Any], headword: str) -> dict[str, Any]:
    hits = [e for e in tables["loanword_entries"] if e["headword_ar"] == headword]
    assert len(hits) == 1, headword
    return hits[0]


def _links(tables: dict[str, Any], eid: str) -> list[dict[str, Any]]:
    return [x for x in tables["loanword_links"] if x["entry_id"] == eid]


def test_registry_pins_licence_and_sums() -> None:
    _need_data()
    reg = _reg()
    part = yaml.safe_load((REPO / "data" / "particles.yaml").read_text(encoding="utf-8"))
    assert reg["openiti"]["commit"] == part["openiti"]["commit"]  # the release the particle works pin
    assert reg["openiti"]["licence"] == "CC BY-NC-SA 4.0"
    assert reg["openiti"]["licence_clause"] == part["openiti"]["licence_clause"]
    sums = {}
    for line in (RAW / "openiti-loanwords" / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines():
        sha, name = line.split()
        sums[name.lstrip("./")] = sha
    s = reg["sources"][0]
    pins = [(s["file"], s["sha256"]), (s["card_file"], s["card_sha256"])]
    pins += [
        p for x in s["cross_check"] for p in ((x["file"], x["sha256"]), (x["card_file"], x["card_sha256"]))
    ]
    assert len(pins) == 6 == len(sums)
    for f, sha in pins:
        assert sums[Path(f).name] == sha, f
        assert hashlib.sha256((RAW / f).read_bytes()).hexdigest() == sha, f
    assert s["source_url"].endswith(s["openiti_uri"]) and reg["openiti"]["commit"] in s["source_url"]
    for k in ("attribution_ar", "attribution_en", "title_ar", "title_en", "edition_ar", "edition_en", "use"):
        assert s[k] and unicodedata.is_normalized("NFC", s[k]), k


def test_counts_match_the_report(built) -> None:
    """The figures of the build report — recomputed here from the rows."""
    tables, report = built
    ents, links, passages = tables["loanword_entries"], tables["loanword_links"], tables["loanword_passages"]
    rep = report["sources"]["muhadhdhab"]
    assert len(ents) == rep["entries"] == report["totals"]["entries"] == 125
    by_chapter = {}
    for e in ents:
        by_chapter[e["chapter_ar"]] = by_chapter.get(e["chapter_ar"], 0) + 1
    assert list(by_chapter.values()) == [
        20,
        3,
        3,
        2,
        5,
        3,
        9,
        1,
        15,
        2,
        3,
        6,
        3,
        2,
        2,
        11,
        5,
        1,
        13,
        2,
        4,
        3,
        7,
    ]
    assert by_chapter == rep["entries_by_chapter"]
    assert len(passages) == 79
    kinds = {}
    for p in passages:
        kinds[f"{p['section']}:{p['kind']}"] = kinds.get(f"{p['section']}:{p['kind']}", 0) + 1
    assert (
        kinds
        == rep["passages"]
        == {
            "introduction:editorial-heading": 2,
            "introduction:text": 27,
            "chapter:chapter-heading": 23,
            "set-aside:copy": 21,
            "set-aside:chapter-heading": 1,
            "conclusion:text": 4,
            "colophon:colophon": 1,
        }
    )
    assert len(links) == rep["links"]["links"] == 122
    methods = {}
    for x in links:
        m = x["method"].split(":")[0]
        methods[m] = methods.get(m, 0) + 1
    assert (
        methods
        == rep["links"]["by_method"]
        == {
            "word-form+lemma-form": 65,
            "quoted-phrase": 36,
            "word-form": 17,
            "initials-form": 3,
            "lemma-form": 1,
        }
    )
    status = [e["link_status"] for e in ents]
    assert (
        status.count("linked"),
        status.count("candidates"),
        status.count("partial"),
        status.count("unlinked"),
    ) == (
        121,
        4,
        0,
        0,
    )
    assert sorted(e["headword_ar"] for e in ents if e["link_status"] != "linked") == [
        "أب",
        "بيع",
        "قفل",
        "هود",
    ]
    named = [e for e in ents if e["language_keys"]]
    assert len(named) == rep["languages"]["entries_naming_a_language"] == 108
    by_lang: dict[str, int] = {}
    for e in ents:
        for k in e["language_keys"]:
            by_lang[k] = by_lang.get(k, 0) + 1
    assert by_lang == rep["languages"]["entries_by_language"]
    assert (by_lang["abyssinian"], by_lang["nabataean"], by_lang["persian"], by_lang["hebrew"]) == (
        28,
        27,
        20,
        18,
    )
    assert (by_lang["syriac"], by_lang["rumi"], by_lang["coptic"], by_lang["berber"]) == (18, 9, 3, 5)
    assert report["totals"]["status"] == {"extracted": 326}


def test_abariq_first_entry(built, corpus) -> None:
    tables, _ = built
    first = tables["loanword_entries"][0]
    assert (first["id"], first["seq"], first["chapter_ar"], first["chapter_seq"]) == (
        "muhadhdhab:001",
        1,
        "حرف الهمزة",
        1,
    )
    assert (first["headword_ar"], first["heading_ar"], first["page"], first["milestone"]) == (
        "أباريق",
        "(أباريق)",
        33,
        "ms004",
    )
    assert first["text_ar"].startswith(
        "(أباريق): حكى الثعالبي في فقه اللغة وأبو حاتم اللغوي في كتاب الزينة أنها فارسية."
    )
    assert "وقال الجواليقي: (الأبريق فارسي معرب" in first["text_ar"]
    assert first["language_keys"] == ["persian"]
    assert next(x["matched_ar"] for x in first["languages"] if x["key"] == "persian") == "فارسية"
    [link] = _links(tables, first["id"])
    assert link["lemma_id"] == corpus["words"]["56:18:2"]["lemma_id"]  # «وَأَبَارِيقَ»
    assert nfc(corpus["lemmas"][link["lemma_id"]]["ar"]) == nfc("أَبَارِيق")
    assert (link["method"], link["scope"], link["confidence"]) == (
        "word-form+lemma-form:exact",
        "lemma",
        "exact",
    )


def test_hand_checked_links(built, corpus) -> None:
    """Links read against the entry and the verse: a quoted phrase fixes the occurrence, and the other lemmas of
    the spelling are kept as excluded."""
    tables, _ = built

    def one(head: str) -> dict[str, Any]:
        [x] = _links(tables, _entry(tables, head)["id"])
        return x

    cases = {
        # headword: (method, locations)
        "ابلعي": ("quoted-phrase:exact", ["11:44:3"]),
        "آزر": ("quoted-phrase:exact", ["6:74:5"]),
        "إلا": ("quoted-phrase:exact", ["9:8:8", "9:10:5"]),
        "آن": ("quoted-phrase:exact", ["55:44:5"]),
        "آنية": ("quoted-phrase:exact", ["88:5:4"]),
        "تحت": ("quoted-phrase:exact", ["19:24:3"]),
        "وزر": ("quoted-phrase:exact", ["75:11:3"]),
        "هون": ("quoted-phrase:exact", ["25:63:7"]),
        "كفر": ("quoted-phrase:exact", ["47:2:14"]),
        "قسيس": ("quoted-phrase:sound-ending", ["5:82:22"]),
        "طه": ("initials-form:exact", ["20:1:1"]),
        "يس": ("initials-form:exact", ["36:1:1"]),
        "ن": ("initials-form:exact", ["68:1:1"]),
        "متكئا": ("word-form:hamza-seat", ["12:31:8"]),
        "منساة": ("word-form:normalised", ["34:14:13"]),
    }
    for head, (method, locs) in cases.items():
        x = one(head)
        assert (x["method"], x["locations"]) == (method, locs), head
        for loc in locs:
            assert corpus["words"][loc]["lemma_id"] == x["lemma_id"], (head, loc)
    azar = one("آزر")
    assert corpus["lemmas"][azar["lemma_id"]]["pos"] == "PN"
    assert [nfc(e["lemma_ar"]) for e in azar["excluded"]] == [nfc("آزَرَ")]  # the verb «فآزره» (48:29)
    assert azar["evidence"][0]["quote_ar"] == "وإذ قال إبراهيم لأبيه آزر"
    assert {nfc(e["lemma_ar"]) for e in one("إلا")["excluded"]} >= {nfc("إِلَّا")}
    assert {nfc(e["lemma_ar"]) for e in one("وزر")["excluded"]} == {nfc("وِزْر")}
    assert one("استبرق")["method"] == "word-form+lemma-form:initial-alif"
    assert one("طه")["kind"] == "initials" and one("طه")["lemma_id"] is None
    # a several-word heading: each word linked to its own verse; a function word inside is not linked
    ula = _entry(tables, "الأولى والآخرة")
    assert [(x["part_ar"], x["locations"]) for x in _links(tables, ula["id"])] == [
        ("الأولى", ["33:33:8"]),
        ("الآخرة", ["38:7:6"]),
    ]
    hayt = _entry(tables, "هيت لك")
    assert [x["part_ar"] for x in _links(tables, hayt["id"])] == ["هيت"] and hayt["link_status"] == "linked"
    assert hayt["parts"][1]["function_word"] and hayt["parts"][1]["reason"].endswith("not linked")
    # the misspelt heading «سرداق» is linked by what it reads
    sur = _entry(tables, "سرداق")
    assert sur["headword_reads_ar"] == "سرادق" and one("سرداق")["part_ar"] == "سرادق"


def test_unlinked_keep_candidates(built) -> None:
    tables, _ = built
    for head, cands in {
        "أب": {"أَبٌ", "أَبّ"},
        "بيع": {"بَيْع", "بِيَع"},
        "قفل": {"أَقْفَال"},
    }.items():
        e = _entry(tables, head)
        assert not _links(tables, e["id"]) and e["link_status"] == "candidates"
        assert {nfc(c["lemma_ar"]) for c in e["candidates"]} == {nfc(c) for c in cands}, head
        assert e["unlinked_reason"]
    hud = _entry(tables, "هود")
    assert len(hud["candidates"]) == 2 and {c["pos"] for c in hud["candidates"]} == {"PN"}


def test_every_link_is_valid(built, corpus) -> None:
    tables, _ = built
    ents = {e["id"]: e for e in tables["loanword_entries"]}
    levels = {*LEVELS, "sound-ending"}
    methods = {"quoted-phrase", "word-form", "lemma-form", "word-form+lemma-form", "initials-form"}
    confidence = {
        "exact": "exact",
        "initial-alif": "high",
        "hamza-seat": "high",
        "sound-ending": "high",
        "normalised": "medium",
    }
    for x in tables["loanword_links"]:
        method, level = x["method"].split(":")
        assert method in methods and level in levels and level == x["level"], x["id"]
        assert x["confidence"] == confidence[level], x["id"]
        assert x["status"] == STATUS
        e = ents[x["entry_id"]]
        if x["kind"] == "initials":
            assert x["lemma_id"] is None and all(
                corpus["words"][loc]["pos"] == "INL" for loc in x["locations"]
            )
        else:
            assert x["kind"] == "lemma" and x["lemma_id"] in corpus["lemmas"]
            assert corpus["lemmas"][x["lemma_id"]]["ar"] == x["lemma_ar"]
        if x["scope"] == "lemma":
            assert x["locations"] is None and "lemma-form" in method
        else:
            assert x["scope"] in ("form", "occurrence") and x["locations"]
            for loc in x["locations"]:
                assert corpus["words"][loc]["lemma_id"] == x["lemma_id"], (x["id"], loc)
                assert x["verse_keys"] and ":".join(loc.split(":")[:2]) in x["verse_keys"]
        if method == "quoted-phrase":
            assert x["scope"] == "occurrence" and x["evidence"]
        for ev in x["evidence"]:
            assert e["text_ar"][ev["start"] : ev["end"]] == ev["quote_ar"]
            assert len(re.findall("[ء-ي]+", ev["quote_ar"])) >= 2
        assert spell(x["part_ar"]) in {
            spell(p) for p in (e["headword_reads_ar"] or e["headword_ar"]).split()
        } | {spell(p[1:]) for p in (e["headword_reads_ar"] or e["headword_ar"]).split()}
    linked = {x["entry_id"] for x in tables["loanword_links"]}
    for e in tables["loanword_entries"]:
        assert (e["link_status"] == "linked") == (e["id"] in linked), e["id"]
        assert set(e["lemma_ids"]) == {
            x["lemma_id"] for x in tables["loanword_links"] if x["entry_id"] == e["id"] and x["lemma_id"]
        }


def test_rows_are_verbatim_and_cover_the_text(built, text) -> None:
    """Every row is a slice of the cleaned text (the loading re-run here on the pinned file); passages and
    entries together hold every letter of it once, in order. A negative control — one row left out — fails."""
    tables, report = built
    spans = []
    for e in tables["loanword_entries"]:
        assert e["status"] == STATUS
        assert e["text_ar"] == "\n".join(s["text_ar"] for s in e["segments"])
        assert e["text_ar"].startswith(e["heading_ar"])
        for s in e["segments"]:
            a, b = s["offsets"]
            assert text[a:b] == s["text_ar"], e["id"]
            assert re.fullmatch(r"ms\d{3}", s["milestone"]) and s["locator"].endswith(f":1.{s['page']}")
            spans.append((a, b))
        for x in e["languages"]:
            assert e["text_ar"][x["start"] : x["end"]] == x["matched_ar"], e["id"]
    for p in tables["loanword_passages"]:
        assert p["status"] == STATUS
        a, b = p["offsets"]
        assert text[a:b] == p["text_ar"], p["id"]
        spans.append((a, b))
        for x in p["speakers"]:
            assert p["text_ar"][x["start"] : x["end"]] == x["who_ar"] or x["kind"] == "author"
    spans.sort()

    def letters_of(sp: list[tuple[int, int]]) -> str:
        return "".join("".join(LETTERS.findall(text[a:b])) for a, b in sp)

    assert all(b1 <= a2 for (_, b1), (a2, _) in itertools.pairwise(spans))
    whole = "".join(LETTERS.findall(text))
    assert letters_of(spans) == whole
    assert letters_of(spans[:40] + spans[41:]) != whole  # negative control: a row left out is seen
    cov = report["sources"]["muhadhdhab"]["coverage"]
    assert cov["letters_in_text"] == cov["letters_in_rows"] == len(whole) == 25580
    assert cov["letters_outside_rows"] == [] and cov["overlapping_rows"] == 0


def test_set_aside_blocks_and_interrupted_entry(built, text) -> None:
    tables, report = built
    rep = report["sources"]["muhadhdhab"]["set_aside"]
    first = rep["base-typing-sin-to-sad"]
    assert [c["headword_ar"] for c in first["copies"]][:3] == ["السجل", "سجيل", "سجين"]
    assert len(first["copies"]) == 19 and {c["page"] for c in first["copies"]} == {58}
    second = rep["base-typing-munfatir-muhl"]
    assert [(c["headword_ar"], c["page"]) for c in second["copies"]] == [("منتظر", 125), ("المهل", 125)]
    ents = {e["id"]: e for e in tables["loanword_entries"]}
    for p in tables["loanword_passages"]:
        if p["kind"] == "copy":
            assert p["section"] == "set-aside" and p["copy_of_entry_id"] in ents
            assert p["id"] in ents[p["copy_of_entry_id"]]["set_aside_copy_ids"]
    # «سيدها»: the re-typed page names no language, its set-aside copy names Coptic
    sayyid = _entry(tables, "سيدها")
    assert sayyid["language_keys"] == [] and sayyid["page"] == 77
    [copy] = [p for p in tables["loanword_passages"] if p["id"] in sayyid["set_aside_copy_ids"]]
    assert [x["matched_ar"] for x in copy["languages"]] == ["بلسان القبط"]
    # «درى» runs on page 58, the block stands between its two sentences, it goes on on page 59
    dur = _entry(tables, "درى")
    assert [s["page"] for s in dur["segments"]] == [58, 59] and dur["pages"] == [58, 59]
    assert dur["segments"][0]["text_ar"] == "(درى) قال شيدلة في (البرهان) الدرى المضيء بالحبشية."
    assert dur["segments"][1]["text_ar"] == "وكذا قال أبو القاسم في لغات القرآن، والواسطي في الإرشاد."
    # the author's own count: 125 entries less his six repeats and the two «some count» = 117
    ac = report["sources"]["muhadhdhab"]["author_count"]
    assert (ac["entries"], ac["entries_less_named"], ac["stated"], ac["agrees"]) == (125, 117, 117, True)
    assert "فتمت بدونها مائة لفظة وسبع عشرة لفظة" in text


def test_introduction_views_and_speakers(built) -> None:
    tables, _ = built
    intro = [p for p in tables["loanword_passages"] if p["section"] == "introduction"]
    views = [p["view_id"] for p in intro if p["view_id"]]
    assert list(dict.fromkeys(views)) == ["denial", "occurrence", "author", "reconciliation", "list"]
    reg = _reg()["sources"][0]["introduction"]["views"]
    for v in reg:
        body = "\n".join(p["text_ar"] for p in intro if p["view_id"] == v["id"])
        assert v["stated_as"] in body and all(h in body for h in v["held_by"]), v["id"]
    first = intro[1]
    assert first["text_ar"].startswith("اختلفت الأئمة في وقوع المعرب في القرآن")
    assert first["page"] == 21 and first["pages"] == [21, 22]
    who = {p["text_ar"][:12]: [x["who_ar"] for x in p["speakers"]] for p in intro}
    assert who["وقال ابن فارس"[:12]] == ["ابن فارس"]
    assert who["ونقل الثعلبي رحمه"[:12]] == ["الثعلبي"]
    assert who["وقال أبو عبيد القاسم"[:12]] == ["أبو عبيد القاسم بن سلام"]
    edit = [p["text_ar"] for p in intro if p["kind"] == "editorial-heading"]
    assert edit == ["1 (مقدمة) 1", "الرأي الذي اختاره السيوطي."]
    concl = [p for p in tables["loanword_passages"] if p["section"] == "conclusion"]
    assert [p["introduced_by_ar"] for p in concl] == [None, "ابن السبكي", "الحافظ ابن حجر", "وقلت"]


def test_languages_and_versions(built) -> None:
    tables, report = built
    rep = report["sources"]["muhadhdhab"]
    for e in tables["loanword_entries"]:
        assert e["language_keys"] == list(
            dict.fromkeys(x["key"] for x in e["languages"] if x["group"] in NAMING_GROUPS)
        )
    assert [x["word_ar"] for x in rep["languages"]["unrecognised_language_words"]] == ["بالطحاوية"]
    assert {x["matched_ar"] for x in rep["languages"]["slip_forms_matched"]} == {
        "أوسريانية",
        "بالنبيطية",
        "بالعنبرانية",
    }
    assert _entry(tables, "وزر")["language_keys"] == ["nabataean", "yemen", "himyar"]
    assert _entry(tables, "قنطار")["language_keys"] == ["rumi", "syriac", "berber", "ifriqiya"]
    same = rep["versions"]["same-typing"]
    assert (
        same["letters_differing"],
        same["page_markers_at_the_same_letter"],
        same["page_labels_following_their_marker"],
    ) == (
        236,
        126,
        126,
    )
    assert same["page_labels_out_of_step"] == 0
    other = rep["versions"]["other-edition"]
    assert (other["words_primary"], other["words_other"], other["words_in_common_in_order"]) == (
        6142,
        5454,
        5130,
    )
    assert rep["cleaning"]["pipe-paragraphs"] == 225 and rep["cleaning"]["name-marks"] == 116
    src = tables["loanword_sources"][0]
    assert (
        src["openiti_uri"] == "0911Suyuti.MuhadhdhabFimaWaqaca.JK009264-ara1"
        and src["licence"] == "CC BY-NC-SA 4.0"
    )
