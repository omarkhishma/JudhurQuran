"""Fetch tafsir editions from spa5k/tafsir_api at a pinned tag into data/raw/tafsir_api/<slug>.json.

Merged shape: {"source", "tag", "slug", "ayahs": [{"surah","ayah","text"}], "empty_ayahs": [...]}.
Re-running skips editions already complete. Network errors retry with backoff; a missing
``empty_ayahs.json`` (404) is normal.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

TAG = "v1.2.2"
BASE = f"https://raw.githubusercontent.com/spa5k/tafsir_api/{TAG}/tafsir"
AYAH_COUNTS = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6]  # fmt: skip


def _get(client: httpx.Client, url: str) -> httpx.Response:
    for attempt in range(6):
        try:
            r = client.get(url)
            if r.status_code in (200, 404):
                return r
        except httpx.HTTPError:
            pass
        time.sleep(2**attempt)
    raise RuntimeError(f"failed after retries: {url}")


def fetch(slug: str, out_dir: Path) -> Path:
    out = out_dir / f"{slug}.json"
    if out.exists():
        data = json.loads(out.read_text(encoding="utf-8"))
        if len(data["ayahs"]) + len(data["empty_ayahs"]) == sum(AYAH_COUNTS):
            return out
    ayahs: list[dict] = []
    empty: list[dict] = []
    with httpx.Client(
        timeout=60, headers={"User-Agent": "judhur-pipeline (research; contact via repo)"}
    ) as client:
        for s in range(1, 115):
            r = _get(client, f"{BASE}/{slug}/{s}.json")
            if r.status_code != 200:
                raise RuntimeError(f"{slug} surah {s}: HTTP {r.status_code}")
            body = r.json()
            items = body["ayahs"] if isinstance(body, dict) else body
            for it in items:
                ayahs.append({"surah": int(it["surah"]), "ayah": int(it["ayah"]), "text": it["text"]})
            er = _get(client, f"{BASE}/{slug}/{s}/empty_ayahs.json")
            if er.status_code == 200:
                for e in er.json():
                    empty.append(e if isinstance(e, dict) else {"surah": s, "ayah": int(e)})
            time.sleep(0.15)  # polite pacing
    out.write_text(
        json.dumps(
            {"source": "spa5k/tafsir_api", "tag": TAG, "slug": slug, "ayahs": ayahs, "empty_ayahs": empty},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return out


def main() -> int:
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    for slug in sys.argv[2:]:
        t = time.time()
        p = fetch(slug, out_dir)
        n = len(json.loads(p.read_text(encoding="utf-8"))["ayahs"])
        print(f"{slug}: {n} ayahs in {time.time() - t:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
