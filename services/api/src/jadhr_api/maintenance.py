"""Maintenance from the command line.

    uv run python -m jadhr_api.maintenance reapply-deletions

After a backup of the account schema is restored (docs/DEPLOY.md), the accounts deleted since that backup are
deleted again: their ids alone are kept fifteen days for this (P6.5, audit 11 F4), one day longer than any backup.
"""

from __future__ import annotations

import sys

from sqlalchemy import text

from .accounts import q, tx
from .contrib import forget
from .published import forget as forget_published
from .shared_maps import forget as forget_maps


def reapply_deletions() -> int:
    with tx() as conn:
        ids = [r["user_id"] for r in q(conn, "select user_id from accounts.deleted_accounts")]
        n = 0
        for uid in ids:
            forget(conn, uid)
            forget_maps(conn, uid)
            forget_published(conn, uid)
            n += conn.execute(text("delete from accounts.users where id = :u"), {"u": uid}).rowcount
    return n


def main() -> None:
    if sys.argv[1:] != ["reapply-deletions"]:
        print(__doc__)
        sys.exit(2)
    print(f"deleted again: {reapply_deletions()} account(s)")


if __name__ == "__main__":
    main()
