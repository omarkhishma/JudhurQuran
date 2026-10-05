"""Contribution and moderation endpoints (PLAN P7). Reading the queue and the changelog is public; proposing,
deciding and the rest need an account. Nothing here is kept by a cache without asking again."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from . import accounts, contrib
from .responses import ORJSONResponse

router = APIRouter(prefix="/api/v1")
NO_STORE = {"Cache-Control": "no-store"}
# public, but asked again each time: a merge shows at once to whoever was part of it
BRIEF = {"Cache-Control": "no-cache"}
User = Annotated[dict[str, Any], Depends(accounts.current_user)]
Viewer = Annotated[dict[str, Any] | None, Depends(accounts.optional_user)]


def ok(payload: Any, headers: dict[str, str] | None = None, status: int = 200) -> ORJSONResponse:
    return ORJSONResponse(payload, status_code=status, headers=headers or NO_STORE)


class _Source(BaseModel):
    work: str = Field(max_length=40)
    ref: str = Field("", max_length=200)


class _Proposal(BaseModel):
    kind: str = Field(max_length=12)
    # a word's lemma, or a correction's item by its address (hadith:…, dict:…, book:…; B58)
    lemma: str = Field(min_length=1, max_length=200)
    sense_ordinal: int | None = Field(None, ge=1, le=500)
    location: str | None = Field(None, max_length=12)
    field: str | None = Field(None, max_length=20)
    current_text: str | None = Field(None, max_length=4000)
    text: str = Field(min_length=1, max_length=4000)
    why: str = Field(min_length=1, max_length=4000)
    sources: list[_Source | str] = Field(default_factory=list, max_length=10)


@router.post(
    "/proposals",
    summary="Propose an edit, a sense, a gloss, a correction, an error, an attestation or an entry",
)
def propose(u: User, body: _Proposal) -> ORJSONResponse:
    return ok(contrib.propose(u, body.model_dump()), status=201)


@router.get("/proposals", summary="The review queue, by filter, newest first")
def proposals(
    viewer: Viewer,
    filter: str = Query("open", max_length=10),
    before: str | None = Query(None, max_length=40),
    limit: int = Query(50, ge=1, le=100),
) -> ORJSONResponse:
    return ok(contrib.queue(viewer, filter, before, limit))


@router.get("/proposals/{pid}", summary="A proposal with its decisions so far")
def proposal(viewer: Viewer, pid: str) -> ORJSONResponse:
    return ok(contrib.detail(pid, viewer))


class _Decision(BaseModel):
    decision: str = Field(max_length=10)
    note: str | None = Field(None, max_length=2000)


@router.post("/proposals/{pid}/decisions", summary="Approve, decline or request changes (reviewers)")
def decide(u: User, pid: str, body: _Decision) -> ORJSONResponse:
    return ok(contrib.decide(u, pid, body.decision, body.note))


class _Revision(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    why: str = Field(min_length=1, max_length=4000)
    sources: list[_Source | str] = Field(default_factory=list, max_length=10)


@router.post("/proposals/{pid}/revise", summary="Answer a request for changes with a new revision")
def revise(u: User, pid: str, body: _Revision) -> ORJSONResponse:
    return ok(contrib.revise(u, pid, body.model_dump()))


@router.post("/proposals/{pid}/withdraw", summary="Withdraw a proposal of yours")
def withdraw(u: User, pid: str) -> ORJSONResponse:
    return ok(contrib.withdraw(u, pid))


class _Report(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


@router.post("/proposals/{pid}/report", summary="Report a proposal to the editors")
def report(u: User, pid: str, body: _Report) -> ORJSONResponse:
    return ok(contrib.report(u, pid, body.reason))


class _Revert(BaseModel):
    note: str = Field("", max_length=2000)


@router.post("/merges/{mid}/revert", summary="Take a merge back (the editorial board)")
def revert(u: User, mid: str, body: _Revert) -> ORJSONResponse:
    return ok(contrib.revert(u, mid, body.note))


@router.get("/changelog", summary="Merged and reverted contributions, newest first, paged by entry")
def changelog(
    since: str | None = Query(None, max_length=40),
    before: int | None = Query(None, ge=1, description="entries before this one (the next page)"),
    limit: int = Query(100, ge=1, le=500),
) -> ORJSONResponse:
    return ok(contrib.changelog(since, limit, before), BRIEF)


@router.get("/lemmas/{slug}/contributions", summary="A word's merged contributions, shown beside its sources")
def lemma_contributions(slug: str) -> ORJSONResponse:
    return ok(contrib.for_lemma(slug[:80]), BRIEF)


@router.get(
    "/corrections",
    summary="The corrections in force on an item of the library, beside what the build made (B58)",
)
def corrections(
    target: str = Query(..., min_length=6, max_length=200, pattern=r"^(hadith|book|dict):"),
) -> ORJSONResponse:
    return ok(contrib.for_target(target), headers={"Cache-Control": "no-store"})


@router.get(
    "/corrections/in-force", summary="The corrections in force on many items at once (a page's articles; B58)"
)
def corrections_in_force(
    targets: Annotated[
        list[Annotated[str, Field(min_length=6, max_length=200, pattern=r"^(hadith|book|dict):")]],
        Query(max_length=80),
    ],
) -> ORJSONResponse:
    return ok({"data": contrib.in_force(targets)}, headers={"Cache-Control": "no-store"})


@router.get("/me/proposals", summary="Your proposals, every status")
def my_proposals(u: User) -> ORJSONResponse:
    return ok(contrib.mine(u))


class _Grant(BaseModel):
    email: str = Field(max_length=320)
    role: str = Field(max_length=12)
    reason: str | None = Field(None, max_length=300)


@router.post("/admin/roles", summary="Appoint a reviewer or an editor (administrators)")
def grant(u: User, body: _Grant) -> ORJSONResponse:
    return ok(contrib.grant(u, body.email, body.role, body.reason))


@router.get("/reports", summary="Unresolved reports, with the proposal each concerns (the editorial board)")
def reports(u: User) -> ORJSONResponse:
    return ok(contrib.open_reports(u))


class _Resolve(BaseModel):
    outcome: str = Field(max_length=10)
    note: str | None = Field(None, max_length=2000)


@router.post(
    "/reports/{rid}/resolve", summary="Dismiss a report, or say it was acted on (the editorial board)"
)
def resolve(u: User, rid: int, body: _Resolve) -> ORJSONResponse:
    return ok(contrib.resolve_report(u, rid, body.outcome, body.note))


class _Block(BaseModel):
    target: str = Field(
        min_length=1, max_length=320, description="an account's address, or a proposal of theirs"
    )
    blocked: bool = True
    reason: str | None = Field(None, max_length=300)


@router.post("/admin/block", summary="Stop an account proposing, reviewing and reporting, or let it again")
def block(u: User, body: _Block) -> ORJSONResponse:
    return ok(contrib.block(u, body.target, body.blocked, body.reason))
