"""The embedding service (P17.2, D34): one process beside the API, reachable only from it, turning a reader's search
into a vector on our own server. It keeps nothing: no request log, no cache of what was asked.

    POST /embed   {"texts": ["…"], "kind": "query"}  →  {"model": "e5-base@…", "dim": 768, "vectors": "<base64 float32>"}
    GET  /healthz                                     →  {"model": "e5-base@…", "dim": 768}
"""

from __future__ import annotations

import asyncio
import base64
import os
from contextlib import asynccontextmanager
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from .encoder import Encoder

MAX_TEXTS = 32
MAX_CHARS = 2000
# the model's work at once, and the requests let wait for it (delta security review, M3): the API stops waiting after
# 1.5 s but a queued request would still be computed, so the queue is bounded and the rest are told at once that the
# service is busy — the API then answers by words and says so
CONCURRENCY = max(1, int(os.environ.get("JADHR_EMBED_CONCURRENCY", "1")))
MAX_WAITING = max(0, int(os.environ.get("JADHR_EMBED_QUEUE", "8")))

state: dict[str, Any] = {}


@asynccontextmanager
async def lifespan(_app: Starlette):
    state["enc"] = Encoder.load(threads=int(os.environ.get("JADHR_EMBED_THREADS", "2")))
    state["gate"] = asyncio.Semaphore(CONCURRENCY)
    state["waiting"] = 0
    yield
    state.clear()


def _encode(texts: list[str], kind: str) -> dict[str, Any]:
    enc: Encoder = state["enc"]
    vec = enc.encode(texts, "query" if kind == "query" else "passage")
    return {"model": enc.spec.tag, "dim": enc.spec.dim, "vectors": base64.b64encode(vec.tobytes()).decode()}


async def embed(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except ValueError:
        return JSONResponse({"error": "a JSON body"}, status_code=400)
    texts = body.get("texts") if isinstance(body, dict) else None
    kind = body.get("kind", "query") if isinstance(body, dict) else None
    if (
        not isinstance(texts, list)
        or not 0 < len(texts) <= MAX_TEXTS
        or not all(isinstance(t, str) and 0 < len(t) <= MAX_CHARS for t in texts)
        or kind not in ("query", "passage")
    ):
        return JSONResponse(
            {"error": f"texts: 1–{MAX_TEXTS} strings of 1–{MAX_CHARS} characters; kind: query or passage"},
            status_code=422,
        )
    # the model's arithmetic runs in a worker thread: the event loop keeps answering health checks
    from starlette.concurrency import run_in_threadpool

    gate: asyncio.Semaphore = state["gate"]
    if gate.locked() and state["waiting"] >= MAX_WAITING:
        return JSONResponse({"error": "busy"}, status_code=503, headers={"Retry-After": "1"})
    state["waiting"] += 1
    try:
        await gate.acquire()
    finally:
        state["waiting"] -= 1
    try:
        return JSONResponse(await run_in_threadpool(_encode, texts, kind))
    finally:
        gate.release()


async def healthz(_request: Request) -> JSONResponse:
    enc: Encoder = state["enc"]
    return JSONResponse({"model": enc.spec.tag, "dim": enc.spec.dim})


app = Starlette(
    routes=[Route("/embed", embed, methods=["POST"]), Route("/healthz", healthz)], lifespan=lifespan
)
