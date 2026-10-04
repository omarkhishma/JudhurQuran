"""The Arabic dictionary as its own surface (PLAN P11.1): every root the classical lexica file an article under —
the Quran's and all the others — with each lexicon's articles in the scholars' order and the Quran as one layer among
many. The articles are shown as the site shows them (display only, D22); a root the evidence could not settle says so
and names its candidates (jadhr_pipeline.lexica.dictroots).
"""

from __future__ import annotations

from typing import Any

from jadhr_arabic import parse_root_input, strip_marks
from sqlalchemy import Connection

from .db import one, rows

_FOLD = str.maketrans({"أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ٱ": "ء", "ى": "ي", "ة": "ه"})
_LETTERS = set("ءابتثجحخدذرزسشصضطظعغفقكلمنهوي")
# the alphabet as the index shows it, hamza first as the lexicographers order it
ALPHABET = "ءبتثجحخدذرزسشصضطظعغفقكلمنهوي"


def keys_for(raw: str) -> list[str]:
    """The registry keys a typed root may be, in order: as a root (علم, ع ل م, ʿ-l-m, امن → ءمن); as written (kept
    with its alif where the evidence could not settle it); and by the rules the registry files headings by — an alif
    for a weak radical (سما → سمو, سمي), a two-letter heading for its doubled root (رد → ردد)."""
    out: list[str] = []
    written = "".join(ch for ch in strip_marks(raw).translate(_FOLD) if ch in _LETTERS)
    # as written first: only a heading the evidence could not settle keeps an alif in its key (سار is not سأر)
    if written:
        out.append(written)
    parsed = parse_root_input(raw)
    if parsed:
        out.append("".join(parsed).translate(_FOLD))
    if written:
        if written.count("ا") == 1:
            out += [written.replace("ا", w) for w in "ويء"]
            if written.startswith("ا"):
                out.append("ء" + written[1:])
        if len(written) == 2:
            out.append(written + written[1])
    return list(dict.fromkeys(k for k in out if k))


def letters(conn: Connection) -> list[dict[str, Any]]:
    """How many roots begin with each letter, and how many of them are the Quran's."""
    got = {
        r["first"]: r
        for r in rows(
            conn,
            # a heading kept with a bare alif (unsettled) is listed with the hamza, as the lexicographers order it
            """select case when first = 'ا' then 'ء' else first end as first, count(*)::int as roots,
                      count(quran_root)::int as quranic
               from content.dict_roots group by 1""",
        )
    }
    return [
        {"letter": ch, "roots": got.get(ch, {}).get("roots", 0), "quranic": got.get(ch, {}).get("quranic", 0)}
        for ch in ALPHABET
    ]


_ROOT_COLS = (
    "key, display, letters, first, quran_root, lexica, articles, attested_as_written, unsure, filed_under"
)


def roots(
    conn: Connection, first: str | None, size: int | None, quranic: bool | None, after: str | None, limit: int
) -> dict[str, Any]:
    """Roots in alphabetical order, by first letter, number of letters and whether the Quran has them; paged by key."""
    where = ["true"]
    params: dict[str, Any] = {"n": limit + 1}
    if first:
        where.append("(first = :f or (:f = 'ء' and first = 'ا'))")
        params["f"] = first.translate(_FOLD)
    if size:
        where.append("letters = :s")
        params["s"] = size
    if quranic is not None:
        where.append("(quran_root is not null) = :q")
        params["q"] = quranic
    if after:
        where.append("key > :a")
        params["a"] = after
    got = rows(
        conn,
        f"select {_ROOT_COLS} from content.dict_roots where {' and '.join(where)} order by key limit :n",
        params,
    )
    more = len(got) > limit
    total = one(
        conn,
        f"select count(*)::int as n from content.dict_roots where {' and '.join(where[:-1] if after else where)}",
        params,
    )
    return {
        "data": got[:limit],
        "total": total["n"] if total else 0,
        "next": got[limit - 1]["key"] if more else None,
    }


