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

from .content import clean_passage, lemma_display, resolve_root, works
from .db import rows

SORTS = ("mushaf", "following", "preceding")
# Collocates leave out particles and pronouns by their tag (CON-Q05), not by word length.
_FUNCTION_TAGS = {
    "P", "CONJ", "SUB", "ACC", "AMD", "ANS", "AVR", "CAUS", "CERT", "CIRC", "COM", "COND", "EQ", "EXH", "EXL",
    "EXP", "FUT", "INC", "INT", "INTG", "NEG", "PREV", "PRO", "REM", "RES", "RET", "RSLT", "SUP", "SUR", "VOC",
    "PRON", "DEM", "REL", "DET", "EMPH", "IMPV", "PRP", "T", "LOC", "INL",
}  # fmt: skip


FILTERS = ("lemma", "pattern", "surah", "place", "juz", "pos", "form", "near")


def _hits(conn: Connection, root_id: int, f: dict[str, Any]) -> list[dict[str, Any]]:
    """Every hit of the root under the filters: lemma and pattern slugs, sūra, Makki/Madani, juzʾ, part of
    speech, the surface form as written in standard spelling, and a lemma found within two words."""
    cond = ["w.root_id = :r"]
    params: dict[str, Any] = {"r": root_id}
    simple = {
        "lemma": "l.slug = :lemma",
        "pattern": "p.slug = :pattern",
        "surah": "w.surah = :surah",
        "juz": "v.juz = :juz",
        "pos": "w.pos = :pos",
        "form": "w.text_imlaei = :form",
    }
    for k, sql in simple.items():
        if f.get(k):
            cond.append(sql)
            params[k] = f[k]
    if f.get("place") in ("meccan", "medinan"):
        cond.append("s.revelation_place = :place")
        params["place"] = f["place"]
    if f.get("near"):
        cond.append(
            """exists (select 1 from content.words w2 join content.lemmas l2 on l2.id = w2.lemma_id
                       where w2.verse_id = w.verse_id and w2.id <> w.id and l2.slug = :near
                         and w2.position between w.position - 2 and w.position + 2)"""
        )
        params["near"] = f["near"]
    return rows(
        conn,
        f"""select w.id, w.location, w.surah, w.ayah, w.position, w.verse_id, w.token_from, w.token_to,
                   w.text_uthmani as surface, w.text_imlaei as form, w.pos, l.slug as lemma_slug, l.ar as lemma_ar,
                   p.slug as pattern_slug, p.ar as pattern_ar, s.name_ar as surah_name_ar,
                   s.name_translit as surah_name_translit, s.revelation_place, v.juz
            from content.words w
            join content.surahs s on s.number = w.surah
            join content.verses v on v.id = w.verse_id
            left join content.lemmas l on l.id = w.lemma_id
            left join content.patterns p on p.id = l.pattern_id
            where {" and ".join(cond)} order by w.id""",
        params,
    )


