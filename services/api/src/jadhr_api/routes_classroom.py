"""The classroom's routes (PLAN P9, research 16): classes and lessons, joining with consent, and a lesson as a file.
Never cached: each answer is one reader's view of their classes."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path
from fastapi.responses import Response
from pydantic import BaseModel, Field

from . import accounts, classroom
from .responses import ORJSONResponse

router = APIRouter(prefix="/api/v1/classroom")
NO_STORE = {"Cache-Control": "no-store"}
User = Annotated[dict[str, Any], Depends(accounts.current_user)]
Id = Annotated[str, Path(max_length=40)]


def ok(payload: Any, status: int = 200) -> ORJSONResponse:
    return ORJSONResponse(payload, status_code=status, headers=NO_STORE)


def gone() -> Response:
    return Response(status_code=204, headers=NO_STORE)


class _Class(BaseModel):
    name: str = Field(max_length=200)
    minors: bool = False


class _ClassEdit(BaseModel):
    name: str | None = Field(None, max_length=200)
    minors: bool | None = None
    archived: bool | None = None


class _Join(BaseModel):
    consent: str = Field(max_length=20)
    detail_opt_in: bool = False


class _Detail(BaseModel):
    detail_opt_in: bool


class _Lesson(BaseModel):
    title: str = Field(max_length=200)
    ranges: list[dict[str, Any]] = Field(max_length=10)
    roots: list[str] = Field(default_factory=list, max_length=30)
    due: str | None = Field(None, max_length=10)


class _LessonEdit(BaseModel):
    title: str | None = Field(None, max_length=200)
    ranges: list[dict[str, Any]] | None = Field(None, max_length=10)
    roots: list[str] | None = Field(None, max_length=30)
    due: str | None = Field(None, max_length=10)


@router.get("/classes", summary="The classes this reader teaches and those they joined")
def classes(u: User) -> ORJSONResponse:
    return ok(classroom.classes(u))


@router.post("/classes", summary="A new class (accounts with the instructor role)")
def create(u: User, body: _Class) -> ORJSONResponse:
    return ok(classroom.create(u, body.name, body.minors), status=201)


@router.get(
    "/classes/{class_id}", summary="A class: its lessons, and for its instructor the roster and join link"
)
def get_class(u: User, class_id: Id) -> ORJSONResponse:
    return ok(classroom.get_class(u, class_id))


@router.patch(
    "/classes/{class_id}", summary="Rename a class, mark it for minors, archive it (its instructor)"
)
def update(u: User, class_id: Id, body: _ClassEdit) -> ORJSONResponse:
    return ok(classroom.update(u, class_id, body.name, body.minors, body.archived))


@router.delete("/classes/{class_id}", summary="Delete a class and everything it held (its instructor)")
def delete(u: User, class_id: Id) -> Response:
    classroom.delete(u, class_id)
    return gone()


@router.post(
    "/classes/{class_id}/code", summary="A new join link; the old one stops working (its instructor)"
)
def new_code(u: User, class_id: Id) -> ORJSONResponse:
    return ok(classroom.new_code(u, class_id))


@router.get("/join/{code}", summary="What joining a class means, shown before joining")
def preview(u: User, code: Annotated[str, Path(max_length=20)]) -> ORJSONResponse:
    return ok(classroom.preview(u, code))


@router.post("/join/{code}", summary="Join a class, agreeing to what its instructor will see")
def join(u: User, code: Annotated[str, Path(max_length=20)], body: _Join) -> ORJSONResponse:
    return ok(classroom.join(u, code, body.consent, body.detail_opt_in), status=201)


@router.patch(
    "/classes/{class_id}/membership", summary="Show my detail to the instructor, or stop (a member)"
)
def set_detail(u: User, class_id: Id, body: _Detail) -> ORJSONResponse:
    return ok(classroom.set_detail(u, class_id, body.detail_opt_in))


@router.delete("/classes/{class_id}/membership", summary="Leave a class; what it held of me goes")
def leave(u: User, class_id: Id) -> Response:
    classroom.leave(u, class_id)
    return gone()


@router.delete(
    "/classes/{class_id}/members/{user_id}", summary="Remove a member and what the class held of them"
)
def remove(u: User, class_id: Id, user_id: Id) -> Response:
    classroom.remove(u, class_id, user_id)
    return gone()


class _Set(BaseModel):
    title: str = Field(max_length=200)
    rule: dict[str, Any]


@router.get("/classes/{class_id}/sets", summary="A class's sets of words, each a title and its rule (B29)")
def class_sets(class_id: Id, u: User) -> ORJSONResponse:
    return ok(classroom.class_sets(u, class_id))


@router.post(
    "/classes/{class_id}/sets", summary="A set of words for the class, by a rule (its instructor; B29)"
)
def add_set(class_id: Id, body: _Set, u: User) -> ORJSONResponse:
    return ok(classroom.add_set(u, class_id, body.title, body.rule), 201)


@router.get("/sets/{set_id}", summary="One of a class's sets with its words, read from the data now (B29)")
def class_set(set_id: Id, u: User) -> ORJSONResponse:
    return ok(classroom.class_set(u, set_id))


@router.delete("/sets/{set_id}", summary="Remove one of a class's sets (its instructor)")
def drop_set(set_id: Id, u: User) -> Response:
    classroom.drop_set(u, set_id)
    return gone()


@router.get("/classes/{class_id}/lessons", summary="A class's lessons")
def lessons(u: User, class_id: Id) -> ORJSONResponse:
    return ok(classroom.lessons(u, class_id))


@router.post(
    "/classes/{class_id}/lessons", summary="A lesson: verse ranges, roots, a due date (its instructor)"
)
def add_lesson(u: User, class_id: Id, body: _Lesson) -> ORJSONResponse:
    return ok(classroom.add_lesson(u, class_id, body.title, body.ranges, body.roots, body.due), status=201)


@router.get("/lessons/{lesson_id}", summary="A lesson, with the member's own progress")
def get_lesson(u: User, lesson_id: Id) -> ORJSONResponse:
    return ok(classroom.get_lesson(u, lesson_id))


@router.patch("/lessons/{lesson_id}", summary="Change a lesson (its instructor)")
def update_lesson(u: User, lesson_id: Id, body: _LessonEdit) -> ORJSONResponse:
    fields = body.model_fields_set
    return ok(
        classroom.update_lesson(
            u, lesson_id, body.title, body.ranges, body.roots, body.due if "due" in fields else ...
        )
    )


@router.delete("/lessons/{lesson_id}", summary="Delete a lesson and what it counted (its instructor)")
def delete_lesson(u: User, lesson_id: Id) -> Response:
    classroom.delete_lesson(u, lesson_id)
    return gone()


@router.get(
    "/lessons/{lesson_id}/pack", summary="A lesson as a file to open with no account (no learner's data)"
)
def pack(u: User, lesson_id: Id) -> ORJSONResponse:
    return ok(classroom.pack(u, lesson_id))


class _Counts(BaseModel):
    day: str = Field(max_length=10)
    items: list[dict[str, Any]] = Field(max_length=500)


class _Progress(BaseModel):
    day: str = Field(max_length=10)
    finished: bool | None = None
    minutes: int = 0


@router.post(
    "/lessons/{lesson_id}/counts", summary="What a member's reader counted for an open lesson's verses"
)
def add_counts(u: User, lesson_id: Id, body: _Counts) -> ORJSONResponse:
    return ok(classroom.add_counts(u, lesson_id, body.day, body.items))


@router.post(
    "/lessons/{lesson_id}/progress", summary="A member's lesson: opened, finished by their word, minutes"
)
def progress(u: User, lesson_id: Id, body: _Progress) -> ORJSONResponse:
    return ok(classroom.progress(u, lesson_id, body.day, body.finished, body.minutes))


class _Note(BaseModel):
    location: str | None = Field(None, max_length=20)
    root: str | None = Field(None, max_length=8)
    text: str = Field("", max_length=1000)


class _NoteEdit(BaseModel):
    text: str | None = Field(None, max_length=1000)
    move: int | None = Field(None, ge=-1, le=1)


@router.get(
    "/lessons/{lesson_id}/heat",
    summary="A lesson as its instructor sees it: totals, and per word above the floor",
)
def heat(u: User, lesson_id: Id) -> ORJSONResponse:
    return ok(classroom.heat(u, lesson_id))


@router.get(
    "/lessons/{lesson_id}/matrix", summary="Learners who chose to show their detail by the lesson's roots"
)
def matrix(u: User, lesson_id: Id, layer: str = "lookup") -> ORJSONResponse:
    return ok(classroom.matrix(u, lesson_id, layer))


@router.get("/lessons/{lesson_id}/mine", summary="What my reader sent for a lesson, as the server keeps it")
def mine(u: User, lesson_id: Id) -> ORJSONResponse:
    return ok(classroom.mine(u, lesson_id))


@router.get("/lessons/{lesson_id}/notes", summary="The instructor's lesson notes")
def notes(u: User, lesson_id: Id) -> ORJSONResponse:
    return ok(classroom.notes(u, lesson_id))


@router.post("/lessons/{lesson_id}/notes", summary="A lesson note: a word, a root, a line")
def add_note(u: User, lesson_id: Id, body: _Note) -> ORJSONResponse:
    return ok(classroom.add_note(u, lesson_id, body.location, body.root, body.text), status=201)


@router.patch("/notes/{note_id}", summary="Change a lesson note's words, or move it up or down")
def edit_note(u: User, note_id: Id, body: _NoteEdit) -> ORJSONResponse:
    return ok(classroom.edit_note(u, note_id, body.text, body.move))


@router.delete("/notes/{note_id}", summary="Remove a lesson note")
def delete_note(u: User, note_id: Id) -> ORJSONResponse:
    return ok(classroom.delete_note(u, note_id))


@router.post(
    "/lessons/{lesson_id}/nudges",
    summary="Remind the members who have not opened a lesson (a notice, not a message)",
)
def nudge(u: User, lesson_id: Id) -> ORJSONResponse:
    return ok(classroom.nudge(u, lesson_id))


@router.get("/me/active", summary="The open lessons of my classes: the verses my reader counts for")
def active(u: User) -> ORJSONResponse:
    return ok(classroom.active(u))


# ─── the lesson's map (P9.3) ───────────────────────────────────────────────────


class _Map(BaseModel):
    graph_id: str = Field(max_length=40)


class _Proposal(BaseModel):
    base: int | None = None
    cards: list[Any] = Field(max_length=200)
    links: list[Any] = Field(default_factory=list, max_length=400)
    note: str = Field("", max_length=500)


class _Decision(BaseModel):
    decision: str = Field(max_length=20)


@router.put(
    "/lessons/{lesson_id}/map", summary="Name one of my shared maps as the lesson's map (the class's only)"
)
def set_map(u: User, lesson_id: Id, body: _Map) -> ORJSONResponse:
    return ok(classroom.set_map(u, lesson_id, body.graph_id))


@router.get("/lessons/{lesson_id}/proposals", summary="What members propose for the lesson's map")
def proposals(u: User, lesson_id: Id) -> ORJSONResponse:
    return ok(classroom.proposals(u, lesson_id))


@router.post(
    "/lessons/{lesson_id}/proposals", summary="Propose cards and links for the lesson's map (a member)"
)
def propose(u: User, lesson_id: Id, body: _Proposal) -> ORJSONResponse:
    return ok(classroom.propose(u, lesson_id, body.base, body.cards, body.links, body.note), status=201)


@router.post("/proposals/{proposal_id}/decide", summary="Confirm a proposal into the map, or decline it")
def decide(u: User, proposal_id: Id, body: _Decision) -> ORJSONResponse:
    return ok(classroom.decide(u, proposal_id, body.decision))


@router.delete("/proposals/{proposal_id}", summary="Take back a proposal of mine that waits")
def withdraw(u: User, proposal_id: Id) -> Response:
    classroom.withdraw(u, proposal_id)
    return gone()


@router.get("/lessons/{lesson_id}/activity", summary="What happened on the lesson's map, newest first")
def activity(u: User, lesson_id: Id, before: str | None = None, limit: int = 30) -> ORJSONResponse:
    return ok(classroom.activity(u, lesson_id, before, limit))


class _Copy(BaseModel):
    class_id: str = Field(max_length=40)


@router.post(
    "/lessons/{lesson_id}/copy", summary="Copy a lesson into another class of mine (its verses, roots, notes)"
)
def copy_lesson(u: User, lesson_id: Id, body: _Copy) -> ORJSONResponse:
    return ok(classroom.copy_lesson(u, lesson_id, body.class_id), status=201)
