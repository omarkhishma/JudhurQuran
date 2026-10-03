"""al-Mufradat split per word and per numbered sense (PLAN P3.1): unit rules, and the tables built from the
stored articles.

The unit tests need no data. The data tests read a dataset build (data/build/2026.10.0: lexicon_entries, roots,
lemmas, words, verses, surahs) and the pinned Shamela pages of al-Mufradat (data/raw, for page numbers); they skip,
with that reason, where either is absent, and fail instead when JADHR_REQUIRE_DATA=1.

The hand-checked sample (``SAMPLE``) is twenty articles: every 81st article with a Quranic root from the 8th
(19 articles) and «علم». Each was read against its cuts, headwords, lemma mappings and senses. Verdict, recorded
here and in docs/DECISIONS.md: 99 sub-entries; every one of the 35 headwords mapped to a lemma is the right lemma
(form level; three at medium confidence: two verb citations and one twin-root); 4 shortfalls, all of the kind
"a word is treated without a cut": «فَالْغُلُّ مختصّ» stays under «انْغَلَّ» (غل), «والْمَشِيئَةُ» starts its
entry one sentence late (شيء), «أَطْرَدَهُ السّلطانُ» stays in the opening entry (طرد), «ودَرَسْتُ العلم:» is kept in
«دَرَسَ» (درس, same lemma); no spurious cut and no wrong lemma.
"""

from __future__ import annotations

import json
import os
import unicodedata
from collections import Counter
from itertools import pairwise
from pathlib import Path
from typing import Any

import pytest
import yaml
from jadhr_pipeline.meanings import STATUS, build_mufradat
from jadhr_pipeline.meanings.lemmamap import LemmaMapper, vocalised
from jadhr_pipeline.meanings.mufradat import Article, conjunction_length, has_root, sense_lists

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("JADHR_RAW_DIR", REPO / "data" / "raw"))
BUILD = Path(os.environ.get("JADHR_BUILD_DIR", RAW.parent / "build" / "2026.10.0"))
REGISTRY = REPO / "data" / "lexica.yaml"


def N(x: Any) -> Any:
    """NFC throughout: typed Arabic literals are compared in canonical mark order (DECISIONS lesson)."""
    if isinstance(x, str):
        return unicodedata.normalize("NFC", x)
    if isinstance(x, (list, tuple)):
        return type(x)(N(v) for v in x)
    return x


# --- unit: words of the root ------------------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("word", "root", "expected"),
    [
        ("والتَّعَلُّمُ", "علم", True),  # a shadda doubles the radical
        ("الاستعلام", "علم", True),  # pattern letters between radicals
        ("اصطبر", "صبر", True),
        ("عِدَة", "وعد", True),  # a first weak radical left out
        ("دَعَتْ", "دعو", True),  # a last weak radical left out, an ending after it
        ("الرَّسِ", "رسس", True),  # a geminate written once
        ("النّهار", "نهي", False),  # «ر» after the radicals is not an ending
        ("أصله", "أله", False),  # «ص» is not a pattern letter
        ("ومنهم", "أمن", False),  # a hamza radical is not written «و» at the start
    ],
)
def test_has_root(word: str, root: str, expected: bool) -> None:
    radicals = ["ء" if ch == "أ" else ch for ch in root]
    assert has_root(word, radicals) is expected


def test_conjunction_length() -> None:
    assert conjunction_length("والعَلَمُ", ["ع", "ل", "م"]) == 1
    assert conjunction_length("وَعَدَ", ["و", "ع", "د"]) == 0  # the و is the first radical
    assert conjunction_length("ورُسَّ", ["ر", "س", "س"]) == 1


