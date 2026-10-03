"""Grant a role, or block an account, from the command line — the first administrator or editor, before anyone can
do it in the app.

uv run python -m jadhr_api.roles <email> <member|reviewer|editor|instructor|admin> [reason]
uv run python -m jadhr_api.roles block <email> [reason]
uv run python -m jadhr_api.roles unblock <email> [reason]
"""

from __future__ import annotations

import sys

from .contrib import block, grant


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    reason = " ".join(sys.argv[3:]) or None
    if sys.argv[1] in ("block", "unblock"):
        out = block(None, sys.argv[2], sys.argv[1] == "block", reason)
        print(f"{sys.argv[2]} is now {'blocked' if out['blocked'] else 'unblocked'}")
        return
    out = grant(None, sys.argv[1], sys.argv[2], reason)
    print(f"{out['email']} is now {out['role']}")


if __name__ == "__main__":
    main()
