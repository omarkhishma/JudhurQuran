"""Monitoring and error tracking (PLAN P12), with nothing about anyone.

* ``record`` counts an error by day — where (a page's address with its ids taken out, or the API's route), what (its
  kind and message), in which release — the web's error pages and the API's unhandled exceptions send theirs. What
  could hold a reader's words is taken out first: an API error is kept as its type and its place in our code, never
  its message (a database error's carries the statement's values); a page's message keeps its shape with what it
  quotes, any address, query string and long number taken out. Each source keeps at most ``ROWS_A_DAY`` kinds a day,
  the rest counted in one row, so reports sent by anyone cannot grow the table without bound (security review L5,
  L11);
* ``check`` asks the site for the pages a deploy's smoke check names and says which did not answer 200;
* ``watch`` checks every five minutes, records what failed (source ``monitor``) and, when ``JADHR_ALERT_WEBHOOK`` is
  set, posts a line to it;
* ``purge`` removes what is older than thirty days — the privacy page's period.

    uv run python -m jadhr_api.ops errors [days]     # what went wrong, most frequent first
    uv run python -m jadhr_api.ops check <base url>  # the smoke check; exits 1 when a page failed
    uv run python -m jadhr_api.ops watch <base url>  # the monitor's loop
"""

from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
import urllib.request
from collections import deque
from typing import Any

from sqlalchemy import text

from .accounts import q, tx

KEEP_DAYS = 30
ROWS_A_DAY = 500  # kinds of error one source keeps a day; past it, one row counts the rest
OVERFLOW = ("overflow", "more kinds of error than are kept a day", "*")
# the pages a deploy's smoke check asks for (docs/DEPLOY.md): every one must answer 200
SMOKE = [
    "/",
    "/about",
    "/quran/2/255",
    "/word/2:255:23",
    "/roots/%D8%B9%D9%84%D9%85",
    "/en/word/1:1:1",
    "/search?q=%D8%B5%D8%A8%D8%B1",
    "/dictionary/%D8%B9%D9%84%D9%85",
    "/hadith/bukhari/1",
    "/api/v1/meta",
    "/sitemap/core.xml",
    "/robots.txt",
]
_IDS = [
    (re.compile(r"^(/(?:en/)?library/text/)[^/]+"), r"\1:id"),
    (re.compile(r"^(/(?:en/)?graph/edit/)[^/]+"), r"\1:id"),
    (re.compile(r"^(/(?:en/)?classroom/)[^/]+"), r"\1:id"),
    (re.compile(r"^(/(?:en/)?auth/verify).*"), r"\1"),
]


# control characters, and the direction controls that reorder a line on a terminal or a page
_CONTROLS = re.compile("[\x00-\x1f\x7f-\x9f\u200e\u200f\u202a-\u202e\u2066-\u2069]")
_KIND = re.compile(r"[A-Za-z][A-Za-z0-9_.]{0,79}")
_PLACE = re.compile(r"/[A-Za-z0-9_\-./:%~]*")
_SCRUB = [
    (re.compile(r'"[^"]*"|“[^”]*”|«[^»]*»'), '"…"'),  # what a message quotes: a value, a reader's text
    (re.compile(r"'[^']{2,}'"), "'…'"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "<address>"),
    (re.compile(r"[?#][^\s]*"), ""),  # a query string or a fragment
    (re.compile(r"\d{5,}"), "<n>"),
]


def place_of(raw: str) -> str:
    """A page's address as recorded: its path alone, the reader's own ids taken out; anything else is "?"."""
    path = raw.split("?")[0].split("#")[0][:200]
    for pat, rep in _IDS:
        path = pat.sub(rep, path)
    return path if _PLACE.fullmatch(path) else "?"


def scrub(message: str) -> str:
    """A message with its shape kept and what could be a reader's taken out."""
    message = _CONTROLS.sub(" ", message)
    for pat, rep in _SCRUB:
        message = pat.sub(rep, message)
    return message.strip()[:300]


def where_of(exc: BaseException) -> str:
    """An API error's place in our own code — its innermost frame in jadhr_api — and the database's own error type
    when the database raised it: what a fix needs, and nothing a request carried."""
    frame = None
    tb = exc.__traceback__
    while tb is not None:
        if "jadhr_api" in tb.tb_frame.f_code.co_filename:
            frame = tb
        tb = tb.tb_next
    where = ""
    if frame is not None:
        name = frame.tb_frame.f_code.co_filename.split("jadhr_api/")[-1]
        where = f"{name}:{frame.tb_lineno} {frame.tb_frame.f_code.co_name}"
    orig = getattr(exc, "orig", None)
    return f"{where} ({type(orig).__module__}.{type(orig).__name__})" if orig is not None else where


