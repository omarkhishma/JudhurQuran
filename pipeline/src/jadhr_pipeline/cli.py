"""Pipeline command line: ``uv run jadhr-pipeline build``."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .build import RawPaths, build
from .layers import build_layers
from .pins import verify_source_pins

REPO = Path(__file__).resolve().parents[3]
DATASET_VERSION = "2026.10.0"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="jadhr-pipeline")
    sub = parser.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="build the canonical dataset into data/build/<version>")
    b.add_argument("--raw", type=Path, default=REPO / "data/raw")
    b.add_argument("--out", type=Path, default=None)
    b.add_argument("--version", default=DATASET_VERSION)
    args = parser.parse_args(argv)

    if args.cmd == "build":
        out = args.out or REPO / "data/build" / args.version
        t = time.time()
        pins = verify_source_pins(args.raw, REPO / "data/sources.yaml")  # raises on any drift
        report = build(
            RawPaths.default(
                args.raw,
                REPO / "data/works.yaml",
                REPO / "data/lexica.yaml",
                REPO / "data/recitations.yaml",
                glossary=REPO / "data/glossary.yaml",
                registry_dir=REPO / "data/registry",
            ),
            out,
            args.version,
        )
        layers = build_layers(
            args.raw,
            out,
            REPO / "data/knowledge.yaml",
            REPO / "data/relations.yaml",
            REPO / "data/patterns.yaml",
            REPO / "data/gharib.yaml",
            REPO / "data/lexica.yaml",
            REPO / "data/particles.yaml",
        )
        print(
            json.dumps(
                {
                    "out": str(out),
                    "seconds": round(time.time() - t, 1),
                    "pins_verified": len(pins["verified"]),
                    "unpinned": pins["unpinned"],
                    **report["counts"],
                    **layers,
                },
                ensure_ascii=False,
            )
        )
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
