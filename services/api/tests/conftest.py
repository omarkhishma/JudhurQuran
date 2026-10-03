"""API tests run against a loaded dataset. Without a reachable database (CI) they skip with that reason;
set JADHR_REQUIRE_DATA=1 to make a missing database a failure instead."""

from __future__ import annotations

import os
from pathlib import Path

import psycopg
import pytest
from jadhr_api.settings import get_settings

HERE = Path(__file__).resolve().parent

# Every test speaks from one address, so the per-address limit would count the whole suite as one visitor; the
# limiter's own test sets its limit (test_api.py, test_internal_token_exempts_server_renders_from_the_rate_limit).
get_settings().rate_limit_per_minute = 1_000_000


def _database_ready() -> bool:
    dsn = get_settings().database_url.replace("postgresql+psycopg://", "postgresql://")
    try:
        with psycopg.connect(dsn, connect_timeout=3) as conn:
            return conn.execute("select count(*) from content.dataset").fetchone()[0] > 0
    except Exception:
        return False


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    # The hook sees every collected test of the session; only this directory needs the database.
    items = [i for i in items if Path(str(i.fspath)).resolve().is_relative_to(HERE)]
    if not items or _database_ready():
        return
    if os.environ.get("JADHR_REQUIRE_DATA") == "1":
        raise pytest.UsageError("JADHR_REQUIRE_DATA=1 but no loaded dataset is reachable")
    skip = pytest.mark.skip(reason="no loaded dataset reachable: unit tests only")
    for item in items:
        item.add_marker(skip)
