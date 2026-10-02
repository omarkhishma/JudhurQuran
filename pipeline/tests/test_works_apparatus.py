"""Stripping the modern editor's apparatus from classical tafsir text (decision D22)."""

import pytest
from jadhr_pipeline.works import strip_apparatus

CASES = [
    ("نص [[حاشية]] بعده.", "نص بعده."),
    # ordinary editorial brackets around the author's words, with a Quran reference inside, stay
    ("كَقَوْلِهِ: [كَقَوْلِهِ ﴿إِحْسَانًا﴾ [البقرة: ٨٣]] ﴿حَمَلَتْهُ﴾", "كَقَوْلِهِ: [كَقَوْلِهِ ﴿إِحْسَانًا﴾ [البقرة: ٨٣]] ﴿حَمَلَتْهُ﴾"),
    # a footnote that began in the previous verse's text
    ("بقية حاشية سابقة (٢٢٩).]].\n\nوَقَالَ مُقَاتِلٌ", "وَقَالَ مُقَاتِلٌ"),
    # a footnote holding a bracketed reference
    ("أول [[حاشية فيها [فصلت: ١٠]]] آخر", "أول آخر"),
    # a footnote that runs past the end of this verse's text
    ("نص [[حاشية لا تنتهي", "نص"),
    # a manuscript folio mark glued to the next word
    ("وثلاثة عشر ٤٣/أفَلَمَّا وصلوا", "وثلاثة عشر فَلَمَّا وصلوا"),
]


@pytest.mark.parametrize(("src", "expected"), CASES)
def test_strip_apparatus(src: str, expected: str) -> None:
    assert strip_apparatus(src)[0] == expected
