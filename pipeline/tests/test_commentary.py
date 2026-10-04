"""A verse's commentary in the books (B55): each tafsir book's own headings read by that book's rule — a range covers
each verse in it, a heading naming one verse covers the verses up to the next heading of its sūra, the sūra from its
section; a number past the sūra's end or a heading going back is left out and counted; nothing guessed."""

from __future__ import annotations

import json
from pathlib import Path

from jadhr_pipeline.ecosystem.commentary import map_commentary

BUILT = Path(__file__).resolve().parents[2] / "data" / "build" / "2026.10.0"
SURAHS = [
    {"number": 1, "name_ar": "الفاتحة", "verse_count": 7},
    {"number": 2, "name_ar": "البقرة", "verse_count": 286},
]
VERSES = [
    {"id": s * 1000 + a, "surah": s, "ayah": a, "text_imlaei": f"آية {s} {a}"}
    for s, n in ((1, 7), (2, 286))
    for a in range(1, n + 1)
]
next(v for v in VERSES if (v["surah"], v["ayah"]) == (2, 2))["text_imlaei"] = (
    "ذلك الكتاب لا ريب فيه هدى للمتقين"
)


def run(slug: str, titles: list[tuple[str, int | None]]) -> dict[tuple[int, int], set[int]]:
    """Chapters of one book (title, parent index); the verses each chapter covers."""
    chapters = [
        {"id": 100 + i, "text_id": 9, "title_ar": t, "parent_id": (100 + p) if p is not None else None}
        for i, (t, p) in enumerate(titles)
    ]
    rows, report = map_commentary([{"id": 9, "slug": slug}], chapters, VERSES, SURAHS)
    out: dict[tuple[int, int], set[int]] = {}
    for r in rows:
        out.setdefault((r["verse_id"] // 1000, r["verse_id"] % 1000), set()).add(r["chapter_id"])
    return out


def test_a_range_covers_each_verse_in_it() -> None:
    got = run(
        "ibncatiyyaandalusi-muharrarwajiz",
        [
            ("سورة البقرة", None),
            ("[سورة البقرة (2) : الآيات 54 الى 55]", 0),
            ("[سورة البقرة (2) : آية 61]", 0),
        ],
    )
    assert got[(2, 54)] == got[(2, 55)] == {101} and got[(2, 61)] == {102} and (2, 56) not in got
    hud = run("hudhawwari-tafsir", [("[2 - سورة البقرة]", None), ("[2.4-7]", 0), ("[2.400]", 0)])
    assert {k for k in hud} == {(2, 4), (2, 5), (2, 6), (2, 7)}  # 400 is past the sūra's end


def test_a_heading_naming_one_verse_runs_to_the_next_heading_of_its_surah() -> None:
    got = run(
        "jarallahzamakhshari-kashshaf",
        [
            ("سورة الفاتحة", None),
            ("الفاتحة : ( 6 ) اهدنا الصراط المستقيم", 0),
            ("الفاتحة : ( 7 ) صراط الذين أنعمت . . . . .", 0),
            ("سورة البقرة", None),
            ("البقرة : ( 1 ) الم", 3),
            ("البقرة : ( 2 ) ذلك الكتاب لا . . . . .", 3),
            ("البقرة : ( 4 ) والذين يؤمنون", 3),
        ],
    )
    assert got[(1, 7)] == {102}
    assert got[(2, 2)] == got[(2, 3)] == {105} and got[(2, 4)] == {106}
    # a sūra's last heading runs to its end
    assert got[(2, 286)] == {106}


def test_ibn_kathirs_quotation_takes_its_surah_from_its_section_and_al_tabaris_quotation_is_found() -> None:
    got = run(
        "ibnkathir-tafsirquran",
        [("تفسير سورة البقرة", None), ("{الم (1) ذلك الكتاب لا ريب فيه (2) } .", 0), ("فصل", 1)],
    )
    assert got[(2, 1)] == got[(2, 2)] == {101}
    tabari = run(
        "tabari-jamicbayan",
        [
            ("سورة البقرة", None),
            ("القول في تأويل قوله تعالى: {الم} [البقرة: 1]", 0),
            ("القول في تأويل قوله تعالى: {ذلك الكتاب لا ريب فيه}", 0),
            ("القول في تأويل قوله تعالى: {شيء لا يوجد}", 0),
        ],
    )
    assert tabari[(2, 1)] == {101} and tabari[(2, 2)] == {102}
    assert sum(len(v) for v in tabari.values()) == 2  # the quotation found nowhere is left out


def test_the_built_books_cover_the_quran_by_their_own_headings() -> None:
    rows = [json.loads(x) for x in (BUILT / "verse_commentary.jsonl").open(encoding="utf-8")]
    report = json.loads((BUILT / "report.json").read_text(encoding="utf-8"))["commentary"]
    texts = {
        json.loads(x)["id"]: json.loads(x)["slug"] for x in (BUILT / "texts.jsonl").open(encoding="utf-8")
    }
    covered: dict[str, set[int]] = {}
    for r in rows:
        covered.setdefault(texts[r["text_id"]], set()).add(r["verse_id"])
    # every book's verses as its report counts them, and each a real verse of the Quran
    for slug, v in covered.items():
        assert len(v) == report[slug]["verses covered"], slug
        assert all(1 <= x <= 6236 for x in v)
    # Hūd and al-Zamakhsharī name nearly every verse; the others most
    assert len(covered["hudhawwari-tafsir"]) == 6236
    assert min(len(v) for v in covered.values()) > 5000
