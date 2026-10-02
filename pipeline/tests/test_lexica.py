"""Lexicon import against the real, sha256-pinned raw files (data/raw/lexica, data/lexica.yaml).

Arabic expectations are compared after strip_marks so that no combining-mark literal appears in
this file (editors silently reorder marks in typed literals). Every count asserted here was
computed by the pipeline from the source files and is pinned as a regression baseline; the
methodology is in docs/research/02-arabic-lexica.md ("Implementation").
"""

from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path
from typing import Any

import pytest
import yaml
from jadhr_arabic import strip_marks
from jadhr_pipeline.lexica import build_lexica
from jadhr_pipeline.lexica.lane import translit
from jadhr_pipeline.lexica.registry import LexiconRegistryError, load_registry
from jadhr_pipeline.lexica.rootmap import RootMatcher

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("JADHR_RAW_DIR", REPO / "data" / "raw"))  # same switch as conftest.py
REGISTRY = REPO / "data" / "lexica.yaml"
BUILD = REPO / "data" / "build" / "2026.10.0"


def _jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.open(encoding="utf-8")]


@pytest.fixture(scope="module")
def roots() -> list[dict[str, Any]]:
    return _jsonl(BUILD / "roots.jsonl")


@pytest.fixture(scope="module")
def built(roots: list[dict[str, Any]]) -> tuple[list[dict], list[dict], list[dict], dict]:
    return build_lexica(RAW, REGISTRY, roots, _jsonl(BUILD / "words.jsonl"), _jsonl(BUILD / "surahs.jsonl"))


def _entries(built: tuple, work: str, root: str) -> list[dict]:
    return [e for e in built[1] if e["work_id"] == work and e["root_key"] == root]


def _plain(text: str) -> str:
    return strip_marks(text)


# --- (a) counts and root coverage per work ---------------------------------------------------

EXPECTED = {
    #  work      entries  strict  loose  manual  roots_strict  roots_any
    "mufradat": (1624, 1295, 221, 3, 1295, 1515),
    "maqayis": (4750, 1357, 216, 0, 1352, 1547),
    "lisan": (9370, 1490, 180, 0, 1489, 1619),
    "sihah": (5648, 1490, 169, 0, 1470, 1599),
    "lane": (5304, 1466, 271, 0, 1388, 1613),
}


@pytest.mark.parametrize("work", sorted(EXPECTED))
def test_counts_and_root_coverage(built: tuple, work: str) -> None:
    n, strict, loose, manual, roots_strict, roots_any = EXPECTED[work]
    rows = [e for e in built[1] if e["work_id"] == work]
    assert len(rows) == n
    assert sum(e["match"] == "strict" for e in rows) == strict
    assert sum(e["match"] == "loose" for e in rows) == loose
    assert sum(e["match"] == "manual" for e in rows) == manual
    assert len({e["root_key"] for e in rows if e["match"] == "strict"}) == roots_strict
    assert len({e["root_key"] for e in rows if e["root_key"]}) == roots_any
    rep = built[3]["works"][work]
    assert rep["roots_strict"] == roots_strict and rep["roots_any"] == roots_any
    assert rep["coverage_any_pct"] == round(100 * roots_any / 1642, 2)


def test_cross_work_coverage_and_review_list(built: tuple) -> None:
    rep = built[3]
    assert rep["coverage"]["roots_total"] == 1642
    assert rep["coverage"]["roots_with_any_entry"] == 1633
    # The nine roots without an article are reduplicated quadriliterals (زلزل، صلصل…), which the
    # lexicographers file under the geminate root.
    for k in rep["coverage"]["roots_with_no_entry"]:
        assert len(k) == 4 and k[0] == k[2] and k[1] == k[3], k
    # Every loose or manual mapping is on the review list with a confidence flag — none is silent.
    loose_ids = {e["id"] for e in built[1] if e["match"] in ("loose", "manual")}
    review_ids = {r["entry_id"] for r in rep["review"]}
    assert loose_ids == review_ids
    assert rep["review_count"] == 1060
    assert {r["confidence"] for r in rep["review"]} <= {"high", "medium", "low", "manual"}
    for r in rep["review"]:
        assert r["rule"]


