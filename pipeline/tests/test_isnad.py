"""The isnād and the matn told apart by rule (P11.2b): the convention on records of every book, the parts tiling every
record's text, and the measure against Sanadset's boundaries (a cross-check, never shown)."""

from __future__ import annotations

import re
from functools import cache
from itertools import pairwise
from typing import Any

import pytest
from jadhr_arabic import normalize
from jadhr_pipeline.ecosystem.isnad import Split
from jadhr_pipeline.ecosystem.isnad_check import measure, records, splits, summary
from jadhr_pipeline.release import REPO

RAW = REPO / "data/raw"
_LETTERS = re.compile(r"[ء-غف-ي]+")


@cache
def _all() -> tuple[dict[str, list[dict[str, Any]]], dict[str, list[Split | None]]]:
    recs = records(RAW)
    return recs, splits(recs)


def _parts(book: str, number: int) -> tuple[str, str, str | None, str | None, list[str]]:
    recs, sp = _all()
    k = next(k for k, h in enumerate(recs[book]) if h["hadithnumber"] == number)
    t, s = recs[book][k]["text"], sp[book][k]
    assert s is not None, (book, number)
    matn = t[s.matn[0] : s.matn[1]] if s.matn else None
    comment = t[s.comment[0] : s.comment[1]] if s.comment else None
    return s.rule, t[s.isnad[0] : s.isnad[1]], matn, comment, [t[a:b] for a, b in s.names]


def _bare(s: str | None) -> str:
    """The words only, normalised: marks and punctuation do not decide a boundary."""
    return " ".join(_LETTERS.findall(normalize(s or "")))


def test_the_prophets_words_begin_the_matn_his_mention_and_verb_close_the_isnad() -> None:
    rule, isnad, matn, _, names = _parts("bukhari", 1)
    assert rule == "prophet-speech"
    assert _bare(isnad).endswith("علي المنبر قال سمعت رسول الله صلي الله عليه وسلم يقول")
    assert _bare(matn).startswith("انما الاعمال بالنيات")
    assert [_bare(n) for n in names] == [
        "الحميدي عبد الله بن الزبير",
        "سفيان",
        "يحيي بن سعيد الانصاري",
        "محمد بن ابراهيم التيمي",
        "علقمه بن وقاص الليثي",
        "عمر بن الخطاب",
    ]
    rule, _, matn, _, names = _parts("abudawud", 4392)  # «وبهذا الإسناد قال قال رسول الله ﷺ "…"»
    assert rule == "prophet-speech" and names == [] and _bare(matn).startswith("ليس علي الخاين قطع")


def test_a_companions_report_begins_after_his_verb_or_at_his_that() -> None:
    rule, isnad, matn, _, names = _parts("muslim", 690)
    assert rule == "companion-said" and _bare(isnad).endswith("عن عايشه قالت")
    assert _bare(matn).startswith("امرني رسول الله") and _bare(names[-1]) == "عايشه"
    _, isnad, matn, _, _ = _parts("malik", 496)  # Mālik's balāgh: «أنه بلغه أن رسول الله ﷺ كان يدعو …»
    assert _bare(isnad).endswith("انه بلغه") and _bare(matn).startswith("ان رسول الله")


def test_co_narrators_and_a_speaker_inside_the_story() -> None:
    _, _, matn, _, names = _parts(
        "muslim", 3633
    )  # «إسحاق بن إبراهيم، ومحمد بن حاتم، قال محمد بن حاتم حدثنا …»
    assert [_bare(n) for n in names[:2]] == ["اسحاق بن ابراهيم", "محمد بن حاتم"]
    assert _bare(matn).startswith("حضرنا مع ابن عباس")
    rule, _, matn, _, names = _parts(
        "muslim", 1018
    )  # «سمعت جابر بن سمرة قال عمر لسعد …»: ʿUmar speaks in the report
    assert rule == "character-said" and _bare(matn).startswith("قال عمر لسعد")
    assert _bare(names[-1]) == "جابر بن سمره"


