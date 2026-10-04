"""Presence on a shared map (PLAN P8.6, D5; EDT-014, EDT-296, EDT-297): who is on a map now, and a soft lock for its
owner's own windows. Nothing here is written down: each API worker keeps its own sockets in memory, and what it holds
leaves with them.

A browser joins over a WebSocket and says who it is — a session token, or none: anyone with a map's link may read
it. Each worker tells the others what it holds through a Postgres notification on one channel, so a map's presence
is the same whichever worker a browser reached; a worker that stops speaking is forgotten after ``STALE`` seconds.
A signed-in person is shown by the name their comments carry; anyone else is counted, never named. The owner may
have the map open in several windows: one edits — the one that claimed it last — and the others are told, and may
take it over. The lock is advisory: the save's revision check (P8.1-E) still refuses a save over a newer one.

Anyone may open a window, so each is admitted against limits before it says hello (security review L7): windows on a
map, windows one address holds, windows it opens in a minute, windows the worker holds in all. A worker's word to the
others fits one Postgres notification (8000 bytes): guests travel as a count, and past what fits a signed-in window is
counted rather than named — the presence never silently stops.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import time
import uuid
from collections import deque
from dataclasses import asdict, dataclass
from typing import Any

import psycopg
from fastapi import WebSocket, WebSocketDisconnect

from . import accounts, shared_maps
from .clients import client_key
from .refusal import Refusal
from .settings import get_settings

CHANNEL = "jadhr_presence"
WORKER = uuid.uuid4().hex[:12]
HEARTBEAT = 15.0
STALE = 45.0
MAX_PER_MAP = 200  # windows on one map, on this worker, counted from the moment one connects
PER_ADDRESS = 20  # windows one address holds open on this worker
JOINS_PER_MINUTE = 60  # windows one address opens in a minute
MAX_SOCKETS = 4000  # windows this worker holds in all
NOTIFY_BYTES = 7800  # one notification carries 8000 bytes
NAME_CHARS = 60


@dataclass
class Entry:
    conn: str
    user: str | None
    name: str | None
    owner: bool
    editing: bool
    claimed: float


class Hub:
    """This worker's sockets by map, what the other workers last said they hold, and the tasks that listen and beat."""

    def __init__(self) -> None:
        self.local: dict[str, dict[str, Entry]] = {}
        self.sockets: dict[str, dict[str, WebSocket]] = {}
        # another worker's windows on a map: when it last spoke, its named windows, and how many others
        self.remote: dict[str, dict[str, tuple[float, list[dict[str, Any]], int]]] = {}
        self.tasks: list[asyncio.Task[None]] = []
        self.leaving: set[asyncio.Task[None]] = set()
        # the windows open now, hello said or not: by map, by address, in all; and when each address opened its last
        self.open: dict[str, int] = {}
        self.by_address: dict[str, int] = {}
        self.joins: dict[str, deque[float]] = {}
        self.total = 0

    # ─── room for a window ─────────────────────────────────────────────────────

    def admit(self, gid: str, address: str) -> str | None:
        """Room for one more window — on the map, for the address, on this worker — or why there is none."""
        now = time.monotonic()
        q = self.joins.setdefault(address, deque())
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= JOINS_PER_MINUTE or self.by_address.get(address, 0) >= PER_ADDRESS:
            return "Too many windows from here."
        if self.total >= MAX_SOCKETS:
            return "Too many windows; try again later."
        if self.open.get(gid, 0) >= MAX_PER_MAP:
            return "Too many windows on this map."
        q.append(now)
        self.open[gid] = self.open.get(gid, 0) + 1
        self.by_address[address] = self.by_address.get(address, 0) + 1
        self.total += 1
        return None

    def release(self, gid: str, address: str) -> None:
        for counts, key in ((self.open, gid), (self.by_address, address)):
            counts[key] = counts.get(key, 1) - 1
            if counts[key] <= 0:
                del counts[key]
        self.total = max(0, self.total - 1)
        # an address is kept only while it counts towards the minute or holds a window
        now = time.monotonic()
        for a in [
            a for a, q in self.joins.items() if a not in self.by_address and (not q or now - q[-1] > 60)
        ]:
            del self.joins[a]

    # ─── what a map's presence is ──────────────────────────────────────────────

    def entries(self, gid: str) -> list[dict[str, Any]]:
        now = time.monotonic()
        mine = [asdict(e) for e in self.local.get(gid, {}).values()]
        theirs = [e for ts, es, _ in self.remote.get(gid, {}).values() if now - ts < STALE for e in es]
        return mine + theirs

    def counted(self, gid: str) -> int:
        """The other workers' windows counted and not named: their guests, and what did not fit their word."""
        now = time.monotonic()
        return sum(n for ts, _, n in self.remote.get(gid, {}).values() if now - ts < STALE)

    def payload(self, gid: str, conn: str) -> dict[str, Any]:
        """What one window is told: the people there (each once, however many windows), how many others, and who
        edits — this window, another, or none."""
        es = self.entries(gid)
        me = next((e for e in es if e["conn"] == conn), None)
        editing = [e for e in es if e["owner"] and e["editing"]]
        editor = max(editing, key=lambda e: (e["claimed"], e["conn"])) if editing else None
        people: dict[str, dict[str, Any]] = {}
        for e in es:
            if not e["user"]:
                continue
            p = people.setdefault(
                e["user"],
                {
                    "name": e["name"],
                    "owner": e["owner"],
                    "you": bool(me and me["user"] == e["user"]),
                    "windows": 0,
                },
            )
            p["windows"] += 1
            if editor and editor["conn"] == e["conn"]:
                p["editing"] = True
        return {
            "type": "presence",
            "people": sorted(people.values(), key=lambda p: (not p["you"], not p["owner"], p["name"] or "")),
            "guests": sum(1 for e in es if not e["user"]) + self.counted(gid),
            "editor": None if not editor else "you" if editor["conn"] == conn else "elsewhere",
        }

    async def changed(self, gid: str) -> None:
        for ws in list(self.sockets.get(gid, {}).values()):
            with contextlib.suppress(Exception):
                await ws.send_json({"type": "changed"})

    async def broadcast(self, gid: str) -> None:
        for conn, ws in list(self.sockets.get(gid, {}).items()):
            with contextlib.suppress(Exception):
                await ws.send_json(self.payload(gid, conn))

    # ─── between workers ───────────────────────────────────────────────────────

    def message(self, gid: str) -> str:
        """This worker's word on a map, within one notification: the owner's windows each (the lock needs them), the
        signed-in by name while they fit, everyone else as a count. An empty list and no count when none is left."""
        es = [asdict(e) for e in self.local.get(gid, {}).values()]
        named = sorted((e for e in es if e["user"]), key=lambda e: not e["owner"])
        n = len(es) - len(named)

        def say() -> str:
            return json.dumps({"w": WORKER, "g": gid, "e": named, "n": n}, ensure_ascii=False)

        body = say()
        while len(body.encode()) > NOTIFY_BYTES and named and not named[-1]["owner"]:
            named.pop()
            n += 1
            body = say()
        return body

    async def publish(self, gid: str) -> None:
        """Tell the other workers what this one holds on a map (an empty list when its last window left)."""
        body = self.message(gid)

        def notify() -> None:
            with accounts.tx() as c:
                accounts.q(c, "select pg_notify(:ch, :body) as sent", {"ch": CHANNEL, "body": body})

        with contextlib.suppress(Exception):
            await asyncio.to_thread(notify)

    async def heard(self, raw: str) -> None:
        """Another worker's word on a map: kept with the time it came, and passed to this worker's windows. Or the
        map's content changed (a comment, a lesson's proposal or activity, B47): its windows are told to look again."""
        try:
            m = json.loads(raw)
            if m.get("k") == "changed":
                await self.changed(str(m["g"]))
                return
            w, gid, es, n = str(m["w"]), str(m["g"]), list(m["e"]), int(m.get("n", 0))
        except (ValueError, KeyError, TypeError, AttributeError):
            return
        if w == WORKER:
            return
        by = self.remote.setdefault(gid, {})
        if es or n:
            by[w] = (time.monotonic(), es, n)
        else:
            by.pop(w, None)
        if gid in self.sockets:
            await self.broadcast(gid)

    async def listen(self) -> None:
        url = get_settings().database_url.replace("+psycopg", "")
        while True:
            try:
                async with await psycopg.AsyncConnection.connect(url, autocommit=True) as conn:
                    await conn.execute(f"listen {CHANNEL}")
                    async for n in conn.notifies():
                        await self.heard(n.payload)
            except asyncio.CancelledError:
                raise
            except Exception:  # the database restarted, or is not reachable yet: try again shortly
                await asyncio.sleep(3)

    async def beat(self) -> None:
        """Every so often: say again what this worker holds, and let go of workers that stopped speaking."""
        while True:
            await asyncio.sleep(HEARTBEAT)
            for gid in list(self.local):
                await self.publish(gid)
            now = time.monotonic()
            for gid, by in list(self.remote.items()):
                gone = [w for w, (ts, _, _) in by.items() if now - ts >= STALE]
                for w in gone:
                    del by[w]
                if gone and gid in self.sockets:
                    await self.broadcast(gid)

    def start(self) -> None:
        """The listener and the heartbeat, once per event loop (a test client may run several in turn)."""
        loop = asyncio.get_running_loop()
        if not self.tasks or any(t.done() or t.get_loop() is not loop for t in self.tasks):
            self.tasks = [loop.create_task(self.listen()), loop.create_task(self.beat())]

    # ─── a window ──────────────────────────────────────────────────────────────

    async def join(self, gid: str, ws: WebSocket, e: Entry) -> None:
        self.local.setdefault(gid, {})[e.conn] = e
        self.sockets.setdefault(gid, {})[e.conn] = ws
        await self.publish(gid)
        await self.broadcast(gid)

    async def leave(self, gid: str, conn: str) -> None:
        self.local.get(gid, {}).pop(conn, None)
        self.sockets.get(gid, {}).pop(conn, None)
        if not self.local.get(gid):
            self.local.pop(gid, None)
            self.sockets.pop(gid, None)
        await self.publish(gid)
        await self.broadcast(gid)


