"""``uv run python -m jadhr_embed fetch [model]`` — the model's pinned files into data/tools/models (once);
``… verify [model]`` — check them; ``… serve [--port 8010]`` — the service (internal; no access log)."""

from __future__ import annotations

import argparse
import sys

from .models import MODELS, chosen


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="jadhr_embed")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("fetch", "verify"):
        s = sub.add_parser(name)
        s.add_argument("model", nargs="?", choices=sorted(MODELS))
    s = sub.add_parser("serve")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8010)
    a = p.parse_args(argv)
    if a.cmd in ("fetch", "verify"):
        spec = MODELS[a.model] if a.model else chosen()
        if a.cmd == "fetch":
            from .fetch import fetch

            print(fetch(spec))
        else:
            from .encoder import verify

            print(verify(spec))
        return 0
    import uvicorn

    uvicorn.run("jadhr_embed.server:app", host=a.host, port=a.port, access_log=False, workers=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
