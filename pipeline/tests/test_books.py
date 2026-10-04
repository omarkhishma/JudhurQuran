"""The books (P11.3a): an OpenITI version read into the generic model by rules applied to every book alike — the
printed pages each paragraph starts and ends on, the editor's apparatus out of the author's text or marked as his,
the page-trust check, the chapters from the headings or from runs of pages."""

from __future__ import annotations

import json
import re
from collections import Counter
from functools import cache
from pathlib import Path
from typing import Any

import yaml
from jadhr_arabic import normalize
from jadhr_pipeline.ecosystem.books import (
    _ANCHOR,
    _JK_HEADING,
    _MILESTONE,
    _TAG,
    _VERSE_REF,
    _W,
    HEADER_END,
    Para,
    Quran,
    _raw_parts,
    book,
    card,
    clean,
    family,
    fixed_pages,
    page_trust,
    paged,
)
from jadhr_pipeline.release import REPO

RAW = REPO / "data/raw"

HEADER = "######OpenITI#\n#META# 000.SortField :: x\n#META#Header#End#\n"


def _quran() -> Quran:
    verses = [
        {
            "surah": 1,
            "ayah": 2,
            "text_imlaei": "الحمد لله رب العالمين",
            "norm_plain": "الحمد لله رب العالمين",
        },
        {
            "surah": 1,
            "ayah": 5,
            "text_imlaei": "إياك نعبد وإياك نستعين",
            "norm_plain": "اياك نعبد واياك نستعين",
        },
        {"surah": 2, "ayah": 4, "text_imlaei": "وبالآخرة هم يوقنون", "norm_plain": "وبالاخرة هم يوقنون"},
        {
            "surah": 38,
            "ayah": 57,
            "text_imlaei": "هذا فليذوقوه حميم وغساق",
            "norm_plain": "هذا فليذوقوه حميم وغساق",
        },
        {"surah": 79, "ayah": 46, "text_imlaei": "كأنهم يوم يرونها", "norm_plain": "كانهم يوم يرونها"},
    ]
    surahs = [(1, "الفاتحة"), (2, "البقرة"), (38, "ص"), (79, "النازعات")]
    return Quran.load(verses, [{"name_ar": n, "number": k} for k, n in surahs])


def test_a_marker_closes_the_page_whose_text_stands_before_it() -> None:
    paras = [
        Para("أ ب PageV01P001"),
        Para("ج د"),  # no marker: on the page the next marker closes
        Para("ه PageV01P002 و"),  # starts on page 2, ends on page 3
        Para(" PageV01P003"),  # a marker alone: no words, no pages
        Para("ز PageV01P004"),
        Para("ح PageV01P005 ط"),  # «ط» stands after the book's last marker: its page is unknown, not guessed
    ]
    words, *_ = paged(paras)
    assert [p.pages for p in paras] == [
        [(1, 1), (1, 1)],
        [(1, 2), (1, 2)],
        [(1, 2), (1, 3)],
        [],
        [(1, 4), (1, 4)],
        [(1, 5)],
    ]
    assert dict(words) == {(1, 1): 2, (1, 2): 3, (1, 3): 1, (1, 4): 1, (1, 5): 1}
    assert all("Page" not in p.text for p in paras)
    assert paras[2].marks == [(1, 2)] and paras[3].marks == [(1, 3)]


def test_a_marker_in_a_heading_or_a_section_left_out_keeps_its_place() -> None:
    raw = HEADER + "\n".join(
        [
            "# فاتحة الكتاب",
            "### | كتاب الطهارة PageV01P002",
            "# أول الباب",
            "~~ تتمته",
            " PageV01P003",
            "### |EDITOR| مقدمة المحقق",
            "# كلام المحقق PageV01P004",
            "### || فصل في المقدمة",
            "# كلام آخر للمحقق",
            "### | كتاب الصلاة",
            "# نص",
        ]
    )
    heads, paras = _raw_parts(raw)
    assert [(lv, t) for lv, t, _ in heads] == [(1, "كتاب الطهارة PageV01P002"), (1, "كتاب الصلاة")]
    assert [p.text for p in paras] == [
        "فاتحة الكتاب PageV01P002",
        "أول الباب  تتمته PageV01P003 PageV01P004",
        "نص",
    ]
    assert [p.heading for p in paras] == [None, 0, 1]
    paged(paras)
    # the editor's pages (4) are no paragraph's; «نص» stands after the last marker
    assert [p.pages for p in paras] == [[(1, 2), (1, 2)], [(1, 3), (1, 3)], []]


