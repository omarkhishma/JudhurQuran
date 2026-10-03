"""The Quran knowledge layers (PLAN P3.9): unit tests of each parser, then hand-checked facts and the
reported counts against a full build from the pinned raw sources.

Data tests read ``data/raw`` and ``data/build/2026.10.0`` (or ``JADHR_RAW_DIR`` / ``JADHR_BUILD_DIR``)
and skip, with the reason, when either is absent; ``JADHR_REQUIRE_DATA=1`` turns that into a failure.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml
from jadhr_pipeline.knowledge import build_knowledge
from jadhr_pipeline.knowledge.apparatus import openiti_plain, rebuild, split_tc
from jadhr_pipeline.knowledge.counts import parse_counts, verse_counts
from jadhr_pipeline.knowledge.crossrefs import parse_reference
from jadhr_pipeline.knowledge.entities import everyday
from jadhr_pipeline.knowledge.places import tanzil_exceptions
from jadhr_pipeline.knowledge.quran import SurahNames

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("JADHR_RAW_DIR", REPO / "data" / "raw"))
BUILD = Path(os.environ.get("JADHR_BUILD_DIR", REPO / "data" / "build" / "2026.10.0"))
REGISTRY = REPO / "data" / "knowledge.yaml"
NAMES = {
    1: "الفاتحة", 3: "آل عمران", 9: "التوبة", 17: "الإسراء", 19: "مريم", 20: "طه", 25: "الفرقان",
    41: "فصلت", 49: "الحجرات", 60: "الممتحنة", 68: "القلم", 76: "الإنسان", 96: "العلق", 111: "المسد",
}  # fmt: skip


# ── unit tests (no data) ────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("tail", "groups"),
    [
        ("٢٥٥", [(None, 255, 255)]),
        (" ٩٣-٩٥", [(None, 93, 95)]),
        ("٩٥-٩٣", [(None, 93, 95)]),  # a range typed right-to-left
        ("١، ٢", [(None, 1, 1), (None, 2, 2)]),
        (" ٣٠، ٣١، ص: ٧٣، ٧٤", [(None, 30, 30), (None, 31, 31), ("ص", 73, 73), ("ص", 74, 74)]),
        ("١٩٦: ١٩٧", [(None, 196, 197)]),
        (" ٢٥ ٢٦", [(None, 25, 25), (None, 26, 26)]),
        (" ١٢٠ _ ١٢٣", [(None, 120, 123)]),
        ("نَعَمْ", None),
    ],
)
def test_parse_reference(tail: str, groups: list | None) -> None:
    assert parse_reference(tail) == groups


@pytest.mark.parametrize(
    ("name", "number"),
    [
        ("آلِ عِمْرَانَ", 3),  # vocalised, with the article's alef
        ("الْإِسْرَاءِ", 17),
        ("طَهَ", 20),
        ("بني إسرائيل", 17),  # another name of the same sūra
        ("براءة", 9),
        ("فضلت", 41),  # a one-letter typo of فصلت
        ("المتحنة", 60),  # a dropped letter
        ("الحجرات", 49),
        ("سُورَةُ الْعَلَقِ", 96),
    ],
)
def test_surah_names(name: str, number: int) -> None:
    assert SurahNames(NAMES).resolve(name)[0] == number


def test_unknown_surah_name_is_not_guessed() -> None:
    names = SurahNames(NAMES)
    assert names.resolve("الْآيَةَ")[0] is None
    assert names.resolve("العاق")[0] is None  # three letters: too short to accept a typo


@pytest.mark.parametrize(
    "text",
    [
        "متن ¬حاشية¥ بعده.",
        "متن ¬حاشية¥.",  # the space before a note goes with it when punctuation follows
        "متن ¬أولى ¬ثانية مدسوسة¥ تتمة",  # a stray ¬ inside a note stays in the note
        "متن ¥ شارد",  # a stray closer
        "متن مقطوع ¬حاشية لا تنتهي",  # a note still open where the field was cut
        "في الكوفي/ 97 و/، وست / ظ 157/ في البصري",  # folio marks
        "أخرجه الضياء 1/ 66/ 75 من طريق",  # a citation, not a folio mark
    ],
)
def test_split_tc_is_lossless(text: str) -> None:
    clean, items, _ = split_tc(text)
    assert "¬" not in clean and "¥" not in clean
    assert rebuild(clean, items) == text


def test_split_tc_counts_and_offsets() -> None:
    clean, items, counts = split_tc("قال ¬انظر: (1/ 167).¥إلى خمسة / 86 و/ آيات ¬ف، خ: معدودًا¥.")
    assert clean == "قال إلى خمسة  آيات."
    assert counts["footnotes"] == 2 and counts["folio_marks"] == 1
    assert [i["kind"] for i in items] == ["footnote", "folio", "footnote"]
    assert items[2]["text"] == "ف، خ: معدودًا"
    assert "1/ 66/ 75" in split_tc("الضياء 1/ 66/ 75")[0]


@pytest.mark.parametrize(
    ("sentence", "expected"),
    [
        # al-Baqara, both counting texts
        (
            "وهي: مئتا آيةٍ وثمانون وخَمْسُ آياتٍ، في المَدَنِيَّيْنِ والمكي والشامي ، وسِتٌّ في الكوفي، وسبعٌ في البصري",
            {"madani1": 285, "madani2": 285, "makki": 285, "shami": 285, "kufi": 286, "basri": 287},
        ),
        (
            "وآيها: مائتان وثمانون وخمس: حجازي وشامي، وست: كوفي، وسبع: بصري.",
            {"madani1": 285, "madani2": 285, "makki": 285, "shami": 285, "kufi": 286, "basri": 287},
        ),
        # a tens figure replaces tens and units; no «في» before the schools
        (
            "وهي: مِئَةٌ وثلاثون  وآيتانِ بصري ، وأربعٌ مدنيان ومكي، وخمسٌ كوفي، وأربعون شامي",
            {"basri": 132, "madani1": 134, "madani2": 134, "makki": 134, "kufi": 135, "shami": 140},
        ),
        # «غير شامي … فيه»
        (
            "وآيها: مائة وتسع: [غير شامي، وعشر: فيه] .",
            {**dict.fromkeys(("madani1", "madani2", "makki", "kufi", "basri"), 109), "shami": 110},
        ),
        # a unit after a lone «عشر» makes a teen; after «مئة وعشر» it replaces the ten
        (
            "وآيها: ثمان: بصري وشامي، وعشر: حرمي، وإحدى: كوفي.",
            {"basri": 8, "shami": 8, "madani1": 10, "madani2": 10, "makki": 10, "kufi": 11},
        ),
        (
            "وهي: مئةٌ وعشرُ آياتٍ  في الشامي، وتِسْعٌ في عدد الباقين",
            {**dict.fromkeys(("madani1", "madani2", "makki", "kufi", "basri"), 109), "shami": 110},
        ),
        # «وآيةٌ» is one; a bare «آيةً» after a number is only the counted noun
        (
            "وهي: خمسون وآيةٌ في البصري، وآيتان في الكوفي، وأربعٌ في المَدَنِيَّيْنِ والمكي، وخَمْسٌ في الشامي",
            {"basri": 51, "kufi": 52, "madani1": 54, "madani2": 54, "makki": 54, "shami": 55},
        ),
        (
            "وهي: عشرون آيةً في جميع العَدَدِ، ليس فيها اختلاف",
            dict.fromkeys(("madani1", "madani2", "makki", "kufi", "basri", "shami"), 20),
        ),
        ("وآيها: خمس.", dict.fromkeys(("madani1", "madani2", "makki", "kufi", "basri", "shami"), 5)),
    ],
)
def test_parse_counts(sentence: str, expected: dict[str, int]) -> None:
    counts, status = parse_counts(sentence)
    assert counts == expected, status


def test_counts_need_the_kufi_check_and_report_disagreement() -> None:
    a = "وهي: إحدى وأربعونَ آيةً في البصري، وأربعونَ في عَدَدِ الباقين."
    b = "وآيها: أربعون: غير مكي وبصري، وإحدى: فيهما."
    vc = verse_counts(a, b, 40)
    assert vc["status"] == "disagree" and vc["differences"] == {"makki": [40, 41]}
    assert verse_counts(a, b, 41)["status"] == "unparsed"  # neither Kūfī figure is the mushaf's 41
    assert verse_counts("وهي: سِتَّ عشرةَ آيةً في المدني الأول، ويقال في المكي كذلك", None, 15)["a"] is None


@pytest.mark.parametrize(
    ("note", "count", "rows"),
    [
        ("Except 17-33 and 48-50, from Medina", 52, [(17, 33, "medina"), (48, 50, "medina")]),
        ("Except 10, 11 and 20, from Medina", 20, [(10, 11, "medina"), (20, 20, "medina")]),
        ("Only 1-3 from Mecca; the rest from Medina", 7, [(4, 7, "medina")]),
        ("Except the last three verses from Medina", 128, [(126, 128, "medina")]),
        ("Except last two verses from Mecca", 129, [(128, 129, "mecca")]),
        (
            "Except 52-55 from Medina and 85 from Juhfa at the time of the Hijra",
            88,
            [(52, 55, "medina"), (85, 85, "juhfa")],
        ),
        ("Except 281 from Mina at the time of the Last Hajj", 286, [(281, 281, "mina")]),
        ("Except 13, revealed during the Prophet's Hijrah", 38, [(13, 13, "hijra-journey")]),
        ("Revealed while returning from Hudaybiyya", 29, [(1, 29, "hudaybiyya-return")]),
    ],
)
def test_tanzil_exceptions(note: str, count: int, rows: list[tuple[int, int, str]]) -> None:
    got = tanzil_exceptions({"surah": 0, "type": "Meccan", "note": note}, count)
    assert [(r["ayah_from"], r["ayah_to"], r["place"]) for r in got] == rows
    for r in got:
        assert r["period"] == {"mecca": "makki", "medina": "madani"}.get(r["place"])


@pytest.mark.parametrize(
    ("lemma", "plain"),
    [
        ("مُوسَىٰ", "موسى"),
        ("هَٰرُون", "هارون"),
        ("تَّوْرَىٰة", "توراة"),
        ("قُرْءَان", "قرآن"),
        ("ٱللَّه", "الله"),
        ("سَيْنَآء", "سيناء"),
        ("صَّٰبِ ِٔين", "صابئين"),
    ],
)
def test_everyday_spelling_for_search(lemma: str, plain: str) -> None:
    assert everyday(lemma) == plain


def test_openiti_plain() -> None:
    seg = "# (1) - قوله - عز وجل - {الم ذلك الكتاب} {1، 2} .\n# أخبرنا أبو عثمان قال: أخبرنا\n~~أبو عمرو ms010 بن مطر PageV01P021"
    assert (
        openiti_plain(seg)
        == "(1) - قوله - عز وجل - {الم ذلك الكتاب} {1، 2} .\n\nأخبرنا أبو عثمان قال: أخبرنا أبو عمرو بن مطر"
    )
    assert openiti_plain("قوله تعالى @QB@ أو كصيب @QE@ الآية") == "قوله تعالى ﴿أو كصيب﴾ الآية"


def test_registry_is_complete() -> None:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    ids = [s["id"] for s in reg["sources"]]
    assert len(ids) == len(set(ids))
    for s in reg["sources"]:
        for key in (
            "title_ar",
            "title_en",
            "license",
            "license_ar",
            "attribution_ar",
            "attribution_en",
            "use",
        ):
            assert s.get(key), f"{s['id']} lacks {key}"
        for f in s.get("files", []):
            assert len(f["sha256"]) == 64
    assert next(s for s in reg["sources"] if s["id"] == "qursim")["use"] == "evaluation-only"


# ── data tests: a full build from the pinned sources ──────────────────────────────────────────
@pytest.fixture(scope="module")
def built() -> tuple[dict, dict]:
    missing = [
        str(p) for p in (RAW / "tafsircenter/quran.db", BUILD / "work_passages.jsonl") if not p.exists()
    ]
    if missing:
        if os.environ.get("JADHR_REQUIRE_DATA") == "1":
            pytest.fail(f"JADHR_REQUIRE_DATA=1 but missing: {missing}")
        pytest.skip(f"raw sources or built dataset not available ({', '.join(missing)})")
    return build_knowledge(RAW, BUILD, REGISTRY)


def _vid(tables: dict, key: str) -> int:
    s, a = map(int, key.split(":"))
    card = tables["surah_cards"][s - 1]
    assert card["surah"] == s
    return sum(c["verse_count"] for c in tables["surah_cards"][: s - 1]) + a


def test_counts_match_the_report(built: tuple[dict, dict]) -> None:
    _, report = built
    assert report["counts"] == {
        "surah_cards": 114,
        "verse_places": 228,
        "asbab": 1294,
        "verse_crossrefs": 21998,
        "entity_candidates": 107,
        "mushaf_signs": 8,
    }
    assert report["surah_cards"]["verse_counts"] == {"agree": 99, "one-text": 9, "unparsed": 5, "disagree": 1}
    assert report["surah_cards"]["apparatus_separated"]["footnotes"] == 6308
    assert report["surah_cards"]["apparatus_separated"]["folio_marks"] == 35
    assert report["asbab"]["tafsircenter"]["rows"] == 321
    assert (report["asbab"]["wahidi"]["sections"], report["asbab"]["wahidi"]["sections_unkeyed"]) == (454, 0)
    assert (report["asbab"]["suyuti"]["sections"], report["asbab"]["suyuti"]["sections_unkeyed"]) == (348, 3)
    assert report["verse_crossrefs"]["citations"] == 5979
    assert report["verse_crossrefs"]["precision"]["sample_size"] == 100
    assert report["verse_crossrefs"]["precision"]["correct"] == 99
    assert report["verse_crossrefs"]["qursim"]["both"] == 7341
    assert report["entity_candidates"]["with_wikidata_id"] == 59


def test_every_row_cites_a_registered_source(built: tuple[dict, dict]) -> None:
    tables, _ = built
    known = {s["id"] for s in yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))["sources"]}
    for name, rows in tables.items():
        for r in rows:
            ids = r.get("source_ids") or [r["source_id"]]
            assert ids and set(ids) <= known, (name, r.get("id"))
            assert "qursim" not in ids  # evaluation only, never output


def test_surah_card_baqara(built: tuple[dict, dict]) -> None:
    card = built[0]["surah_cards"][1]
    # Tanzil quran-data.xml: <sura index="2" ayas="286" … type="Medinan" order="87" …/>
    assert (card["surah"], card["place"], card["revelation_order"], card["verse_count"]) == (
        2,
        "medinan",
        87,
        286,
    )
    assert card["tc_place_ar"] == "مدنية" and card["tc_revelation_order"] == 87
    assert card["verse_counts_a"] == card["verse_counts_b"] == {
        "madani1": 285, "madani2": 285, "makki": 285, "shami": 285, "kufi": 286, "basri": 287,
    }  # fmt: skip
    assert card["names"].startswith("سورة البقرة")
    assert "¬" not in card["revelation"] and "¥" not in card["revelation"]


def test_surah_cards_flag_the_truncated_source_fields(built: tuple[dict, dict]) -> None:
    cards = built[0]["surah_cards"]
    assert [c["surah"] for c in cards if c["truncated_fields"]] == [6, 8, 9, 16, 17, 22]
    assert built[1]["surah_cards"]["tc_study_preferred_differs_from_tanzil"] == [55, 76, 83, 108, 113, 114]


def test_verse_places_keep_both_opinions(built: tuple[dict, dict]) -> None:
    rows = [
        r for r in built[0]["verse_places"] if r["surah"] == 68 and (r["ayah_from"], r["ayah_to"]) == (17, 33)
    ]
    tanzil = [r for r in rows if r["source_id"] == "tanzil-revelation-order"]
    tc = {r["role"]: r for r in rows if r["source_id"] == "tafsircenter-quran-db"}
    assert tanzil[0]["period"] == "madani" and tanzil[0]["quote"] == "Except 17-33 and 48-50, from Medina"
    assert tanzil[0]["tc_check"] == "differs"
    assert tc["reported"]["period"] == "madani" and tc["reported"]["attributed_to"] == "ابن عباس، وقتادة"
    assert tc["preferred"]["period"] == "makki" and "فالآيات مكيات كغيرها" in tc["preferred"]["quote"]
    # 2:281 «from Mina at the time of the Last Hajj»: a place, no period invented
    mina = next(r for r in built[0]["verse_places"] if r["surah"] == 2 and r["ayah_from"] == 281)
    assert (mina["place"], mina["period"]) == ("mina", None)


def test_asbab_known_entries(built: tuple[dict, dict]) -> None:
    tables, _ = built
    asbab = tables["asbab"]
    v = {k: _vid(tables, k) for k in ("2:89", "2:1", "2:2", "2:26", "111:1", "111:5")}
    # Tafsir Center narration 1: «قوله تعالى: {وَلَمَّا جَاءَهُمْ كِتَابٌ …} [البقرة: 89]» with its takhrīj
    n1 = next(r for r in asbab if r["work"] == "tafsircenter" and r["number"] == 1)
    assert (n1["verse_from"], n1["verse_to"], n1["match_method"]) == (v["2:89"], v["2:89"], "reference")
    assert n1["text"].startswith("1 - عن ابن عباس") and n1["takhrij"].startswith("أخرجه ابن جرير في تفسيره")
    assert "¬" not in n1["text"]
    # narration 321: the heading quotes 111:1-5 with its verse numbers
    n321 = next(r for r in asbab if r["work"] == "tafsircenter" and r["number"] == 321)
    assert (n321["verse_from"], n321["verse_to"]) == (v["111:1"], v["111:5"])
    # al-Wāḥidī: «(1) - قوله - عز وجل - {الم ذلك الكتاب} {1، 2}» — the editor's verse numbers
    w = next(
        r for r in asbab if r["work"] == "wahidi" and r["heading"] and "{الم ذلك الكتاب}" in r["heading"]
    )
    assert (w["verse_from"], w["verse_to"], w["match_method"], w["confidence"]) == (
        v["2:1"],
        v["2:2"],
        "editor-number",
        "high",
    )
    assert w["locator"].endswith("#ms010") and w["page"] == "V01P021"
    # al-Suyūṭī: «قوله تعالى @QB@ إن الله لا يستحيي أن يضرب مثلا @QE@»
    s = next(
        r
        for r in asbab
        if r["work"] == "suyuti" and r["heading"] and "﴿إن الله لا يستحيي أن يضرب مثلا﴾" in r["heading"]
    )
    assert (s["verse_from"], s["verse_to"], s["match_method"]) == (v["2:26"], v["2:26"], "quote")
    # unkeyed sections stay, with a null verse
    unkeyed = [r for r in asbab if r["section_kind"] == "section" and r["verse_from"] is None]
    assert len(unkeyed) == 3 and all(r["match_method"] is None for r in unkeyed)


def test_ibn_kathir_citations_in_ayat_al_kursi(built: tuple[dict, dict]) -> None:
    tables, _ = built
    k = _vid(tables, "2:255")
    cited = {(r["to_verse"], r["to_verse_end"]): r for r in tables["verse_crossrefs"] if r["from_verse"] == k}
    # «﴿وَعَنَتِ الْوُجُوهُ لِلْحَيِّ الْقَيُّومِ﴾ [طَهَ:١١١]»
    taha = cited[(_vid(tables, "20:111"), _vid(tables, "20:111"))]
    assert (taha["method"], taha["confidence"], taha["reference"]) == ("reference", "high", "[طَهَ:١١١]")
    # «[مَرْيَمَ: ٩٣-٩٥]» and «[آلِ عِمْرَانَ:١، ٢]» (a list of adjacent verses is one span)
    assert (_vid(tables, "19:93"), _vid(tables, "19:95")) in cited
    assert (_vid(tables, "3:1"), _vid(tables, "3:2")) in cited
    # a quote of the verse being explained is not a cross-reference
    assert all(not (r["to_verse"] <= k <= r["to_verse_end"]) for r in cited.values())


def test_no_verse_cites_itself(built: tuple[dict, dict]) -> None:
    rows = built[0]["verse_crossrefs"]
    assert not [r for r in rows if r["from_verse"] == 1 and r["to_verse"] <= 1 <= r["to_verse_end"]]
    assert not [r for r in rows if r["to_verse"] <= r["from_verse"] <= r["to_verse_end"]]


def test_entity_candidates(built: tuple[dict, dict]) -> None:
    rows = {r["name_plain"]: r for r in built[0]["entity_candidates"]}
    assert all(r["status"] == "candidate" for r in rows.values())
    assert (rows["موسى"]["occurrences"], rows["موسى"]["verse_count"]) == (136, 131)
    assert rows["نوح"]["wikidata_id"] == "Q81422" and rows["نوح"]["wikidata_rule"] == "present-in-quran"
    assert rows["الله"]["wikidata_id"] is None  # no item meets either rule: left to the editors
    assert rows["مصر"]["wikidata_id"] is None  # «الحضارة المصرية في العصر الإسلامي» is not the Quran's Miṣr
    assert all(r["wikidata_evidence"] for r in rows.values() if r["wikidata_id"])


def test_mushaf_signs_are_tied_to_their_code_points_by_the_pages_own_examples(built: tuple) -> None:
    """P3.9: eight signs from the Madinah Mushaf's note, each example verse carrying its code point; counts
    from our text (Ḥafṣ's four sakt places, fifteen sajdas)."""
    tables, report = built
    signs = {s["id"]: s for s in tables["mushaf_signs"]}
    assert list(signs) == ["lazim", "qila", "jaiz", "sila", "muanaqa", "sakt", "sajda", "hizb"]
    assert signs["jaiz"]["text_ar"] == "علامة الوقف الجائز جوازا مستوي الطرفين"
    assert signs["muanaqa"]["example_key"] == "2:2" and signs["sajda"]["example_key"] == "32:15"
    assert report["mushaf_signs"]["occurrences"]["sakt"] == 4
    assert report["mushaf_signs"]["occurrences"]["sajda"] == 15
    assert all(s["source_id"] == "kfgqpc-mushaf-key" and s["occurrences"] > 0 for s in signs.values())
