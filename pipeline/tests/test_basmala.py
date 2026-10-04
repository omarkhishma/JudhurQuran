"""The basmala Tanzil writes at the head of a sūra's first verse is not the verse's (P1.8): the join strips it — four
words — from verse 1 of every sūra but al-Fātiḥa (where it is the verse) and at-Tawba (which has none), so the
words of each verse line up with the corpus and the recitation timings by their place."""

from __future__ import annotations

import json
import unicodedata
from pathlib import Path

import pytest
from jadhr_pipeline.texts import BASMALA_TOKENS, has_embedded_basmala, parse_tanzil_txt, tanzil_tokens

ROOT = Path(__file__).resolve().parents[2]
TANZIL = ROOT / "data" / "raw" / "tanzil" / "quran-uthmani-nomarks.txt"
VERSES = ROOT / "data" / "build" / "2026.10.0" / "verses.jsonl"


def test_which_first_verses_carry_it() -> None:
    assert not has_embedded_basmala(1, 1) and not has_embedded_basmala(9, 1)
    assert has_embedded_basmala(2, 1) and has_embedded_basmala(114, 1)
    assert not has_embedded_basmala(2, 2)
    # a verse with it gives its four words apart; one without gives none
    assert tanzil_tokens("a b c d e f", 2, 1) == (["a", "b", "c", "d"], ["e", "f"])
    assert tanzil_tokens("a b c d e f", 1, 1) == ([], ["a", "b", "c", "d", "e", "f"])


def _letters(words: list[str]) -> list[str]:
    return [
        "".join(c for c in unicodedata.normalize("NFD", w) if not unicodedata.combining(c)) for w in words
    ]


def test_on_the_pinned_text_every_first_verse_loses_exactly_the_basmala() -> None:
    text = parse_tanzil_txt(TANZIL).verses
    basmala = text[(1, 1)].split(" ")
    assert len(basmala) == BASMALA_TOKENS
    stripped, marked_apart = 0, []
    for surah in range(1, 115):
        head, body = tanzil_tokens(text[(surah, 1)], surah, 1)
        if has_embedded_basmala(surah, 1):
            # the four words taken are al-Fātiḥa's first verse, letter for letter (Tanzil marks a few apart: 95's
            # «بِّسْمِ» carries a shadda)
            assert _letters(head) == _letters(basmala), surah
            if head != basmala:
                marked_apart.append(surah)
            stripped += 1
        else:
            assert head == [], surah
        assert body, surah
    assert stripped == 112
    assert 95 in marked_apart and len(marked_apart) < 10


@pytest.mark.skipif(not VERSES.exists(), reason="no build to compare with")
def test_the_verses_word_counts_match_the_build_once_stripped() -> None:
    text = parse_tanzil_txt(TANZIL).verses
    counts = {
        (v["surah"], v["ayah"]): v["word_count"]
        for v in (json.loads(line) for line in VERSES.read_text(encoding="utf-8").splitlines())
    }
    for surah in range(1, 115):
        _, body = tanzil_tokens(text[(surah, 1)], surah, 1)
        assert len(body) == counts[(surah, 1)], surah