def test_the_editor_s_apparatus_out_of_the_author_s_text_or_marked_as_his() -> None:
    stats: Counter[str] = Counter()
    text = (
        "قال تعالى: @QB@(الحمد لله رب العالمين)@QE@ (2) [الفاتحة: 2] وقال (3) كذا [يعني الرجل] "
        "ونعبد (5) [البقرة: 3 - 4] ms12 انتهى"
    )
    body, meta = clean(text, _quran(), stats)
    # the verse's number kept (its words end verse 2); a footnote marker out, even «(5)» after a word that ends no
    # verse 5; the references out, kept as links; the editor's gloss kept as printed and marked
    assert "(2)" in body and "(3)" not in body and "(5)" not in body
    assert "[الفاتحة" not in body and "ms12" not in body and "@Q" not in body
    assert meta["quran_refs"] == [[1, 2, 2], [2, 3, 4]]
    assert [body[a:b] for a, b in meta["editor"]] == ["[يعني الرجل]"]
    assert stats == Counter(
        {"quran-quotes": 1, "verse-refs": 2, "verse-numbers": 1, "footnote-markers": 2, "editor-brackets": 1}
    )


def test_a_reference_links_only_a_verse_that_is_there() -> None:
    stats: Counter[str] = Counter()
    # «[النازعات: 56]»: al-Nāziʿāt has 46 verses — the editor's slip, left as printed; «ص» is also his «page»: a
    # one-letter sūra only where its verse's words stand before it
    text = "إلا ليعبدون [النازعات: 56] ثم {وغساق} [ص: 57] وفي الحديث أفي كل [ص : 20] عام"
    body, meta = clean(text, _quran(), stats)
    assert meta["quran_refs"] == [[38, 57, 57]]
    assert [body[a:b] for a, b in meta["editor"]] == ["[النازعات: 56]", "[ص : 20]"]
    assert stats["verse-refs-unknown"] == stats["verse-refs-one-letter-unquoted"] == 1


def test_a_verse_number_needs_the_verse_s_own_last_words() -> None:
    q = _quran()
    assert q.verse_number("وإياك نستعين", 5, quoted=False)
    assert not q.verse_number("وإياك نستعين", 4, quoted=False)
    # a quoted fragment may stop inside the verse: its last two words need only be a pair of that verse
    assert not q.verse_number("الحمد لله", 2, quoted=False)
    assert q.verse_number("الحمد لله", 2, quoted=True)


def test_a_slipped_page_marker_is_read_only_where_its_neighbours_leave_one_page() -> None:
    marks = [
        (5, 340),
        (5, 341),
        (5, 342),
        (5, 34),
        (5, 344),
        (5, 0),
        (5, 346),
        (5, 347),
        (0, 0),
        (0, 0),
        (5, 352),
    ]
    fixed, read, unknown = fixed_pages(marks)
    # «34» between 342 and 344 is 343, the unnumbered page between 344 and 346 is 345; two unnumbered pages between
    # 347 and 352 leave room for four: unknown
    assert fixed == [
        (5, 340),
        (5, 341),
        (5, 342),
        (5, 343),
        (5, 344),
        (5, 345),
        (5, 346),
        (5, 347),
        None,
        None,
        (5, 352),
    ]
    assert (read, unknown) == (2, 2)
    # a restart (front matter numbered apart) leaves the shorter run off the spine, unknown
    fixed, read, unknown = fixed_pages(
        [(1, 4), (1, 5), (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7)]
    )
    assert (
        fixed[:2] == [None, None] and fixed[2:] == [(1, n) for n in range(1, 8)] and (read, unknown) == (0, 2)
    )


