"""A root's life across the texts (PLAN P11.4b, research 21 §6): the passages of the hadith and the books that hold
it, by text, with counts — where the rules are sure of the word (its form is the Quran's, alone or with its clitics)
apart from where they found it possible (a pattern, a weak root) — and each passage with the root's word in its words:
the first word of what the passage reports, never its isnād, a narrator's name or a fixed blessing (the same spans
the build keeps out of its roots, ecosystem/model.py).

A root is asked by its dictionary key or by the Quran's (they differ for a few weak roots: ``dict_roots.quran_root``).
"""

from __future__ import annotations

import json
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
    conn: Connection,
    key: str,
    kind: str | None,
    slug: str | None,
    which: str,
    offset: int,
    limit: int,
    grader: str | None = None,
    ruling: str | None = None,
) -> dict[str, Any] | None:
    """A root's passages in the hadith and the books; with a grader and a ruling, only the hadith that grader rules
    so (B57) — one grader's word, never a grade of the hadith's own, since the graders disagree."""
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
    if grader and ruling:
        where.append("p.meta->'grades' @> cast(:graded as jsonb)")
        params["graded"] = json.dumps([{"grader": grader, "value": ruling}])
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
        "graded": {"grader": grader, "ruling": ruling} if grader and ruling else None,
    }


def rulings(conn: Connection) -> list[dict[str, Any]]:
    """Each grader of the hadith with the rulings they give and on how many hadith (B57): their own terms, and the
    Arabic the dataset gives each (none where it gives none)."""
    found = rows(
        conn,
        """select g->>'grader' as grader, max(g->>'grader_ar') as grader_ar, max(g->>'grader_en') as grader_en,
                  g->>'value' as value, max(g->>'value_ar') as value_ar, count(*)::int as n
             from content.passages p join content.texts t on t.id = p.text_id,
                  jsonb_array_elements(coalesce(p.meta->'grades', '[]'::jsonb)) g
            where t.kind = 'hadith'
            group by g->>'grader', g->>'value'
            order by g->>'grader', count(*) desc""",
    )
    out: dict[str, dict[str, Any]] = {}
    for r in found:
        g = out.setdefault(
            r["grader"],
            {"grader": r["grader"], "grader_ar": r["grader_ar"], "grader_en": r["grader_en"], "rulings": []},
        )
        g["rulings"].append({"value": r["value"], "value_ar": r["value_ar"], "n": r["n"]})
    return sorted(out.values(), key=lambda g: -sum(x["n"] for x in g["rulings"]))


SURE_KINDS = ["form", "clitic"]


def _lemma_passages(
    conn: Connection, text_id: int, forms: list[int], limit: int
) -> tuple[list[dict[str, Any]], int]:
    """A text's passages holding one of the forms, in the text's order, and how many there are."""
    found = rows(
        conn,
        """select p.uri, p.ar_full, p.form_ids, p.meta from content.passages p
            where p.text_id = :t and p.form_ids && :f order by p.chapter_id, p.ordinal limit :l""",
        {"t": text_id, "f": forms, "l": limit},
    )
    total = one(
        conn,
        "select count(*) as n from content.passages p where p.text_id = :t and p.form_ids && :f",
        {"t": text_id, "f": forms},
    )
    return found, int(total["n"]) if total else 0


def lemma_in_text(conn: Connection, slug: str, text_slug: str, limit: int = 5) -> dict[str, Any] | None:
    """A Quranic word in one hadith collection or book (P1.3 ``?in_text=``, the panel's "In this text", RDR-268…271):
    the passages where the rules read the word as this lemma surely — its form the Quran's, alone or with its clitics —
    each with the word in its line, in the text's order, and how many; where the text has none, its places in the
    other texts that hold it (``siblings``), so the section never dead-ends."""
    lem = one(conn, "select id, slug, ar from content.lemmas where slug = :s", {"s": slug})
    text = one(
        conn,
        "select id, slug, kind, title_ar, title_en from content.texts where slug = :t and kind <> 'quran'",
        {"t": text_slug},
    )
    if lem is None or text is None:
        return None
    forms = [
        r["id"]
        for r in rows(
            conn,
            """select id from content.text_forms
                where (readings->0->>'lemma_id')::int = :l and kind = any(:k)""",
            {"l": lem["id"], "k": SURE_KINDS},
        )
    ]
    reads = set(forms)

    def shaped(found: list[dict[str, Any]]) -> list[dict[str, Any]]:
        where_ = hits(conn, [r["uri"] for r in found])
        return [
            {
                **{x: where_[r["uri"]][x] for x in ("uri", "ref", "text", "top", "chapter")},
                "sure": True,
                "kwic": _kwic(r["ar_full"] or "", r["form_ids"] or [], r["meta"] or {}, reads),
            }
            for r in found
            if r["uri"] in where_
        ]

    found, total = _lemma_passages(conn, text["id"], forms, limit) if forms else ([], 0)
    siblings: list[dict[str, Any]] = []
    if total == 0 and forms:
        # the texts the build counts the lemma in (content.text_lemmas), in the library's order
        for o in rows(
            conn,
            """select t.id from content.text_lemmas x join content.texts t on t.id = x.text_id
                where x.lemma_id = :l and t.kind <> 'quran' and t.id <> :t order by t.sort_order limit 3""",
            {"l": lem["id"], "t": text["id"]},
        ):
            more, _ = _lemma_passages(conn, o["id"], forms, 2)
            siblings += shaped(more)
    return {
        "lemma": {"slug": lem["slug"], "ar": lem["ar"]},
        "text": {k: text[k] for k in ("slug", "kind", "title_ar", "title_en")},
        "total": total,
        "data": shaped(found),
        "siblings": siblings,
    }