def root(conn: Connection, raw: str, excerpt: int = 700) -> dict[str, Any] | None:
    """A root with every lexicon's articles on it, in the scholars' order; the Quran's layer when it is a Quranic
    root; where its articles are filed when the lexica file it elsewhere (زلزل under زلل)."""
    r = None
    for k in keys_for(raw):
        r = one(conn, f"select {_ROOT_COLS} from content.dict_roots where key = :k", {"k": k})
        if r:
            break
    if r is None:
        return None
    arts = rows(
        conn,
        """select e.id, e.uri, e.work_id, e.headword, e.dict_rule as rule, e.dict_candidates as candidates, e.page_ref,
                  left(e.body, :n) as excerpt, length(e.body) as length,
                  w.title_ar, w.title_en, w.author_ar, w.author_en, w.death_hijri, w.death_ce, w.lang, w.kind,
                  w.edition_note, w.source_url, w.license, w.attribution_ar, w.attribution_en, w.redistributable,
                  w.sort_order
           from content.lexicon_entries e join content.lexicon_works w on w.id = e.work_id
           where :k = any(e.dict_roots) order by w.sort_order, e.id""",
        {"k": r["key"], "n": excerpt},
    )
    works: dict[str, dict[str, Any]] = {}
    for a in arts:
        w = works.setdefault(
            a["work_id"],
            {
                k: a[k]
                for k in (
                    "title_ar",
                    "title_en",
                    "author_ar",
                    "author_en",
                    "death_hijri",
                    "death_ce",
                    "lang",
                    "kind",
                    "edition_note",
                    "source_url",
                    "license",
                    "attribution_ar",
                    "attribution_en",
                    "redistributable",
                )
            }
            | {"id": a["work_id"], "articles": []},
        )
        w["articles"].append(
            {
                k: a[k]
                for k in ("id", "uri", "headword", "rule", "candidates", "page_ref", "excerpt", "length")
            }
        )
    # the roots an unsettled article may belong to, where the dictionary has them
    cand_keys = sorted({c for a in arts for c in (a["candidates"] or [])})
    candidates = (
        rows(
            conn,
            "select key, display, articles from content.dict_roots where key = any(:k) order by key",
            {"k": cand_keys},
        )
        if cand_keys
        else []
    )
    quran = (
        one(
            conn,
            """select key, spaced, translit, occurrences, verse_count, surah_count, lemma_count, gist_ar
               from content.roots where key = :k""",
            {"k": r["quran_root"]},
        )
        if r["quran_root"]
        else None
    )
    filed = (
        one(conn, f"select {_ROOT_COLS} from content.dict_roots where key = :k", {"k": r["filed_under"]})
        if r["filed_under"]
        else None
    )
    # the roots before and after it, to leaf through as in a printed dictionary
    prev = one(
        conn,
        "select key, display from content.dict_roots where key < :k order by key desc limit 1",
        {"k": r["key"]},
    )
    nxt = one(
        conn,
        "select key, display from content.dict_roots where key > :k order by key limit 1",
        {"k": r["key"]},
    )
    return {
        **r,
        "spaced": " ".join(r["display"]),
        "prev": prev,
        "next": nxt,
        "works": list(works.values()),
        "candidates": candidates,
        "quran": quran,
        "filed_under": filed,
    }


def entry(conn: Connection, key: int | str) -> dict[str, Any] | None:
    """One article whole, when the dictionary files it under a root (or the site shows it under a Quranic one): by its
    row id, or by its identifier (``dict:lane:علم``, P1.7a), which never changes between releases."""
    by = "e.id = :k" if isinstance(key, int) else "e.uri = :k"
    return one(
        conn,
        f"""select e.id, e.uri, e.work_id, e.headword, e.body, e.page_ref, e.source_ref, e.dict_roots,
                  e.dict_rule as rule,
                  w.title_ar, w.title_en, w.author_ar, w.author_en, w.lang, w.attribution_ar, w.attribution_en
           from content.lexicon_entries e join content.lexicon_works w on w.id = e.work_id
           where {by} and (cardinality(e.dict_roots) > 0 or e.displayable)""",
        {"k": key},
    )
