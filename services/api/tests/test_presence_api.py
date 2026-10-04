"""Presence on a shared map (P8.6, D5; EDT-014, EDT-296, EDT-297): who is there now — the signed-in by the name
their comments carry, anyone else counted — told to every window as it changes; one of the owner's windows edits and
another is told, and may take it over; another worker's windows heard through Postgres; a map not shared refused.
Nothing is written down."""

from __future__ import annotations

import json
import threading
import time
import uuid
from collections.abc import Callable
from typing import Any

import anyio
import pytest
from fastapi.testclient import TestClient
from jadhr_api import accounts
from jadhr_api.main import app
from starlette.websockets import WebSocketDisconnect
from test_graphs_api import _share, people  # noqa: F401  (the owner and two readers, signed in)


def _token(h: dict[str, str]) -> str:
    return h["Authorization"].removeprefix("Bearer ")


def _receive(ws: Any, within: float = 10.0) -> dict[str, Any]:
    """The next message, or a failure after `within` seconds — a window told nothing must fail the test, not hang it."""

    async def next_message() -> Any:
        with anyio.fail_after(within):
            return await ws._send_rx.receive()

    try:
        m = ws.portal.call(next_message)
    except TimeoutError:
        raise AssertionError(f"nothing told within {within}s") from None
    ws._raise_on_close(m)
    return json.loads(m["text"])


def _until(ws: Any, ok: Callable[[dict[str, Any]], bool], most: int = 12) -> dict[str, Any]:
    """The first message that satisfies `ok`: a window is told each time anything changes."""
    for _ in range(most):
        m = _receive(ws)
        if ok(m):
            return m
    raise AssertionError("no such message")


def _names(m: dict[str, Any]) -> set[str]:
    return {p["name"] for p in m["people"]}


def test_who_is_on_a_shared_map_and_which_window_edits(people: dict[str, dict[str, str]]) -> None:  # noqa: F811
    o, r = people["o"], people["r"]
    g = _share(o, local=f"pres{uuid.uuid4().hex[:6]}")
    on = f"/api/v1/graphs/{g['id']}/presence"
    with TestClient(app) as tc, tc.websocket_connect(on) as a:
        a.send_json({"type": "hello", "token": _token(o), "editing": True})
        first = _until(a, lambda m: m["type"] == "presence")
        owner_name = first["people"][0]["name"]
        assert first["editor"] == "you" and first["people"] == [
            {"name": owner_name, "owner": True, "you": True, "windows": 1, "editing": True}
        ]
        with tc.websocket_connect(on) as b:
            b.send_json({"type": "hello", "token": _token(r), "editing": True})  # a reader cannot edit
            seen = _until(b, lambda m: len(m["people"]) == 2)
            assert seen["editor"] == "elsewhere" and [p["you"] for p in seen["people"]] == [True, False]
            assert [p["owner"] for p in seen["people"]] == [False, True]
            _until(a, lambda m: len(m["people"]) == 2)
            with tc.websocket_connect(on) as guest:
                guest.send_json({"type": "hello"})
                g1 = _until(guest, lambda m: m["guests"] == 1)
                assert len(g1["people"]) == 2 and g1["editor"] == "elsewhere"
                _until(a, lambda m: m["guests"] == 1)
            # the guest has gone, and is no longer counted
            _until(a, lambda m: m["guests"] == 0)
        _until(a, lambda m: len(m["people"]) == 1)
        # the owner's second window: told another edits, the owner shown once with two windows; it takes the map
        with tc.websocket_connect(on) as a2:
            a2.send_json({"type": "hello", "token": _token(o), "editing": True})
            w2 = _until(a2, lambda m: m["type"] == "presence")
            assert w2["editor"] == "elsewhere" and w2["people"][0]["windows"] == 2
            a2.send_json({"type": "take"})
            assert _until(a2, lambda m: m["editor"] == "you")["editor"] == "you"
            assert _until(a, lambda m: m["editor"] == "elsewhere")["editor"] == "elsewhere"
        # the window that took it closed: the one left edits again
        assert _until(a, lambda m: m["editor"] == "you")["people"][0]["windows"] == 1