# --- unit: lemma mapping ----------------------------------------------------------------------------------------
ROOTS = [
    {"id": 1, "key": "علم", "letters": ["ع", "ل", "م"]},
    {"id": 2, "key": "طلع", "letters": ["ط", "ل", "ع"]},
    {"id": 3, "key": "زيد", "letters": ["ز", "ي", "د"]},
    {"id": 4, "key": "زود", "letters": ["ز", "و", "د"]},
]
LEMMAS = [
    {"key": "Eilom", "ar": "عِلْم", "pos": "N", "verb_form": None, "root_id": 1},
    {"key": "Ealiym", "ar": "عَلِيم", "pos": "ADJ", "verb_form": None, "root_id": 1},
    {"key": "Ea`lim", "ar": "عَٰلِم", "pos": "N", "verb_form": None, "root_id": 1},
    {"key": "Ea`lamiyn", "ar": "عَٰلَمِين", "pos": "N", "verb_form": None, "root_id": 1},
    {"key": "Ealima", "ar": "عَلِمَ", "pos": "V", "verb_form": None, "root_id": 1},
    {"key": "Eal~ama", "ar": "عَلَّمَ", "pos": "V", "verb_form": 2, "root_id": 1},
    {"key": "T~alaEa", "ar": "طَّلَعَ", "pos": "V", "verb_form": 8, "root_id": 2},
    {"key": "TalaEat", "ar": "طَلَعَت", "pos": "V", "verb_form": None, "root_id": 2},
    {"key": "ziyaAdap", "ar": "زِيَادَة", "pos": "N", "verb_form": None, "root_id": 3},
    {"key": "z~aAd", "ar": "زَّاد", "pos": "N", "verb_form": None, "root_id": 4},
]


def test_lemma_mapping_rules() -> None:
    m = LemmaMapper(ROOTS, LEMMAS, [])
    got = {w: m.map(w, r) for w, r in [
        ("العَالِمُ", "علم"), ("العالَمُ", "علم"), ("العَلَمُ", "علم"), ("العِلْمُ", "علم"), ("وأَعْلَمْتُ", "علم"),
        ("اطَّلَعَ", "طلع"), ("طَلَعَ", "طلع"), ("الزَّادُ", "زيد"), ("العلم", None),
    ]}  # fmt: skip
    assert (got["العَالِمُ"].lemma_key, got["العَالِمُ"].method, got["العَالِمُ"].confidence) == (
        "Ea`lim",
        "lemma",
        "exact",
    )
    # the vowels decide: «العالَمُ» is the singular of عَٰلَمِين, not عَٰلِم
    assert (got["العالَمُ"].lemma_key, got["العالَمُ"].method) == ("Ea`lamiyn", "plural-lemma")
    # a vocalised letter without the lemma's shadda: «العَلَمُ» (a sign) is not عَلَّمَ (he taught)
    assert (got["العَلَمُ"].lemma_key, got["العَلَمُ"].reason) == (None, "no-lemma-of-the-root")
    assert got["العِلْمُ"].lemma_key == "Eilom"
    # a Form IV verb citation; the Quran has no Form IV verb of علم
    assert (got["وأَعْلَمْتُ"].lemma_key, got["وأَعْلَمْتُ"].reason) == (None, "no-lemma-of-the-root")
    # the corpus writes the Form VIII ٱطَّلَعَ as «طَّلَعَ»: only «اطَّلَعَ» is it, «طَلَعَ» is Form I
    assert got["اطَّلَعَ"].lemma_key == "T~alaEa"
    assert (got["طَلَعَ"].lemma_key, got["طَلَعَ"].method) == ("TalaEat", "verb-citation")
    # الزاد is filed by al-Rāghib under زيد; its lemma is of the twin root زود
    assert (got["الزَّادُ"].lemma_key, got["الزَّادُ"].method, got["الزَّادُ"].root_key) == (
        "z~aAd",
        "lemma+twin-root",
        "زود",
    )
    assert got["العلم"].reason == "article-not-quranic"


def test_vocalised_reads_hamza_and_madd() -> None:
    assert [x[0] for x in vocalised("آثِم")] == ["ء", "ا", "ث", "م"]  # آ in a headword: hamza + ā
    # the corpus writes «ٱسْتَيْ َٔسَ»: a hamza mark after a space is the letter ء
    corpus = "ٱسْتَيْ" + " " + chr(0x064E) + chr(0x0654) + "سَ"
    assert [x[0] for x in vocalised(corpus)] == ["ا", "س", "ت", "ي", "ء", "س"]