def test_gharib_glosses_counts_and_alignment(built: tuple) -> None:
    glosses = built[2]
    assert len(glosses) == 3431
    aligned = [g for g in glosses if g["word_locations"]]
    assert len(aligned) == 3404
    rep = built[3]["works"]["ibn-qutaybah-gharib"]
    assert (rep["glosses"], rep["aligned"], rep["unaligned"]) == (3431, 3404, 27)
    words = {w["location"]: w for w in _jsonl(BUILD / "words.jsonl")}
    for g in glosses:
        for loc in g["word_locations"]:
            w = words[loc]
            assert (w["surah"], w["ayah"]) == (g["surah"], g["ayah"]), (g["id"], loc)
    # 9:41 «انفروا خفافا وثقالا» → the verse's first three words; the gloss is the printed item
    # text after its number, quoted phrase included.
    g = next(
        g for g in glosses if (g["surah"], g["ayah"]) == (9, 41) and _plain(g["phrase"]).startswith("انفروا")
    )
    assert g["word_locations"] == ["9:41:1", "9:41:2", "9:41:3"]
    assert _plain(g["gloss"]).startswith("\ufd3fانفروا خفافا وثقالا\ufd3e أي: لينفر منكم من كان مخفا ومثقلا")


# Coordinator's detector for a later numbered item swallowed into a gloss ("٢- و (العالَمُونَ)…").
LATER_ITEM = re.compile("(?:^|\n\n)([\u0660-\u0669]+)\\s*[-\u2013]\\s")


def test_no_gloss_contains_a_later_numbered_item(built: tuple) -> None:
    assert LATER_ITEM.search("\u0628\n\n\u0662- \u0648 (x)")  # the detector does fire on a merged item
    hits = [(g["surah"], g["ayah"]) for g in built[2] if LATER_ITEM.search(g["gloss"])]
    assert hits == []
    for g in built[2]:
        assert not re.match("\\s*[\u0660-\u06690-9]+\\s*[-\u2013]", g["gloss"]), g[
            "id"
        ]  # number prefix stays out


@pytest.mark.parametrize(
    ("ayah", "word"),
    [(2, "العالمون"), (4, "يوم الدين"), (6, "الصراط")],
)
def test_fatiha_items_are_their_own_glosses(built: tuple, ayah: int, word: str) -> None:
    """1:2, 1:4 and 1:6 used to sit inside the gloss of 1:1."""
    rows = [
        g
        for g in built[2]
        if (g["surah"], g["ayah"]) == (1, ayah)
        and _plain(g["phrase"]).replace("\u0627", "") == word.replace("\u0627", "")
    ]
    assert len(rows) == 1, rows
    g = rows[0]
    assert g["word_locations"] and all(loc.startswith(f"1:{ayah}:") for loc in g["word_locations"])
    assert _plain(g["gloss"]).startswith("\u0648 ")  # printed «و (العالَمُونَ)…» / «و ﴿يَوْمِ الدِّينِ﴾…»
    assert word.split()[-1] in _plain(g["gloss"])
    (first,) = [x for x in built[2] if (x["surah"], x["ayah"]) == (1, 1)]
    assert word not in _plain(first["gloss"])


def test_gharib_ayah_lists_give_one_row_per_ayah(built: tuple) -> None:
    """«١٦، ١٨، ٢١، ٣٠- ﴿فَكَيْفَ كَانَ عَذَابِي وَنُذُرِ﴾» (al-Qamar's refrain)."""
    rows = [g for g in built[2] if g["surah"] == 54 and _plain(g["phrase"]) == "فكيف كان عذابي ونذر"]
    assert sorted(g["ayah"] for g in rows) == [16, 18, 21, 30]
    assert len({g["gloss"] for g in rows}) == 1 and all(g["word_locations"] for g in rows)


# --- (b) known-good spot checks -------------------------------------------------------------


def test_maqayis_core_meaning_is_the_verbatim_opening_sentence(built: tuple) -> None:
    for root, expected in (
        ("علم", "العين واللام والميم أصل صحيح واحد، يدل على أثر بالشئ يتميز به عن غيره."),
        ("كتب", "الكاف والتاء والباء أصل صحيح واحد يدل على جمع شيء إلى شيء."),
        ("رحم", "الراء والحاء والميم أصل واحد يدل على الرقة والعطف والرأفة."),
    ):
        (e,) = _entries(built, "maqayis", root)
        assert e["match"] == "strict"
        assert _plain(e["core_meaning"]) == expected
        assert e["body"].startswith(e["core_meaning"])
    assert all(e["core_meaning"] is None for e in built[1] if e["work_id"] != "maqayis")


def test_mufradat_rahma_article_starts_as_printed(built: tuple) -> None:
    (e,) = _entries(built, "mufradat", "رحم")
    assert e["match"] == "strict" and e["page_ref"] == "347-348"
    assert _plain(e["body"]).startswith("الرحم: رحم المرأة، وامرأة رحوم تشتكي رحمها.")
    assert e["source_ref"] == "shamela:23636:toc-566"


