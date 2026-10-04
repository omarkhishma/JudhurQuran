"""API keys and the public API's limits (P10.2b): a key made by a signed-in reader is shown once and kept as a hash;
it reads at its own limit, an address without one at the public limit, both said in RateLimit-* headers; a revoked
or unknown key is refused; the public API is readable from any site's pages; the export lists keys, never their
values."""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from jadhr_api import accounts
from jadhr_api.main import app, create_app
from jadhr_api.settings import get_settings

client = TestClient(app)
ROOT = "/api/v1/public/quran/roots/علم"


def _sign_in(addr: str) -> dict[str, str]:
    client.post("/api/v1/auth/email", json={"email": addr})
    link = client.get("/api/v1/auth/dev/outbox", params={"email": addr}).json()["messages"][-1]["link"]
    r = client.post("/api/v1/auth/verify", json={"token": link.split("token=")[1]})
    return {"Authorization": f"Bearer {r.json()['session']}"}


@pytest.fixture
def reader() -> Iterator[dict[str, str]]:
    addr = f"keys-{uuid.uuid4().hex[:8]}@example.org"
    yield _sign_in(addr)
    with accounts.tx() as conn:
        accounts.q(conn, "delete from accounts.users where email = :e returning id", {"e": addr})
        accounts.q(conn, "delete from accounts.login_tokens where email = :e returning email", {"e": addr})


def test_a_key_is_shown_once_kept_as_a_hash_and_reads_at_its_own_limit(reader: dict[str, str]) -> None:
    assert client.post("/api/v1/me/keys", json={"name": "x"}).status_code == 401
    assert (
        client.post("/api/v1/me/keys", headers=reader, json={"name": "  "}).json()["error"]["code"] == "empty"
    )
    made = client.post("/api/v1/me/keys", headers=reader, json={"name": "my concordance script"})
    assert made.status_code == 201 and made.headers["cache-control"] == "no-store"
    k = made.json()
    assert k["key"].startswith("jk_") and len(k["key"]) == 35 and k["prefix"] == k["key"][:10]
    listed = client.get("/api/v1/me/keys", headers=reader).json()["data"]
    assert [x["name"] for x in listed] == ["my concordance script"] and "key" not in listed[0]
    with accounts.tx() as conn:
        row = accounts.q1(conn, "select * from accounts.api_keys where id = :i", {"i": k["id"]})
    assert row and k["key"] not in str(dict(row)) and len(row["key_hash"]) == 64
    # read with the key: its own limit; without: the public one; both readable from any site's pages
    keyed = client.get(ROOT, headers={"X-API-Key": k["key"]})
    assert keyed.status_code == 200 and keyed.headers["ratelimit-limit"] == str(
        get_settings().key_rate_per_minute
    )
    bearer = client.get(ROOT, headers={"Authorization": f"Bearer {k['key']}"})
    assert bearer.status_code == 200 and bearer.headers["ratelimit-limit"] == str(
        get_settings().key_rate_per_minute
    )
    anon = client.get(ROOT)
    assert anon.headers["ratelimit-limit"] == str(get_settings().public_rate_per_minute)
    assert (
        anon.headers["access-control-allow-origin"] == "*"
        and "RateLimit-Remaining" in anon.headers["access-control-expose-headers"]
    )
    assert client.get("/api/v1/me/keys", headers=reader).json()["data"][0]["last_used_on"] is not None
    # unknown and revoked keys are refused
    assert client.get(ROOT, headers={"X-API-Key": "jk_" + "x" * 32}).json()["error"]["code"] == "invalid_key"
    assert client.delete(f"/api/v1/me/keys/{k['id']}", headers=reader).json()["revoked_at"]
    r = client.get(ROOT, headers={"X-API-Key": k["key"]})
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_key"
    # the export lists keys, never their values
    out = client.get("/api/v1/me/export", headers=reader).json()
    assert [x["prefix"] for x in out["api_keys"]] == [k["prefix"]] and k["key"] not in str(out)


def test_ten_keys_at_most(reader: dict[str, str]) -> None:
    for i in range(10):
        assert client.post("/api/v1/me/keys", headers=reader, json={"name": f"k{i}"}).status_code == 201
    r = client.post("/api/v1/me/keys", headers=reader, json={"name": "one more"})
    assert r.status_code == 429 and r.json()["error"]["code"] == "too_many"


def test_the_public_limit_is_kept(monkeypatch: pytest.MonkeyPatch) -> None:
    # the cached settings patched, not rebuilt: a rebuilt one would drop conftest's test-wide overrides
    monkeypatch.setattr(get_settings(), "public_rate_per_minute", 3)
    tight = TestClient(create_app())
    seen = [tight.get(ROOT, headers={"X-Forwarded-For": "203.0.113.9"}) for _ in range(4)]
    assert [r.status_code for r in seen] == [200, 200, 200, 429]
    assert [r.headers["ratelimit-remaining"] for r in seen] == ["2", "1", "0", "0"]
    assert int(seen[3].headers["retry-after"]) > 0 and seen[3].json()["error"]["code"] == "rate_limited"
    # another address is not held back by the first
    assert tight.get(ROOT, headers={"X-Forwarded-For": "203.0.113.10"}).status_code == 200