def record(source: str, kind: str, message: str, place: str, release: str = "") -> None:
    kind = kind if _KIND.fullmatch(kind) else "Error"
    row = {
        "s": source,
        "k": kind,
        "m": scrub(message),
        "p": place_of(place),
        "r": _CONTROLS.sub("", release)[:20],
    }
    with tx() as conn:
        kept = conn.execute(
            text("select count(*) from ops.errors where day = current_date and source = :s"), {"s": source}
        ).scalar_one()
        known = conn.execute(
            text(
                """select 1 from ops.errors where day = current_date and source = :s and kind = :k and message = :m
                   and place = :p and release = :r"""
            ),
            row,
        ).first()
        if kept >= ROWS_A_DAY and not known:
            row.update(zip(("k", "m", "p"), OVERFLOW, strict=True), r="")
        conn.execute(
            text(
                """insert into ops.errors (day, source, kind, message, place, release)
                   values (current_date, :s, :k, :m, :p, :r)
                   on conflict (day, source, kind, message, place, release)
                   do update set count = ops.errors.count + 1, last_at = now()"""
            ),
            row,
        )


REPORTS_A_MINUTE = 30  # a page's error reports one address sends a minute; the rest are dropped
_reports: dict[str, deque[float]] = {}
_REPORTS_LOCK = threading.Lock()


def reports_allowed(key: str) -> bool:
    """Whether one more report from this address fits its minute; the address is kept in memory for that minute only."""
    now = time.monotonic()
    with _REPORTS_LOCK:
        q = _reports.setdefault(key, deque())
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= REPORTS_A_MINUTE:
            return False
        q.append(now)
        if len(_reports) > 10_000:
            for k in [k for k, v in _reports.items() if not v or now - v[-1] > 60]:
                del _reports[k]
        return True


def purge() -> int:
    with tx() as conn:
        return conn.execute(
            text("delete from ops.errors where day < current_date - :d"), {"d": KEEP_DAYS}
        ).rowcount


def report(days: int = 7) -> list[dict[str, Any]]:
    with tx() as conn:
        return q(
            conn,
            """select source, kind, message, place, release, sum(count)::int as count, max(last_at) as last_at
                 from ops.errors where day >= current_date - :d
                group by source, kind, message, place, release order by count desc, last_at desc limit 100""",
            {"d": days},
        )


def check(base: str, timeout: float = 15) -> list[str]:
    """The smoke check: the paths that did not answer 200 without a redirect, each with what it answered."""
    failed = []
    for path in SMOKE:
        url = base.rstrip("/") + path
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, headers={"User-Agent": "jadhr-monitor"}), timeout=timeout
            ) as r:
                if r.status != 200 or r.geturl() != url:
                    failed.append(f"{path}: {r.status}{' (redirected)' if r.geturl() != url else ''}")
        # any failure is what the check reports
        except Exception as e:
            failed.append(f"{path}: {type(e).__name__} {str(e)[:120]}")
    return failed


def _alert(lines: list[str]) -> None:
    hook = os.environ.get("JADHR_ALERT_WEBHOOK")
    if not hook:
        return
    body = json.dumps({"text": "Jadhr: " + "; ".join(lines)[:1500]}).encode()
    try:
        urllib.request.urlopen(
            urllib.request.Request(hook, data=body, headers={"Content-Type": "application/json"}), timeout=15
        )
    # an alert that cannot be sent is logged, and the check goes on
    except Exception:
        print("alert not sent", file=sys.stderr)


def watch(base: str, every: int = 300) -> None:
    while True:
        failed = check(base)
        for f in failed:
            path, _, what = f.partition(": ")
            record("monitor", "smoke", what, path)
        if failed:
            print("failed:", failed, file=sys.stderr, flush=True)
            _alert(failed)
        time.sleep(every)


def main() -> None:
    args = sys.argv[1:]
    if args[:1] == ["errors"]:
        for r in report(int(args[1]) if len(args) > 1 else 7):
            # what was recorded has no control character; said again here, as a report may hold rows from before
            line = f"{r['count']:>6}  {r['source']:<7} {r['kind']:<24} {r['place']:<40} {r['message'][:80]}"
            print(_CONTROLS.sub(" ", line))
    elif args[:1] == ["check"] and len(args) == 2:
        failed = check(args[1])
        print("\n".join(failed) if failed else "all answered 200")
        sys.exit(1 if failed else 0)
    elif args[:1] == ["watch"] and len(args) == 2:
        watch(args[1])
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