# --- unit: senses -----------------------------------------------------------------------------------------------
def test_sense_lists_on_a_small_article() -> None:
    body = (
        "العِلْمُ: إدراك الشيء بحقيقته، وذلك ضربان:\n\nأحدهما: إدراك ذات الشيء.\n\n"
        "والثاني: الحكم على الشيء.\n\nوالعَلَمُ: الأثر الذي يعلم به الشيء، والأمر على ثلاثة أوجه:\n\n"
        "- قول.\n\n- وفعل.\n\n- وحال."
    )
    art = Article({"body": body, "id": 1}, ["ع", "ل", "م"], [])
    cut = body.index("والعَلَمُ")
    first = sense_lists(art, 0, cut, [0, cut])
    assert [(lst.kind, [body[a:b] for a, b, _ in lst.markers]) for lst in first] == [
        ("ordinal", ["أحدهما", "والثاني"])
    ]
    assert (
        first[0].announcement is not None
        and body[first[0].announcement[0] : first[0].announcement[1]] == "ضربان"
    )
    assert first[0].announcement[2] == 2 and [r for _, r in first[0].ends] == ["next-marker", "paragraph-end"]
    second = sense_lists(art, cut, len(body), [0, cut])
    assert [(lst.kind, len(lst.markers), lst.announcement and lst.announcement[2]) for lst in second] == [
        ("bullet", 3, 3)
    ]


# --- data -------------------------------------------------------------------------------------------------------
def _need_data() -> None:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    work = next(w for w in reg["works"] if w["id"] == "mufradat")
    missing = [f["path"] for f in work["files"] if not (RAW / f["path"]).exists()]
    need = (
        "lexicon_entries.jsonl",
        "roots.jsonl",
        "lemmas.jsonl",
        "words.jsonl",
        "verses.jsonl",
        "surahs.jsonl",
    )
    missing += [str(BUILD / f) for f in need if not (BUILD / f).exists()]
    if missing:
        msg = f"al-Mufradat pages or dataset build not available: {missing[:3]}"
        if os.environ.get("JADHR_REQUIRE_DATA") == "1":
            pytest.fail(msg)
        pytest.skip(msg)


@pytest.fixture(scope="module")
def built() -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    _need_data()
    return build_mufradat(RAW, BUILD, REGISTRY)


@pytest.fixture(scope="module")
def bodies() -> dict[int, str]:
    _need_data()
    with (BUILD / "lexicon_entries.jsonl").open(encoding="utf-8") as fh:
        return {r["id"]: r["body"] for r in map(json.loads, fh) if r["work_id"] == "mufradat"}


def test_counts_match_the_report(built) -> None:
    """The figures of the build report (and of the P3.1 handover), recomputed from the rows."""
    tables, rep = built
    subs, senses, cites = (
        tables["mufradat_subentries"],
        tables["mufradat_senses"],
        tables["mufradat_citations"],
    )
    heads = [h for s in subs for h in s["headwords"]]
    assert (rep["articles"], rep["articles_with_root"]) == (1624, 1519)
    assert len(subs) == rep["subentries"] == 5626
    assert Counter(s["cut_rule"] for s in subs) == {
        "article-start": 1624,
        "colon": 3698,
        "paragraph-initial": 36,
        "vocalised-clause-initial": 268,
    }
    assert (len(heads), sum(1 for h in heads if h["lemma_key"])) == (5760, 2014)
    assert Counter(h["match_method"] or "unmapped" for h in heads) == {
        "unmapped": 3746,
        "lemma": 1636,
        "verb-citation": 252,
        "quran-form": 63,
        "plural-lemma": 47,
        "lemma+twin-root": 8,
        "verb-citation+twin-root": 6,
        "quran-form+twin-root": 1,
        "plural-lemma+twin-root": 1,
    }
    assert Counter(h["unmapped_reason"] for h in heads if not h["lemma_key"]) == {
        "no-lemma-of-the-root": 3710,
        "same-letters": 36,
    }
    assert (sum(1 for s in subs if s["lemma_keys"]), rep["lemmas_with_a_subentry"]) == (1968, 1663)
    assert rep["rooted_lemma_occurrences_covered_pct"] == 51.89
    lists = {(x["subentry_id"], x["list_no"]) for x in senses}
    assert (len(senses), len(lists)) == (339, 131)
    assert Counter(x["list_kind"] for x in senses if x["sense_index"] == 1) == {
        "ordinal": 102,
        "bullet": 17,
        "paragraph-items": 12,
    }
    assert (rep["lists_with_stated_count"], rep["lists_stated_equals_found"]) == (91, 87)
    quotes = [c for c in cites if c["end"] > c["start"]]
    assert (len(cites), len(quotes)) == (8708, 8705)
    assert Counter(c["status"] for c in quotes) == {"resolved": 8691, "unresolved": 9, "ambiguous": 5}
    assert sum(1 for c in quotes if c["ref_mismatch"]) == 38
    assert Counter(s["page_method"] for s in subs) == {"located": 5605, "article-range": 21}
    assert {s["status"] for s in [*subs, *senses]} == {STATUS}


