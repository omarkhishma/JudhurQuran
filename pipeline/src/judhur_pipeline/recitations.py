"""Recitations: reciter registry + word timings mapped onto the KFGQPC display tokens.

quran-align segments are ``[word_start, word_end_exclusive, start_ms, end_ms]`` with 0-based indices
into the Tanzil verse tokens (no embedded basmala). They are mapped token by token onto the display
tokens through an exact alignment (Tanzil and KFGQPC share the letter stream; three KFGQPC tokens
fuse two Tanzil tokens). A display token's time is the union of its Tanzil tokens' segments.
"""

from __future__ import annotations

import hashlib
import io
import json
import zipfile
from pathlib import Path
from typing import Any

import yaml

from judhur_arabic import normalize

from .align import align

ZIP_PREFIX = ""


def _key(t: str) -> str:
    return normalize(t).replace(" ", "").replace("ء", "")


def build_recitations(
    raw: Path,
    registry: Path,
    verses: dict[tuple[int, int], tuple[int, list[str], list[str]]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """``verses`` maps (surah, ayah) → (verse_id, tanzil_tokens, display_tokens)."""
    cfg = yaml.safe_load(registry.read_text(encoding="utf-8"))
    zpath = raw / cfg["timings_zip"]
    blob = zpath.read_bytes()
    if hashlib.sha256(blob).hexdigest() != cfg["timings_zip_sha256"]:
        raise ValueError(f"{zpath.name}: sha256 differs from data/recitations.yaml")
    zf = zipfile.ZipFile(io.BytesIO(blob))
    names = {Path(n).name: n for n in zf.namelist()}

    # Tanzil token index (0-based) → display token position (1-based), per verse.
    maps: dict[tuple[int, int], dict[int, int]] = {}
    for k, (_, tz, disp) in verses.items():
        m: dict[int, int] = {}
        for g in align(tz, disp, _key):
            for i in g.left:
                m[i] = g.right[0] + 1
        maps[k] = m

    reciters_out: list[dict[str, Any]] = []
    timings_out: list[dict[str, Any]] = []
    report: dict[str, Any] = {}
    for order, r in enumerate(cfg["reciters"], start=1):
        text = zf.read(names[f"{r['folder']}.json"]).decode("utf-8")
        recovered = False
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # The upstream Sudais file starts with the aligner's crash log; the complete array follows it.
            data = json.loads(text[text.index("\n[") :])
            recovered = True
        if len(data) != len(verses):
            raise ValueError(f"{r['folder']}: {len(data)} timing items, expected {len(verses)}")
        mapped = 0
        unmapped = 0
        no_timing = 0
        malformed = 0
        for item in data:
            k = (int(item["surah"]), int(item["ayah"]))
            verse_id, _, disp = verses[k]
            m = maps[k]
            by_token: dict[int, list[int]] = {}
            segments = item.get("segments") or []
            if not segments:
                no_timing += 1  # the aligner could not time this verse; it still plays, without highlighting
            for seg in segments:
                if len(seg) != 4:
                    malformed += 1
                    continue
                start, end, t0, t1 = seg
                for idx in range(start, end):
                    pos = m.get(idx)
                    if pos is None:
                        unmapped += 1
                        continue
                    span = by_token.setdefault(pos, [t0, t1])
                    span[0], span[1] = min(span[0], t0), max(span[1], t1)
                    mapped += 1
            segs = [[pos, ms[0], ms[1]] for pos, ms in sorted(by_token.items())]
            timings_out.append({"reciter_id": r["id"], "verse_id": verse_id, "segments": segs})
        reciters_out.append(
            {
                "id": r["id"],
                "name_ar": r["name_ar"],
                "name_en": r["name_en"],
                "style": r["style"],
                "folder": r["folder"],
                "audio_url": cfg["audio_url"].replace("{folder}", r["folder"]),
                "is_default": bool(r.get("default")),
                "sort_order": order,
            }
        )
        report[r["id"]] = {
            "verses": len(data),
            "verses_without_timing": no_timing,
            "malformed_segments": malformed,
            "token_timings": mapped,
            "unmapped_indices": unmapped,
            "recovered_after_crash_log": recovered,
        }
    return reciters_out, timings_out, report
