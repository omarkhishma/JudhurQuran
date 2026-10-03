"""Accounts (PLAN P6.1, decision D3): sign-in by e-mail link, sessions, the account, its devices.

Every feature works without an account; an account exists to sync and to be credited (L6, PRF-Q01/Q02). A
session is an opaque random token the browser keeps and sends as a bearer header — no cookie. Tokens are
stored hashed; a sign-in link is single-use and short-lived; asking for one never reveals whether an address
has an account. Content stays on the read-only engine; only this module and ``sync`` write, on their own engine.
"""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
import smtplib
import threading
from collections import deque
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from datetime import UTC, datetime
from email.message import EmailMessage
from functools import lru_cache
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import Header, HTTPException
from sqlalchemy import Connection, Engine, create_engine, text

from .settings import get_settings

EMAIL_RE = r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$"
MAX_LINKS_PER_EMAIL = 3  # within the token's lifetime


@lru_cache
def write_engine() -> Engine:
    return create_engine(
        get_settings().database_url,
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
        connect_args={"options": "-c statement_timeout=5000"},
    )


@contextmanager
def tx() -> Iterator[Connection]:
    with write_engine().begin() as conn:
        yield conn


def q(conn: Connection, sql: str, params: Mapping[str, Any] | None = None) -> list[dict[str, Any]]:
    return [dict(r._mapping) for r in conn.execute(text(sql), params or {})]


def q1(conn: Connection, sql: str, params: Mapping[str, Any] | None = None) -> dict[str, Any] | None:
    r = conn.execute(text(sql), params or {}).first()
    return dict(r._mapping) if r is not None else None


def now() -> datetime:
    return datetime.now(UTC)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


# ─── encryption at rest (NTB-Q02, PRF-Q03) ─────────────────────────────────────


@lru_cache
def _aead() -> AESGCM:
    s = get_settings()
    if s.data_key:
        key = base64.b64decode(s.data_key)
    elif s.environment == "production":
        raise RuntimeError("JADHR_DATA_KEY is required in production: synced records are encrypted at rest")
    else:
        # development only: a fixed key derived from a label, so local data survives restarts
        key = hashlib.sha256(b"jadhr-development-data-key").digest()
    if len(key) != 32:
        raise RuntimeError("JADHR_DATA_KEY must be 32 bytes, base64")
    return AESGCM(key)


def seal(plain: bytes, aad: str) -> bytes:
    nonce = secrets.token_bytes(12)
    return nonce + _aead().encrypt(nonce, plain, aad.encode())


def unseal(blob: bytes, aad: str) -> bytes:
    return _aead().decrypt(blob[:12], blob[12:], aad.encode())


# ─── mail ──────────────────────────────────────────────────────────────────────

_OUTBOX: deque[dict[str, str]] = deque(maxlen=200)
_OUTBOX_LOCK = threading.Lock()

SUBJECT = {"ar": "رابط الدخول إلى جذر", "en": "Your sign-in link for Jadhr"}
BODY = {
    "ar": "السلام عليكم،\n\nهذا رابط الدخول إلى جذر، صالح لمرة واحدة ولمدة {minutes} دقيقة:\n\n{link}\n\nإن لم تطلبه فتجاهل هذه الرسالة؛ لن يحدث شيء.\n",
    "en": "Hello,\n\nHere is your sign-in link for Jadhr. It works once, for {minutes} minutes:\n\n{link}\n\nIf you did not ask for it, ignore this message; nothing will happen.\n",
}


def send_link(email: str, link: str, locale: str) -> None:
    s = get_settings()
    lang = "ar" if locale == "ar" else "en"
    body = BODY[lang].format(link=link, minutes=s.login_token_minutes)
    if s.mail_backend == "dev":
        if s.environment == "production":
            raise RuntimeError("the dev mail backend never runs in production")
        with _OUTBOX_LOCK:
            _OUTBOX.append({"to": email, "subject": SUBJECT[lang], "body": body, "link": link})
        return
    if s.mail_backend == "smtp":
        if not s.smtp_host:
            raise RuntimeError("JADHR_SMTP_HOST is not set")
        msg = EmailMessage()
        msg["From"] = s.mail_from
        msg["To"] = email
        msg["Subject"] = SUBJECT[lang]
        msg.set_content(body)
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password or "")
            smtp.send_message(msg)