# Twenty articles read by hand (module docstring): entry id → [(headword as written, lemma key)]
SAMPLE: dict[int, list[tuple[str, str | None]]] = {
    1000008: [("الأثاث", ">ava`v"), ("أثايث", None), ("تأثّث", None)],
    1000105: [("بسَ", None), ("بَسَسْتُ", "bus~ati"), ("انْبَسَّتِ", None), ("بَسَسْتُ", "bus~ati"), ("بَسُوس", None)],
    1000200: [
        ("الثَّلَاثَة", "vala`vap"), ("الثُّلُثُ", "v~uluv"), ("ثَلَّثْتُ", None), ("أَثْلَثْتُهُمْ", None), ("أَثْلَثَ", None),
        ("مَثْلُوث", None), ("مَثْلُوث", None), ("ثَلُوث", None), ("ثَلَّثْتُ", None), ("ثَلَّثَ", None), ("ثُلَاثِيٌّ", None),
    ],
    1000287: [
        ("الحَجَر", "Hajar"), ("الحَجْر", None), ("الحِجْر", "Hijor"), ("حَجَرْتُ", None), ("حُجِّر", None),
        ("الحَجُّورَة", None), ("تَحَجَّرَ", None), ("الأحجار", None),
    ],
    1000370: [
        ("الحَوْل", "Hawol"), ("استحال", None), ("حَوَّلْتُ", None), ("الحَوْلُ", "Hawol"), ("حَالَتِ", "HaAla"),
        ("أَحَالَتْ", None), ("أَحَال", None), ("حَالَتِ", "HaAla"), ("الحالُ", None), ("الحول", None),
        ("حَوْلُ", "Hawol"), ("الحِيلَة", "Hiylap"), ("المُحَال", None), ("استحال", None), ("الحِوَلَاء", None),
    ],
    1000455: [("دَرَسَ", "darasu")],
    1000539: [("الرَّسِ", None), ("الرَّسِّ", "r~as~"), ("رُسَّ", None)],
    1000628: [
        ("الزِّيادَةُ", "ziyaAdap"), ("ازْدَادَ", "{zodaAdu"), ("الزَّادُ", "z~aAd"), ("التَّزَوُّدُ", None),
        ("الْمِزْوَدُ", None), ("الْمَزَادَةُ", None),
    ],
    1000713: [("سنم", None)],
    1000799: [("الشَّيْءُ", "$aYo'"), ("المشيئة", None)],
    1000885: [("الطَّرْدُ", None), ("طَرَدَهُ", "Tarad"), ("مُطَارَدَةُ", None), ("المِطْرَدُ", None)],
    1000969: [("عَسَى", "EasaY"), ("المُعْسِيَاتُ", None), ("عَسِيَ", "EasaY")],
    1001053: [
        ("الغَلَلُ", None), ("انْغَلَّ", None), ("غُلَّ", None), ("الْغُلَالَةُ", None), ("الْغُلَالَةُ", None),
        ("الْغُلُولُ", None), ("الغِلُّ", "gil~"), ("غَلَّ", None), ("غَلَّ", "gal~a"), ("أَغْلَلْتُ", None),
        ("أَغَلَّ", None), ("الغُلَّةُ", None), ("الغَلَّةُ", None), ("الْمُغَلْغَلَةُ", None),
    ],
    1001135: [("الْفَوْزُ", "fawoz"), ("المَفَازَةُ", "mafaAzap"), ("فَوَّزَ", None)],
    1001218: [("القُوَّةُ", "quw~ap"), ("أَقْوَى", None)],
    1001302: [("اللَّفْظُ", None)],
    1001390: [("المَيْزُ", None), ("تَمَيَّزَ", "tamay~azu")],
    1001475: [("الإِنْكَارُ", None), ("المُنْكَرُ", "munkar"), ("نَكَرْتُ", "nakira"), ("النُّكْرُ", "n~ukor")],
    1001565: [("الوَسْوَسَةُ", None)],
    1000995: [
        ("العِلْمُ", "Eilom"), ("التَّعْلِيمُ", None), ("التَّعَلُّمُ", None), ("تَعْلِيمُهُ", None), ("عَلِيمٌ", "Ealiym"),
        ("العَالِمُ", "Ea`lim"), ("العَلَمُ", None), ("أَعْلَمْتُ", None), ("العُلَّامُ", None), ("العالَمُ", "Ea`lamiyn"),
    ],
}  # fmt: skip


