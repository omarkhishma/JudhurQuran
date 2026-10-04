"""P12's budget for the panel: the word payload — every section of the panel in one request (P1.3) — answers in under
200 ms at the 95th percentile, measured over the P3.10 sample of 200 words as the panel opens them (at the word's
first place), after one pass to warm the process's caches."""

from __future__ import annotations

import time
import urllib.parse

from fastapi.testclient import TestClient
from jadhr_api.db import connect
from jadhr_api.main import app
from jadhr_api.packets import first_place, sample_slugs

client = TestClient(app)
BUDGET_MS = 200


def test_the_word_payload_answers_within_its_budget() -> None:
    with connect() as conn:
        urls = [
            f"/api/v1/words/{urllib.parse.quote(s)}?at={first_place(conn, s)}" for s in sample_slugs(conn)
        ]
    for u in urls:
        assert client.get(u).status_code == 200
    took = []
    for u in urls:
        t = time.perf_counter()
        r = client.get(u)
        took.append((time.perf_counter() - t) * 1000)
        assert r.status_code == 200
    took.sort()
    p95 = took[int(len(took) * 0.95)]
    print(f"word payload: p50 {took[len(took) // 2]:.0f} ms, p95 {p95:.0f} ms, max {took[-1]:.0f} ms")
    assert p95 < BUDGET_MS, p95
