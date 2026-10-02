"""Unified search over verses, roots, lemmas and word forms.

The query is classified first (verse reference, surah name, root letters, Arabic
word/phrase, Latin) and the classification is returned to the client so the UI
can say honestly what it understood. All Arabic matching is diacritic- and
orthography-insensitive on both sides (``jadhr_arabic.normalize``); display
always uses the stored, verified forms.
"""

from __future__ import annotations

import re
from typing import Any

from jadhr_arabic import has_arabic, is_uthmani, normalize, parse_root_input, root_input_candidates
from jadhr_arabic import key as root_key
from sqlalchemy import Connection

from .content import lemma_display
from .db import one, rows

_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
_REF_RE = re.compile(r"^\s*(\d{1,3})\s*[:：.\-/ ]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*$")
_SURAH_NUM_RE = re.compile(r"^\s*(?:surah|sura|سورة)?\s*(\d{1,3})\s*$", re.I)
_LATIN_SIMPLIFY = re.compile(r"[^a-z0-9]")

LABELS = {
    "empty": ("فارغ", "empty"),
    "verse_ref": ("رقم آية", "verse reference"),
    "surah": ("سورة", "surah"),
    "root": ("جذر", "root"),
    "arabic_word": ("كلمة عربية", "Arabic word"),
    "arabic_phrase": ("عبارة عربية", "Arabic phrase"),
    "latin": ("نص لاتيني", "Latin text"),
}


def _simplify_latin(s: str) -> str:
    s = s.lower().replace("al-", "").replace("an-", "").replace("ash-", "").replace("at-", "")
    s = _LATIN_SIMPLIFY.sub("", s)
    return re.sub(r"(.)\1+", r"\1", s)


def _surah_by_name(conn: Connection, q: str) -> dict[str, Any] | None:
    surahs = rows(conn, "select number, name_ar, name_translit, name_en, verse_count from content.surahs")
    qa = normalize(q).removeprefix("سوره ").strip()
    ql = _simplify_latin(q.removeprefix("surah ").removeprefix("sura "))
    for s in surahs:
        if qa and normalize(s["name_ar"]) == qa:
            return s
        if (
            ql
            and len(ql) >= 3
            and (ql == _simplify_latin(s["name_translit"]) or ql == _simplify_latin(s["name_en"]))
        ):
            return s
    return None


def detect(conn: Connection, q: str) -> tuple[str, dict[str, Any]]:
    raw = q.strip()
    if not raw:
        return "empty", {}
    ascii_q = raw.translate(_DIGITS)
    m = _REF_RE.match(ascii_q)
    if m:
        return "verse_ref", {
            "surah": int(m.group(1)),
            "ayah": int(m.group(2)),
            "to": int(m.group(3) or 0) or None,
        }
    m = _SURAH_NUM_RE.match(ascii_q)
    if m and 1 <= int(m.group(1)) <= 114:
        return "surah", {"surah": int(m.group(1))}
    # "<surah name> <ayah>" e.g. البقرة 255
    parts = ascii_q.rsplit(" ", 1)
    if len(parts) == 2 and parts[1].isdigit():
        s = _surah_by_name(conn, parts[0])
        if s:
            return "verse_ref", {"surah": s["number"], "ayah": int(parts[1]), "to": None}
    s = _surah_by_name(conn, raw)
    if s:
        return "surah", {"surah": s["number"]}
    if has_arabic(raw):
        tokens = raw.split()
        if 2 <= len(tokens) <= 5 and all(len(normalize(t)) == 1 for t in tokens):
            letters = parse_root_input(raw)
            if letters:
                return "root", {"letters": letters}
        if len(tokens) > 1:
            return "arabic_phrase", {}
        return "arabic_word", {}
    if re.fullmatch(r"\s*[a-zA-Zʿʾ'’ḥḫṣḍṭẓġšṯḏ]{1,3}(\s*[-_ ]\s*[a-zA-Zʿʾ'’ḥḫṣḍṭẓġšṯḏ]{1,3}){1,3}\s*", raw):
        candidates = root_input_candidates(raw)
        if candidates:
            return "root", {"letters": candidates[0], "candidates": candidates}
    return "latin", {}


def _root_row(conn: Connection, key: str) -> dict[str, Any] | None:
    return one(
        conn,
        "select key, spaced, translit, occurrences, lemma_count, verse_count from content.roots where key = :k",
        {"k": key},
    )


_CLITICS = ("وال", "فال", "بال", "كال", "لل", "ال", "و", "ف")


def _lemma_candidates(norm_q: str) -> list[str]:
    """The query plus the query without a leading article/conjunction (الرحمن → رحمن), for lemma matching."""
    out = [norm_q]
    for c in _CLITICS:
        if norm_q.startswith(c) and len(norm_q) - len(c) >= 2:
            out.append(norm_q[len(c) :])
            break
    return out


