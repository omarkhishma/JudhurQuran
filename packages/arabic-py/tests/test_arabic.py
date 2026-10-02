"""Arabic utilities. Combining-mark strings are written as explicit escapes —
editors silently reorder marks in typed literals (Judhur lesson)."""

import pytest
from judhur_arabic import (
    BuckwalterError,
    bw_lemma_to_arabic,
    bw_to_arabic,
    from_qac,
    key,
    normalize,
    parse_root_input,
    skeleton,
    spaced,
    split_lemma_key,
    strip_marks,
    translit,
)

# ٱلْعَٰلَمِينَ — alef wasla, lam, sukun, ain, fatha, dagger alef, lam, fatha, meem, kasra, yeh, noon, fatha
ALAMIN = "ٱلْعَٰلَمِينَ"


def test_bw_basic_and_extended_marks() -> None:
    assert bw_to_arabic("ktb") == "كتب"
    assert bw_to_arabic("{ll~ahi") == "ٱللَّهِ"
    # dagger alef, maddah, small high rounded zero
    assert bw_to_arabic("`^@") == "ٰٓ۟"


def test_bw_is_strict() -> None:
    with pytest.raises(BuckwalterError):
        bw_to_arabic("kt\rb")
    with pytest.raises(BuckwalterError):
        bw_to_arabic("ktb2")


def test_lemma_homograph_digit_and_multiword() -> None:
    assert split_lemma_key("bayona2") == ("bayona", 2)
    assert split_lemma_key("kitaAb") == ("kitaAb", None)
    assert bw_lemma_to_arabic("<ilo_yaAsiyn") == "إِلْ يَاسِين"


def test_qac_root_hamza_radical() -> None:
    assert from_qac("Amn") == ["ء", "م", "ن"]
    assert from_qac("qrA") == ["ق", "ر", "ء"]
    assert spaced(from_qac("Amn")) == "أ م ن"  # أ م ن
    assert key(from_qac("sAl")) == "سأل"  # سأل
    assert translit(from_qac("Elm")) == "ʿ-l-m"


def test_strip_marks_keeps_letters() -> None:
    assert strip_marks(ALAMIN) == "ٱلعلمين"


def test_normalize_folds_alef_family_on_both_sides() -> None:
    # ٱللَّه (Uthmani) and الله (plain) share a key
    assert normalize("ٱللَّهِ") == normalize("الله")
    # أمر / إمر / امر
    assert normalize("أمر") == normalize("امر") == normalize("إمر")
    # كِتَابَة finds كتابة; ة and ه share a key
    assert normalize("كِتَابَة") == normalize("كتابه")


def test_normalize_drops_quranic_annotation_signs() -> None:
    # pause mark ۚ, sajdah ۩, small high meem ۢ, QPC open fathatan U+08F0
    assert normalize("عليمۚ ۩ بࣰۢ") == "عليم ب"


def test_skeleton_aligns_vocative_split() -> None:
    # يَٰٓأَيُّهَا (one Uthmani token) vs يا أيها (two imlaei tokens)
    uthmani = "يَٰٓأَيُّهَا"
    assert skeleton(uthmani) == skeleton("يا أيها")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("ك ت ب", ["ك", "ت", "ب"]),
        ("كتب", ["ك", "ت", "ب"]),
        ("أمن", ["ء", "م", "ن"]),
        ("امن", ["ء", "م", "ن"]),
        ("k-t-b", ["ك", "ت", "ب"]),
        ("q-r-'", ["ق", "ر", "ء"]),
        ("sh-r-k", ["ش", "ر", "ك"]),
        ("ʿ-l-m", ["ع", "ل", "م"]),
    ],
)
def test_parse_root_input(raw: str, expected: list[str]) -> None:
    assert parse_root_input(raw) == expected


def test_parse_root_input_rejects_non_roots() -> None:
    assert parse_root_input("") is None
    assert parse_root_input("kitab") is None
    assert parse_root_input("ك") is None


def test_ascii_root_input_expands_undotted_letters() -> None:
    from judhur_arabic import root_input_candidates

    as_keys = lambda q: ["".join(c) for c in root_input_candidates(q)]  # noqa: E731
    assert "رحم" in as_keys("r-h-m")  # رحم: plain h may be ح
    assert as_keys("r-h-m")[0] == "رهم"  # the strict reading stays first (رهم)
    assert as_keys("ḥ-m-d")[0] == "حمد"  # dotted ḥ is not ambiguous
    assert as_keys("رحم") == ["رحم"]  # Arabic input has one reading
    assert len(root_input_candidates("h-s-d-t-z")) <= 64
