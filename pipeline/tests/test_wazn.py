"""Morphological pattern (wazn) engine.

Expected patterns follow the classical الميزان الصرفي as stated in standard sarf references (the underlying
form before إعلال بالقلب، e.g. قَالَ فَعَلَ، مِيزَان مِفْعَال). Both sides are NFC-normalised so the order in
which an editor stored the marks never decides a test. Abstentions are tested as carefully as answers: a
pattern is only claimed when one analysis is certain.
"""

from __future__ import annotations

import unicodedata

import pytest
from jadhr_pipeline.wazn import lemma_pattern


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def wazn(lemma: str, root: str, pos: str = "N", form: int | None = None, derivation: str | None = None):
    return lemma_pattern(nfc(lemma), list(root), pos, form, derivation)


# lemma (as the corpus writes it), root, pos, verb form, derivation, expected pattern
CLAIMED = [
    # plain triliteral nouns
    ("رَبّ", "ربب", "N", None, None, "فَعْل"),
    ("كِتَٰب", "كتب", "N", None, None, "فِعَال"),
    ("رَسُول", "رسل", "N", None, None, "فَعُول"),
    ("رَّحِيم", "رحم", "ADJ", None, None, "فَعِيل"),  # leading assimilation shadda dropped
    ("رَّحْمَٰن", "رحم", "ADJ", None, None, "فَعْلَان"),  # dagger alef is a long ā
    ("جَنَّة", "جنن", "N", None, None, "فَعْلَة"),
    ("مِّيثَٰق", "وثق", "N", None, None, "مِفْعَال"),  # weak first radical surfacing as ي
    ("مِيزَان", "وزن", "N", None, None, "مِفْعَال"),
    ("عِند", "عند", "LOC", None, None, "فِعْل"),  # ن without a written sukun
    ("أُذُنٌ", "أذن", "N", None, None, "فُعُل"),  # case ending dropped
    ("أَبَدًا", "أبد", "T", None, None, "فَعَل"),  # alef after final tanwin is orthographic
    ("قُرْءَان", "قرأ", "N", None, None, "فُعْلَان"),
    ("شَيْطَٰن", "شطن", "N", None, None, "فَيْعَال"),
    # weak roots
    ("حِين", "حين", "N", None, None, "فِعْل"),
    ("صُورَة", "صور", "N", None, None, "فُعْلَة"),
    ("بَاب", "بوب", "N", None, None, "فَعَل"),  # hollow, middle radical as alef
    ("مَقَام", "قوم", "N", None, None, "مَفْعَل"),  # vowel moved to the radical before (مَقْوَم)
    ("مَّكَان", "كون", "N", None, None, "مَفْعَل"),
    ("سَمَآء", "سمو", "N", None, None, "فَعَال"),  # final weak radical as ء after alef; madd sign
    ("دُعَآء", "دعو", "N", None, None, "فُعَال"),
    ("طَآئِفَة", "طوف", "N", None, None, "فَاعِلَة"),  # middle weak radical as ء after alef
    ("هُدًى", "هدي", "N", None, None, "فُعَل"),
    ("مَأْوَىٰ", "أوي", "N", None, None, "مَفْعَل"),
    ("صَلَوٰة", "صلو", "N", None, None, "فَعَلَة"),  # rasm وٰ
    ("دُّنْيَا", "دنو", "ADJ", None, None, "فُعْلَى"),  # rasm ا for ى after ي
    ("عَصَا", "عصو", "N", None, None, "فَعَل"),
    ("وَلِىّ", "ولي", "N", None, None, "فَعِيل"),
    ("أُنثَىٰ", "أنث", "N", None, None, "فُعْلَى"),
    # hamza
    ("آخِر", "أخر", "N", None, None, "فَاعِل"),
    ("آبَاء", "أبو", "N", None, None, "أَفْعَال"),  # أَأْبَاء
    ("ءَالَآء", "ألو", "N", None, None, "أَفْعَال"),
    ("فُؤَاد", "فأد", "N", None, None, "فُعَال"),
    # doubled roots
    ("أَشَدّ", "شدد", "N", None, None, "أَفْعَل"),
    ("مَحِلّ", "حلل", "N", None, None, "مَفْعِل"),
    ("دَآبَّة", "دبب", "N", None, None, "فَاعِلَة"),
    ("أَذِلَّة", "ذلل", "N", None, None, "أَفْعِلَة"),
    # augments and endings
    ("عَٰلَمِين", "علم", "N", None, None, "فَاعَلِين"),
    ("نَصْرَانِيّ", "نصر", "N", None, None, "فَعْلَانِيّ"),
    ("حَوَارِيُّون", "حور", "N", None, None, "فَعَالِيُّون"),  # shadda + vowel order inside a suffix
    ("فَصِيلَت", "فصل", "N", None, None, "فَعِيلَة"),  # open ت in the rasm
    ("بَيِّنَة", "بين", "N", None, None, "فَيْعِلَة"),
    ("مَلَكُوت", "ملك", "N", None, None, "فَعَلُوت"),
    ("سُكَٰرَىٰ", "سكر", "N", None, None, "فُعَالَى"),
    # quadriliteral
    ("زُخْرُف", "زخرف", "N", None, None, "فُعْلُل"),
    ("قِنطَار", "قنطر", "N", None, None, "فِعْلَال"),
    ("عَبْقَرِىّ", "عبقر", "N", None, None, "فَعْلَلِيّ"),
    ("مُقَنطَرَة", "قنطر", "ADJ", 2, "PASS_PCPL", "مُفَعْلَلَة"),
    # tagged derivatives
    ("مُسْتَقِيم", "قوم", "ADJ", 10, "ACT_PCPL", "مُسْتَفْعِل"),
    ("كَٰفِرُون", "كفر", "N", None, "ACT_PCPL", "فَاعِلُون"),
    ("مَّعْدُودَة", "عدد", "ADJ", None, "PASS_PCPL", "مَفْعُولَة"),
    ("مُّهْتَدُون", "هدي", "N", 8, "ACT_PCPL", "مُفْتَعِل"),  # deleted radical: singular template
    ("تَذْكِرَة", "ذكر", "N", 2, "VN", "تَفْعِلَة"),
    ("مُنقَلَب", "قلب", "N", 7, "PASS_PCPL", "مُنْفَعَل"),
    # verbs
    ("عَلِمَ", "علم", "V", None, None, "فَعِلَ"),
    ("جَعَلَ", "جعل", "V", None, None, "فَعَلَ"),
    ("كَبُرَ", "كبر", "V", None, None, "فَعُلَ"),
    ("أَخَذَ", "أخذ", "V", None, None, "فَعَلَ"),
    ("ٱسْتَغْفَرَ", "غفر", "V", 10, None, "اسْتَفْعَلَ"),
    ("وَسْوَسَ", "وسوس", "V", None, None, "فَعْلَلَ"),
    ("تَقْشَعِرُّ", "قشعر", "V", 4, None, "افْعَلَلَّ"),
]


