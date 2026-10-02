"""``uv run python -m jadhr_pipeline.knowledge build OUT_DIR`` · ``… fetch-wikidata``."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from . import build_knowledge
from .entities import fetch_wikidata, pn_candidates

REPO = Path(__file__).resolve().parents[4]
DATASET_VERSION = "2026.10.0"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m jadhr_pipeline.knowledge")
    sub = p.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="build the knowledge tables as JSONL into OUT_DIR")
    b.add_argument("out", type=Path)
    b.add_argument("--raw", type=Path, default=REPO / "data/raw")
    b.add_argument("--build-dir", type=Path, default=REPO / "data/build" / DATASET_VERSION)
    b.add_argument("--registry", type=Path, default=REPO / "data/knowledge.yaml")
    f = sub.add_parser("fetch-wikidata", help="refresh the pinned Wikidata responses (network)")
    f.add_argument("--raw", type=Path, default=REPO / "data/raw")
    f.add_argument("--build-dir", type=Path, default=REPO / "data/build" / DATASET_VERSION)
    args = p.parse_args(argv)

    if args.cmd == "fetch-wikidata":
        out = args.raw / "wikidata-quran-entities"
        print(json.dumps(fetch_wikidata(pn_candidates(args.build_dir), out), ensure_ascii=False))
        print(f"now update the sha256 pins of {out} in data/knowledge.yaml", file=sys.stderr)
        return 0

    t = time.time()
    tables, report = build_knowledge(args.raw, args.build_dir, args.registry)
    args.out.mkdir(parents=True, exist_ok=True)
    for name, rows in tables.items():
        with (args.out / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
    report["seconds"] = round(time.time() - t, 1)
    (args.out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(
        json.dumps(
            {"out": str(args.out), **report["counts"], "seconds": report["seconds"]}, ensure_ascii=False
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
