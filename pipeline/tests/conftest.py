"""Tests that read the pinned raw sources skip, with that reason, where data/raw is absent (CI).

Locally the raw sources are present and every test runs; set JADHR_REQUIRE_DATA=1 to turn a missing
dataset into a failure instead of a skip.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
RAW = Path(os.environ.get("JADHR_RAW_DIR", Path(__file__).resolve().parents[2] / "data" / "raw"))
NEEDS_DATA = {
    "test_lexica.py",
    "test_lexica_dictionaries.py",
    "test_release.py",
    "test_lexicon_xml.py",
    "test_hadith.py",
    "test_isnad.py",
    "test_taqrib.py",
    "test_narrators.py",
    "test_hadeethenc.py",
    "test_catalogue.py",
    "test_no_word_of_the_authors_is_lost_on_the_shelf",
    "test_a_books_paragraphs_carry_the_printed_pages_they_stand_on",
    "test_every_built_article_has_one_identifier_of_its_own_work",
    "test_the_built_books_cover_the_quran_by_their_own_headings",
    "test_every_book_holds_only_the_authors_text_with_the_editors_apparatus_counted",
    "test_no_markup_of_the_versions_is_left_in_the_books",
    "test_every_pinned_source_file_matches",
    "test_the_dictionary_on_the_build",
    "test_on_lanes_own_article_of_the_root",
    "test_on_the_pinned_text_every_first_verse_loses_exactly_the_basmala",
    "test_the_verses_word_counts_match_the_build_once_stripped",
}


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if RAW.exists():
        return
    if os.environ.get("JADHR_REQUIRE_DATA") == "1":
        raise pytest.UsageError(f"JADHR_REQUIRE_DATA=1 but {RAW} is missing")
    skip = pytest.mark.skip(reason="raw sources (data/raw) not available: unit tests only")
    for item in items:
        if not Path(str(item.fspath)).resolve().is_relative_to(HERE):
            continue
        if item.fspath.basename in NEEDS_DATA or item.name in NEEDS_DATA:
            item.add_marker(skip)
