"""``uv run python -m jadhr_pipeline.patterns_catalog <out_dir>`` — write the pattern catalog tables as JSONL."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from . import build_pattern_catalog, write_tables

REPO = Path(__file__).resolve().parents[4]
DATASET_VERSION = "2026.10.0"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m jadhr_pipeline.patterns_catalog", description=__doc__)
    ap.add_argument("out_dir", type=Path, help="directory for pattern_*.jsonl and patterns_report.json")
    ap.add_argument("--raw", type=Path, default=REPO / "data/raw", help="data/raw (licensed downloads)")
    ap.add_argument(
        "--build", type=Path, default=REPO / "data/build" / DATASET_VERSION, help="a dataset build directory"
    )
    ap.add_argument("--registry", type=Path, default=REPO / "data/patterns.yaml")
    args = ap.parse_args(argv)
    t = time.time()
    tables, report = build_pattern_catalog(args.raw, args.build, args.registry)
    write_tables(tables, report, args.out_dir)
    cov = report.get("coverage", {})
    summary = {
        "out": str(args.out_dir),
        "seconds": round(time.time() - t, 1),
        **report["totals"],
        "coverage_direct_or_base": cov.get("direct_or_base"),
    }
    print(json.dumps(summary, ensure_ascii=False))
    missing = [k for k, v in report["sources"].items() if v.get("status") == "missing-file"]
    if missing:
        print(f"missing source files: {missing}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
