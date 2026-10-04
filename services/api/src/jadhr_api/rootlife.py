"""A root's life across the texts (PLAN P11.4b, research 21 §6): the passages of the hadith and the books that hold
it, by text, with counts — where the rules are sure of the word (its form is the Quran's, alone or with its clitics)
apart from where they found it possible (a pattern, a weak root) — and each passage with the root's word in its words:
the first word of what the passage reports, never its isnād, a narrator's name or a fixed blessing (the same spans
the build keeps out of its roots, ecosystem/model.py).

A root is asked by its dictionary key or by the Quran's (they differ for a few weak roots: ``dict_roots.quran_root``).
"""

from __future__ import annotations

from bisect import bisect_right
from typing import Any

from jadhr_arabic.analysis import word_spans
from sqlalchemy import Connection

from .db import one, rows
from .texts import hits

CONTEXT = 70  # characters of context on each side of the word, cut at a word's edge
WHICH = {
    "sure": "p.roots @> array[cast(:k as text)]",
    "possible": "p.roots_low @> array[cast(:k as text)]",
    "all": "(p.roots @> array[cast(:k as text)] or p.roots_low @> array[cast(:k as text)])",
}


def resolve(conn: Connection, key: str) -> dict[str, Any] | None:
    """The dictionary's root a key names: its own, or the one filed for the Quran's root of that key."""
    return one(
        conn,
        """select key, display, quran_root from content.dict_roots
            where key = :k or quran_root = :k order by (key = :k) desc limit 1""",
        {"k": key},
    )


def _kwic(text: str, form_ids: list[int], meta: dict[str, Any], hits_: set[int]) -> dict[str, str] | None:
    """The first word of the passage's report whose form reads to the root, with the words around it."""
    split = meta.get("split") if isinstance(meta.get("split"), dict) else None
    reported = split["matn"][0] if split and split.get("matn") else (split["isnad"][1] if split else 0)
    skip = sorted((x, y) for k in ("names", "chain", "formulaic") for x, y in (meta.get(k) or []))
    starts = [x for x, _ in skip]
    for (a, b), fid in zip(word_spans(text), form_ids, strict=False):
        if fid not in hits_ or a < reported:
            continue
        at = bisect_right(starts, a) - 1
        if at >= 0 and a < skip[at][1]:
            continue
        before = text[max(0, a - CONTEXT) : a]
        after = text[b : b + CONTEXT]
        if a > CONTEXT and " " in before:
            before = "…" + before[before.index(" ") + 1 :]
        if len(text) - b > CONTEXT and " " in after:
            after = after[: after.rindex(" ")] + "…"
        return {"before": before, "word": text[a:b], "after": after}
    return None


def root_in_texts(
    conn: Connection, key: str, kind: str | None, slug: str | None, which: str, offset: int, limit: int
) -> dict[str, Any] | None:
    root = resolve(conn, key)
    if root is None:
        return None
    k = root["key"]
    # each text's count, made by the build (content.root_texts)
    counts = rows(
        conn,
        """select t.slug, t.kind, t.title_ar, t.title_en, c.sure, c.possible
             from content.root_texts c join content.texts t on t.id = c.text_id
            where c.root = :k order by t.sort_order""",
        {"k": k},
    )
    where = ["t.kind <> 'quran'", WHICH[which]]
    params: dict[str, Any] = {"k": k}
    if kind:
        where.append("t.kind = :kind")
        params["kind"] = kind
    if slug:
        where.append("t.slug = :slug")
        params["slug"] = slug
    cond = " and ".join(where)
    found = rows(
        conn,
        f"""select p.uri, p.ar_full, p.form_ids, p.meta, {WHICH["sure"]} as sure
              from content.passages p join content.texts t on t.id = p.text_id
             where {cond} order by t.sort_order, p.id limit :l offset :o""",
        {**params, "l": limit, "o": offset},
    )
    total = int(
        one(
            conn,
            f"select count(*) as n from content.passages p join content.texts t on t.id = p.text_id where {cond}",
            params,
        )["n"]  # type: ignore[index]
    )
    ids = sorted({f for r in found for f in (r["form_ids"] or []) if f})
    reads = {
        r["id"]
        for r in rows(
            conn,
            """select id from content.text_forms
                where id = any(:ids) and exists (select 1 from jsonb_array_elements(readings) x
                                                 where x->>'dict_root' = :k)""",
            {"ids": ids, "k": k},
        )
    }
    where_ = hits(conn, [r["uri"] for r in found])
    data = []
    for r in found:
        h = where_.get(r["uri"])
        if h is None:
            continue
        data.append(
            {
                **{x: h[x] for x in ("uri", "ref", "text", "top", "chapter")},
                "sure": r["sure"],
                "kwic": _kwic(r["ar_full"] or "", r["form_ids"] or [], r["meta"] or {}, reads),
            }
        )
    by_kind: dict[str, dict[str, int]] = {}
    for c in counts:
        t = by_kind.setdefault(c["kind"], {"sure": 0, "possible": 0, "texts": 0})
        t["sure"] += c["sure"]
        t["possible"] += c["possible"]
        t["texts"] += 1
    return {
        "root": root,
        "counts": counts,
        "totals": by_kind,
        "data": data,
        "total": total,
        "offset": offset,
        "limit": limit,
    }