hub = Hub()


def _who(token: Any) -> dict[str, Any] | None:
    if not isinstance(token, str) or not token or len(token) > 200:
        return None
    return accounts.optional_user(f"Bearer {token}")


def _owner_of(gid: str) -> str:
    with accounts.tx() as conn:
        return str(shared_maps._graph(conn, shared_maps._uuid(gid))["owner_id"])


def _may_join(gid: str, u: dict[str, Any] | None) -> bool:
    """A lesson's map is joined by its class only (P9.3)."""
    try:
        shared_maps.may_join(gid, u)
        return True
    except Refusal:
        return False


async def serve(ws: WebSocket, gid: str) -> None:
    """One window on a shared map, admitted within the limits (module docstring) and counted until it closes."""
    await ws.accept()
    address = client_key(ws)
    why = hub.admit(gid, address)
    if why:
        await ws.close(code=4429, reason=why)
        return
    try:
        await _serve(ws, gid)
    finally:
        hub.release(gid, address)


async def _serve(ws: WebSocket, gid: str) -> None:
    """One window on a shared map: its hello (who it is, whether it edits), then its claims, until it closes."""
    try:
        owner = await asyncio.to_thread(_owner_of, gid)
    except Refusal:
        await ws.close(code=4404, reason="This map is not shared.")
        return
    try:
        hello = await asyncio.wait_for(ws.receive_json(), timeout=10)
    except (TimeoutError, WebSocketDisconnect, ValueError):
        with contextlib.suppress(Exception):
            await ws.close(code=4400, reason="Say hello first.")
        return
    if not isinstance(hello, dict) or hello.get("type") != "hello":
        await ws.close(code=4400, reason="Say hello first.")
        return
    u = await asyncio.to_thread(_who, hello.get("token"))
    if not await asyncio.to_thread(_may_join, gid, u):
        await ws.close(code=4404, reason="This map is a class's.")
        return
    is_owner = bool(u and str(u["id"]) == owner)
    editing = is_owner and bool(hello.get("editing"))
    # a window opened while another of the owner's already edits waits to be asked; the first one claims at once
    others = [x for x in hub.entries(gid) if x["owner"] and x["editing"]]
    e = Entry(
        conn=uuid.uuid4().hex[:16],
        user=str(u["id"]) if u else None,
        name=(u.get("display_name") or "")[:NAME_CHARS] or None if u else None,
        owner=is_owner,
        editing=editing,
        claimed=time.time() if editing and not others else 0.0,
    )
    hub.start()
    await hub.join(gid, ws, e)
    try:
        while True:
            m = await ws.receive_json()
            if not isinstance(m, dict):
                continue
            if m.get("type") == "take" and e.owner:
                e.editing, e.claimed = True, time.time()
            elif m.get("type") == "editing" and e.owner:
                e.editing = bool(m.get("on"))
            else:
                continue
            await hub.publish(gid)
            await hub.broadcast(gid)
    except (WebSocketDisconnect, ValueError, RuntimeError):
        pass
    finally:
        # the window's leaving is told even when its handler is being cancelled (a server stopping, a test client
        # closing): it runs as a task of its own
        leaving = asyncio.get_running_loop().create_task(hub.leave(gid, e.conn))
        hub.leaving.add(leaving)
        leaving.add_done_callback(hub.leaving.discard)
        with contextlib.suppress(asyncio.CancelledError):
            await asyncio.shield(leaving)


def tell_changed(conn: Any, gid: Any) -> None:
    """Within a writing transaction: every worker tells its windows on the map, once the change is committed, that the
    map's comments or its lesson's proposals and activity changed (B47). Nothing is kept."""
    accounts.q(
        conn,
        "select pg_notify(:ch, :body) as sent",
        {"ch": CHANNEL, "body": json.dumps({"k": "changed", "g": str(gid)})},
    )
