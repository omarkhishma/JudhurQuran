"""Sign in with Google or Apple (decision D3), offered only when configured.

The authorization-code flow with PKCE: the browser makes the verifier and the state, the provider returns a
code to our own page, and the API exchanges it server-side and checks the ID token's signature against the
provider's published keys, its issuer, audience and expiry before trusting the address in it. A known
identity signs in its account; a new one with a verified address joins the account of that address, or
starts one. Redirects go back only to this site.
"""

from __future__ import annotations

import time
from functools import lru_cache
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import HTTPException

from . import accounts
from .settings import get_settings

PROVIDERS: dict[str, dict[str, str]] = {
    "google": {
        "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
        "token": "https://oauth2.googleapis.com/token",
        "jwks": "https://www.googleapis.com/oauth2/v3/certs",
        "issuer": "https://accounts.google.com",
    },
    "apple": {
        "authorize": "https://appleid.apple.com/auth/authorize",
        "token": "https://appleid.apple.com/auth/token",
        "jwks": "https://appleid.apple.com/auth/keys",
        "issuer": "https://appleid.apple.com",
    },
}


def configured() -> dict[str, bool]:
    s = get_settings()
    return {
        "google": bool(s.google_client_id and s.google_client_secret),
        "apple": bool(s.apple_client_id and s.apple_team_id and s.apple_key_id and s.apple_private_key),
    }


def _client_id(provider: str) -> str:
    s = get_settings()
    cid = s.google_client_id if provider == "google" else s.apple_client_id
    assert cid
    return cid


def _client_secret(provider: str) -> str:
    s = get_settings()
    if provider == "google":
        assert s.google_client_secret
        return s.google_client_secret
    # Apple's client secret is a short-lived ES256 token signed with the team's key
    now = int(time.time())
    return jwt.encode(
        {
            "iss": s.apple_team_id,
            "iat": now,
            "exp": now + 300,
            "aud": "https://appleid.apple.com",
            "sub": s.apple_client_id,
        },
        (s.apple_private_key or "").replace("\\n", "\n"),
        algorithm="ES256",
        headers={"kid": s.apple_key_id},
    )


def _check(provider: str, redirect_uri: str) -> None:
    if provider not in PROVIDERS or not configured().get(provider):
        raise HTTPException(status_code=404, detail="This way of signing in is not available here.")
    base = get_settings().public_web_url.rstrip("/")
    if not (redirect_uri == base or redirect_uri.startswith(base + "/")):
        raise HTTPException(status_code=422, detail="The return address must be on this site.")


def start(provider: str, redirect_uri: str, state: str, challenge: str) -> str:
    _check(provider, redirect_uri)
    params = {
        "response_type": "code",
        "client_id": _client_id(provider),
        "redirect_uri": redirect_uri,
        "scope": "openid email",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    if provider == "apple":
        params["response_mode"] = "form_post"  # Apple returns the address only to a POST
    return f"{PROVIDERS[provider]['authorize']}?{urlencode(params)}"


def http() -> httpx.Client:
    return httpx.Client(timeout=10)


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True)


def signing_key(provider: str, token: str) -> Any:
    return _jwks_client(PROVIDERS[provider]["jwks"]).get_signing_key_from_jwt(token).key


def finish(provider: str, code: str, redirect_uri: str, verifier: str, device: str | None) -> dict[str, Any]:
    _check(provider, redirect_uri)
    p = PROVIDERS[provider]
    with http() as client:
        r = client.post(
            p["token"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": _client_id(provider),
                "client_secret": _client_secret(provider),
                "code_verifier": verifier,
            },
        )
    if r.status_code != 200 or "id_token" not in r.json():
        raise HTTPException(status_code=400, detail="The provider did not confirm this sign-in.")
    token = r.json()["id_token"]
    try:
        claims = jwt.decode(
            token,
            signing_key(provider, token),
            algorithms=["RS256", "ES256"],
            audience=_client_id(provider),
            issuer=p["issuer"],
        )
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=400, detail="The provider's answer could not be verified.") from e
    email = (claims.get("email") or "").lower()
    verified = claims.get("email_verified") in (True, "true")
    sub = str(claims.get("sub") or "")
    if not sub:
        raise HTTPException(status_code=400, detail="The provider's answer names no account.")
    with accounts.tx() as conn:
        ident = accounts.q1(
            conn,
            "select user_id from accounts.identities where provider = :p and subject = :s",
            {"p": provider, "s": sub},
        )
        if ident is not None:
            u = accounts.q1(conn, "select * from accounts.users where id = :id", {"id": ident["user_id"]})
        else:
            if not (email and verified):
                raise HTTPException(
                    status_code=400, detail="The provider did not give a verified e-mail address."
                )
            u = accounts.user_by_email(conn, email)
            accounts.q(
                conn,
                "insert into accounts.identities (provider, subject, user_id, email) values (:p, :s, :u, :e) returning provider",
                {"p": provider, "s": sub, "u": u["id"], "e": email},
            )
        assert u is not None
        session = accounts.start_session(conn, u["id"], device)
    return {"session": session, "user": accounts._user_out(u), "return_to": "/me"}
