"""The concordance of a root (design 05 §5.3, inventory CON-01…39 and the Quran notes CON-Q01…Q09).

KWIC lines are split from the stored mushaf tokens, never from highlighter fragments. Every line knows
its sūra, āya and word position, its surface form, lemma and pattern; filters by lemma, pattern, sūra and
Makki/Madani; sorts in mushaf order (the default and the "source" order), by the following context, or
by the preceding context read outward from the keyword. Totals come from the server, lines are paged.
"""

from __future__ import annotations

import csv
import io
import unicodedata
from typing import Any

from jadhr_arabic import normalize
from sqlalchemy import Connection

from .content import lemma_display, resolve_root
from .db import rows

SORTS = ("mushaf", "following", "preceding")
# Collocates leave out particles and pronouns by their tag (CON-Q05), not by word length.
_FUNCTION_TAGS = {
    "P", "CONJ", "SUB", "ACC", "AMD", "ANS", "AVR", "CAUS", "CERT", "CIRC", "COM", "COND", "EQ", "EXH", "EXL",
    "EXP", "FUT", "INC", "INT", "INTG", "NEG", "PREV", "PRO", "REM", "RES", "RET", "RSLT", "SUP", "SUR", "VOC",
    "PRON", "DEM", "REL", "DET", "EMPH", "IMPV", "PRP", "T", "LOC", "INL",
}  # fmt: skip


def _hits(
    conn: Connection,
    root_id: int,
    lemma: str | None,
    pattern: str | None,
    surah: int | None,
    place: str | None,
) -> list[dict[str, Any]]:
    cond = ["w.root_id = :r"]
    params: dict[str, Any] = {"r": root_id}
    if lemma:
        cond.append("l.slug = :lemma")
        params["lemma"] = lemma
    if pattern:
        cond.append("p.slug = :pattern")
        params["pattern"] = pattern
    if surah:
        cond.append("w.surah = :surah")
        params["surah"] = surah
    if place in ("meccan", "medinan"):
        cond.append("s.revelation_place = :place")
        params["place"] = place
    return rows(
        conn,
        f"""select w.id, w.location, w.surah, w.ayah, w.position, w.verse_id, w.token_from, w.token_to,
                   w.text_uthmani as surface, w.text_imlaei as form, w.pos, l.slug as lemma_slug, l.ar as lemma_ar,
                   p.slug as pattern_slug, p.ar as pattern_ar, s.name_ar as surah_name_ar,
                   s.name_translit as surah_name_translit, s.revelation_place
            from content.words w
            join content.surahs s on s.number = w.surah
            left join content.lemmas l on l.id = w.lemma_id
            left join content.patterns p on p.id = l.pattern_id
            where {" and ".join(cond)} order by w.id""",
        params,
    )


def _kwic(conn: Connection, hits: list[dict[str, Any]]) -> None:
    """Fill each hit's preceding / keyword / following from the verse's display tokens."""
    toks = rows(
        conn,
        "select verse_id, position, text from content.tokens where verse_id = any(:ids) order by verse_id, position",
        {"ids": sorted({h["verse_id"] for h in hits})},
    )
    by_v: dict[int, list[str]] = {}
    for t in toks:
        by_v.setdefault(t["verse_id"], []).append(t["text"])
    for h in hits:
        vt = by_v[h["verse_id"]]
        a, b = h["token_from"] - 1, h["token_to"]
        h["left"] = " ".join(vt[:a])
        h["keyword"] = " ".join(vt[a:b])
        h["right"] = " ".join(vt[b:])


def _sort(hits: list[dict[str, Any]], sort: str) -> None:
    if sort == "following":
        hits.sort(key=lambda h: (normalize(h["right"]), h["id"]))
    elif sort == "preceding":
        # read outward from the keyword: the nearest preceding word first (the standard left sort)
        hits.sort(key=lambda h: (" ".join(reversed(normalize(h["left"]).split())), h["id"]))
    # mushaf order is the query's own order


def _facets(conn: Connection, root_id: int) -> dict[str, Any]:
    lemmas = rows(
        conn,
        """select l.slug, l.ar, count(*)::int as n from content.words w join content.lemmas l on l.id = w.lemma_id
           where w.root_id = :r group by l.id order by count(*) desc, l.slug""",
        {"r": root_id},
    )
    for x in lemmas:
        x["ar"] = lemma_display(x["ar"])
    patterns = rows(
        conn,
        """select p.slug, p.ar, count(*)::int as n from content.words w join content.lemmas l on l.id = w.lemma_id
           join content.patterns p on p.id = l.pattern_id where w.root_id = :r group by p.id order by count(*) desc, p.slug""",
        {"r": root_id},
    )
    surahs = rows(
        conn,
        """select s.number as surah, s.name_ar, s.name_translit, s.revelation_place, count(*)::int as n
           from content.words w join content.surahs s on s.number = w.surah where w.root_id = :r
           group by s.number order by s.number""",
        {"r": root_id},
    )
    return {"lemmas": lemmas, "patterns": patterns, "surahs": surahs}