@pytest.mark.parametrize(("lemma", "root", "pos", "form", "derivation", "expected"), CLAIMED)
def test_claimed(lemma, root, pos, form, derivation, expected):
    result = wazn(lemma, root, pos, form, derivation)
    assert result is not None, lemma
    assert nfc(result["pattern"]) == nfc(expected), (lemma, result)


# No single certain analysis → no pattern (None) or, for form-I verbs, no vowel claim.
ABSTAINED = [
    ("سَيَّارَة", "سير", "N"),  # فَعَّالَة or فَيْعَالَة from the letters alone
    ("قَيُّوم", "قوم", "ADJ"),  # فَيْعُول or فَعُّول
    ("مَعِين", "عين", "N"),  # مَفْعُول (مَعْيُون) or مَفْعِل
    ("مَصِير", "صير", "N"),  # same ambiguity
    ("ٱللَّه", "أله", "PN"),
    ("يَد", "يدي", "N"),  # deleted radical
    ("ٱبْن", "بني", "N"),
]


@pytest.mark.parametrize(("lemma", "root", "pos"), ABSTAINED)
def test_abstained(lemma, root, pos):
    assert wazn(lemma, root, pos) is None


@pytest.mark.parametrize(
    ("lemma", "root"),
    [
        ("يَعْلَمُ", "علم"),  # imperfect lemma: its vowel is not the perfect's
        ("يَصِفُ", "وصف"),  # the prefix ي is not the weak first radical
        ("قَالَ", "قول"),  # hollow: underlying vowel not visible
        ("مَسَّ", "مسس"),  # doubled: underlying vowel not visible
        ("لَقُ", "لقي"),  # truncated lemma
    ],
)
def test_form_one_without_vowel(lemma, root):
    assert wazn(lemma, root, "V") == {"pattern": "", "method": "verb-form-I"}


def test_form_xii_has_no_pattern():
    # The corpus labels اطْمَأَنَّ as form XII; it is not افْعَوْعَلَ.
    assert wazn("ٱطْمَأَنَّ", "طمن", "V", 12) is None
    assert wazn("مُطْمَئِنّ", "طمن", "N", 12, "ACT_PCPL") is None
