"""Pipeline command line: ``uv run judhur-pipeline build``."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .build import RawPaths, build

REPO = Path(__file__).resolve().parents[3]
DATASET_VERSION = "2026.10.0"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="judhur-pipeline")
    sub = parser.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="build the canonical dataset into data/build/<version>")
    b.add_argument("--raw", type=Path, default=REPO / "data/raw")
    b.add_argument("--out", type=Path, default=None)
    b.add_argument("--version", default=DATASET_VERSION)
    args = parser.parse_args(argv)

    if args.cmd == "build":
        out = args.out or REPO / "data/build" / args.version
        t = time.time()
        report = build(
            RawPaths.default(args.raw, REPO / "data/works.yaml", REPO / "data/lexica.yaml"), out, args.version
        )
        print(
            json.dumps(
                {"out": str(out), "seconds": round(time.time() - t, 1), **report["counts"]},
                ensure_ascii=False,
            )
        )
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
