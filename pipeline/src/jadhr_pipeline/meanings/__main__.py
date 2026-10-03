"""``uv run python -m jadhr_pipeline.meanings {gharib|mufradat} <out_dir>`` — write the P3.1 meaning tables as
JSONL, with their build report (``gharib_report.json`` / ``mufradat_report.json``)."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from . import build_gharib, build_mufradat, write_tables

REPO = Path(__file__).resolve().parents[4]
DATASET_VERSION = "2026.10.0"
REGISTRIES = {"gharib": REPO / "data/gharib.yaml", "mufradat": REPO / "data/lexica.yaml"}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m jadhr_pipeline.meanings", description=__doc__)
    ap.add_argument(
        "which", choices=sorted(REGISTRIES), help="gharib (KFGQPC al-Muyassar) or mufradat (al-Raghib)"
    )
    ap.add_argument("out_dir", type=Path, help="directory for the *.jsonl tables and the report")
    ap.add_argument("--raw", type=Path, default=REPO / "data/raw", help="data/raw (licensed downloads)")
    ap.add_argument(
        "--build", type=Path, default=REPO / "data/build" / DATASET_VERSION, help="a dataset build directory"
    )
    ap.add_argument(
        "--registry", type=Path, default=None, help="registry (default: data/gharib.yaml or data/lexica.yaml)"
    )
    args = ap.parse_args(argv)
    registry = args.registry or REGISTRIES[args.which]
    t = time.time()
    builder = build_gharib if args.which == "gharib" else build_mufradat
    tables, report = builder(args.raw, args.build, registry)
    write_tables(tables, report, args.out_dir, f"{args.which}_report.json")
    print(
        json.dumps(
            {
                "out": str(args.out_dir),
                "seconds": round(time.time() - t, 1),
                "rows": {k: len(v) for k, v in tables.items()},
                **report["totals"],
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
