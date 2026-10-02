"""Romanisation: hand-checked expectations for common Quranic lemmas and patterns."""

import pytest
from jadhr_arabic import scholarly, slug_lemma, slug_pattern

CASES = [
    # vocalised Arabic, scholarly transliteration, lemma slug
    ("ٱللَّه", "Allāh", "allah"),
    ("فِى", "fī", "fi"),
    ("ٱلَّذِى", "alladhī", "alladhi"),
    ("عَلَىٰ", "ʿalā", "ala"),
    ("رَحْمَٰن", "raḥmān", "rahman"),
    ("كِتَٰب", "kitāb", "kitab"),
    ("ٱسْم", "ism", "ism"),
    ("سَمَآء", "samāʾ", "sama"),
    ("ءَامَنَ", "āmana", "amana"),
    ("مُؤْمِن", "muʾmin", "mumin"),
    ("قُرْءَان", "qurʾān", "quran"),
    ("مَكْتَبَة", "maktaba", "maktaba"),
    ("مُوسَىٰ", "mūsā", "musa"),
    ("صَلَوٰة", "ṣalāh", "sala"),
    ("شَىْء", "shayʾ", "shay"),
    ("ٱلرَّحْمَٰن", "al-raḥmān", "alrahman"),
    ("إِبْرَٰهِيم", "ibrāhīm", "ibrahim"),
    ("هُدًى", "hudā", "huda"),
    ("جَنَّة", "janna", "janna"),
]

PATTERNS = [
    ("فَاعِل", "fāʿil", "faa3il"),
    ("مَفْعُول", "mafʿūl", "maf3uul"),
    ("فَعَالَة", "faʿāla", "fa3aalah"),
    ("فَعَلَة", "faʿala", "fa3alah"),
    ("فَعَّلَ", "faʿʿala", "fa33ala"),
    ("اسْتَفْعَلَ", "istafʿala", "istaf3ala"),
]


@pytest.mark.parametrize(("ar", "sch", "slug"), CASES)
def test_lemma_romanisation(ar: str, sch: str, slug: str) -> None:
    assert scholarly(ar) == sch
    assert slug_lemma(ar) == slug


@pytest.mark.parametrize(("ar", "sch", "slug"), PATTERNS)
def test_pattern_romanisation(ar: str, sch: str, slug: str) -> None:
    assert scholarly(ar) == sch
    assert slug_pattern(ar) == slug


def test_pattern_slugs_do_not_collide_where_the_design_did() -> None:
    # The design keyed both فَعَلَ and فَعَالَة as "fa3ala".
    assert slug_pattern("فَعَلَ") != slug_pattern("فَعَالَة")