def test_printed_pages_are_cited_only_where_the_markers_hold() -> None:
    rising = [(1, n) for n in range(1, 21)]
    assert page_trust(rising, [250] * 20, None) == (True, [])
    assert page_trust(rising[:5], [250] * 5, None) == (False, [{"why": "markers", "n": 5}])
    assert page_trust([*rising, (1, 3)], [250] * 20, None) == (False, [{"why": "backs", "n": 1}])
    assert page_trust([None, None, *rising], [250] * 20, None)[1] == [{"why": "unknown", "n": 2, "of": 22}]
    assert page_trust([None, *rising[:5], *rising[6:]] + rising[19:] * 30, [250] * 20, None)[0]
    assert page_trust(rising, [2500] * 20, None)[1] == [{"why": "median", "n": 2500}]
    sampled = {"pages_tested": 10, "both_ends_match": 7}
    assert page_trust(rising, [250] * 20, sampled)[1] == [{"why": "turath", "n": 7, "of": 10}]
    assert page_trust(rising, [250] * 20, {"pages_tested": 10, "both_ends_match": 8})[0]


def test_a_books_card_is_read_from_its_own_header_by_one_rule() -> None:
    spec = {"title_ar": "تاريخ :: ديوان المبتدأ", "author_ar": "Ibn Khaldūn", "author_full_ar": ""}
    openiti = (
        "######OpenITI#\n#META# 010.AuthorAKA\t:: NODATA\n"
        "#META# 010.AuthorNAME\t:: عبد الرحمن بن محمد، ابن خلدون (المتوفى: 808هـ)\n"
        "#META# 020.BookTITLE\t:: ديوان المبتدأ والخبر\n#META# 029.BookTITLEalt\t:: NODATA\n"
        "#META# 040.EdEDITOR\t:: خليل شحادة\n#META# 041.EdNUMBER\t:: الثانية، 1408 هـ - 1988 م\n"
        "#META# 043.EdPUBLISHER\t:: دار الفكر، بيروت\n#META# 045.EdYEAR\t:: NODATA\n#META#Header#End#\n"
    )
    c = card(openiti, spec)
    assert (c["title_ar"], c["short_title_ar"]) == ("ديوان المبتدأ والخبر", "ديوان المبتدأ والخبر")
    # no Arabic short name in the header or the catalogue: the card's «المؤلف», else the full name's
    assert (
        c["author_ar"] == c["author_full_ar"] == "عبد الرحمن بن محمد، ابن خلدون"
        and c["follows_print"] is None
    )
    assert c["edition_ar"] == "تحقيق خليل شحادة، الطبعة الثانية، 1408 هـ - 1988 م، دار الفكر، بيروت"
    shamela = (
        "#META# المؤلف: الربيع بن حبيب (المتوفى حوالي سنة: 170ه)\n#META# comments: ترقيم الصفحات آلي غير موافق للمطبوع\n"
        "#META# الكتاب: الجامع الصحيح ¶ المؤلف: الربيع\n#META#Header#End#\n"
    )
    c = card(shamela, {"title_ar": "x", "author_ar": "Rabīʿ", "author_full_ar": ""})
    assert (c["title_ar"], c["author_ar"], c["follows_print"]) == ("الجامع الصحيح", "الربيع بن حبيب", False)
    assert page_trust([(1, n) for n in range(1, 21)], [250] * 20, None, c["follows_print"])[1] == [
        {"why": "card"}
    ]