def _translations(conn: Connection, work_id: str | None, hits: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Each hit's verse in one translation (the row tooltip and the CSV column, CON-08, CON-Q08)."""
    if not work_id:
        return None
    w = next((x for x in works(conn, kind="translation") if x["id"] == work_id), None)
    if w is None:
        return None
    found = rows(
        conn,
        """select v.id as vid, p.text from content.verses v
           join content.work_passages p on p.work_id = :w and v.id between p.verse_from and p.verse_to
           where v.id = any(:ids) order by v.id, p.verse_from""",
        {"w": work_id, "ids": sorted({h["verse_id"] for h in hits})},
    )
    by_v: dict[int, str] = {}
    for x in found:
        by_v.setdefault(x["vid"], clean_passage(x["text"], w["strip_leading_number"]))
    for h in hits:
        h["translation"] = by_v.get(h["verse_id"])
    return {k: w[k] for k in ("id", "title_ar", "title_en", "author_ar", "author_en")}


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
    pos = rows(
        conn,
        """select w.pos as tag, min(w.features #>> '{pos,ar}') as ar, min(w.features #>> '{pos,en}') as en,
                  count(*)::int as n
           from content.words w where w.root_id = :r group by w.pos order by count(*) desc, w.pos""",
        {"r": root_id},
    )
    juz = rows(
        conn,
        """select v.juz, count(*)::int as n from content.words w join content.verses v on v.id = w.verse_id
           where w.root_id = :r group by v.juz order by v.juz""",
        {"r": root_id},
    )
    return {"lemmas": lemmas, "patterns": patterns, "surahs": surahs, "pos": pos, "juz": juz}


def concordance(
    conn: Connection,
    root_raw: str,
    *,
    sort: str = "mushaf",
    offset: int = 0,
    limit: int = 50,
    translation: str | None = None,
    **filters: Any,
) -> dict[str, Any] | None:
    r = resolve_root(conn, root_raw)
    if r is None:
        return None
    f = {k: filters.get(k) for k in FILTERS}
    hits = _hits(conn, r["id"], f)
    total = len(hits)
    if sort != "mushaf":
        _kwic(conn, hits)
        _sort(hits, sort)
        page = hits[offset : offset + limit]
    else:
        page = hits[offset : offset + limit]
        _kwic(conn, page)
    work = _translations(conn, translation, page)
    return {
        "root": {k: r[k] for k in ("key", "spaced", "translit", "occurrences")},
        "filters": {**f, "sort": sort, "near_ar": _lemma_ar(conn, f["near"])},
        "facets": _facets(conn, r["id"]),
        "total": total,
        "offset": offset,
        "translation": work,
        "data": [_row(h) for h in page],
        "next_offset": offset + limit if offset + limit < total else None,
    }


def _lemma_ar(conn: Connection, slug: str | None) -> str | None:
    if not slug:
        return None
    found = rows(conn, "select ar from content.lemmas where slug = :s", {"s": slug})
    return lemma_display(found[0]["ar"]) if found else None


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
        "juz": h["juz"],
        "left": h["left"],
        "keyword": h["keyword"],
        "right": h["right"],
        "translation": h.get("translation"),
    }


def distribution(conn: Connection, root_raw: str, **filters: Any) -> dict[str, Any] | None:
    """Hits per sūra normalised per 100 words (with each sūra's revelation order), the Makki/Madani split,
    hits per surface form, and the content words found within two words of a hit — all under the same
    filters as the lines (CON-21…24, CON-Q04/Q05)."""
    r = resolve_root(conn, root_raw)
    if r is None:
        return None
    hits = _hits(conn, r["id"], {k: filters.get(k) for k in FILTERS})
    words = {
        x["number"]: x
        for x in rows(
            conn,
            "select number, name_ar, name_translit, revelation_place, revelation_order, word_count from content.surahs",
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
            "revelation_order": words[s]["revelation_order"],
            "hits": n,
            "words": words[s]["word_count"],
            "per100": round(100 * n / words[s]["word_count"], 2),
        }
        for s, n in sorted(per.items())
    ]
    place = {"meccan": 0, "medinan": 0}
    for p in per_surah:
        place[p["place"]] += p["hits"]
    near = (
        rows(
            conn,
            """select l.slug, l.ar, w2.pos, count(*)::int as n
           from content.words w join content.words w2
             on w2.verse_id = w.verse_id and w2.position between w.position - 2 and w.position + 2 and w2.id <> w.id
           join content.lemmas l on l.id = w2.lemma_id
           where w.id = any(:ids) and (w2.root_id is null or w2.root_id <> :r)
           group by l.id, w2.pos order by count(*) desc, l.slug""",
            {"ids": [h["id"] for h in hits], "r": r["id"]},
        )
        if hits
        else []
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
    "surah", "ayah", "position", "location", "surah_name", "surface", "lemma", "root", "pattern", "pos",
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
    tr = out["translation"]
    # the translation column names its work, so the text never travels without its credit
    w.writerow(CSV_COLUMNS + ((f"translation: {tr['title_en']} ({tr['author_en']})",) if tr else ()))
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
                out["root"]["key"],
                x["pattern"] or "",
                x["pos"],
                x["left"],
                x["keyword"],
                x["right"],
            ]
            + ([x["translation"] or ""] if tr else [])
        )
    ascii_tr = unicodedata.normalize("NFKD", out["root"]["translit"].replace("ʿ", "3").replace("ʾ", "2"))
    name = (
        "concordance-"
        + ("".join(ch for ch in ascii_tr if ch.isascii() and (ch.isalnum() or ch == "-")) or "root")
        + ".csv"
    )
    return "﻿" + buf.getvalue(), name
