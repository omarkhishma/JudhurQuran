"""Accounts and sync (P6, D3): sign-in links that work once, sessions without cookies, records that sync
record by record with the newer version winning and nothing destroyed, encryption at rest, two-step delete,
and Google/Apple sign-in checked against the provider's keys."""

from __future__ import annotations

import time
import uuid
from collections.abc import Iterator
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from jadhr_api import accounts, oidc
from jadhr_api.main import app
from jadhr_api.settings import get_settings

client = TestClient(app)


@pytest.fixture
def email() -> Iterator[str]:
    addr = f"reader-{uuid.uuid4().hex[:10]}@example.org"
    yield addr
    with accounts.tx() as conn:
        accounts.q(conn, "delete from accounts.users where email = :e returning id", {"e": addr})
        accounts.q(conn, "delete from accounts.login_tokens where email = :e returning email", {"e": addr})


def link_for(addr: str) -> str:
    r = client.post("/api/v1/auth/email", json={"email": addr, "locale": "ar", "return_to": "/notebook"})
    assert r.status_code == 202
    msgs = client.get("/api/v1/auth/dev/outbox", params={"email": addr}).json()["messages"]
    return msgs[-1]["link"].split("token=")[1]


def sign_in(addr: str) -> dict[str, str]:
    r = client.post("/api/v1/auth/verify", json={"token": link_for(addr), "device": "test"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['session']}"}


def test_a_link_works_once_and_the_answer_never_tells_who_has_an_account(email: str) -> None:
    assert client.get("/api/v1/auth/providers").json() == {"email": True, "google": False, "apple": False}
    token = link_for(email)
    first = client.post("/api/v1/auth/verify", json={"token": token})
    assert (
        first.status_code == 200
        and first.json()["user"]["email"] == email
        and first.json()["return_to"] == "/notebook"
    )
    assert client.post("/api/v1/auth/verify", json={"token": token}).status_code == 400  # once only
    # an address with an account and one without get the same answer
    assert (
        client.post("/api/v1/auth/email", json={"email": email}).json()
        == client.post("/api/v1/auth/email", json={"email": f"x{email}"}).json()
    )
    assert client.post("/api/v1/auth/email", json={"email": "not-an-address"}).status_code == 422
    with accounts.tx() as conn:
        accounts.q(
            conn, "delete from accounts.login_tokens where email = :e returning email", {"e": f"x{email}"}
        )


def test_links_are_rate_limited_quietly_and_expire(email: str) -> None:
    for _ in range(5):
        client.post("/api/v1/auth/email", json={"email": email})
    assert (
        len(client.get("/api/v1/auth/dev/outbox", params={"email": email}).json()["messages"])
        == accounts.MAX_LINKS_PER_EMAIL
    )
    token = (
        client.get("/api/v1/auth/dev/outbox", params={"email": email})
        .json()["messages"][-1]["link"]
        .split("token=")[1]
    )
    with accounts.tx() as conn:
        accounts.q(
            conn,
            "update accounts.login_tokens set expires_at = now() - interval '1 minute' where email = :e returning email",
            {"e": email},
        )
    assert client.post("/api/v1/auth/verify", json={"token": token}).status_code == 400


def test_a_link_never_returns_a_reader_to_another_site() -> None:
    for bad in ("https://evil.example", "//evil.example", "/\\evil", None):
        assert accounts.safe_return(bad) == "/me"
    assert accounts.safe_return("/notebook?tab=journal") == "/notebook?tab=journal"


def test_the_account_needs_a_session_and_keeps_its_devices_and_settings(email: str) -> None:
    assert client.get("/api/v1/me").status_code == 401
    h = sign_in(email)
    me = client.get("/api/v1/me", headers=h).json()
    assert (
        me["email"] == email
        and len(me["devices"]) == 1
        and me["devices"][0]["current"]
        and me["role"] == "member"
    )
    r = client.patch(
        "/api/v1/me",
        headers=h,
        json={"display_name": "قارئ", "orcid": "0000-0002-1825-0097", "settings": {"sync_journal": True}},
    )
    assert (
        r.status_code == 200
        and r.json()["display_name"] == "قارئ"
        and r.json()["settings"]["sync_journal"] is True
    )
    assert client.patch("/api/v1/me", headers=h, json={"orcid": "1234"}).status_code == 422
    h2 = sign_in(email)
    devices = client.get("/api/v1/me", headers=h2).json()["devices"]
    assert len(devices) == 2
    other = next(d for d in devices if not d["current"])
    assert client.delete(f"/api/v1/me/sessions/{other['id']}", headers=h2).status_code == 200
    assert client.get("/api/v1/me", headers=h).status_code == 401  # that device is signed out
    assert client.post("/api/v1/auth/signout", headers=h2).status_code == 200
    assert client.get("/api/v1/me", headers=h2).status_code == 401


def test_records_sync_newest_wins_nothing_is_destroyed_and_values_are_encrypted(email: str) -> None:
    h = sign_in(email)
    t0 = int(time.time() * 1000)
    rec = {
        "store": "saved",
        "key": "lemma:ilm",
        "value": {"kind": "lemma", "key": "ilm", "label": "عِلْم"},
        "updated_at": t0,
    }
    assert client.post("/api/v1/me/sync", headers=h, json={"records": [rec]}).json()["applied"] == [
        {"store": "saved", "key": "lemma:ilm"}
    ]
    pulled = client.get("/api/v1/me/sync", headers=h, params={"since": 0}).json()
    assert [r["value"]["label"] for r in pulled["records"]] == ["عِلْم"] and pulled["cursor"] > 0
    # an older version loses, and the client learns the server's
    old = client.post(
        "/api/v1/me/sync",
        headers=h,
        json={"records": [{**rec, "value": {"label": "old"}, "updated_at": t0 - 1000}]},
    ).json()
    assert old["applied"] == [] and old["rejected"][0]["server"]["value"]["label"] == "عِلْم"
    # a newer one wins, and the one it replaces is kept
    client.post(
        "/api/v1/me/sync",
        headers=h,
        json={"records": [{**rec, "value": {"label": "new"}, "updated_at": t0 + 1000}]},
    )
    hist = client.get("/api/v1/me/history", headers=h).json()["data"]
    assert hist[0]["value"]["label"] == "عِلْم"
    # the older version that lost is kept too: nothing a device sent is destroyed
    assert "old" in [x["value"]["label"] for x in hist if x["value"]]
    # a deletion travels as a tombstone
    client.post(
        "/api/v1/me/sync",
        headers=h,
        json={"records": [{**rec, "value": None, "deleted": True, "updated_at": t0 + 2000}]},
    )
    after = client.get("/api/v1/me/sync", headers=h, params={"since": pulled["cursor"]}).json()["records"]
    assert after[-1]["deleted"] is True
    # and a replaced version can be put back
    back = client.post(f"/api/v1/me/history/{hist[0]['id']}/restore", headers=h).json()
    assert back["applied"] == [{"store": "saved", "key": "lemma:ilm"}]
    assert client.get("/api/v1/me/export", headers=h).json()["records"][0]["value"]["label"] == "عِلْم"
    # a device that sends what the server already holds changes nothing and leaves no copy
    n_hist = len(client.get("/api/v1/me/history", headers=h).json()["data"])
    same = client.post(
        "/api/v1/me/sync",
        headers=h,
        json={
            "records": [{**rec, "value": {"label": "عِلْم", "key": "ilm", "kind": "lemma"}, "updated_at": 1}]
        },
    ).json()
    assert same == {"applied": [{"store": "saved", "key": "lemma:ilm"}], "rejected": []}
    assert len(client.get("/api/v1/me/history", headers=h).json()["data"]) == n_hist
    # a tie with a different value keeps the server's and keeps the other as a replaced version
    cur = client.get("/api/v1/me/export", headers=h).json()["records"][0]
    tie = client.post(
        "/api/v1/me/sync",
        headers=h,
        json={"records": [{**rec, "value": {"label": "tie"}, "updated_at": cur["updated_at"]}]},
    ).json()
    assert tie["applied"] == [] and tie["rejected"][0]["server"]["value"]["label"] == "عِلْم"
    assert "tie" in [
        x["value"]["label"] for x in client.get("/api/v1/me/history", headers=h).json()["data"] if x["value"]
    ]
    # at rest the value is ciphertext, bound to its user, store and key
    with accounts.tx() as conn:
        raw = accounts.q1(
            conn,
            "select value from accounts.records r join accounts.users u on u.id = r.user_id where u.email = :e",
            {"e": email},
        )
    assert raw is not None and "عِلْم".encode() not in bytes(raw["value"])


def test_the_journal_syncs_only_when_turned_on_and_lookups_are_shared_only_by_choice(email: str) -> None:
    h = sign_in(email)
    rec = {
        "store": "journal",
        "key": "2026-10-03:quran",
        "value": {"lookups": 3},
        "updated_at": int(time.time() * 1000),
    }
    assert client.post("/api/v1/me/sync", headers=h, json={"records": [rec]}).status_code == 403
    assert (
        client.post("/api/v1/me/lookups", headers=h, json={"events": [{"lemma": "ilm"}]}).status_code == 403
    )
    client.patch("/api/v1/me", headers=h, json={"settings": {"sync_journal": True, "share_lookups": True}})
    assert client.post("/api/v1/me/sync", headers=h, json={"records": [rec]}).status_code == 200
    assert (
        client.post(
            "/api/v1/me/lookups", headers=h, json={"events": [{"lemma": "ilm", "root": "علم"}]}
        ).json()["recorded"]
        == 1
    )
    assert (
        client.post("/api/v1/me/sync", headers=h, json={"records": [{**rec, "store": "nope"}]}).status_code
        == 422
    )
    # every device learns the choice with its changes, and turning the journal off takes it off the server
    assert client.get("/api/v1/me/sync", headers=h).json()["settings"]["sync_journal"] is True
    client.patch("/api/v1/me", headers=h, json={"settings": {"sync_journal": False}})
    pulled = client.get("/api/v1/me/sync", headers=h).json()
    assert pulled["settings"]["sync_journal"] is False
    assert [r for r in pulled["records"] if r["store"] == "journal"] == []
    assert [
        r for r in client.get("/api/v1/me/history", headers=h).json()["data"] if r["store"] == "journal"
    ] == []


def test_deleting_the_account_takes_two_steps_and_removes_everything(email: str) -> None:
    h = sign_in(email)
    client.post(
        "/api/v1/me/sync",
        headers=h,
        json={"records": [{"store": "notebook", "key": "n1", "value": {"title": "x"}, "updated_at": 1}]},
    )
    assert client.post("/api/v1/me/delete/confirm", headers=h, json={"confirm": "x" * 40}).status_code == 400
    token = client.post("/api/v1/me/delete", headers=h).json()["confirm"]
    assert client.post("/api/v1/me/delete/confirm", headers=h, json={"confirm": token}).json() == {
        "deleted": True
    }
    assert client.get("/api/v1/me", headers=h).status_code == 401
    with accounts.tx() as conn:
        left = accounts.q1(conn, "select count(*) as n from accounts.users where email = :e", {"e": email})
    assert left is not None and left["n"] == 0


def test_deleting_the_account_leaves_nothing_of_it_in_any_table(email: str) -> None:
    """P6.3, PRF-Q03: every table of the account schema is enumerated, so a table added later is never left out."""
    h = sign_in(email)
    me = client.get("/api/v1/me", headers=h).json()
    client.patch("/api/v1/me", headers=h, json={"settings": {"sync_journal": True, "share_lookups": True}})
    t = int(time.time() * 1000)
    for i, store in enumerate(("saved", "journal", "notebook")):
        client.post(
            "/api/v1/me/sync",
            headers=h,
            json={"records": [{"store": store, "key": "k", "value": {"v": i}, "updated_at": t + i}]},
        )
        client.post(  # a newer version, so the first is kept in the history
            "/api/v1/me/sync",
            headers=h,
            json={
                "records": [{"store": store, "key": "k", "value": {"v": i + 10}, "updated_at": t + 100 + i}]
            },
        )
    client.post("/api/v1/me/lookups", headers=h, json={"events": [{"lemma": "ilm", "root": "علم"}]})
    with accounts.tx() as conn:
        tables = [
            r["table_name"]
            for r in accounts.q(
                conn,
                "select table_name from information_schema.tables where table_schema = 'accounts' and table_type = 'BASE TABLE'",
            )
        ]
        cols = {
            r["table_name"]: r["cols"]
            for r in accounts.q(
                conn,
                """select table_name, array_agg(column_name::text) as cols from information_schema.columns
                   where table_schema = 'accounts' group by table_name""",
            )
        }

    # every table names its account by user_id, or by address before there is one (sign-in links); a table with
    # neither could hold something of the account that deleting it would miss, so it fails here
    by = {
        tb: "user_id" if "user_id" in cols[tb] else "email" if "email" in cols[tb] else None for tb in tables
    }
    assert all(by.values()), by

    def held() -> dict[str, int]:
        with accounts.tx() as conn:
            return {
                tb: accounts.q1(
                    conn,
                    f"select count(*) as n from accounts.{tb} where {c} = :v",
                    {"v": me["id"] if c == "user_id" else email},
                )["n"]  # type: ignore[index]
                for tb, c in by.items()
            }

    before = held()
    assert before["records"] >= 3 and before["record_history"] >= 3 and before["lookup_events"] == 1
    assert before["sessions"] == 1 and before["login_tokens"] >= 1
    token = client.post("/api/v1/me/delete", headers=h).json()["confirm"]
    assert client.post("/api/v1/me/delete/confirm", headers=h, json={"confirm": token}).status_code == 200
    assert held() == {tb: 0 for tb in before}
    # and no row in any schema (the contributions too, P7) still points at the account
    with accounts.tx() as conn:
        refs = accounts.q(
            conn,
            """select kcu.table_schema as s, kcu.table_name as t, kcu.column_name as c
               from information_schema.referential_constraints rc
               join information_schema.key_column_usage kcu on kcu.constraint_name = rc.constraint_name
                 and kcu.constraint_schema = rc.constraint_schema
               join information_schema.constraint_column_usage ccu on ccu.constraint_name = rc.unique_constraint_name
                 and ccu.constraint_schema = rc.unique_constraint_schema
               where ccu.table_schema = 'accounts' and ccu.table_name = 'users'""",
        )
        assert {(r["s"], r["t"]) for r in refs} >= {
            ("contributions", "proposals"),
            ("contributions", "decisions"),
        }
        for r in refs:
            n = accounts.q1(
                conn, f"select count(*) as n from {r['s']}.{r['t']} where {r['c']} = :u", {"u": me["id"]}
            )
            assert n is not None and n["n"] == 0, r


def test_the_dev_outbox_never_answers_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "environment", "production")
    assert client.get("/api/v1/auth/dev/outbox", params={"email": "a@b.co"}).status_code == 404


