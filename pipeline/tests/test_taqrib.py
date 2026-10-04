"""Ibn Ḥajar's Taqrīb al-Tahdhīb read into narrator profiles (P11.2b): every entry verbatim with his edition's number,
and beside it what his own words and his introduction's rules give — verdict and rank, ṭabaqa, year of death, sigla."""

from __future__ import annotations

import statistics
from functools import cache

from jadhr_pipeline.ecosystem.taqrib import SIGLA, Entry, parse
from jadhr_pipeline.release import REPO

FILE = REPO / "data/raw/openiti-2025.1.9-hadith/0852IbnHajarCasqalani.TaqribTahdhib.JK000121-ara1.completed"


@cache
def _entries() -> list[Entry]:
    return parse(FILE.read_text(encoding="utf-8"))


def _no(n: int) -> Entry:
    return next(e for e in _entries() if e.number == n)


def test_every_entry_is_read_in_the_books_order() -> None:
    raw = FILE.read_text(encoding="utf-8")
    marks = [line.split(" ", 2)[1] for line in raw.splitlines() if line.startswith("### $")]
    main = [e for e in _entries() if e.kind == "entry"]
    # «$» the men and «$$» the women's section, numbered; «$$$» a cross-reference («صوابه …», «هو …»)
    assert len(main) == marks.count("$") + marks.count("$$") and len(_entries()) - len(main) == marks.count(
        "$$$"
    )
    numbers = [e.number for e in main]
    assert numbers == sorted(numbers) and numbers[0] == 1
    assert all(e.text and e.name and e.text.startswith(e.name) for e in main)
    assert all(set(e.sigla) <= set(SIGLA) for e in main)


def test_his_words_give_the_verdict_tabaqa_year_and_books() -> None:
    e = _no(
        1
    )  # «… صدوق من العاشرة مات سنة ست وثلاثين د فق»; the name ends where his description begins («نزيل»)
    assert (e.name, e.verdict, e.rank, e.tabaqa) == (
        "أحمد بن إبراهيم بن خالد الموصلي أبو علي",
        "صدوق",
        4,
        10,
    )
    # the tenth ṭabaqa died after 200 (his introduction), so «ست وثلاثين» is 236
    assert (e.death_text, e.death_ah, e.death_rule, e.sigla) == (
        "مات سنة ست وثلاثين",
        236,
        "century-by-tabaqa",
        ["د", "فق"],
    )
    assert (_no(3).verdict, _no(3).rank) == ("ثقة حافظ", 2)
    assert (_no(13).death_ah, _no(13).death_rule) == (197, "written")  # «مات سنة 197»
    # a Companion is of the first ṭabaqa; a woman's death, two years named, the first read and both shown
    w = _no(8525)
    assert (w.rank, w.tabaqa, w.tabaqa_rule) == (1, 1, "companion") and w.death_ah == 73
    assert w.death_text and "ثلاث أو أربع وسبعين" in w.death_text


def test_most_entries_are_read_and_the_years_follow_the_tabaqat() -> None:
    main = [e for e in _entries() if e.kind == "entry"]
    assert sum(e.rank is not None for e in main) >= 0.9 * len(main)
    assert sum(e.tabaqa is not None for e in main) >= 0.95 * len(main)
    phrases = [e for e in main if e.death_text]
    assert sum(e.death_ah is not None for e in phrases) >= 0.9 * len(phrases)
    # a later ṭabaqa died later: the median year rises from the second to the twelfth
    medians = [
        statistics.median([e.death_ah for e in main if e.tabaqa == t and e.death_ah]) for t in range(2, 13)
    ]
    assert medians == sorted(medians), medians


def test_his_introduction_defines_each_rank_and_tabaqa_in_his_words() -> None:
    from jadhr_pipeline.ecosystem.taqrib import introduction

    rows = introduction(FILE.read_text(encoding="utf-8"))
    ranks = {r["n"]: r["text"] for r in rows if r["scale"] == "rank"}
    tabaqat = {r["n"]: r["text"] for r in rows if r["scale"] == "tabaqa"}
    assert sorted(ranks) == sorted(tabaqat) == list(range(1, 13))
    # the terms the rank reading uses are his: «صدوق» the fourth, «مقبول» the sixth, the Companions the first
    assert "بصدوق" in ranks[4] and "مقبول" in ranks[6] and "الصحابة" in ranks[1] and "الصحابة" in tabaqat[1]
    assert "كالزهري" in tabaqat[4] and "كمالك" in tabaqat[7]
    death = next(r["text"] for r in rows if r["scale"] == "death")
    assert "قبل المائة" in death and "بعد المائتين" in death
