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
        with tx() as conn:
            got = q(conn, "select * from ops.errors where place = :p", {"p": f"/api/v1/_boom/{tag}"})
        assert [(x["source"], x["kind"]) for x in got] == [("api", "RuntimeError")]
        # its message is never kept: a database error's carries the statement's values (security review L11)
        assert tag not in got[0]["message"] and "boom" not in got[0]["message"]
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


def test_what_could_be_a_readers_is_taken_out_of_a_message() -> None:
    """Security review L11: the message's shape kept, what it quotes and any address, query or long number gone."""
    assert ops.scrub("Unexpected token 'ع', \"عن العلم أصل\" is not valid JSON") == (
        "Unexpected token 'ع', \"…\" is not valid JSON"
    )
    assert (
        ops.scrub("failed for reader@example.org at /me?tab=x, id 1234567")
        == "failed for <address> at /me id <n>"
    )
    assert ops.scrub("bad\x1b[31m red \u202e evil") == "bad [31m red   evil"
    assert ops.place_of("/x\x1b[2J") == "?" and ops.place_of("<script>") == "?"
    assert ops.place_of("/roots/%D8%B9?q=1") == "/roots/%D8%B9"


def test_reports_are_bounded_by_kind_place_day_and_address(monkeypatch: object) -> None:
    """Security review L5: anyone may report, so a kind must be a name and a place a path; past ``ROWS_A_DAY`` kinds a
    day the rest are counted in one row; an address sends ``REPORTS_A_MINUTE`` a minute, the rest dropped."""
    import pytest

    mp = pytest.MonkeyPatch()
    tag = uuid.uuid4().hex[:8]
    try:
        ops.record("web", "<img onerror>", f"odd {tag}", "/")
        assert _rows(tag)[0]["kind"] == "Error"
        with tx() as conn:
            kept = conn.execute(
                text("select count(*) from ops.errors where day = current_date and source = 'web'")
            ).scalar_one()
        mp.setattr(ops, "ROWS_A_DAY", kept)
        ops.record(
            "web", "TypeError", f"new {tag}", "/"
        )  # a new kind past the day's rows: counted as overflow
        ops.record("web", "Error", f"odd {tag}", "/")  # a kind already kept still counts as itself
        assert [r["count"] for r in _rows(f"odd {tag}")] == [2] and _rows(f"new {tag}") == []
        with tx() as conn:
            over = q(
                conn,
                "select * from ops.errors where day = current_date and source = 'web' and kind = 'overflow'",
            )
        assert len(over) == 1 and over[0]["place"] == "*"
        mp.setattr(ops, "ROWS_A_DAY", 10_000)
        mp.setattr(ops, "REPORTS_A_MINUTE", 2)
        mp.setattr(ops, "_reports", {})
        client = TestClient(app)
        for _ in range(3):
            body = {"kind": "TypeError", "message": f"burst {tag}", "place": "/"}
            assert client.post("/api/v1/ops/errors", json=body).status_code == 204
        assert [r["count"] for r in _rows(f"burst {tag}")] == [2]
    finally:
        mp.undo()
        with tx() as conn:
            conn.execute(
                text("delete from ops.errors where message like :t or kind = 'overflow'"), {"t": f"%{tag}%"}
            )