def test_lisan_merged_articles_are_split(built: tuple) -> None:
    """Earlier community splits merged عين into عون, ولي into وشي, دين into دون, حفظ into حظظ."""
    for inner, outer in (("عين", "عون"), ("ولي", "وشي"), ("دين", "دون"), ("حفظ", "حظظ")):
        (a,) = _entries(built, "lisan", inner)
        (b,) = _entries(built, "lisan", outer)
        assert a["match"] == b["match"] == "strict"
        assert _plain(a["body"]).split(":", 1)[0] == inner
        assert f"\n\n{inner}:" not in _plain(b["body"])
    (ein,) = _entries(built, "lisan", "عين")
    assert _plain(ein["body"]).startswith("عين: العين: حاسة البصر والرؤية")


def test_lane_kataba_entry(built: tuple) -> None:
    main, supplement = _entries(built, "lane", "كتب")  # k0.xml article + a later k1.xml addendum
    assert supplement["source_ref"].startswith("perseus:lane:k1.xml:")
    e = main
    assert e["match"] == "strict" and e["headword"] == "كتب"
    assert "كتبه" in _plain(e["body"])
    assert "He wrote it" in e["body"]
    assert not re.search(r"\b(kataba|katabahu|kitaAb)\b", e["body"])  # no Buckwalter left
    assert e["page_ref"].startswith("2589")


def test_sihah_rahma_article(built: tuple) -> None:
    (e,) = _entries(built, "sihah", "رحم")
    assert e["headword"] == "[رحم]" and e["page_ref"] == "5/1929"
    assert _plain(e["body"]).startswith("الرحمة: الرقة والتعطف.")


# --- (c) cleaning rules: no editor apparatus or markup survives --------------------------------

MARKERS = {
    "mufradat": re.compile("\u00ab[\u0660-\u06690-9]{1,3}\u00bb"),
    "lisan": re.compile("\u00ab[\u0660-\u06690-9]{1,3}\u00bb"),
    "maqayis": re.compile("\\(\u00ac[\u0660-\u06690-9]{1,3}\\)"),
    "sihah": re.compile("\\([\u0660-\u06690-9]{1,3}\\)"),
}


def test_no_footnote_markers_or_markup_in_bodies(built: tuple) -> None:
    for e in built[1]:
        body = e["body"]
        assert body and body == body.strip(), e["id"]
        assert "<span" not in body and "</span>" not in body and "\r" not in body
        assert "\n\n\n" not in body
        pat = MARKERS.get(e["work_id"])
        if pat is not None:
            assert not pat.search(body), (e["work_id"], e["headword"], pat.search(body))
    gharib_marker = re.compile("\\([\u0660-\u06690-9]{1,3}\\)")
    for g in built[2]:
        assert not gharib_marker.search(g["gloss"]), g["id"]
        assert "<span" not in g["gloss"]


def test_every_rule_applied_is_a_registered_rule(built: tuple) -> None:
    rules = set(built[3]["rules"])
    for wid, rep in built[3]["works"].items():
        assert rep["rules_applied"], wid
        for name in rep["rules_applied"]:
            assert name.split(":", 1)[0] in rules, (wid, name)
    sh = built[3]["works"]["lisan"]["rules_applied"]
    assert sh["footnote-markers-removed"] == 5119 and sh["footnotes-dropped"] == 3731


# --- (d) root keys and row contract ---------------------------------------------------------


def test_root_keys_are_canonical_and_rows_follow_the_contract(built: tuple, roots: list[dict]) -> None:
    works, entries, glosses, _ = built
    keys = {r["key"] for r in roots}
    assert len(keys) == 1642
    for e in entries:
        assert e["root_key"] is None or e["root_key"] in keys
        assert (e["match"] is None) == (e["root_key"] is None)
        assert e["match"] in (None, "strict", "loose", "manual")
        assert set(e) == {
            "id",
            "work_id",
            "root_key",
            "headword",
            "match",
            "body",
            "core_meaning",
            "page_ref",
            "source_ref",
        }
    ids = [e["id"] for e in entries] + [g["id"] for g in glosses]
    assert len(ids) == len(set(ids))
    blocks = {w.id: w.id_block for w in load_registry(RAW, REGISTRY, verify=False).works}
    for e in entries:
        assert e["id"] // 1_000_000 == blocks[e["work_id"]]
    for g in glosses:
        assert g["id"] // 1_000_000 == blocks[g["work_id"]]
    # Display order = the author's death date (design: al-ʿAyn first, Lane last).
    assert [w["id"] for w in works] == WORK_ORDER
    deaths = [w["death_ce"] for w in works]
    assert deaths == sorted(deaths)
    assert [w["sort_order"] for w in works] == sorted(w["sort_order"] for w in works)
    assert [w["id"] for w in works if w["redistributable"]] == ["lane"]
    for w in works:
        assert w["license"] and w["attribution_ar"] and w["attribution_en"] and w["source_url"]
        assert w["lang"] in ("ar", "en")
        assert w["kind"] in ("earliest", "general", "root", "interpretive", "english", "gharib")
        assert "shamela_id" in w
        assert (w["shamela_id"] is None) == (w["id"] == "lane")


