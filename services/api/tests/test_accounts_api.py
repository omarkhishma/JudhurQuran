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
    assert client.get("/api/v1/auth/providers").json() == {
        "email": True,
        "google": False,
        "apple": False,
        "link_minutes": get_settings().login_token_minutes,
    }
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
    assert same == {"applied": [{"store": "saved", "key": "lemma:ilm"}], "rejected": [], "refused": []}
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
    # nothing of the account is left — but its id, alone, for fifteen days, so a restored backup can delete it again
    assert held() == {tb: (1 if tb == "deleted_accounts" else 0) for tb in before}
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


# ─── P6.5: the fix pass from audit 11 ──────────────────────────────────────────


def test_keys_are_sealed_like_values_and_lookups_are_sealed_whole(email: str) -> None:
    """F2: nothing in the account's rows names its content — not the value, not the key."""
    h = sign_in(email)
    client.patch("/api/v1/me", headers=h, json={"settings": {"share_lookups": True}})
    client.post(
        "/api/v1/me/sync",
        headers=h,
        json={
            "records": [{"store": "saved", "key": "n:quran:2:255", "value": {"text": "آية"}, "updated_at": 5}]
        },
    )
    client.post(
        "/api/v1/me/lookups", headers=h, json={"events": [{"lemma": "ilm", "root": "علم", "verse": "2:255"}]}
    )
    with accounts.tx() as conn:
        raw = accounts.q(
            conn,
            "select r.* from accounts.records r join accounts.users u on u.id = r.user_id where u.email = :e",
            {"e": email},
        )
        looks = accounts.q(
            conn,
            "select l.* from accounts.lookup_events l join accounts.users u on u.id = l.user_id where u.email = :e",
            {"e": email},
        )
    blob = b"".join(bytes(v) for r in raw + looks for v in r.values() if isinstance(v, (bytes, memoryview)))
    text = " ".join(str(v) for r in raw + looks for v in r.values() if not isinstance(v, (bytes, memoryview)))
    for secret in ("2:255", "quran", "علم", "ilm"):
        assert secret not in text and secret.encode() not in blob, secret
    # and the reader gets them back as they were
    assert client.get("/api/v1/me/sync", headers=h).json()["records"][0]["key"] == "n:quran:2:255"


def test_the_export_holds_everything_and_every_table_is_accounted_for(email: str) -> None:
    """F5, PRF-14: live records, deletions, replaced versions, shared lookups, identities; every table of the
    schema is either in the export or named here as a secret or a passing state, so a new table cannot be missed."""
    h = sign_in(email)
    client.patch("/api/v1/me", headers=h, json={"settings": {"share_lookups": True}})
    rec = {"store": "saved", "key": "b:lemma:ilm", "value": {"label": "a"}, "updated_at": 10}
    client.post("/api/v1/me/sync", headers=h, json={"records": [rec]})
    client.post(
        "/api/v1/me/sync", headers=h, json={"records": [{**rec, "value": {"label": "b"}, "updated_at": 20}]}
    )
    client.post(
        "/api/v1/me/sync",
        headers=h,
        json={"records": [{**rec, "key": "b:root:x", "deleted": True, "value": None, "updated_at": 30}]},
    )
    client.post("/api/v1/me/lookups", headers=h, json={"events": [{"lemma": "ilm"}]})
    out = client.get("/api/v1/me/export", headers=h).json()
    assert [r["value"]["label"] for r in out["records"]] == ["b"]
    assert out["deleted"][0]["key"] == "b:root:x" and out["history"][0]["value"]["label"] == "a"
    assert out["lookups"][0]["lemma"] == "ilm" and out["identities"] == [] and out["account"]["devices"]
    exported = {
        "users": "account",
        "records": "records/deleted",
        "record_history": "history",
        "lookup_events": "lookups",
        "identities": "identities",
        "sessions": "account.devices",
        # the contributions schema (audit 12 F15)
        "contributions.proposals": "contributions.proposals",
        "contributions.decisions": "contributions.decisions",
        "contributions.reports": "contributions.reports",
        "contributions.role_grants": "contributions.role_grants",
        "contributions.merges": "contributions.merges_credited",
        # the classroom schema (P9): what it holds of a teacher and of a member
        "classroom.classes": "classroom.teaching",
        "classroom.lessons": "classroom.teaching.lessons",
        "classroom.notes": "classroom.teaching.lessons.notes",
        "classroom.members": "classroom.joined",
        "classroom.counts": "classroom.counts",
        "classroom.progress": "classroom.progress",
        "classroom.nudges": "classroom.nudges",
    }
    not_data = {
        "login_tokens": "a secret, by address",
        "delete_requests": "a secret for ten minutes",
        "deleted_accounts": "an id after the account is gone",
        "contributions.changelog": "the public record of merges, naming no one (a merge's credit is exported)",
    }
    assert set(out["contributions"]) == {
        v.split(".")[1] for k, v in exported.items() if k.startswith("contributions.")
    }
    with accounts.tx() as conn:
        tables = {
            (r["t"] if r["s"] == "accounts" else f"{r['s']}.{r['t']}")
            for r in accounts.q(
                conn,
                """select table_schema as s, table_name as t from information_schema.tables
                   where table_schema in ('accounts', 'contributions', 'classroom') and table_type = 'BASE TABLE'""",
            )
        }
    assert tables == set(exported) | set(not_data)
    assert set(out["classroom"]) == {"teaching", "joined", "counts", "progress", "nudges"}
    # turning sharing off takes the shared lookups off the server
    client.patch("/api/v1/me", headers=h, json={"settings": {"share_lookups": False}})
    assert client.get("/api/v1/me/export", headers=h).json()["lookups"] == []


