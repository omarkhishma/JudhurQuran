"""Word boundaries refined against the recitation itself (P3.7, D10).

quran-align places the boundary between two words where its recogniser switched words; measured on 100
verses of al-Ḥuṣarī's teaching recitation, that point lies a median 40–60 ms before the quietest moment
between the words and sits more than 6 dB above it in 60% of cases, so a word cut there loses its last
sound and carries the next word's first. This tool moves every boundary between two consecutive words to
the quietest 10 ms frame near it — within ±150 ms, and never past the middle of either word — and records
how deep that dip is: a shallow dip means the reciter joins the two words (idghām, a carried vowel), so
the slice cannot be clean and the reader is told.

    uv run --extra audio python -m jadhr_pipeline.recitation_refine <audio_dir> <out.json> [--reciter ID]

``audio_dir`` holds the reciter's EveryAyah files (``SSSAAA.mp3``); ffmpeg decodes them. The output is
pinned by sha256 in data/recitations.yaml and read by the build; the audio itself is not kept.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import subprocess
import sys
import zipfile
from pathlib import Path
from typing import Any

import yaml

REPO = Path(__file__).resolve().parents[3]
SR = 16_000
FRAME_MS = 10
WINDOW_MS = 150
# words the aligner separates by more than this are not touching: the reciter paused between them, the
# aligner's edges already sit at the speech, and moving them would pull the silence into a word
TOUCHING_MS = 100
METHOD = (
    "boundary between consecutive single-word segments that touch (aligner gap ≤ 100 ms) moved to the "
    "lowest-energy 10 ms frame within ±150 ms of the aligner's boundary and inside the middle halves of "
    "the two words; depth = the two words' median frame energy minus the energy at that frame (dB); "
    "words separated by a pause keep the aligner's edges"
)


def _energy(path: Path) -> Any:
    import numpy as np

    pcm = subprocess.run(
        ["ffmpeg", "-v", "quiet", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    x = np.frombuffer(pcm, dtype=np.int16).astype(np.float32)
    hop = SR * FRAME_MS // 1000
    n = len(x) // hop
    frames = x[: n * hop].reshape(n, hop)
    return 10 * np.log10((frames**2).mean(axis=1) + 1e-6)


def refine_verse(segments: list[list[int]], e: Any) -> list[list[Any]]:
    """``segments`` are quran-align's ``[word_start, word_end_exclusive, start_ms, end_ms]``; returns them
    with refined times and, per segment, the dip depth at its start and its end (None where not refined)."""
    import numpy as np

    out: list[list[Any]] = [[*s, None, None] for s in segments]
    for i in range(len(out) - 1):
        a, b = out[i], out[i + 1]
        if a[1] - a[0] != 1 or b[1] - b[0] != 1 or a[1] != b[0]:
            continue  # only two single words that follow each other
        if b[2] - a[3] > TOUCHING_MS:
            continue  # a pause between them: keep the aligner's edges
        given = (a[3] + b[2]) // 2
        lo = max(given - WINDOW_MS, a[2] + (a[3] - a[2]) // 2)
        hi = min(given + WINDOW_MS, b[2] + (b[3] - b[2]) // 2)
        f0, f1 = lo // FRAME_MS, hi // FRAME_MS + 1
        if f1 - f0 < 3 or f1 > len(e):
            continue
        m = f0 + int(np.argmin(e[f0:f1]))
        t = m * FRAME_MS + FRAME_MS // 2
        body = np.concatenate(
            [e[a[2] // FRAME_MS : a[3] // FRAME_MS], e[b[2] // FRAME_MS : b[3] // FRAME_MS]]
        )
        depth = round(float(np.median(body) - e[m]), 1) if len(body) else None
        a[3], b[2] = t, t
        a[5], b[4] = depth, depth
    return out


def _timings(reciter: str) -> tuple[list[dict[str, Any]], str]:
    cfg = yaml.safe_load((REPO / "data/recitations.yaml").read_text(encoding="utf-8"))
    folder = next(r["folder"] for r in cfg["reciters"] if r["id"] == reciter)
    blob = (REPO / "data/raw" / cfg["timings_zip"]).read_bytes()
    if hashlib.sha256(blob).hexdigest() != cfg["timings_zip_sha256"]:
        raise ValueError("timings zip: sha256 differs from data/recitations.yaml")
    zf = zipfile.ZipFile(io.BytesIO(blob))
    name = next(n for n in zf.namelist() if Path(n).name == f"{folder}.json")
    return json.loads(zf.read(name)), folder


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="jadhr_pipeline.recitation_refine")
    p.add_argument("audio_dir", type=Path)
    p.add_argument("out", type=Path)
    p.add_argument("--reciter", default="husary-muallim")
    args = p.parse_args(argv)
    data, folder = _timings(args.reciter)
    verses: dict[str, list[list[Any]]] = {}
    audio_sha: dict[str, str] = {}
    missing: list[str] = []
    for n, item in enumerate(data, 1):
        key = f"{item['surah']}:{item['ayah']}"
        f = args.audio_dir / f"{item['surah']:03d}{item['ayah']:03d}.mp3"
        if not f.is_file() or f.stat().st_size == 0:
            missing.append(key)
            continue
        audio_sha[key] = hashlib.sha256(f.read_bytes()).hexdigest()
        verses[key] = refine_verse(item.get("segments") or [], _energy(f))
        if n % 500 == 0:
            print(f"{n}/{len(data)}", file=sys.stderr)
    depths = sorted(d for segs in verses.values() for s in segs for d in s[4:5] if d is not None)
    out = {
        "reciter": args.reciter,
        "folder": folder,
        "method": METHOD,
        "frame_ms": FRAME_MS,
        "window_ms": WINDOW_MS,
        "verses": verses,
        "audio_sha256": audio_sha,
        "missing_audio": missing,
        "stats": {
            "verses": len(verses),
            "boundaries_refined": len(depths),
            "depth_db_p10_p50_p90": [depths[int(len(depths) * q)] for q in (0.1, 0.5, 0.9)] if depths else [],
        },
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(out["stats"] | {"missing_audio": len(missing), "out": str(args.out)}))


if __name__ == "__main__":
    main()
