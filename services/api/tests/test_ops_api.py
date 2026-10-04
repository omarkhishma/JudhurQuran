"""Monitoring and error tracking (P12), with nothing about anyone: an error a page meets is counted by day — what,
where (the reader's own ids taken out), which release — and so is an error the API did not handle; the smoke check
names what did not answer 200; thirty days are kept."""

from __future__ import annotations

import threading
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer

from fastapi.testclient import TestClient
from jadhr_api import ops
from jadhr_api.accounts import q, tx
from jadhr_api.main import app
from sqlalchemy import text


def _rows(tag: str) -> list[dict]:
    with tx() as conn:
        return q(conn, "select * from ops.errors where message like :t", {"t": f"%{tag}%"})


def test_a_pages_error_is_counted_by_day_with_nothing_about_who() -> None:
    tag = uuid.uuid4().hex[:8]
    client = TestClient(app)
    for _ in range(2):
        r = client.post(
            "/api/v1/ops/errors",
            json={
                "kind": "TypeError",
                "message": f"x is undefined {tag}",
                "place": "/library/text/abc123?x=1#p2",
                "release": "2026.10.0",
            },
        )
        assert r.status_code == 204
    got = _rows(tag)
    assert len(got) == 1 and got[0]["count"] == 2
    assert got[0]["place"] == "/library/text/:id" and got[0]["source"] == "web"
    # the table holds no address, no account, no request
    with tx() as conn:
        cols = {
            r["column_name"]
            for r in q(
                conn,
                "select column_name from information_schema.columns where table_schema = 'ops' and table_name = 'errors'",
            )
        }
    assert cols == {"day", "source", "kind", "message", "place", "release", "count", "first_at", "last_at"}
    assert client.post("/api/v1/ops/errors", json={"kind": "", "place": "/"}).status_code == 422


def test_an_error_the_api_did_not_handle_is_counted_by_its_route() -> None:
    tag = uuid.uuid4().hex[:8]

    def boom() -> None:
        raise RuntimeError(f"boom {tag}")

    app.router.add_api_route(f"/api/v1/_boom/{tag}", boom)
    try:
        r = TestClient(app, raise_server_exceptions=False).get(f"/api/v1/_boom/{tag}")
        assert r.status_code == 500 and r.json()["error"]["code"] == "server_error"
        got = _rows(tag)
        assert [(x["source"], x["kind"], x["place"]) for x in got] == [
            ("api", "RuntimeError", f"/api/v1/_boom/{tag}")
        ]
    finally:
        app.router.routes[:] = [
            x for x in app.router.routes if getattr(x, "path", "") != f"/api/v1/_boom/{tag}"
        ]


def test_the_smoke_check_names_what_did_not_answer() -> None:
    class H(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            self.send_response(500 if self.path.startswith("/about") else 200)
            self.end_headers()
            self.wfile.write(b"ok")

        def log_message(self, *_: object) -> None:
            pass

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        failed = ops.check(f"http://127.0.0.1:{srv.server_port}")
    finally:
        srv.shutdown()
    assert [f.split(":")[0] for f in failed] == ["/about"]


def test_thirty_days_are_kept() -> None:
    tag = uuid.uuid4().hex[:8]
    with tx() as conn:
        conn.execute(
            text(
                "insert into ops.errors (day, source, kind, message, place) values (current_date - 31, 'web', 'E', :m, '/')"
            ),
            {"m": f"old {tag}"},
        )
        conn.execute(
            text(
                "insert into ops.errors (day, source, kind, message, place) values (current_date - 29, 'web', 'E', :m, '/')"
            ),
            {"m": f"recent {tag}"},
        )
    ops.purge()
    assert [r["message"] for r in _rows(tag)] == [f"recent {tag}"]
