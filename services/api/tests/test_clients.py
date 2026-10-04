"""Whom a request is counted as, for limits (security review L4): an IPv6 address by its /64, so turning over
addresses inside the block one home or server is given escapes no limit; an IPv4 address inside IPv6 as itself."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from jadhr_api.clients import key_of
from jadhr_api.main import app
from jadhr_api.settings import get_settings

client = TestClient(app)


def test_an_ipv6_address_counts_by_its_block() -> None:
    assert key_of("2001:db8:1:2:3:4:5:6") == key_of("2001:db8:1:2:ffff::1") == "2001:db8:1:2::/64"
    assert key_of("2001:db8:1:3::1") != key_of("2001:db8:1:2::1")
    assert key_of("::ffff:203.0.113.5") == key_of("203.0.113.5") == "203.0.113.5"
    assert key_of("fe80::1%eth0") == "fe80::/64"
    assert key_of("testclient") == "testclient"


def test_addresses_turned_over_inside_one_block_share_one_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "rate_limit_per_minute", 2)
    seen = [
        client.get("/healthz", headers={"x-forwarded-for": f"2001:db8:dead:beef::{i}"}).status_code
        for i in range(1, 4)
    ]
    assert seen == [200, 200, 429]
    # another block is another reader
    assert client.get("/healthz", headers={"x-forwarded-for": "2001:db8:dead:bee0::1"}).status_code == 200
