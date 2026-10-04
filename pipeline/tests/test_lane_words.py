"""Lane's paragraph on each Quranic word (P3.1): read from Lane's own article of the root, matched by the word's vowels
or, for a verb Perseus keys bare, by its form; nothing guessed where neither holds. The words' Arabic is made from
their Buckwalter spelling, never typed with its marks."""

from __future__ import annotations

from pathlib import Path

from jadhr_arabic.buckwalter import bw_lemma_to_arabic
from jadhr_pipeline.lexica.lane import LaneWord, read_lane
from jadhr_pipeline.lexica.lane_words import map_lane_words
from jadhr_pipeline.lexica.shamela import Counters

RAW = Path(__file__).resolve().parents[2] / "data" / "raw" / "lexica" / "laneslexicon-lexicon_xml"


def _lemma(i: int, bw: str, pos: str = "N", form: int | None = None) -> dict:
    return {
        "id": i,
        "key": bw,
        "ar": bw_lemma_to_arabic(bw),
        "root_id": 1,
        "pos": pos,
        "verb_form": form,
        "occurrences": 10,
    }


ROOTS = [{"id": 1, "key": "علم", "letters": ["ع", "ل", "م"]}]


def _map(words: list[LaneWord], lemmas: list[dict]) -> dict[int, tuple[int, str]]:
    entries = [{"id": 7, "work_id": "lane", "displayable": True, "root_key": "علم", "lane_words": words}]
    rows, report = map_lane_words(entries, lemmas, ROOTS)
    assert report["rows"] == len(rows)
    return {r["lemma_id"]: (r["para"], r["rule"]) for r in rows}


def test_a_word_is_matched_by_its_vowels_or_its_verb_form() -> None:
    words = [
        LaneWord(0, "Ealimahu", "1", "2138"),  # the verb, cited with its object pronoun
        LaneWord(1, "El~mhu", "2", "2139"),  # form II, keyed without vowels
        LaneWord(2, "EilomN", None, "2140"),  # the noun, with its tanwin
        LaneWord(3, "EalamN", None, "2140"),  # another noun of the same letters
        LaneWord(4, "AlEaAlamu", None, "2141"),  # keyed with the article
    ]
    lemmas = [
        _lemma(1, "Ealima", "V"),
        _lemma(2, "Eal~ama", "V", 2),
        _lemma(3, "Eilom"),
        _lemma(4, "Ealam"),
        _lemma(5, "Ea`lam"),
        _lemma(6, "m~aEoluwma`t", "ADJ"),  # a plural Lane keys in the singular: no paragraph
    ]
    got = _map(words, lemmas)
    assert got == {
        1: (0, "vocalised"),
        2: (1, "verb-form"),
        3: (2, "vocalised"),
        4: (3, "vocalised"),
        5: (4, "vocalised"),
    }


def test_a_verb_takes_a_verbs_paragraph_and_a_noun_a_nouns() -> None:
    # Lane keys the noun «عَلَمٌ» and the verb «عَلَمَهُ»: each word of the corpus takes its own kind's paragraph
    words = [LaneWord(0, "EalamN", None, "1"), LaneWord(1, "Ealamahu", "1", "1")]
    assert _map(words, [_lemma(1, "Ealama", "V"), _lemma(2, "Ealam")]) == {
        1: (1, "vocalised"),
        2: (0, "vocalised"),
    }
    # a verb Lane has no verb paragraph for takes none, not the noun's
    assert _map([LaneWord(0, "EalamN", None, "1")], [_lemma(1, "Ealama", "V")]) == {}


def test_an_unnumbered_derived_verb_is_not_taken_for_form_one() -> None:
    # «تَعَلَّمَ» left without a form number: it does not begin with the root's first letter, so Lane's form I is not it
    words = [LaneWord(0, "Elmhu", "1", "1")]
    assert _map(words, [_lemma(1, "taEal~ama", "V")]) == {}
    assert _map(words, [_lemma(1, "Ealima", "V")]) == {1: (0, "verb-form")}


def test_the_same_letters_with_other_vowels_are_another_word() -> None:
    # «مُرَاضَعٌ» is not «مَرَاضِع», even as the one word of those letters: no paragraph is guessed
    words = [LaneWord(0, "muraADaEN", None, "1")]
    assert _map(words, [_lemma(1, "maraADiE")]) == {}


def test_spellings_lane_and_the_mushaf_write_apart_are_one_word() -> None:
    # Perseus writes a final ya «ى», and a shadda after the tanwin: «كُرْسِىٌّ» is «كُرْسِيّ»
    assert _map([LaneWord(0, "kurosiY~N", None, "1")], [_lemma(1, "kurosiy~")]) == {1: (0, "vocalised")}
    assert _map([LaneWord(0, "EaSiY~N", None, "1")], [_lemma(1, "EaSiy~", "ADJ")]) == {1: (0, "vocalised")}


def test_on_lanes_own_article_of_the_root() -> None:
    lane = read_lane(RAW / "lexicon_xml-f3c19fb.tar.gz", Counters())
    elm = next(e for e in lane if e.root_n == "Elm")
    paras = elm.body.split("\n\n")
    # every word's paragraph is a paragraph of the article, and begins with the word as Lane keys it
    assert elm.words and all(0 <= w.para < len(paras) for w in elm.words)
    lemmas = [
        _lemma(1, "Ealima", "V"),
        _lemma(2, "Eilom"),
        _lemma(3, "Ealiym", "ADJ"),
        _lemma(4, "Eal~ama", "V", 2),
    ]
    got = _map(elm.words, lemmas)
    assert set(got) == {1, 2, 3, 4}
    for lid, (para, _) in got.items():
        key = next(w.key for w in elm.words if w.para == para)
        assert paras[para], (lid, key)
    # the noun's paragraph is the one Perseus keys «EilomN», not the verb's
    assert next(w.key for w in elm.words if w.para == got[2][0]) == "EilomN"