# Display order by death date (CE): the nine dictionaries of the design plus Ibn Qutaybah's gharib.
WORK_ORDER = ["ibn-qutaybah-gharib", "sihah", "maqayis", "mufradat", "lisan", "lane"]


def test_entry_ids_do_not_move_when_the_display_order_changes(built: tuple) -> None:
    """Ids come from id_block, not sort_order: the reorder by death date (2026-10-03) kept every id."""
    for work, root, eid in (
        ("mufradat", "رحم", 1000531),
        ("maqayis", "رحم", 2001729),
        ("lisan", "رحم", 3007615),
        ("sihah", "رحم", 4004486),
        ("lane", "رحم", 5001538),
    ):
        (e,) = _entries(built, work, root)
        assert e["id"] == eid, (work, e["id"])
    assert built[2][0]["id"] == 6000001


# --- units: registry pins, matcher rules, transliteration -------------------------------------


def test_registry_refuses_a_file_whose_sha256_differs(tmp_path: Path) -> None:
    data = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    data["works"][0]["files"][0]["sha256"] = "0" * 64
    bad = tmp_path / "lexica.yaml"
    bad.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")
    with pytest.raises(LexiconRegistryError, match="sha256 mismatch"):
        load_registry(RAW, bad)


def _registry_variant(tmp_path: Path, edit: Any) -> Path:
    data = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    edit(data["works"])
    out = tmp_path / "lexica.yaml"
    out.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")
    return out


def _work(works: list[dict], wid: str) -> dict:
    return next(w for w in works if w["id"] == wid)


@pytest.mark.parametrize(
    ("edit", "message"),
    [
        (lambda ws: _work(ws, "lisan").update(kind="lexicon"), "kind must be one of"),
        (lambda ws: _work(ws, "lisan").update(id_block=_work(ws, "sihah")["id_block"]), "id_block must be"),
        (
            lambda ws: _work(ws, "lisan").update(sort_order=_work(ws, "sihah")["sort_order"]),
            "sort_order must be",
        ),
        (lambda ws: _work(ws, "lisan").pop("id_block"), "missing fields"),
        (lambda ws: _work(ws, "lisan").pop("shamela_id"), "needs its shamela_id"),
        (lambda ws: _work(ws, "lisan").update(sort_order=1000), "order is by death date"),  # after Lane
        (lambda ws: _work(ws, "lisan").update(editor_supplements="hide"), "editor_supplements must be"),
    ],
)
def test_registry_schema_is_enforced(tmp_path: Path, edit: Any, message: str) -> None:
    load_registry(RAW, REGISTRY, verify=False)  # the real registry passes
    with pytest.raises(LexiconRegistryError, match=message):
        load_registry(RAW, _registry_variant(tmp_path, edit), verify=False)


def test_registry_refuses_a_missing_file(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    shutil.copytree(RAW / "lexica" / "laneslexicon-lexicon_xml", raw / "lexica" / "laneslexicon-lexicon_xml")
    with pytest.raises(LexiconRegistryError, match="missing raw file"):
        load_registry(raw, REGISTRY)


def test_matcher_tiers(roots: list[dict]) -> None:
    m = RootMatcher(roots)
    assert m.match("رحم", {}, set()).match == "strict"
    assert m.match("[رحم]", {}, set()).root_key == "رحم"
    assert m.match("أز\u0651", {}, set()).rule == "shadda-expanded"
    sama = m.match("سما", {}, set())
    assert (sama.root_key, sama.match, sama.confidence, sama.rule) == (
        "سمو",
        "loose",
        "high",
        "alif-for-weak",
    )
    rab = m.match("رب", {}, set())
    assert (rab.root_key, rab.rule) == ("ربب", "two-letter-geminate")
    # A loose candidate is not assigned when the work already has a strict article for it.
    supp = m.match("سما", {}, {"سمو"})
    assert supp.root_key is None and supp.suppressed == ("سمو",)
    assert m.match("خنزير", {"خنزير": "خنزر"}, set()).match == "manual"
    with pytest.raises(ValueError):
        m.match("كذا", {"كذا": "ليس-جذرا"}, set())


def test_lane_transliteration_table() -> None:
    assert translit("ktb") == "كتب"
    assert translit("A^mn") == "أمن"
    assert translit("A_i") == "\u0625\u0650"
    assert translit("A@l") == "\u0671\u0644"
    assert translit("y^w^") == "ئؤ"
