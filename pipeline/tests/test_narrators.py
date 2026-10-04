"""The names in a chain linked to Ibn Ḥajar's entries (P11.2b): known chains linked to the right narrators, every link
with its rule and a confidence its rule has earned against MIS's hand mapping of Ṣaḥīḥ Muslim."""

from __future__ import annotations

from functools import cache
from typing import Any

import pytest
import yaml
from jadhr_pipeline.ecosystem import narrators_check
from jadhr_pipeline.ecosystem.hadith import build_hadith
from jadhr_pipeline.ecosystem.narrators import CONFIDENCE
from jadhr_pipeline.ecosystem.taqrib import Entry, parse
from jadhr_pipeline.release import REPO

RAW = REPO / "data/raw"
REG = REPO / "data/hadith.yaml"


@cache
def _built() -> tuple[dict[str, Any], dict[str, Any], dict[int, Entry]]:
    drafts, stats = build_hadith(RAW, REG)
    file = yaml.safe_load(REG.read_text(encoding="utf-8"))["narrators"]["file"]
    entries = parse((RAW / file).read_text(encoding="utf-8"))
    return {d.slug: d for d in drafts}, stats, dict(enumerate(entries, start=1))


def _chain(book: str, number: int) -> list[tuple[str, str | None]]:
    """The links of the record the compilation numbers ``number`` (its sequence; Muslim cites ʿAbd al-Bāqī's)."""
    drafts, _, entries = _built()
    p = next(p for p in drafts[book].passages if p.meta["sequence"] == number)
    return [
        (link["text"], entries[link["chosen"]].name if link["chosen"] else None)
        for link in p.meta["narrators"]
    ]


def test_known_chains_link_to_their_narrators() -> None:
    chain = _chain("bukhari", 1)
    expect = [
        "عبد الله بن الزبير بن عيسى",  # «الحميدي عبد الله بن الزبير»: the nisba first
        "سفيان بن عيينة",  # «سفيان», by the chain: al-Ḥumaydī's teacher of the eighth
        "يحيى بن سعيد بن قيس الأنصاري",
        "محمد بن إبراهيم بن الحارث",
        "علقمة بن وقاص",
        "عمر بن الخطاب",
    ]
    assert len(chain) == len(expect) and all(
        (n or "").startswith(e) for (_, n), e in zip(chain, expect, strict=True)
    ), chain
    chain = dict(_chain("bukhari", 3223))
    assert chain["أَبُو الْيَمَانِ"].startswith("الحكم بن نافع")  # a kunya, by his entry
    assert chain["الأَعْرَجِ"].startswith("عبد الرحمن بن هرمز")  # a laqab, by the Taqrīb's cross-reference
    assert chain["أَبِي هُرَيْرَةَ"].startswith("أبو هريرة")
    chain = dict(_chain("muslim", 690))  # «عن عائشة» before the Prophet: a Companion's place
    assert chain["عَائِشَةَ"].startswith("عائشة بنت أبي بكر") and chain["أَبُو كُرَيْبٍ"].startswith("محمد بن العلاء")


def test_every_link_says_how_it_was_made() -> None:
    drafts, stats, _ = _built()
    links = [link for d in drafts.values() for p in d.passages for link in p.meta.get("narrators") or []]
    linked = [x for x in links if x["chosen"]]
    assert len(linked) >= 0.85 * sum(1 for x in links if x["rule"] != "recension")
    assert all(x["status"] == "auto" and x["confidence"] == CONFIDENCE[x["rule"]] for x in linked)
    # a name left open keeps its candidates, never a guess
    assert all(x["confidence"] == 0 and x["rule"] for x in links if not x["chosen"])
    assert sum(v for k, v in stats.items() if k.startswith("links:")) == len(links)


def test_the_links_agree_with_mis_and_each_rule_earns_its_confidence() -> None:
    pytest.importorskip("openpyxl")
    drafts, _, entries = _built()
    muslim = [p for p in drafts["muslim"].passages if p.text.strip()]
    m = narrators_check.measure(
        RAW, [{"text": p.text} for p in muslim], [p.meta.get("narrators") or [] for p in muslim], entries
    )
    assert m["records"] > 7000 and m["precision"] >= 0.86 and m["tabaqa agreement"] >= 0.9, m
    for rule, precision in m["precision by rule"].items():
        assert precision >= CONFIDENCE[rule] - 0.03, (rule, precision, CONFIDENCE[rule])