def test_hand_checked_sample(built) -> None:
    tables, _ = built
    got: dict[int, list[tuple[str, str | None]]] = {}
    for s in tables["mufradat_subentries"]:
        if s["entry_id"] in SAMPLE:
            got.setdefault(s["entry_id"], []).append((s["headword_ar"], s["lemma_key"]))
    assert N(got) == N(SAMPLE)
    assert sum(len(v) for v in SAMPLE.values()) == 99
    assert sum(1 for v in SAMPLE.values() for _, k in v if k) == 35


def test_hand_checked_details(built, bodies) -> None:
    tables, _ = built
    subs = {s["id"]: s for s in tables["mufradat_subentries"]}
    senses = [x for x in tables["mufradat_senses"]]
    # علم: «العِلْمُ: … وذلك ضربان: أحدهما … والثاني …» and the second enumeration «فالأوّل … والثاني …»
    ilm = [x for x in senses if x["subentry_id"] == "mufradat:1000995:e01"]
    assert N([(x["list_no"], x["marker_ar"], x["announcement_ar"], x["stated_count"]) for x in ilm]) == N([
        (1, "أحدهما", "ضربان", 2), (1, "والثاني", "ضربان", 2), (2, "فالأوّل", None, None), (2, "والثاني", None, None),
    ])  # fmt: skip
    assert ilm[2]["verses"] == ["8:60"] and ilm[3]["verses"][:2] == ["60:10", "5:109"]
    e10 = subs["mufradat:1000995:e10"]
    assert (e10["page_ref"], e10["match_method"], e10["match_confidence"]) == (
        "581-582",
        "plural-lemma",
        "medium",
    )
    assert subs["mufradat:1000995:e01"]["page_ref"] == "580"
    # جهل: «الجهل على ثلاثة أضرب: - الأول … - والثاني … - والثالث …»; «والجاهل» opens its own entry
    jahl = [x for x in senses if x["entry_id"] == 1000264]
    assert N([x["marker_ar"] for x in jahl]) == N(["- الأول", "- والثاني", "- والثالث"])
    assert {x["announcement_ar"] for x in jahl} == {N("على ثلاثة أضرب")} and jahl[2]["verses"] == [
        "2:67",
        "49:6",
    ]
    assert (subs["mufradat:1000264:e02"]["cut_rule"], subs["mufradat:1000264:e02"]["lemma_key"]) == (
        "paragraph-initial",
        "jaAhil",
    )
    # حيي: six senses of الحياة, «الأوّل … والسادسة», announced «على أوجه» without a number
    hayat = [x for x in senses if x["subentry_id"] == "mufradat:1000372:e01"]
    assert len(hayat) == 6 and N(hayat[-1]["marker_ar"]) == N("والسادسة") and hayat[0]["stated_count"] is None
    # حدد: «وجميع حدود الله على أربعة أوجه:» and four dashes
    hadd = [x for x in senses if x["entry_id"] == 1000289]
    assert [x["list_kind"] for x in hadd] == ["bullet"] * 4 and hadd[0]["stated_count"] == 4
    # ثلث: a missing comma — «صاروا ثلاثة وحبل مَثْلُوث:» opens at «وحبل»
    e06 = subs["mufradat:1000200:e06"]
    assert N(bodies[1000200][e06["start"] : e06["start"] + 4]) == N("وحبل")
    # the first quotation of علم, its reference and its verse
    q = next(c for c in tables["mufradat_citations"] if c["id"] == "mufradat:1000995:q001")
    assert N((q["quote_ar"], q["reference_ar"])) == N(("لا تَعْلَمُونَهُمُ اللَّهُ يَعْلَمُهُمْ", "[الأنفال/ ٦٠]"))
    assert (q["verse_keys"], q["status"], q["method"], q["subentry_id"]) == (
        ["8:60"],
        "resolved",
        "text",
        "mufradat:1000995:e01",
    )


