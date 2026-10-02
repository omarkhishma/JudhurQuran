"""Word-by-word English glosses and transliteration from the Quranic Arabic Corpus website.

The glosses are not in the downloadable morphology file; they exist only on the corpus's Word by Word
pages (https://corpus.quran.com/wordbyword.jsp). Terms: use is allowed "provided its source (the Quranic
Arabic Corpus) is clearly indicated, and a link is made to http://corpus.quran.com"; changing it is not
allowed. So the text is stored and shown verbatim, punctuation included (research 03 §6.2).

    uv run python -m jadhr_pipeline.corpus_wbw data/raw/qac-wbw      # fetch (resumable, polite)

Fetching keeps every page as served (``pages/CCC-VVV.html``, named by the first verse on the page), then
writes ``wbw.jsonl`` ({location, translit, gloss}) and ``SHA256SUMS.txt``. Parsing is strict: every page
must yield consecutive words, and the whole set must cover every verse of the mushaf exactly once.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import time
from pathlib import Path

import httpx

from .fetch_tafsir import AYAH_COUNTS

BASE = "https://corpus.quran.com/wordbyword.jsp"
USER_AGENT = "jadhr-dataset-build/1.0 (non-commercial Quran study site; polite fetch, 1 request per second)"
DELAY_SECONDS = 1.0

_ROW = re.compile(
    r'<tr><td><span class="location">\((\d+):(\d+):(\d+)\)</span><br/>(.*?)<br/>(.*?)</td><td class="ic">',
    re.S,
)
_TAG = re.compile(r"<[^>]+>")


def _text(fragment: str) -> str:
    return html.unescape(_TAG.sub("", fragment)).strip()


def parse_page(page: str) -> list[dict[str, str | int]]:
    """Rows of one Word by Word page, in page order."""
    out = []
    for c, v, w, translit, gloss in _ROW.findall(page):
        out.append(
            {
                "surah": int(c),
                "ayah": int(v),
                "word": int(w),
                "translit": _text(translit),
                "gloss": _text(gloss),
            }
        )
    return out


def _page_path(raw: Path, surah: int, ayah: int) -> Path:
    return raw / "pages" / f"{surah:03d}-{ayah:03d}.html"


def fetch(raw: Path) -> None:
    (raw / "pages").mkdir(parents=True, exist_ok=True)
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=60, follow_redirects=True) as client:
        for surah, count in enumerate(AYAH_COUNTS, start=1):
            ayah = 1
            while ayah <= count:
                path = _page_path(raw, surah, ayah)
                if not path.exists():
                    for attempt in range(6):
                        try:
                            r = client.get(BASE, params={"chapter": surah, "verse": ayah})
                            if r.status_code == 200 and "morphologyTable" in r.text:
                                break
                        except httpx.HTTPError:
                            pass
                        time.sleep(DELAY_SECONDS * 2**attempt)
                    else:
                        raise RuntimeError(f"failed after retries: {surah}:{ayah}")
                    path.write_text(r.text, encoding="utf-8")
                    time.sleep(DELAY_SECONDS)
                rows = [x for x in parse_page(path.read_text(encoding="utf-8")) if x["surah"] == surah]
                if not rows or rows[0]["ayah"] != ayah:
                    raise RuntimeError(f"page {path.name} does not start at {surah}:{ayah}")
                ayah = max(int(x["ayah"]) for x in rows) + 1
                print(f"{surah}:{ayah - 1}", flush=True)


def collect(raw: Path) -> list[dict[str, str]]:
    """All words in mushaf order; fails on any gap, duplicate or out-of-order word."""
    seen: dict[tuple[int, int, int], dict[str, str | int]] = {}
    for path in sorted((raw / "pages").glob("*.html")):
        for row in parse_page(path.read_text(encoding="utf-8")):
            key = (int(row["surah"]), int(row["ayah"]), int(row["word"]))
            if key in seen and seen[key] != row:
                raise RuntimeError(f"conflicting rows for {key} in {path.name}")
            seen[key] = row
    out = []
    for surah, count in enumerate(AYAH_COUNTS, start=1):
        for ayah in range(1, count + 1):
            w = 1
            while (surah, ayah, w) in seen:
                r = seen.pop((surah, ayah, w))
                out.append(
                    {
                        "location": f"{surah}:{ayah}:{w}",
                        "translit": str(r["translit"]),
                        "gloss": str(r["gloss"]),
                    }
                )
                w += 1
            if w == 1:
                raise RuntimeError(f"no words for {surah}:{ayah}")
    if seen:
        raise RuntimeError(f"words outside the verse sequence: {sorted(seen)[:5]}")
    return out


def write(raw: Path) -> int:
    rows = collect(raw)
    jsonl = "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
    (raw / "wbw.jsonl").write_text(jsonl, encoding="utf-8")
    sums = [f"{hashlib.sha256(jsonl.encode()).hexdigest()}  wbw.jsonl"]
    for path in sorted((raw / "pages").glob("*.html")):
        sums.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  pages/{path.name}")
    (raw / "SHA256SUMS.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")
    return len(rows)


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    raw = Path(args[0]) if args else Path("data/raw/qac-wbw")
    fetch(raw)
    n = write(raw)
    print(json.dumps({"words": n, "out": str(raw / "wbw.jsonl")}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
