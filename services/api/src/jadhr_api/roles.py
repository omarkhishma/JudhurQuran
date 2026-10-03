"""Grant a role from the command line — the first administrator or editor, before anyone can do it in the app.

uv run python -m jadhr_api.roles <email> <member|reviewer|editor|instructor|admin> [reason]
"""

from __future__ import annotations

import sys

from .contrib import grant


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    out = grant(None, sys.argv[1], sys.argv[2], " ".join(sys.argv[3:]) or None)
    print(f"{out['email']} is now {out['role']}")


if __name__ == "__main__":
    main()