def test_rows_are_spans_of_the_stored_articles(built, bodies) -> None:
    """Every sub-entry, headword, sense and quotation is a span of the stored article (offsets checked); the
    sub-entries of an article follow one another without overlap and cover it; senses lie inside their
    sub-entry; verses are verse keys of the Quran."""
    tables, _ = built
    with (BUILD / "verses.jsonl").open(encoding="utf-8") as fh:
        verse_keys = {json.loads(line)["key"] for line in fh}
    by_art: dict[int, list[dict[str, Any]]] = {}
    for s in tables["mufradat_subentries"]:
        b = bodies[s["entry_id"]]
        assert b[s["start"] : s["end"]] == s["text_ar"] and s["text_ar"].strip() == s["text_ar"], s["id"]
        for h in s["headwords"]:
            assert b[h["start"] : h["end"]] == h["headword_ar"], s["id"]
            assert s["start"] <= h["start"] < h["end"] <= s["end"]
        assert set(s["verses"]) <= verse_keys
        by_art.setdefault(s["entry_id"], []).append(s)
    assert set(by_art) == set(bodies)
    for eid, rows in by_art.items():
        rows.sort(key=lambda s: s["seq"])
        assert rows[0]["start"] == 0 or not bodies[eid][: rows[0]["start"]].strip()
        assert not bodies[eid][rows[-1]["end"] :].strip()
        for a, z in pairwise(rows):
            assert a["end"] <= z["start"] and not bodies[eid][a["end"] : z["start"]].strip(), a["id"]
    subs = {s["id"]: s for s in tables["mufradat_subentries"]}
    for x in tables["mufradat_senses"]:
        sub = subs[x["subentry_id"]]
        assert bodies[x["entry_id"]][x["start"] : x["end"]] == x["text_ar"]
        assert sub["start"] <= x["start"] < x["end"] <= sub["end"], x["id"]
        if x["marker_ar"]:
            assert bodies[x["entry_id"]][x["marker_start"] : x["marker_end"]] == x["marker_ar"]
        assert set(x["verses"]) <= verse_keys
    for c in tables["mufradat_citations"]:
        b = bodies[c["entry_id"]]
        assert b[c["start"] : c["end"]] == c["quote_ar"]
        if c["reference_ar"]:
            assert b[c["reference_start"] : c["reference_end"]] == c["reference_ar"]
        assert (c["status"] == "resolved") == bool(c["verse_keys"]) and set(c["verse_keys"]) <= verse_keys
    ids = [s["id"] for s in tables["mufradat_subentries"]] + [x["id"] for x in tables["mufradat_senses"]]
    assert len(ids) == len(set(ids))