def test_google_sign_in_checks_the_id_token_against_the_providers_key(
    email: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    s = get_settings()
    assert (
        client.get(
            "/api/v1/auth/oidc/google/start",
            params={"redirect_uri": f"{s.public_web_url}/auth/oidc/google", "state": "s", "challenge": "c"},
        ).status_code
        == 404
    )
    monkeypatch.setattr(s, "google_client_id", "cid.apps")
    monkeypatch.setattr(s, "google_client_secret", "secret")
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    sub = uuid.uuid4().hex

    def token(claims: dict[str, Any], signer: Any = key) -> str:
        now = int(time.time())
        return jwt.encode(
            {"iss": "https://accounts.google.com", "aud": "cid.apps", "iat": now, "exp": now + 60, **claims},
            signer,
            algorithm="RS256",
        )

    answers: list[str] = []

    def fake_token_endpoint(request: httpx.Request) -> httpx.Response:
        assert b"code_verifier=v" in request.content and b"client_secret=secret" in request.content
        return httpx.Response(200, json={"id_token": answers.pop(0)})

    monkeypatch.setattr(
        oidc, "http", lambda: httpx.Client(transport=httpx.MockTransport(fake_token_endpoint))
    )
    monkeypatch.setattr(oidc, "signing_key", lambda _p, _t: key.public_key())
    redirect = f"{s.public_web_url}/auth/oidc/google"
    url = client.get(
        "/api/v1/auth/oidc/google/start", params={"redirect_uri": redirect, "state": "st", "challenge": "ch"}
    ).json()["url"]
    assert "code_challenge=ch" in url and "code_challenge_method=S256" in url
    assert (
        client.get(
            "/api/v1/auth/oidc/google/start",
            params={"redirect_uri": "https://evil.example/cb", "state": "s", "challenge": "c"},
        ).status_code
        == 422
    )

    def finish() -> httpx.Response:
        return client.post(
            "/api/v1/auth/oidc/google/finish", json={"code": "c", "redirect_uri": redirect, "verifier": "v"}
        )

    # a token signed by someone else is refused
    answers.append(
        token(
            {"sub": sub, "email": email, "email_verified": True},
            rsa.generate_private_key(public_exponent=65537, key_size=2048),
        )
    )
    assert finish().status_code == 400
    # an unverified address is refused
    answers.append(token({"sub": sub, "email": email, "email_verified": False}))
    assert finish().status_code == 400
    # a verified one signs in, and the identity is remembered
    answers.append(token({"sub": sub, "email": email, "email_verified": True}))
    r = finish()
    assert r.status_code == 200 and r.json()["user"]["email"] == email
    answers.append(token({"sub": sub}))  # next time the identity alone is enough
    assert finish().json()["user"]["email"] == email