def test_a_pointer_to_another_chain_has_no_matn_and_the_collector_speaks_apart() -> None:
    rule, isnad, matn, _, _ = _parts("muslim", 2158)  # «… عن النبي ﷺ مثله»
    assert rule == "chain-reference" and matn is None
    assert _bare(isnad).endswith("عن النبي صلي الله عليه وسلم مثله")
    rule, _, matn, comment, _ = _parts("tirmidhi", 238)
    assert rule == "prophet-speech" and _bare(matn).startswith("مفتاح الصلاه الطهور")
    assert _bare(comment).startswith("قال ابو عيسي")


def test_the_parts_tile_every_record_and_its_names_sit_in_its_isnad() -> None:
    recs, sp = _all()
    read = 0
    for book, hs in recs.items():
        done = 0
        for h, s in zip(hs, sp[book], strict=True):
            if s is None:
                continue
            done += 1
            t = h["text"]
            ends = [s.isnad, *(p for p in (s.matn, s.comment) if p)]
            assert s.isnad[0] == 0 and ends[-1][1] == len(t), (book, h["hadithnumber"])
            assert all(a[1] == b[0] for a, b in pairwise(ends)), (book, h["hadithnumber"])
            assert all(s.isnad[0] <= a < b <= s.isnad[1] for a, b in s.names), (book, h["hadithnumber"])
            assert s.as_meta()["status"] == "auto" and s.as_meta()["method"] == "rules-v1"
        # most records read; the rest are left whole, never guessed
        assert done >= 0.8 * len(hs), (book, done, len(hs))
        read += done
    assert read >= 0.85 * sum(len(hs) for hs in recs.values())


def test_the_split_agrees_with_sanadsets_boundaries() -> None:
    """Measured, not copied: the content's start against Sanadset's, carried onto our text (research 21's splitter v2
    reached 54% exact on al-Bukhārī). The Muwaṭṭaʾ differs most by convention (Sanadset files the reported actor in
    its isnād), so its floor is lower."""
    pytest.importorskip("pyarrow")
    m = measure(RAW)
    s = summary(m)
    for book in ("bukhari", "muslim", "abudawud", "tirmidhi", "ibnmajah"):
        assert s[book]["n"] > 2000 and s[book]["exact"] >= 0.75 and s[book]["within 5"] >= 0.84, (
            book,
            s[book],
        )
        assert s[book]["companion"] >= 0.82, (book, s[book])
        speech = m[book]["prophet-speech"]
        assert speech["exact"] / speech["n"] >= 0.93, (book, speech)
    assert s["malik"]["exact"] >= 0.4 and s["malik"]["within 5"] >= 0.6, s["malik"]


def test_every_narrators_name_in_a_record_is_found_and_a_matns_words_are_not() -> None:
    """The names a root's life must not count: those of the isnād and of the chains elsewhere in the record (a
    collector's note naming who else reported it), never the words of the report («عن الصلاة» is no narrator)."""
    from jadhr_pipeline.ecosystem.isnad import chain_words, known_names, split

    recs, sp = _all()
    known = known_names((h["text"], s) for b in recs for h, s in zip(recs[b], sp[b], strict=True))
    k = next(k for k, h in enumerate(recs["bukhari"]) if h["hadithnumber"] == 27)
    t = recs["bukhari"][k]["text"]  # «… رواه يونس وصالح ومعمر وابن أخي الزهري عن الزهري.»
    names, formulas, _ = chain_words(t, sp["bukhari"][k], known)
    found = [_bare(t[a:b]) for a, b in names]
    assert found[-5:] == ["يونس", "صالح", "معمر", "ابن اخي الزهري", "الزهري"]
    assert all(
        _bare(t[a:b]).removeprefix("و") in {"عن", "حدثنا", "اخبرنا", "اخبرني", "حدثني", "رواه", "سمعت"}
        for a, b in formulas
    )
    text = "حَدَّثَنَا قُتَيْبَةُ، عَنْ أَنَسٍ، قَالَ سَأَلْتُ رَسُولَ اللَّهِ صلى الله عليه وسلم عَنِ الصَّلاَةِ"
    names, _, blessings = chain_words(text, split(text, "bukhari", known), known)
    assert [_bare(text[a:b]) for a, b in names] == ["قتيبه", "انس"]
    # the blessing after his name is a formula, not the root صلو of «الصلاة»
    assert [_bare(text[a:b]) for a, b in blessings] == ["صلي الله عليه وسلم"]