def test_another_workers_windows_are_heard_through_postgres(people: dict[str, dict[str, str]]) -> None:  # noqa: F811
    o = people["o"]
    g = _share(o, local=f"pres{uuid.uuid4().hex[:6]}")
    other = {
        "conn": "x1",
        "user": "someone-else",
        "name": "قارئ في عامل آخر",
        "owner": False,
        "editing": False,
        "claimed": 0,
    }
    stop = threading.Event()

    def say(entries: list[dict[str, Any]]) -> None:
        # the other worker speaks until this one has heard (its listener may still be connecting)
        while not stop.is_set():
            with accounts.tx() as c:
                accounts.q(
                    c,
                    "select pg_notify('jadhr_presence', :b) as sent",
                    {"b": json.dumps({"w": "another-worker", "g": g["id"], "e": entries})},
                )
            time.sleep(0.3)

    with TestClient(app) as tc, tc.websocket_connect(f"/api/v1/graphs/{g['id']}/presence") as a:
        a.send_json({"type": "hello", "token": _token(o), "editing": True})
        _until(a, lambda m: m["type"] == "presence")
        t = threading.Thread(target=say, args=([other],), daemon=True)
        t.start()
        try:
            heard = _until(a, lambda m: "قارئ في عامل آخر" in _names(m), most=60)
        finally:
            stop.set()
            t.join()
        assert len(heard["people"]) == 2 and heard["editor"] == "you"
        # the other worker's last window left: it says so with an empty list
        stop.clear()
        t = threading.Thread(target=say, args=([],), daemon=True)
        t.start()
        try:
            gone = _until(a, lambda m: len(m["people"]) == 1, most=60)
        finally:
            stop.set()
            t.join()
        assert "قارئ في عامل آخر" not in _names(gone)


def test_a_map_not_shared_is_refused() -> None:
    with TestClient(app) as tc, tc.websocket_connect(f"/api/v1/graphs/{uuid.uuid4()}/presence") as ws:
        with pytest.raises(WebSocketDisconnect) as e:
            _receive(ws)
        assert e.value.code == 4404


def test_windows_are_admitted_within_limits(monkeypatch: pytest.MonkeyPatch) -> None:
    """Security review L7: anyone may open a window, so one address, one map and one worker each hold a bounded
    number, counted from the moment a window connects — before its hello."""
    from jadhr_api import presence

    hub = presence.Hub()
    monkeypatch.setattr(presence, "PER_ADDRESS", 2)
    monkeypatch.setattr(presence, "JOINS_PER_MINUTE", 3)
    assert hub.admit("m", "a") is None and hub.admit("m", "a") is None
    assert hub.admit("m", "a") == "Too many windows from here."
    assert hub.admit("m", "b") is None  # another address
    hub.release("m", "a")
    assert hub.admit("n", "a") is None  # a window closed makes room
    hub.release("n", "a")
    assert hub.admit("n", "a") == "Too many windows from here."  # but not past the minute's openings
    # the map holds one of a's windows and b's
    monkeypatch.setattr(presence, "MAX_PER_MAP", 2)
    assert hub.admit("m", "c") == "Too many windows on this map."
    assert (hub.open, hub.total) == ({"m": 2}, 2)
    for a in ("a", "b"):
        hub.release("m", a)
    assert (hub.open, hub.by_address, hub.total) == ({}, {}, 0)


def test_a_window_past_the_limit_is_closed_before_its_hello(
    people: dict[str, dict[str, str]],  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from jadhr_api import presence

    monkeypatch.setattr(presence, "PER_ADDRESS", 1)
    g = _share(people["o"], local=f"pres{uuid.uuid4().hex[:6]}")
    on = f"/api/v1/graphs/{g['id']}/presence"
    with TestClient(app) as tc, tc.websocket_connect(on) as a:
        a.send_json({"type": "hello"})
        _until(a, lambda m: m["type"] == "presence")
        with tc.websocket_connect(on) as b:
            with pytest.raises(WebSocketDisconnect) as e:
                _receive(b)
            assert e.value.code == 4429


def test_a_workers_word_fits_one_notification() -> None:
    """Past what 8000 bytes carry, a signed-in window is counted rather than named; the owner's windows always go."""
    from jadhr_api import presence

    hub = presence.Hub()
    es = {
        f"c{i}": presence.Entry(f"c{i}", uuid.uuid4().hex, "قارئ " + "ب" * 50, False, False, 0.0)
        for i in range(150)
    }
    es["own"] = presence.Entry("own", "owner-id", "صاحب الخريطة", True, True, 1.0)
    es.update({f"g{i}": presence.Entry(f"g{i}", None, None, False, False, 0.0) for i in range(40)})
    hub.local["m"] = es
    body = hub.message("m")
    m = json.loads(body)
    assert len(body.encode()) <= presence.NOTIFY_BYTES
    assert m["e"][0]["user"] == "owner-id" and m["e"][0]["editing"] is True
    assert len(m["e"]) + m["n"] == 191 and m["n"] > 40  # every window told: named, or counted