def dev_outbox(email: str) -> list[dict[str, str]]:
    with _OUTBOX_LOCK:
        return [m for m in _OUTBOX if m["to"] == email]


def email_enabled() -> bool:
    s = get_settings()
    return (s.mail_backend == "smtp" and bool(s.smtp_host)) or (
        s.mail_backend == "dev" and s.environment != "production"
    )


# ─── sign-in, sessions, the account ───────────────────────────────────────────


def safe_return(path: str | None) -> str:
    """Only a path inside the site, so a sign-in link can never send a reader elsewhere."""
    if not path or not path.startswith("/") or path.startswith("//") or "\\" in path or len(path) > 300:
        return "/me"
    return path


def request_link(email: str, return_to: str | None, locale: str) -> None:
    s = get_settings()
    email = email.strip().lower()
    token = new_token()
    with tx() as conn:
        recent = q1(
            conn,
            "select count(*) as n from accounts.login_tokens where email = :e and created_at > now() - make_interval(mins => :m)",
            {"e": email, "m": s.login_token_minutes},
        )
        if recent and recent["n"] >= MAX_LINKS_PER_EMAIL:
            return  # quietly: the answer never differs, so nobody learns anything from it
        conn.execute(
            text(
                """insert into accounts.login_tokens (token_hash, email, return_to, expires_at)
                   values (:h, :e, :r, now() + make_interval(mins => :m))"""
            ),
            {"h": hash_token(token), "e": email, "r": safe_return(return_to), "m": s.login_token_minutes},
        )
    prefix = "" if locale == "ar" else f"/{locale}"
    send_link(email, f"{s.public_web_url.rstrip('/')}{prefix}/auth/verify?token={token}", locale)


def _user_out(u: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(u["id"]),
        "email": u["email"],
        "display_name": u["display_name"],
        "affiliation": u["affiliation"],
        "orcid": u["orcid"],
        "role": u["role"],
        "settings": u["settings"],
        "created_at": u["created_at"],
    }


def start_session(conn: Connection, user_id: Any, device: str | None) -> str:
    token = new_token()
    conn.execute(
        text(
            """insert into accounts.sessions (token_hash, user_id, device, expires_at)
               values (:h, :u, :d, now() + make_interval(days => :days))"""
        ),
        {
            "h": hash_token(token),
            "u": user_id,
            "d": (device or "")[:120] or None,
            "days": get_settings().session_days,
        },
    )
    return token


def user_by_email(conn: Connection, email: str) -> dict[str, Any]:
    u = q1(conn, "select * from accounts.users where email = :e", {"e": email})
    if u is None:
        u = q1(conn, "insert into accounts.users (email) values (:e) returning *", {"e": email})
    assert u is not None
    return u


def verify_link(token: str, device: str | None) -> dict[str, Any] | None:
    """A link used once, inside its lifetime, opens a session for its address — creating the account on first use."""
    with tx() as conn:
        t = q1(
            conn,
            """update accounts.login_tokens set used_at = now()
               where token_hash = :h and used_at is null and expires_at > now() returning email, return_to""",
            {"h": hash_token(token)},
        )
        if t is None:
            return None
        u = user_by_email(conn, t["email"])
        session = start_session(conn, u["id"], device)
        return {"session": session, "user": _user_out(u), "return_to": t["return_to"] or "/me"}