def test_a_clock_ahead_wins_nothing_and_a_full_account_refuses_only_the_new(
    email: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = sign_in(email)
    future = int((time.time() + 86_400 * 365) * 1000)
    client.post(
        "/api/v1/me/sync",
        headers=h,
        json={"records": [{"store": "saved", "key": "k1", "value": 1, "updated_at": future}]},
    )
    stored = client.get("/api/v1/me/sync", headers=h).json()["records"][0]["updated_at"]
    assert stored <= int(time.time() * 1000) + 1000  # F13: bounded by the server's clock
    from jadhr_api import sync

    monkeypatch.setattr(sync, "MAX_RECORDS", 1)
    r = client.post(
        "/api/v1/me/sync",
        headers=h,
        json={
            "records": [
                {"store": "saved", "key": "k1", "value": 2, "updated_at": 1},
                {"store": "saved", "key": "k2", "value": 3, "updated_at": 2},
            ]
        },
    ).json()
    # F14: the existing record's change is judged as ever; only the new one is refused
    assert r["refused"] == [{"store": "saved", "key": "k2", "reason": "full"}] and len(r["rejected"]) == 1


def test_deletions_are_purged_after_their_period_and_a_device_behind_resyncs_in_full(email: str) -> None:
    h = sign_in(email)
    client.post(
        "/api/v1/me/sync",
        headers=h,
        json={"records": [{"store": "saved", "key": "before", "value": 1, "updated_at": 1}]},
    )
    client.post(
        "/api/v1/me/sync",
        headers=h,
        json={
            "records": [{"store": "saved", "key": "gone", "value": None, "deleted": True, "updated_at": 2}]
        },
    )
    client.post(
        "/api/v1/me/sync",
        headers=h,
        json={"records": [{"store": "saved", "key": "kept", "value": 1, "updated_at": 3}]},
    )
    first = client.get("/api/v1/me/sync", headers=h).json()
    behind = first["records"][0]["seq"]  # a device that synced the first record only, before the deletion
    with accounts.tx() as conn:
        accounts.q(
            conn,
            "update accounts.records r set updated_at = now() - interval '400 days' from accounts.users u where u.id = r.user_id and u.email = :e and r.deleted returning r.seq",
            {"e": email},
        )
    accounts.purge()
    later = client.get("/api/v1/me/sync", headers=h, params={"since": behind}).json()
    assert later["full"] is True and [r["key"] for r in later["records"]] == ["before", "kept"]
    assert client.get("/api/v1/me/sync", headers=h, params={"since": first["cursor"]}).json()["full"] is False


def test_requests_are_bounded_per_body_per_account_and_sign_in_mail_per_sender(
    email: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = sign_in(email)
    r = client.post("/api/v1/me/sync", headers={**h, "content-length": "9000000"}, content=b"{}")
    assert r.status_code == 413
    s = get_settings()
    monkeypatch.setattr(s, "account_rate_per_minute", 2)
    codes = [client.get("/api/v1/me", headers=h).status_code for _ in range(3)]
    assert codes[-1] == 429
    monkeypatch.setattr(s, "mail_per_ip_per_hour", 1)
    accounts._mail_by_ip.clear()
    hdr = {"x-forwarded-for": "198.51.100.7"}
    assert client.post("/api/v1/auth/email", headers=hdr, json={"email": f"a{email}"}).status_code == 202
    assert client.post("/api/v1/auth/email", headers=hdr, json={"email": f"b{email}"}).status_code == 429
    accounts._mail_by_ip.clear()
    with accounts.tx() as conn:
        accounts.q(
            conn,
            "delete from accounts.login_tokens where email in (:a, :b) returning email",
            {"a": f"a{email}", "b": f"b{email}"},
        )


def test_addresses_are_forgotten_once_they_no_longer_count() -> None:
    """The limiters keep an address only while it counts: a minute for requests, an hour for sign-in mail (F1)."""
    from collections import deque

    from jadhr_api import main

    now = time.monotonic()
    main._hits["203.0.113.9"].append(now - 120)
    main._swept[0] = 0.0
    assert client.get("/healthz").status_code == 200
    assert "203.0.113.9" not in main._hits
    accounts._mail_by_ip["203.0.113.8"] = deque([now - 4000])
    assert accounts.mail_allowed("198.51.100.99")
    assert "203.0.113.8" not in accounts._mail_by_ip
    accounts._mail_by_ip.clear()


def test_a_deleted_account_is_remembered_by_its_id_only_so_a_restore_can_delete_it_again(email: str) -> None:
    h = sign_in(email)
    uid = client.get("/api/v1/me", headers=h).json()["id"]
    token = client.post("/api/v1/me/delete", headers=h).json()["confirm"]
    client.post("/api/v1/me/delete/confirm", headers=h, json={"confirm": token})
    with accounts.tx() as conn:
        row = accounts.q1(conn, "select * from accounts.deleted_accounts where user_id = :u", {"u": uid})
        assert row is not None and set(row) == {"user_id", "deleted_at"}
        accounts.q(
            conn, "delete from accounts.deleted_accounts where user_id = :u returning user_id", {"u": uid}
        )


def test_restoring_a_backup_then_reapplying_deletions_removes_the_accounts_deleted_since(email: str) -> None:
    """F4: an account deleted after a dump comes back with a restore; the command deletes it again."""
    from jadhr_api.maintenance import reapply_deletions

    h = sign_in(email)
    uid = client.get("/api/v1/me", headers=h).json()["id"]
    with accounts.tx() as conn:  # as if the account had been deleted, then a backup from before was restored
        accounts.q(
            conn, "insert into accounts.deleted_accounts (user_id) values (:u) returning user_id", {"u": uid}
        )
    assert reapply_deletions() >= 1
    assert client.get("/api/v1/me", headers=h).status_code == 401
    with accounts.tx() as conn:
        accounts.q(
            conn, "delete from accounts.deleted_accounts where user_id = :u returning user_id", {"u": uid}
        )


def test_the_account_says_what_the_server_keeps_and_when_the_oldest_of_each_kind_goes(email: str) -> None:
    """Plan B35: counts per kind, the account's cap, and the day the oldest deletion marker, replaced version and
    shared lookup goes — each period the setting the purge uses."""
    h = sign_in(email)
    s = get_settings()
    t0 = int(time.time() * 1000) - 60_000

    def push(store: str, key: str, value: object, at: int, deleted: bool = False) -> None:
        rec = {"store": store, "key": key, "value": value, "deleted": deleted, "updated_at": at}
        assert client.post("/api/v1/me/sync", headers=h, json={"records": [rec]}).status_code == 200

    push("saved", "b:lemma:ilm", {"label": "a"}, t0)
    push("saved", "b:lemma:ilm", {"label": "b"}, t0 + 1000)  # the first kept as a replaced version
    push("saved", "b:root:علم", {"label": "c"}, t0)
    push("saved", "b:root:علم", None, t0 + 2000, deleted=True)  # a deletion marker
    push("prefs", "size", 1.2, t0)
    client.patch("/api/v1/me", headers=h, json={"settings": {"share_lookups": True}})
    client.post("/api/v1/me/lookups", headers=h, json={"events": [{"lemma": "ilm", "root": "علم"}]})
    held = client.get("/api/v1/me", headers=h).json()["held"]
    assert held["stores"] == {"saved": 1, "prefs": 1}
    assert held["used"] == 3 and held["limit"] == 20_000
    assert held["deletions"]["count"] == 1 and held["history"]["count"] >= 1 and held["lookups"]["count"] == 1

    def days_left(iso: str) -> float:
        from datetime import datetime

        return (datetime.fromisoformat(iso).timestamp() - time.time()) / 86400

    assert abs(days_left(held["deletions"]["first_goes"]) - s.tombstone_days) < 0.01
    assert abs(days_left(held["history"]["first_goes"]) - s.history_days) < 0.01
    assert abs(days_left(held["lookups"]["first_goes"]) - s.lookup_retention_days) < 0.01
