"""Texts beyond the Quran (P11.4a): a draft assembled into the generic model — ids after the Quran's, the tree of
chapters, each passage's verbatim text with a form id per word, its sure and possible roots kept apart."""

from __future__ import annotations

import pytest
from jadhr_arabic.analysis import Vocabulary, word_spans
from jadhr_pipeline.ecosystem.model import Chapter, Draft, Passage, assemble

V = Vocabulary(
    forms={"العلم": [(1, "علم", "N", 9)], "من": [(9, None, "P", 40)], "كتاب": [(3, "كتب", "N", 7)]},
    patterns=[("fa3aal", "فعال", "N", 40)],
    quran_roots={"علم", "كتب", "سلم"},
    dict_roots={"علم", "كتب", "سلم", "عبس"},
    to_dict={"علم": "علم", "كتب": "كتب", "سلم": "سلم"},
)


def draft() -> Draft:
    return Draft(
        slug="t", uri="book:t", kind="book", title_ar="كتاب", title_en="A book", author_ar=None, author_en=None,
        meta_ar=None, meta_en=None, era_year=800, source_id="src", info={"edition": "x"},
        chapters=[Chapter("الأول"), Chapter("باب", level=2, parent=0)],
        passages=[
            Passage(0, "1", "العِلْمُ مِنَ الكِتابِ، يا سلام!"),
            Passage(1, "2", "كتاب عباس (12)"),
        ],
    )  # fmt: skip


def test_a_draft_assembled_after_the_quran() -> None:
    out = assemble([draft()], V, text_id=2, chapter_id=115, passage_id=6237, sort_order=2)
    t = out["texts"][0]
    assert (t["id"], t["chapter_count"], t["passage_count"]) == (2, 2, 2) and t["info"] == {"edition": "x"}
    c1, c2 = out["chapters"]
    assert c1["id"] == 115 and c2["parent_id"] == 115 and c2["level"] == 2 and c2["uri"] == "book:t:c2"
    p1, p2 = out["passages"]
    assert p1["id"] == 6237 and p1["uri"] == "book:t:1" and p1["ar_full"] == "العِلْمُ مِنَ الكِتابِ، يا سلام!"
    # a form id for each word the shared tokeniser cuts, so the API can give the words back with their spans
    assert len(p1["form_ids"]) == len(word_spans(p1["ar_full"])) == p1["token_count"] == 5
    forms = {f["id"]: f for f in out["text_forms"]}
    kinds = [forms[i]["kind"] for i in p1["form_ids"]]
    assert kinds == ["form", "particle", "clitic", "particle", "pattern"]
    # sure roots (the Quran's forms) and possible ones (a pattern) apart
    assert p1["roots"] == ["علم", "كتب"] and p1["roots_low"] == ["سلم"]
    assert p2["roots"] == ["كتب"] and p2["roots_low"] == ["عبس"]
    # one row per distinct form, shared by the passages
    assert len(out["text_forms"]) == len({f["norm"] for f in out["text_forms"]})


def test_a_reference_is_given_once() -> None:
    d = draft()
    d.passages.append(Passage(0, "1", "مكرر"))
    with pytest.raises(ValueError, match="twice"):
        assemble([d], V, text_id=2, chapter_id=115, passage_id=6237, sort_order=2)