def test_a_book_without_headings_reads_in_runs_of_pages(tmp_path: Path) -> None:
    (tmp_path / "b.mARkdown").write_text(
        HEADER
        + "\n".join(
            [
                "# [12]",  # the editor's number for the paragraph that follows
                "# نص الفقرة الأولى PageV01P001",
                "# PageV01P002",  # a marker alone, al-Ṭabarī's way
                "# نص الفقرة الثانية PageV01P060",
            ]
        ),
        encoding="utf-8",
    )
    spec = {
        "slug": "b",
        "work": "0001X.Y",
        "file": "b.mARkdown",
        "title_ar": "ك",
        "title_en": "K",
        "author_ar": "م",
        "author_en": "M",
        "death_ah": 1,
        "version": "v",
        "genre": None,
    }
    stats: Counter[str] = Counter()
    d = book(tmp_path, spec, Quran(set(), set(), {}), None, stats)
    assert [(p.ref, p.text, p.meta) for p in d.passages] == [
        ("1", "نص الفقرة الأولى", {"pages": [[1, 1], [1, 1]], "on_page": 1, "editor_number": "12"}),
        # half the paragraphs numbered: the editor numbers them, and the one he left falls under the number before
        ("2", "نص الفقرة الثانية", {"pages": [[1, 60], [1, 60]], "on_page": 1, "editor_section": "12"}),
    ]
    assert [c.meta for c in d.chapters] == [
        {"label": "pages", "volume": 1, "pages_from": 1},
        {"label": "pages", "volume": 1, "pages_from": 50},
    ]
    assert [p.chapter for p in d.passages] == [0, 1]
    assert d.info["pages_trusted"] is False and d.info["numbered_by_editor"] is True
    assert d.info["pages_why"] == [{"why": "markers", "n": 3}, {"why": "median", "n": 3}]
    assert stats["b:editor-paragraph-numbers"] == 1


# ── on the shelf's files (data/raw) and the build's Quran (data/build) ──


@cache
def _verses() -> list[dict[str, Any]]:
    path = REPO / "data/build/2026.10.0/verses.jsonl"
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines()]


@cache
def _shelf() -> tuple[dict[str, Any], Quran]:
    build = REPO / "data/build/2026.10.0"

    surahs = [json.loads(x) for x in (build / "surahs.jsonl").read_text(encoding="utf-8").splitlines()]
    reg = yaml.safe_load((REPO / "data/books.yaml").read_text(encoding="utf-8"))
    return reg, Quran.load(_verses(), surahs)


def test_no_word_of_the_authors_is_lost_on_the_shelf() -> None:
    """Every word on an author's line reaches a paragraph, and the rules take out only the sūra names of the
    editor's verse references and the words inside a scrape's HTML — counted by a reading of the raw lines of its own,
    for all 37 books."""
    reg, quran = _shelf()
    for spec in reg["books"]:
        body = (RAW / spec["file"]).read_text(encoding="utf-8").split(HEADER_END, 1)[1]
        fam = family(spec["version"])
        on_lines, out = 0, None
        for line in body.splitlines():
            if fam == "JK" and out is None and _JK_HEADING.match(line) and _W.search(line):
                continue
            h = re.match(r"^### (\|+)(EDITOR\||PARATEXT\|)?", line)
            if h:
                if h.group(2):
                    out = len(h.group(1))
                elif out is not None and len(h.group(1)) <= out:
                    out = None
                continue
            if out is None and not line.startswith(("### $", "#META")):
                on_lines += len(_W.findall(line))
        _, paras = _raw_parts((RAW / spec["file"]).read_text(encoding="utf-8"), fam)
        paged(paras)
        assert sum(len(_W.findall(p.text)) for p in paras) == on_lines, spec["slug"]
        for p in paras:
            body_, meta = clean(p.text, quran, Counter(), fam)
            # a tag's words (an anchor naming its verse) are the scrape's, not the author's
            html = sum(len(_W.findall(m.group(0))) for m in _ANCHOR.finditer(p.text)) + sum(
                len(_W.findall(m.group(0))) for m in _TAG.finditer(_ANCHOR.sub(" ", p.text))
            )
            # the references a paragraph had, less those still in its text: the ones linked
            before, after = (
                [
                    m.group("sura")
                    for m in _VERSE_REF.finditer(t)
                    if quran.suras.get(normalize(m.group("sura").strip()))
                ]
                for t in (_MILESTONE.sub(" ", p.text), body_)
            )
            lost = len(_W.findall(p.text)) - len(_W.findall(body_))
            names = sum(len(_W.findall(x)) for x in before) - sum(len(_W.findall(x)) for x in after)
            assert lost == names + html, (spec["slug"], p.text[:80])
            # and the verses a scrape's anchors name («<a "التوبة 113">»)
            assert (
                0
                <= len(meta.get("quran_refs", [])) - (len(before) - len(after))
                <= len(_ANCHOR.findall(p.text))
            )


