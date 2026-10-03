"""What the signs written in the mushaf mean (P3.9): the waqf signs, the sakt sign, the sajda sign and the
ḥizb sign, in the words of the Madinah Mushaf's own note «التعريف بهذا المصحف» (source
``kfgqpc-mushaf-key``, transcribed in ``data/knowledge.yaml``).

Each sign is tied to the code point the KFGQPC text writes it with; the tie is checked, not assumed: the
example verse the page gives must carry that code point on the token the registry names. Counts are the
sign's occurrences in our text (waqf and sakt signs on a word's last letter; the sakt sign inside a word
is another mark — «السين فوق الصاد», read with sīn — and is not counted).
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

from .quran import read_jsonl
from .registry import Registry

SOURCE = "kfgqpc-mushaf-key"


def _char(cp: str) -> str:
    return chr(int(cp.removeprefix("U+"), 16))


def build_mushaf_signs(reg: Registry, build_dir: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    verses = {v["id"]: v for v in read_jsonl(build_dir / "verses.jsonl")}
    by_key: dict[str, dict[int, str]] = {}
    ends: Counter[str] = Counter()
    for t in read_jsonl(build_dir / "tokens.jsonl"):
        by_key.setdefault(verses[t["verse_id"]]["key"], {})[t["position"]] = t["text"]
        if t["text"]:
            ends[t["text"][-1]] += 1
    hizb = sum(1 for v in verses.values() if v.get("hizb_mark"))
    rows: list[dict[str, Any]] = []
    problems: list[str] = []
    for i, s in enumerate(reg.sources[SOURCE]["signs"], start=1):
        chars = [_char(cp) for cp in s["codepoints"]]
        ex = s.get("example")
        if ex:
            token = by_key.get(ex["key"], {}).get(ex["token"], "")
            if not any(token.endswith(c) for c in chars):
                problems.append(
                    f"{s['id']}: {ex['key']} token {ex['token']} «{token}» does not end with {s['codepoints']}"
                )
        count = hizb if s["kind"] == "hizb" else sum(ends[c] for c in chars)
        rows.append(
            {
                "id": s["id"],
                "sort_order": i,
                "kind": s["kind"],
                "codepoints": s["codepoints"],
                "chars": "".join(chars),
                "label_ar": s["label_ar"],
                "text_ar": s["text_ar"],
                "example_key": ex["key"] if ex else None,
                "example_token": ex["token"] if ex else None,
                "page": s["page"],
                "occurrences": count,
                "source_id": SOURCE,
            }
        )
    if problems:
        raise ValueError("mushaf signs do not match their examples:\n  " + "\n  ".join(problems))
    return rows, {"signs": len(rows), "occurrences": {r["id"]: r["occurrences"] for r in rows}}
