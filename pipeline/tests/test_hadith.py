"""The hadith collections (P11.2a): every record verbatim under its printed number, filed under its Arabic kitāb and
bāb, its grades only under the graders whose rulings they are, an empty record said to be empty with its witness."""

from __future__ import annotations

import json
import re

import pytest
import yaml
from jadhr_pipeline.ecosystem.hadith import build_hadith, clean_title, verdict
from jadhr_pipeline.release import REPO

RAW = REPO / "data/raw"
REG = REPO / "data/hadith.yaml"


@pytest.fixture(scope="module")
def built() -> tuple[dict, dict]:
    drafts, stats = build_hadith(RAW, REG)
    return {d.slug: d for d in drafts}, stats


def _where(d, ref: str) -> tuple[str, str | None]:
    p = next(p for p in d.passages if p.ref == ref)
    c = d.chapters[p.chapter]
    return (d.chapters[c.parent].title_ar, c.title_ar) if c.parent is not None else (c.title_ar, None)


def test_every_record_verbatim_under_its_number(built: tuple[dict, dict]) -> None:
    drafts, stats = built
    for spec in yaml.safe_load(REG.read_text(encoding="utf-8"))["collections"]:
        src = json.loads(
            (RAW / "fawazahmed0-hadith-api/editions" / spec["edition"]).read_text(encoding="utf-8")
        )["hadiths"]
        d = drafts[spec["slug"]]
        assert len(d.passages) == len(src) == stats[f"{spec['slug']}:records"]
        # the compilation's characters, untouched (its RLM marks and its order of marks included)
        assert [p.text for p in d.passages] == [r["text"] for r in src]
        assert len({p.ref for p in d.passages}) == len(src)
    # Fatḥ al-Bārī's numbers, its sub-entries (402.2) kept; Muslim's by ʿAbd al-Bāqī, a record without one by place
    refs = {p.ref for p in drafts["bukhari"].passages}
    assert {"1", "6502", "7563", "402.2"} <= refs
    assert drafts["muslim"].passages[0].ref.startswith("s") and "1907.01" in {
        p.ref for p in drafts["muslim"].passages
    }


def test_the_titles_reach_the_records(built: tuple[dict, dict]) -> None:
    drafts, stats = built
    anchors = {
        ("bukhari", "6502"): ("كتاب الرقاق", "باب التواضع"),
        ("bukhari", "7563"): ("كتاب التوحيد", "باب قول الله تعالى ونضع الموازين القسط"),
        ("muslim", "1907.01"): ("كتاب الإمارة", "باب قوله صلى الله عليه وسلم: «إنما الأعمال بالنية»"),
        ("muslim", "2577.01"): ("كتاب البر والصلة والآداب", "باب تحريم الظلم"),
        ("abudawud", "4607"): ("كتاب السنة", "باب في لزوم السنة"),
        ("ibnmajah", "224"): (
            "افتتاح الكتاب في الإيمان وفضائل الصحابة والعلم",
            "باب فضل العلماء والحث على طلب العلم",
        ),
        ("malik", "1"): ("كتاب وقوت الصلاة", "باب وقوت الصلاة"),
    }
    for (slug, ref), (kitab, bab) in anchors.items():
        k, b = _where(drafts[slug], ref)
        assert k == kitab and (b or "").startswith(bab), (slug, ref, k, b)
    # nearly every record reaches its bāb; the rest their kitāb at least
    for slug in drafts:
        records = stats[f"{slug}:records"]
        placed = sum(v for k, v in stats.items() if k.startswith(f"{slug}:titles-") and "-kitab-by-" not in k)
        assert placed >= 0.97 * (records - stats.get(f"{slug}:empty", 0)), slug
    # every title Arabic and present: a typing slip («xsتعالى») taken out, the compilation's English names never one
    for d in drafts.values():
        assert all(c.title_ar.strip() and not re.search(r"[A-Za-z—]", c.title_ar) for c in d.chapters), d.slug
    assert any(c.title_ar == "باب استحباب حمد الله تعالى بعد الأكل والشرب" for c in drafts["muslim"].chapters)
    # the Muwaṭṭaʾ's empty records filed under no section («book 0») take the kitāb their neighbours share
    assert (
        _where(drafts["malik"], "958")[0] == _where(drafts["malik"], "957")[0] == "كتاب الحج"
    )  # by number order
    for ref in ("167", "1748"):
        before, after = str(int(ref) - 1), str(int(ref) + 1)
        assert (
            _where(drafts["malik"], ref)[0]
            == _where(drafts["malik"], before)[0]
            == _where(drafts["malik"], after)[0]
        )


def test_grades_only_under_the_graders_whose_rulings_they_are(built: tuple[dict, dict]) -> None:
    drafts, stats = built
    reg = yaml.safe_load(REG.read_text(encoding="utf-8"))
    shown = {g["grader"] for d in drafts.values() for p in d.passages for g in p.meta["grades"]}
    assert shown == set(reg["graders"]) and not shown & set(reg["excluded_graders"])
    assert stats["grades-not-shown-misattributed"] > 20_000
    assert not any(p.meta["grades"] for slug in ("bukhari", "muslim") for p in drafts[slug].passages)
    first = drafts["abudawud"].passages[0].meta["grades"]
    albani = next(g for g in first if g["grader"] == "Al-Albani")
    assert (
        albani["value"] == "Hasan Sahih"
        and albani["value_ar"] == "حسن صحيح"
        and albani["work_ar"] == "صحيح وضعيف سنن أبي داود"
    )
    zubair = next(g for g in first if g["grader"] == "Zubair Ali Zai")
    assert zubair["value_ar"] is None  # as he published it
    # al-Tirmidhī's own verdict, read from his text
    assert stats["tirmidhi:verdict"] > 3000
    assert verdict("قال أبو عيسى: هذا حديث حسن صحيح") == "حسن صحيح"


def test_an_empty_record_is_said_to_be_empty_with_its_witness(built: tuple[dict, dict]) -> None:
    drafts, stats = built
    empty = [p for p in drafts["ibnmajah"].passages if p.meta.get("empty")]
    assert len(empty) == stats["ibnmajah:empty"] == 5 and all(p.text == "" for p in empty)
    assert all(p.meta["witness"] and p.meta["witness"]["source"] == "openiti" for p in empty)


def test_titles_are_cleaned_of_the_editors_numbers() -> None:
    assert clean_title("( 38 باب التواضع )") == "باب التواضع"
    assert clean_title("1 - كتاب الطهارة") == "كتاب الطهارة"
    assert clean_title("( 4 باب هل يستاك الإمام بحضرة رعيته 2 )") == "باب هل يستاك الإمام بحضرة رعيته"