def search(conn: Connection, q: str, limit: int = 20) -> dict[str, Any]:
    kind, info = detect(conn, q)
    results: dict[str, list[dict[str, Any]]] = {
        "verses": [],
        "surahs": [],
        "roots": [],
        "lemmas": [],
        "words": [],
    }
    norm_q = normalize(q)
    # Text pasted from a mushaf is matched on the Uthmani shadow; everyday spelling on the imlāʾī one.
    wcol, vcol = ("norm_uthmani", "norm_uthmani") if is_uthmani(q) else ("norm", "norm")

    if kind == "verse_ref":
        v = one(
            conn,
            "select key, surah, ayah, text_qpc, text_imlaei from content.verses where surah = :s and ayah = :a",
            {"s": info["surah"], "a": info["ayah"]},
        )
        if v:
            results["verses"].append(v)
    elif kind == "surah":
        s = one(conn, "select * from content.surahs where number = :n", {"n": info["surah"]})
        if s:
            results["surahs"].append(s)
    elif kind == "root":
        # Every reading of the input that is a real root, most frequent first (r-h-m → رحم; h-m-d → حمد, همد).
        keys = [root_key(c) for c in info.get("candidates") or [info["letters"]]]
        results["roots"] = rows(
            conn,
            """select key, spaced, translit, occurrences, lemma_count, verse_count from content.roots
               where key = any(:ks) order by occurrences desc, id""",
            {"ks": keys},
        )
    if kind in ("arabic_word", "arabic_phrase") or (
        kind == "surah" and has_arabic(q) and not norm_q.isdigit()
    ):
        # A surah name (النور، الفجر) is also an Arabic word — search it as one too.
        if kind in ("arabic_word", "surah") and " " not in norm_q.strip():
            # exact forms first, then forms that start with the query; grouped by form + lemma
            results["words"] = rows(
                conn,
                f"""select w.norm as form, min(w.text_imlaei) as display, count(*)::int as occurrences,
                          (array_agg(w.location order by w.id))[1] as sample, l.id as lemma_id, l.ar as lemma, r.key as root,
                          bool_or(w.{wcol} = :q) as exact
                   from content.words w
                   left join content.lemmas l on l.id = w.lemma_id
                   left join content.roots r on r.id = w.root_id
                   where w.{wcol} = :q or w.{wcol} like :prefix
                   group by w.norm, l.id, l.ar, r.key
                   order by bool_or(w.{wcol} = :q) desc, count(*) desc
                   limit :limit""",
                {"q": norm_q, "prefix": norm_q.replace("%", "").replace("_", "") + "%", "limit": limit},
            )
            for w in results["words"]:
                w["lemma"] = lemma_display(w["lemma"])
            results["lemmas"] = rows(
                conn,
                """select l.id, l.ar, l.pos, l.occurrences, r.key as root from content.lemmas l
                   left join content.roots r on r.id = l.root_id
                   where l.norm = any(:qs) or l.norm_plain = any(:qs) order by l.occurrences desc limit :limit""",
                {"qs": _lemma_candidates(norm_q), "limit": limit},
            )
            for lem in results["lemmas"]:
                lem["ar"] = lemma_display(lem["ar"])
            root_keys: list[str] = []
            letters = parse_root_input(q)
            if letters and 3 <= len(letters) <= 4:
                root_keys.append(root_key(letters))
            root_keys += [w["root"] for w in results["words"] if w["root"]]
            seen: set[str] = set()
            for k in root_keys:
                if k in seen:
                    continue
                seen.add(k)
                r = _root_row(conn, k)
                if r:
                    results["roots"].append(r)
                if len(results["roots"]) >= 5:
                    break
        pattern = "%" + norm_q.replace("%", "").replace("_", "") + "%"
        results["verses"] = rows(
            conn,
            f"""select v.key, v.surah, v.ayah, v.text_qpc, v.text_imlaei, s.name_ar, s.name_translit
               from content.verses v join content.surahs s on s.number = v.surah
               where v.{vcol} like :p order by v.id limit :limit""",
            {"p": pattern, "limit": limit},
        )
    if kind == "latin":
        like = "%" + q.strip().lower().replace("%", "").replace("_", "") + "%"
        results["lemmas"] = rows(
            conn,
            """select l.id, l.ar, l.pos, l.occurrences, l.gloss_en, r.key as root from content.lemmas l
               left join content.roots r on r.id = l.root_id
               where lower(l.gloss_en) like :p order by l.occurrences desc limit :limit""",
            {"p": like, "limit": limit},
        )
        for lem in results["lemmas"]:
            lem["ar"] = lemma_display(lem["ar"])
        results["words"] = rows(
            conn,
            """select w.norm as form, min(w.text_imlaei) as display, count(*)::int as occurrences,
                      (array_agg(w.location order by w.id))[1] as sample, l.id as lemma_id, l.ar as lemma, r.key as root, false as exact
               from content.words w left join content.lemmas l on l.id = w.lemma_id
               left join content.roots r on r.id = w.root_id
               where lower(w.translit) like :p or lower(w.gloss_en) like :p
               group by w.norm, l.id, l.ar, r.key order by count(*) desc limit :limit""",
            {"p": like, "limit": limit},
        )
        for w in results["words"]:
            w["lemma"] = lemma_display(w["lemma"])

    ar, en = LABELS[kind]
    return {
        "query": q,
        "detected": {"kind": kind, "label_ar": ar, "label_en": en, **info},
        "results": results,
    }
