"""Tests that read the pinned raw sources skip, with that reason, where data/raw is absent (CI).

Locally the raw sources are present and every test runs; set JUDHUR_REQUIRE_DATA=1 to turn a missing
dataset into a failure instead of a skip.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
RAW = Path(os.environ.get("JUDHUR_RAW_DIR", Path(__file__).resolve().parents[2] / "data" / "raw"))
NEEDS_DATA = {"test_lexica.py", "test_every_pinned_source_file_matches"}


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if RAW.exists():
        return
    if os.environ.get("JUDHUR_REQUIRE_DATA") == "1":
        raise pytest.UsageError(f"JUDHUR_REQUIRE_DATA=1 but {RAW} is missing")
    skip = pytest.mark.skip(reason="raw sources (data/raw) not available: unit tests only")
    for item in items:
        if not Path(str(item.fspath)).resolve().is_relative_to(HERE):
            continue
        if item.fspath.basename in NEEDS_DATA or item.name in NEEDS_DATA:
            item.add_marker(skip)