def current_user(authorization: str | None = Header(None)) -> dict[str, Any]:
    """The bearer session's account, or 401. Sliding: each use pushes the session's last-seen time."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in to use this.")
    h = hash_token(authorization.removeprefix("Bearer ").strip())
    with tx() as conn:
        u = q1(
            conn,
            """update accounts.sessions s set last_seen_at = now() from accounts.users u
               where s.token_hash = :h and s.expires_at > now() and u.id = s.user_id
               returning u.*, s.token_hash as session_hash""",
            {"h": h},
        )
    if u is None:
        raise HTTPException(status_code=401, detail="This session has ended. Sign in again.")
    return u


def me(u: dict[str, Any]) -> dict[str, Any]:
    with tx() as conn:
        devices = q(
            conn,
            """select left(token_hash, 12) as id, device, created_at, last_seen_at, token_hash = :h as current
               from accounts.sessions where user_id = :u and expires_at > now() order by last_seen_at desc""",
            {"u": u["id"], "h": u["session_hash"]},
        )
        counts = q1(
            conn,
            "select count(*) filter (where not deleted) as records from accounts.records where user_id = :u",
            {"u": u["id"]},
        )
    return {**_user_out(u), "devices": devices, "records": counts["records"] if counts else 0}


ALLOWED_SETTINGS = {"sync_journal": bool, "share_lookups": bool}


def update_me(u: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    for k in ("display_name", "affiliation", "orcid"):
        if k in patch:
            v = (patch[k] or "").strip()
            fields[k] = v[:120] or None
    settings = dict(u["settings"] or {})
    for k, typ in ALLOWED_SETTINGS.items():
        if k in (patch.get("settings") or {}):
            v = patch["settings"][k]
            if not isinstance(v, typ):
                raise HTTPException(status_code=422, detail=f"{k} must be {typ.__name__}")
            settings[k] = v
    with tx() as conn:
        sets = ", ".join(f"{k} = :{k}" for k in fields)
        try:
            conn.execute(
                text(
                    f"update accounts.users set {sets + ', ' if sets else ''}settings = cast(:settings as jsonb) where id = :id"
                ),
                {**fields, "settings": json.dumps(settings), "id": u["id"]},
            )
        except Exception as e:  # the orcid check, most likely
            raise HTTPException(status_code=422, detail="Check the ORCID (0000-0000-0000-0000).") from e
        if (u["settings"] or {}).get("sync_journal") and not settings.get("sync_journal"):
            # the journal syncs only by choice (NTB-Q02): turning it off takes it off the server, every copy
            for table in ("records", "record_history"):
                conn.execute(
                    text(f"delete from accounts.{table} where user_id = :u and store = 'journal'"),
                    {"u": u["id"]},
                )
    return {**u, **fields, "settings": settings}


def end_session(u: dict[str, Any], session_id: str | None = None) -> bool:
    with tx() as conn:
        if session_id is None:
            r = conn.execute(
                text("delete from accounts.sessions where token_hash = :h"), {"h": u["session_hash"]}
            )
        else:
            r = conn.execute(
                text("delete from accounts.sessions where user_id = :u and left(token_hash, 12) = :id"),
                {"u": u["id"], "id": session_id},
            )
        return r.rowcount > 0


def purge() -> dict[str, int]:
    """What the privacy page promises: expired tokens and sessions, replaced versions past 30 days, lookup
    events past their retention — gone. Run daily (the API also runs it at start)."""
    s = get_settings()
    with tx() as conn:
        out = {}
        for name, sql in (
            ("login_tokens", "delete from accounts.login_tokens where expires_at < now() - interval '1 day'"),
            ("sessions", "delete from accounts.sessions where expires_at < now()"),
            (
                "history",
                f"delete from accounts.record_history where replaced_at < now() - interval '{int(s.history_days)} days'",
            ),
            (
                "lookups",
                f"delete from accounts.lookup_events where at < now() - interval '{int(s.lookup_retention_days)} days'",
            ),
            ("delete_requests", "delete from accounts.delete_requests where expires_at < now()"),
        ):
            out[name] = conn.execute(text(sql)).rowcount
    return out
