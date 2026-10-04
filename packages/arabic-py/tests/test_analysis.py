"""The word-analysis rules (jadhr_arabic.analysis): each kind on a small vocabulary built for the test."""

from __future__ import annotations

from jadhr_arabic.analysis import Vocabulary, analyse, fold_root, strips


def vocab() -> Vocabulary:
    return Vocabulary(
        forms={
            "العلم": [(1, "علم", "N", 9), (2, "علم", "V", 1)],
            "علم": [(1, "علم", "N", 5)],
            "من": [(9, None, "P", 40)],
            "كتاب": [(3, "كتب", "N", 7)],
        },
        patterns=[
            ("fa3l", "فعل", "N", 100),
            ("fa3aal", "فعال", "N", 40),
            ("tafaa3ala", "تفاعل", "V", 10),
            ("istaf3ala", "استفعل", "V", 20),
        ],
        quran_roots={"علم", "كتب", "خرج", "أخذ", "حدد", "حول", "وقع", "وصف"},
        dict_roots={"علم", "كتب", "خرج", "ءخذ", "قعس", "سربخ", "حدد", "حول", "وقع", "وصف", "طلق"},
        to_dict={
            "علم": "علم",
            "كتب": "كتب",
            "خرج": "خرج",
            "أخذ": "ءخذ",
            "حدد": "حدد",
            "حول": "حول",
            "وقع": "وقع",
            "وصف": "وصف",
        },
    )


def test_a_form_the_quran_has_is_read_by_its_share() -> None:
    a = analyse(vocab(), "العِلْمَ")
    assert a.kind == "form" and a.readings[0].root == "علم" and a.confidence == 0.9


def test_a_function_word_has_no_root() -> None:
    a = analyse(vocab(), "مِن")
    assert a.kind == "particle" and a.readings[0].root is None


def test_clitics_are_taken_off_and_named() -> None:
    a = analyse(vocab(), "وكتابه")
    assert (
        a.kind == "clitic" and a.clitics == ("و", "ه") and a.readings[0].root == "كتب" and a.confidence == 0.7
    )


def test_a_pattern_finds_a_quranic_root_with_its_hamza() -> None:
    a = analyse(vocab(), "أخاذ")
    assert a.kind == "pattern" and a.readings[0].root == "أخذ" and a.readings[0].dict_root == "ءخذ"
    assert a.readings[0].pattern == "fa3aal" and a.confidence <= 0.35


def test_a_verb_in_its_inflection_and_a_root_only_the_dictionary_has() -> None:
    a = analyse(vocab(), "يتقاعسون")
    assert a.kind == "pattern-dict" and a.readings[0].root is None and a.readings[0].dict_root == "قعس"
    assert a.readings[0].pattern == "tafaa3ala" and a.confidence <= 0.2
    b = analyse(vocab(), "فاستخرجوه")
    assert b.kind == "pattern" and b.readings[0].root == "خرج" and b.clitics == ("ف", "ه")


def test_weak_and_doubled_roots_by_the_classical_rules() -> None:
    for word, root in (("حد", "حدد"), ("حال", "حول"), ("يقع", "وقع"), ("صفة", "وصف"), ("والحال", "حول")):
        a = analyse(vocab(), word)
        assert a.kind == "weak" and root in {r.root for r in a.readings} and a.confidence <= 0.25, word


def test_marks_written_apart_are_particles() -> None:
    assert analyse(vocab(), "يا").kind == "particle" and analyse(vocab(), "ح").kind == "particle"


def test_nothing_is_invented() -> None:
    assert analyse(vocab(), "زيدون").kind == "none"
    assert analyse(vocab(), "").kind == "none"


def test_helpers() -> None:
    assert fold_root("ءخذ") == fold_root("أخذ") == "اخذ"
    assert ("كتاب", ("و", "ه")) in strips("وكتابه")