def test_no_markup_of_the_versions_is_left_in_the_books() -> None:
    """After the rules, no page-end marker, quotation tag, half-verse mark, HTML or Latin letter is left in any book;
    the few signs still standing are the print's own («_» for a blank in a grammar example) or a library's sign we
    cannot read (al-Basyawī's «~» and «< >»), counted here so a new one shows."""
    reg, quran = _shelf()
    left: Counter[str] = Counter()
    for spec in reg["books"]:
        d = book(RAW, spec, quran, None, Counter())
        for p in d.passages:
            assert not re.search(r"[A-Za-z]|%~%|PageEnd|@QUR@|</?[a-z]", p.text), (
                spec["slug"],
                p.ref,
                p.text[:80],
            )
            left.update(re.findall(r"[<>|^@#%&$=~+]", p.text))
        for c in d.chapters:
            assert not re.search(r"[A-Za-z<>@%]", c.title_ar), (spec["slug"], c.title_ar)
    assert sum(left.values()) < 120, left


def test_a_books_paragraphs_carry_the_printed_pages_they_stand_on() -> None:
    reg, quran = _shelf()
    spec = next(b for b in reg["books"] if b["slug"] == "zaydibncali-musnad")
    d = book(RAW, spec, quran, None, Counter())
    # read off the file: «PageV01P049» ends the page that «حدثني … حدثنا سليمان» stands on, «ابن إبراهيم …» opens 50
    assert d.passages[3].text.startswith("ابن إبراهيم بن عبيد المحاربي")
    assert [p.meta["pages"] for p in d.passages[:7]] == [
        [[1, 49], [1, 49]],
        [[1, 49], [1, 49]],
        [[1, 49], [1, 49]],
        [[1, 50], [1, 50]],
        [[1, 51], [1, 51]],  # pages 52 and 53 hold no text
        [[1, 54], [1, 54]],
        [[1, 56], [1, 56]],
    ]
    # the paragraphs opening on page 49 are its first, second and third; page 50's first
    assert [p.meta["on_page"] for p in d.passages[:5]] == [1, 2, 3, 1, 1]


def test_every_book_holds_only_the_authors_text_with_the_editors_apparatus_counted() -> None:
    reg, quran = _shelf()
    stats: Counter[str] = Counter()
    ayat = {(v["surah"], v["ayah"]) for v in _verses()}
    for spec in reg["books"]:
        d = book(RAW, spec, quran, None, stats)
        assert d.passages and len({p.ref for p in d.passages}) == len(d.passages)
        for p in d.passages:
            assert not re.search(r"PageV\d|@Q[BE]@|(?<![A-Za-z])ms\d", p.text), (spec["slug"], p.ref)
            assert all(p.text[a] == "[" and p.text[b - 1] == "]" for a, b in p.meta.get("editor", []))
            assert all(
                (s, a) in ayat and (s, b) in ayat and a <= b for s, a, b in p.meta.get("quran_refs", [])
            )
        assert all(0 <= p.chapter < len(d.chapters) for p in d.passages)
    for rule in ("verse-refs", "verse-numbers", "footnote-markers", "editor-brackets", "quran-quotes"):
        assert stats[rule] > 1000, rule