def concordance(
    conn: Connection,
    root_raw: str,
    *,
    lemma: str | None = None,
    pattern: str | None = None,
    surah: int | None = None,
    place: str | None = None,
    sort: str = "mushaf",
    offset: int = 0,
    limit: int = 50,
) -> dict[str, Any] | None:
    r = resolve_root(conn, root_raw)
    if r is None:
        return None
    hits = _hits(conn, r["id"], lemma, pattern, surah, place)
    total = len(hits)
    if sort != "mushaf":
        _kwic(conn, hits)
        _sort(hits, sort)
        page = hits[offset : offset + limit]
    else:
        page = hits[offset : offset + limit]
        _kwic(conn, page)
    return {
        "root": {k: r[k] for k in ("key", "spaced", "translit", "occurrences")},
        "filters": {"lemma": lemma, "pattern": pattern, "surah": surah, "place": place, "sort": sort},
        "facets": _facets(conn, r["id"]),
        "total": total,
        "offset": offset,
        "data": [_row(h) for h in page],
        "next_offset": offset + limit if offset + limit < total else None,
    }


def _row(h: dict[str, Any]) -> dict[str, Any]:
    return {
        "location": h["location"],
        "verse_key": f"{h['surah']}:{h['ayah']}",
        "surah": h["surah"],
        "ayah": h["ayah"],
        "position": h["position"],
        "surah_name_ar": h["surah_name_ar"],
        "surah_name_translit": h["surah_name_translit"],
        "place": h["revelation_place"],
        "surface": h["surface"],
        "form": h["form"],
        "lemma_slug": h["lemma_slug"],
        "lemma": lemma_display(h["lemma_ar"]) if h["lemma_ar"] else None,
        "pattern_slug": h["pattern_slug"],
        "pattern": h["pattern_ar"],
        "pos": h["pos"],
        "left": h["left"],
        "keyword": h["keyword"],
        "right": h["right"],
    }


def distribution(
    conn: Connection, root_raw: str, lemma: str | None = None, pattern: str | None = None
) -> dict[str, Any] | None:
    """Hits per sūra normalised per 100 words, the Makki/Madani split, hits per surface form, and the
    content words found within two words of a hit (CON-21…24, CON-Q04/Q05)."""
    r = resolve_root(conn, root_raw)
    if r is None:
        return None
    hits = _hits(conn, r["id"], lemma, pattern, None, None)
    words = {
        x["number"]: x
        for x in rows(
            conn, "select number, name_ar, name_translit, revelation_place, word_count from content.surahs"
        )
    }
    per: dict[int, int] = {}
    forms: dict[str, int] = {}
    for h in hits:
        per[h["surah"]] = per.get(h["surah"], 0) + 1
        forms[h["form"]] = forms.get(h["form"], 0) + 1
    per_surah = [
        {
            "surah": s,
            "name_ar": words[s]["name_ar"],
            "name_translit": words[s]["name_translit"],
            "place": words[s]["revelation_place"],
            "hits": n,
            "words": words[s]["word_count"],
            "per100": round(100 * n / words[s]["word_count"], 2),
        }
        for s, n in sorted(per.items())
    ]
    place = {"meccan": 0, "medinan": 0}
    for p in per_surah:
        place[p["place"]] += p["hits"]
    near = rows(
        conn,
        """select l.slug, l.ar, w2.pos, count(*)::int as n
           from content.words w join content.words w2
             on w2.verse_id = w.verse_id and w2.position between w.position - 2 and w.position + 2 and w2.id <> w.id
           join content.lemmas l on l.id = w2.lemma_id
           where w.id = any(:ids) and (w2.root_id is null or w2.root_id <> :r)
           group by l.id, w2.pos order by count(*) desc, l.slug""",
        {"ids": [h["id"] for h in hits], "r": r["id"]},
    )
    collocates: dict[str, dict[str, Any]] = {}
    for x in near:
        if x["pos"] in _FUNCTION_TAGS:
            continue
        c = collocates.setdefault(x["slug"], {"slug": x["slug"], "ar": lemma_display(x["ar"]), "n": 0})
        c["n"] += x["n"]
    return {
        "root": {k: r[k] for k in ("key", "spaced", "translit", "occurrences")},
        "total": len(hits),
        "per_surah": per_surah,
        "place": place,
        "forms": [{"form": f, "n": n} for f, n in sorted(forms.items(), key=lambda kv: (-kv[1], kv[0]))],
        "collocates": sorted(collocates.values(), key=lambda c: (-c["n"], c["slug"]))[:20],
    }


CSV_COLUMNS = (
    "surah", "ayah", "position", "location", "surah_name", "surface", "lemma", "pattern", "pos",
    "preceding", "keyword", "following",
)  # fmt: skip


def concordance_csv(conn: Connection, root_raw: str, **filters: Any) -> tuple[str, str] | None:
    """Every line under the current filters and sort as CSV with a UTF-8 BOM, so spreadsheet programs
    read the Arabic (CON-26/27, CON-Q08); the filename is the root key in ASCII."""
    out = concordance(conn, root_raw, offset=0, limit=10**6, **filters)
    if out is None:
        return None
    buf = io.StringIO()
    w = csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    w.writerow(CSV_COLUMNS)
    for x in out["data"]:
        w.writerow(
            [
                x["surah"],
                x["ayah"],
                x["position"],
                x["location"],
                x["surah_name_ar"],
                x["surface"],
                x["lemma"] or "",
                x["pattern"] or "",
                x["pos"],
                x["left"],
                x["keyword"],
                x["right"],
            ]
        )
    ascii_tr = unicodedata.normalize("NFKD", out["root"]["translit"].replace("ʿ", "3").replace("ʾ", "2"))
    name = (
        "concordance-"
        + ("".join(ch for ch in ascii_tr if ch.isascii() and (ch.isalnum() or ch == "-")) or "root")
        + ".csv"
    )
    return "﻿" + buf.getvalue(), name
