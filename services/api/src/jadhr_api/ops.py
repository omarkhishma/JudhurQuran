"""Monitoring and error tracking (PLAN P12), with nothing about anyone.

* ``record`` counts an error by day — where (a page's address with its ids taken out, or the API's route), what (its
  kind and message), in which release — the web's error pages and the API's unhandled exceptions send theirs;
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
import time
import urllib.request
from typing import Any

from sqlalchemy import text

from .accounts import q, tx

KEEP_DAYS = 30
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


def place_of(raw: str) -> str:
    """A page's address as recorded: its path alone, the reader's own ids taken out."""
    path = raw.split("?")[0].split("#")[0][:200]
    for pat, rep in _IDS:
        path = pat.sub(rep, path)
    return path


def record(source: str, kind: str, message: str, place: str, release: str = "") -> None:
    with tx() as conn:
        conn.execute(
            text(
                """insert into ops.errors (day, source, kind, message, place, release)
                   values (current_date, :s, :k, :m, :p, :r)
                   on conflict (day, source, kind, message, place, release)
                   do update set count = ops.errors.count + 1, last_at = now()"""
            ),
            {"s": source, "k": kind[:80], "m": message[:300], "p": place_of(place), "r": release[:20]},
        )


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
            print(f"{r['count']:>6}  {r['source']:<7} {r['kind']:<24} {r['place']:<40} {r['message'][:80]}")
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
