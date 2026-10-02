"""The four dictionaries split from the Shamela typings (PLAN P3.2): Tāj al-ʿArūs, al-Qāmūs al-Muḥīṭ,
Kitāb al-ʿAyn and Tahdhīb al-Lugha — against the real, sha256-pinned files.

Arabic expectations are compared after strip_marks (no combining-mark literal in this file). Every
hand-checked article start below was read in the raw Shamela page text, not only in our output.
Boundary precision is measured against the OpenITI copy of the same edition (test oracle only, never
shown): a seeded random sample of 50 entries; the number is printed and must reach the research's
estimate for the work.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import pytest
from jadhr_arabic import strip_marks
from jadhr_pipeline.lexica import build_lexica, work_articles
from jadhr_pipeline.lexica.oracle import boundary_precision, read_oracle
from jadhr_pipeline.lexica.quranidx import QuranPairs, qtokens

REPO = Path(__file__).resolve().parents[2]
RAW = Path(os.environ.get("JADHR_RAW_DIR", REPO / "data" / "raw"))
REGISTRY = REPO / "data" / "lexica.yaml"
BUILD = REPO / "data" / "build" / "2026.10.0"
ORACLES = RAW / "lexica" / "openiti-oracles"


def _jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.open(encoding="utf-8")]


@pytest.fixture(scope="module")
def words() -> list[dict[str, Any]]:
    return _jsonl(BUILD / "words.jsonl")


@pytest.fixture(scope="module")
def built(words: list[dict[str, Any]]) -> tuple[list[dict], list[dict], list[dict], dict]:
    return build_lexica(RAW, REGISTRY, _jsonl(BUILD / "roots.jsonl"), words, _jsonl(BUILD / "surahs.jsonl"))


def _rows(built: tuple, work: str) -> list[dict]:
    return [e for e in built[1] if e["work_id"] == work]


def _plain(text: str) -> str:
    return strip_marks(text)


# --- counts and coverage ---------------------------------------------------------------------------

# work: (entries, strict, loose, manual, roots strict, roots any) — computed by the pipeline, pinned.
EXPECTED = {
    "taj": (11891, 1620, 14, 1, 1617, 1628),
    "qamus": (10389, 1616, 23, 1, 1613, 1629),
}
# The research's expected size of each work (docs/research/06 Part 6, 02 §3).
RANGES = {
    "taj": (11_800, 12_000),  # 11,985 root headings in the TOC (7,390 plain, 3,521 spaced, 1,074 irregular)
    "qamus": (10_300, 10_500),  # 10,371 bullets; ~9,800–10,300 roots in Hawramani/m3ajim word keys
}


@pytest.mark.parametrize("work", sorted(EXPECTED))
def test_counts_within_research_range_and_coverage(built: tuple, work: str) -> None:
    n, strict, loose, manual, roots_strict, roots_any = EXPECTED[work]
    rows = _rows(built, work)
    lo, hi = RANGES[work]
    assert lo <= len(rows) <= hi
    assert len(rows) == n
    assert sum(e["match"] == "strict" for e in rows) == strict
    assert sum(e["match"] == "loose" for e in rows) == loose
    assert sum(e["match"] == "manual" for e in rows) == manual
    rep = built[3]["works"][work]
    assert (rep["roots_strict"], rep["roots_any"]) == (roots_strict, roots_any)
    assert rep["coverage_strict_pct"] == round(100 * roots_strict / 1642, 2)
    assert rep["coverage_strict_occurrence_pct"] <= rep["coverage_any_occurrence_pct"]
    print(
        f"\n{work}: {len(rows)} entries; strict {roots_strict} roots = {rep['coverage_strict_pct']}% "
        f"({rep['coverage_strict_occurrence_pct']}% of occurrences); any {roots_any} = "
        f"{rep['coverage_any_pct']}% ({rep['coverage_any_occurrence_pct']}%)"
    )


# --- hand-checked articles --------------------------------------------------------------------------

# (work, root, headword as printed, printed volume/page, opening words of the article as printed)
HAND_CHECKED = [
    ("taj", "رحم", "ر ح م", "32/225", "(الرحمة) بالفتح، (ويحرك) ، حكاه سيبويه: (الرقة) ."),
    ("taj", "علم", "ع ل م", "33/126", "(علمه - كسمعه - علما، بالكسر: عرفه) هكذا في الصحاح"),
    ("taj", "كتب", "كتب", "4/100", "(كتبه) ، يكتب، (كتبا) بالفتح المصدر المقيس، (وكتابا) بالكسر"),
    ("taj", "قول", "قول", "30/291", "القول: الكلام على الترتيب، أو كل لفظ"),
    ("taj", "أمن", "أمن", "34/184", "(الأمن والآمن، كصاحب) ،"),
    ("taj", "سمو", "سمو", "38/301", "(و (سما) يسمو (سموا) ، كعلو: (ارتفع) وعلا."),
    ("taj", "حمد", "حمد", "8/38", "(الحمد) : نقيض الذم، وقال اللحياني: الحمد؛ (الشكر)"),
    ("taj", "ربب", "ربب", "2/459", "(الرب) هو الله ﷿، وهو رب كل شيء، أي مالكه"),
    # a root article the TOC does not list ("صرخَ: (الصَّرْخَة…" at a line start)
    ("taj", "صرخ", "صرخ", "7/290", "(الصرخة: الصيحة الشديدة) عند الفزع أو المصيبة."),
    # الكوكب is filed under ككب (manual mapping, registry)
    ("taj", "كوكب", "ككب", "4/157", "(الكوكب) : ذكره الليث في باب الرباعي"),
    # a heading the typist broke over two lines ("ع ض⏎و:")
    ("taj", "عضو", "ع ض و", "39/60", "(العضو، بالضم والكسر: واحد الأعضاء"),
    # the root فصل, whose one-word title is also a section word
    ("taj", "فصل", "فصل", "30/162", "الفصل: الحاجز بين الشيئين، كما في المحكم"),
    # al-Qāmūs: the headword is the bullet's first word; the root comes from the aligned Tāj heading
    ("qamus", "رحم", "الرحمة", "1111", "الرحمة، ويحرك: الرقة، والمغفرة، والتعطف،"),
    ("qamus", "علم", "علمه", "1140", "علمه، كسمعه، علما، بالكسر: عرفه، وعلم هو في نفسه"),
    ("qamus", "كتب", "كتبه", "128", "كتبه كتبا وكتابا: خطه،"),
    ("qamus", "قول", "القول", "1051", "القول: الكلام، أو كل لفظ مذل به اللسان، تاما أو ناقصا"),
    ("qamus", "أمن", "الأمن", "1176", "الأمن والآمن، كصاحب: ضد الخوف"),
    ("qamus", "سمو", "سما", "1296", "و: سما سموا: ارتفع،"),
    ("qamus", "حمد", "الحمد", "278", "الحمد: الشكر، والرضى، والجزاء، وقضاء الحق،"),
    ("qamus", "ربب", "الرب", "87", "الرب، باللام: لا يطلق لغير الله ﷿، وقد يخفف"),
    ("qamus", "شور", "شار", "420", "شار العسل شورا وشيارا وشيارة ومشارا ومشارة: استخرجه من الوقبة،"),
    # two lines the typist printed without their bullet, recovered through Tāj
    ("qamus", "شجر", "الشجر", "413", "الشجر والشجر والشجراء، كجبل وعنب وصحراء،"),
    ("qamus", "حير", "حار", "381", "حار يحار حيرة وحيرا وحيرا وحيرانا وتحير واستحار:"),
    # الكوكب aligned to Tāj's heading ككب (manual mapping, registry)
    ("qamus", "كوكب", "الكوكب", "131", "الكوكب: النجم،"),
]


@pytest.mark.parametrize(("work", "root", "headword", "page", "start"), HAND_CHECKED)
def test_hand_checked_article_starts(
    built: tuple, work: str, root: str, headword: str, page: str, start: str
) -> None:
    rows = [e for e in _rows(built, work) if e["root_key"] == root]
    assert len(rows) == 1, [e["headword"] for e in rows]
    (e,) = rows
    assert e["match"] in ("strict", "manual")
    assert _plain(e["headword"]).replace(" ", "") == headword.replace(" ", "")
    assert e["page_ref"].startswith(page)
    assert _plain(e["body"]).startswith(start), _plain(e["body"])[:120]


# --- Tāj: headword markers -------------------------------------------------------------------------

OPEN, CLOSE = "﴿", "﴾"
_REF = re.compile(r"^\s{0,2}[\(\[]\s*[^\d٠-٩()\[\]:]{2,30}:\s*[٠-٩\d]")
_CITE = re.compile(r"(تعالي|﷿|وجل|التنزيل|القران|العزيز|الايه|قري|قرا|قراه|ثناوه|سبحانه)[\s:]*$")
_CITE_FOLD = str.maketrans({"ى": "ي", "ئ": "ي", "ؤ": "و", "ء": "", "أ": "ا", "إ": "ا", "آ": "ا", "ة": "ه"})


def test_taj_headword_markers_are_gone_and_quotations_kept(built: tuple, words: list[dict]) -> None:
    raw_abaa = next(
        json.loads(line)["body"]
        for line in (RAW / "lexica/hf-authenticilm-shamela4/2502/pages.jsonl").open(encoding="utf-8")
        if "id=toc-16>" in line
    )
    assert "( ﴿الأَبَاءَةُ" in raw_abaa  # the typing put a marker before the headword (known positive)
    quran = QuranPairs(words)
    kept = 0
    for e in _rows(built, "taj"):
        body = e["body"]
        assert "!" not in body, e["headword"]
        # Every bracket left is part of a balanced ﴿…﴾ pair (markers came singly and alternating).
        seq = "".join(ch for ch in body if ch in (OPEN, CLOSE))
        assert seq == (OPEN + CLOSE) * (len(seq) // 2), (e["headword"], seq)
        for m in re.finditer(f"{OPEN}([^{OPEN}{CLOSE}]*){CLOSE}", body):
            kept += 1
            before = _plain(body[max(0, m.start() - 50) : m.start()]).translate(_CITE_FOLD)
            before = re.sub("[^ء-ي﷿:.،؛ ]", " ", before)  # only . ، ؛ end a citation
            toks = qtokens(m.group(1))
            assert (
                _REF.match(body[m.end() : m.end() + 45]) or _CITE.search(before) or quran.share(toks) >= 0.5
            ), (e["headword"], m.group(0)[:60])
    (abaa,) = [e for e in _rows(built, "taj") if _plain(e["headword"]) == "أبأ"]
    assert _plain(abaa["body"]).startswith("(الأباءة، كعباءة: القصبة) ، أو هو أجمة الحلفاء")
    stats = built[3]["works"]["taj"]
    kept_report = sum(v for k, v in stats["stats"].items() if k.startswith("taj-quotation-brackets-kept"))
    assert kept == kept_report
    assert stats["rules_applied"]["taj-headword-markers-removed"] > 100_000
    # A genuine quotation keeps its brackets (رحم: "فِي قَوْلِه تَعالى: ﴿فسأكتبها للَّذين يَتَّقُونَ﴾").
    (rahma,) = [e for e in _rows(built, "taj") if e["root_key"] == "رحم"]
    assert OPEN + "فسأكتبها للذين يتقون" + CLOSE in _plain(rahma["body"])


def test_taj_typing_defects_are_counted_not_edited(built: tuple) -> None:
    """Lost glyphs ("[]"), Quran text lost to a font code («٧. ٠٢٥ …») and «(سقط: …)» notes stay as
    typed and are counted for review."""
    stats = built[3]["works"]["taj"]["stats"]
    for name in ("typing-defect:empty-brackets", "typing-defect:quran-font-code", "typing-defect:saqt-note"):
        assert stats[name] > 0, name
    found = sum(len(re.findall(r"\[\s*\]", e["body"])) for e in _rows(built, "taj"))
    assert found == stats["typing-defect:empty-brackets"]


# --- al-Qāmūs: every bullet accounted for, roots through Tāj --------------------------------------


def test_qamus_bullets_all_accounted_for_and_aligned(built: tuple) -> None:
    raw = "\n".join(
        json.loads(line)["body"]
        for line in (RAW / "lexica/hf-authenticilm-shamela4/2558/pages.jsonl").open(encoding="utf-8")
    )
    bullets_in_source = raw.count("•")
    rep = built[3]["works"]["qamus"]
    rules = rep["rules_applied"]
    rows = _rows(built, "qamus")
    assert bullets_in_source == rep["bullets"] == rules["qamus-bullet-split"] == 10371
    # One entry per bullet, plus the articles whose bullet the typist left out (recovered through Tāj).
    recovered = rules["qamus-bullet-split:lost-bullet-recovered"]
    assert len(rows) == bullets_in_source + recovered
    assert len(rep["lost_bullets_recovered"]) == recovered == 18
    for e in rows:
        assert "•" not in e["body"], e["headword"]
        assert e["body"].startswith(e["headword"].strip()) or e["body"][:3] in ("و: ", "ي: ")
    # Particles (الألف اللينة) aside, at least 99% of the articles are aligned to a Tāj root.
    particles = rules["qamus-root-alignment:particles-not-aligned"]
    aligned = rules["qamus-root-alignment"]
    assert aligned / (len(rows) - particles) >= 0.99
    assert rules["qamus-root-alignment:unaligned"] == len(rep["unaligned_bullets"])
    print(
        f"\nqamus: {aligned} of {len(rows) - particles} articles aligned to Tāj ({aligned / (len(rows) - particles):.2%})"
    )


# --- boundary precision against the OpenITI copy ----------------------------------------------------

ORACLE = {
    # work: (OpenITI version, markup style, compare after the printed header, research estimate)
    "taj": ("1205MurtadaZabidi.TajCarus.JK007140-ara1", "bar", False, 0.98),
    # same typing (no other copy splits al-Qāmūs); its bullets carry no root, so entries are keyed by
    # their first word — the root assignment was checked by hand instead (docs/research/02 §10.7)
    "qamus": ("0817MajdDinFiruzabadi.QamusMuhit.Shamela0007283-ara1", "bullet", False, 0.98),
}


@pytest.mark.parametrize("work", sorted(ORACLE))
def test_split_precision_against_openiti(work: str, words: list[dict]) -> None:
    name, style, skip_head, minimum = ORACLE[work]
    path = ORACLES / name
    if not path.exists():
        pytest.skip(f"OpenITI oracle {name} not downloaded (data/raw/lexica/openiti-oracles)")
    arts, _ = work_articles(RAW, REGISTRY, work, words, _jsonl(BUILD / "surahs.jsonl"))
    entries = [
        ([a.headword] if style == "bullet" else a.match_heads or [a.headword], a.body)
        for a in arts
        if a.body.strip()
    ]
    precision, verdicts = boundary_precision(entries, read_oracle(path, style), skip_head=skip_head)
    print(f"\n{work}: boundary precision {precision:.2f} on {len(verdicts)} sampled entries against {name}")
    for v in verdicts:
        if not v.ok:
            print("  ", v)
    assert len(verdicts) == 50
    assert precision >= minimum
