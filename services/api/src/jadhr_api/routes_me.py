"""The account and sync endpoints (PLAN P6). Personal: never cached, never logged beyond the request line."""

from __future__ import annotations

import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel, Field

from . import accounts, classroom, contrib, oidc, shared_maps, sync
from .settings import get_settings

router = APIRouter(prefix="/api/v1")
NO_STORE = {"Cache-Control": "no-store"}
User = Annotated[dict[str, Any], Depends(accounts.current_user)]


def ok(payload: Any, status: int = 200) -> ORJSONResponse:
    return ORJSONResponse(payload, status_code=status, headers=NO_STORE)


@router.get("/auth/providers", summary="How a reader can sign in here (only what is configured)")
def providers() -> ORJSONResponse:
    # how long a sign-in link works, so the page says the period the server keeps (never a number of its own)
    return ok(
        {
            "email": accounts.email_enabled(),
            **oidc.configured(),
            "link_minutes": get_settings().login_token_minutes,
        }
    )


class _EmailLink(BaseModel):
    email: str = Field(max_length=320)
    return_to: str | None = Field(None, max_length=300)
    locale: str = Field("ar", pattern="^(ar|en)$")


@router.post(
    "/auth/email",
    summary="Send a sign-in link (the answer is the same whether or not the address has an account)",
)
def email_link(body: _EmailLink, request: Request) -> ORJSONResponse:
    if not accounts.email_enabled():
        raise HTTPException(status_code=503, detail="Sign-in by e-mail is not available here yet.")
    if not re.match(accounts.EMAIL_RE, body.email.strip()):
        raise HTTPException(status_code=422, detail="Check the e-mail address.")
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(
        ","
    )[0]
    if not accounts.mail_allowed(ip.strip()):
        raise HTTPException(status_code=429, detail="Too many sign-in links from here; try again later.")
    accounts.request_link(body.email, body.return_to, body.locale)
    return ok({"sent": True}, 202)


class _Verify(BaseModel):
    token: str = Field(min_length=20, max_length=100)
    device: str | None = Field(None, max_length=120)


@router.post("/auth/verify", summary="Exchange a sign-in link for a session")
def verify(body: _Verify) -> ORJSONResponse:
    out = accounts.verify_link(body.token, body.device)
    if out is None:
        raise HTTPException(
            status_code=400, detail="This link has expired or was already used. Ask for a new one."
        )
    return ok(out)


@router.get("/auth/dev/outbox", include_in_schema=False)
def dev_outbox(email: str = Query(..., max_length=320)) -> ORJSONResponse:
    # development only: the e2e suite reads the link it asked for; a production server answers 404
    s = get_settings()
    if s.environment == "production" or s.mail_backend != "dev":
        raise HTTPException(status_code=404)
    return ok({"messages": accounts.dev_outbox(email.strip().lower())})


@router.get("/auth/oidc/{provider}/start", summary="Begin signing in with Google or Apple")
def oidc_start(
    provider: str,
    redirect_uri: str = Query(..., max_length=300),
    state: str = Query(..., max_length=200),
    challenge: str = Query(..., max_length=200),
) -> ORJSONResponse:
    return ok({"url": oidc.start(provider, redirect_uri, state, challenge)})


class _OidcFinish(BaseModel):
    code: str = Field(max_length=2000)
    redirect_uri: str = Field(max_length=300)
    verifier: str = Field(max_length=200)
    device: str | None = Field(None, max_length=120)


@router.post("/auth/oidc/{provider}/finish", summary="Finish signing in with Google or Apple")
def oidc_finish(provider: str, body: _OidcFinish) -> ORJSONResponse:
    return ok(oidc.finish(provider, body.code, body.redirect_uri, body.verifier, body.device))


@router.post("/auth/signout", summary="End this device's session")
def signout(u: User) -> ORJSONResponse:
    accounts.end_session(u)
    return ok({"signed_out": True})


@router.get("/me", summary="The signed-in account, its devices and how much it holds")
def me(u: User) -> ORJSONResponse:
    return ok({**accounts.me(u), "held": sync.held(u)})


class _MePatch(BaseModel):
    display_name: str | None = Field(None, max_length=120)
    affiliation: str | None = Field(None, max_length=120)
    orcid: str | None = Field(None, max_length=19)
    settings: dict[str, Any] | None = None


@router.patch("/me", summary="Change the name, affiliation, ORCID or settings")
def me_patch(u: User, body: _MePatch) -> ORJSONResponse:
    return ok(accounts.me(accounts.update_me(u, body.model_dump(exclude_unset=True))))


@router.delete("/me/sessions/{session_id}", summary="Sign a device out")
def me_session_end(u: User, session_id: str) -> ORJSONResponse:
    if not accounts.end_session(u, session_id[:12]):
        raise HTTPException(status_code=404, detail="No such device.")
    return ok({"ended": session_id})


@router.get("/me/sync", summary="The records changed on other devices since a cursor")
def sync_pull(u: User, since: int = Query(0, ge=0)) -> ORJSONResponse:
    return ok(sync.pull(u, since))


class _Record(BaseModel):
    store: str = Field(max_length=20)
    key: str = Field(max_length=200)
    value: Any = None
    deleted: bool = False
    updated_at: int = Field(ge=0)


class _Push(BaseModel):
    records: list[_Record] = Field(max_length=2000)


@router.post("/me/sync", summary="Send the records this device changed; for each, the newer version wins")
def sync_push(u: User, body: _Push) -> ORJSONResponse:
    return ok(sync.push(u, [r.model_dump() for r in body.records]))


@router.get("/me/history", summary="Versions replaced in the last 30 days, recoverable")
def history(u: User) -> ORJSONResponse:
    return ok({"data": sync.history(u)})


@router.post("/me/history/{history_id}/restore", summary="Put a replaced version back")
def restore(u: User, history_id: int) -> ORJSONResponse:
    return ok(sync.restore(u, history_id))


@router.get("/me/export", summary="Everything the account holds, as JSON")
def export(u: User) -> ORJSONResponse:
    return ORJSONResponse(
        {
            "account": accounts.me(u),
            **sync.export(u),
            "contributions": contrib.export_for(u),
            **shared_maps.export_for(u),
            **classroom.export_for(u),
        },
        headers={**NO_STORE, "Content-Disposition": 'attachment; filename="jadhr-account.json"'},
    )


@router.post(
    "/me/delete", summary="Ask to delete the account: returns a confirmation token valid ten minutes"
)
def delete_request(u: User) -> ORJSONResponse:
    return ok({"confirm": sync.request_delete(u)})


class _Confirm(BaseModel):
    confirm: str = Field(min_length=20, max_length=100)


@router.post("/me/delete/confirm", summary="Delete the account and everything it holds")
def delete_confirm(u: User, body: _Confirm) -> ORJSONResponse:
    if not sync.delete_account(u, body.confirm):
        raise HTTPException(status_code=400, detail="This confirmation has expired. Ask again.")
    return ok({"deleted": True})


class _Lookups(BaseModel):
    events: list[dict[str, str | None]] = Field(max_length=500)


@router.post("/me/lookups", summary="Share lookups with a class (only when the reader turned that on)")
def lookups(u: User, body: _Lookups) -> ORJSONResponse:
    return ok({"recorded": sync.record_lookups(u, body.events)})
