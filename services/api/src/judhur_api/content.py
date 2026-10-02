"""Content queries. Every function takes an open connection and returns plain dicts/lists
shaped for the API schemas in ``schemas.py``."""

from __future__ import annotations

import hashlib
import re
from typing import Any

from judhur_arabic import key as root_key
from judhur_arabic import parse_root_input
from sqlalchemy import Connection

from .db import one, rows, scalar

SHADDA = "ّ"


def lemma_display(ar: str | None) -> str | None:
    """Corpus lemmas sometimes carry a shadda on their first letter that belongs to the preceding
    word's assimilation (مَّعْلُوم). That mark is context, not part of the lemma — drop it for display."""
    if ar and len(ar) > 1 and ar[1] == SHADDA:
        return ar[0] + ar[2:]
    return ar


# ─── meta ───────────────────────────────────────────────────────────────────


def dataset(conn: Connection) -> dict[str, Any]:
    d = one(conn, "select version, text_sha256, counts, loaded_at from content.dataset")
    if d is None:
        raise RuntimeError("no dataset loaded")
    return d


def sources(conn: Connection) -> list[dict[str, Any]]:
    return rows(
        conn,
        """select id, kind, role, title_ar, title_en, version, url, license, license_url,
                  attribution_ar, attribution_en from content.sources order by kind, id""",
    )


# ─── surahs & verses ────────────────────────────────────────────────────────


def surahs(conn: Connection) -> list[dict[str, Any]]:
    return rows(conn, "select * from content.surahs order by number")


def surah(conn: Connection, number: int) -> dict[str, Any] | None:
    return one(conn, "select * from content.surahs where number = :n", {"n": number})


_VERSE_COLS = """v.id, v.surah, v.ayah, v.key, v.page, v.juz, v.line_start, v.line_end, v.hizb_mark,
                 v.hizb_quarter, v.manzil, v.ruku, v.sajda,
                 v.text_qpc, v.number_text, v.text_imlaei, v.word_count, v.token_count"""


def _attach_tokens_and_words(conn: Connection, verses: list[dict[str, Any]], full_words: bool) -> None:
    if not verses:
        return
    ids = [v["id"] for v in verses]
    toks = rows(
        conn,
        "select verse_id, position, text, word_from, word_to from content.tokens "
        "where verse_id = any(:ids) order by verse_id, position",
        {"ids": ids},
    )
    word_cols = (
        "w.verse_id, w.position, w.location, w.token_from, w.token_to, w.pos, w.text_uthmani, w.text_imlaei, "
        "w.translit, w.gloss_en, r.key as root, l.ar as lemma, l.id as lemma_id"
    )
    if full_words:
        word_cols += ", w.features, w.segments, w.definite"
    words = rows(
        conn,
        f"""select {word_cols}
            from content.words w
            left join content.roots r on r.id = w.root_id
            left join content.lemmas l on l.id = w.lemma_id
            where w.verse_id = any(:ids) order by w.verse_id, w.position""",
        {"ids": ids},
    )
    by_verse_t: dict[int, list[dict[str, Any]]] = {i: [] for i in ids}
    by_verse_w: dict[int, list[dict[str, Any]]] = {i: [] for i in ids}
    for t in toks:
        by_verse_t[t.pop("verse_id")].append(t)
    for w in words:
        w["lemma"] = lemma_display(w["lemma"])
        by_verse_w[w.pop("verse_id")].append(w)
    for v in verses:
        v["tokens"] = by_verse_t[v["id"]]
        v["words"] = by_verse_w[v["id"]]


def surah_verses(conn: Connection, number: int, start: int, end: int) -> list[dict[str, Any]]:
    verses = rows(
        conn,
        f"select {_VERSE_COLS} from content.verses v where v.surah = :s and v.ayah between :a and :b order by v.id",
        {"s": number, "a": start, "b": end},
    )
    _attach_tokens_and_words(conn, verses, full_words=False)
    return verses


def verse(conn: Connection, surah_no: int, ayah: int) -> dict[str, Any] | None:
    v = one(
        conn,
        f"select {_VERSE_COLS} from content.verses v where v.surah = :s and v.ayah = :a",
        {"s": surah_no, "a": ayah},
    )
    if v is None:
        return None
    _attach_tokens_and_words(conn, [v], full_words=True)
    nav = one(
        conn,
        """select (select key from content.verses where id = :id - 1) as prev,
                  (select key from content.verses where id = :id + 1) as next""",
        {"id": v["id"]},
    )
    v["prev"], v["next"] = (nav or {}).get("prev"), (nav or {}).get("next")
    return v


def verses_by_page(conn: Connection, page: int) -> list[dict[str, Any]]:
    verses = rows(
        conn, f"select {_VERSE_COLS} from content.verses v where v.page = :p order by v.id", {"p": page}
    )
    _attach_tokens_and_words(conn, verses, full_words=False)
    return verses


# ─── words ──────────────────────────────────────────────────────────────────


def _root_summary(conn: Connection, root_id: int) -> dict[str, Any] | None:
    return one(
        conn,
        """select id, key, letters, spaced, translit, occurrences, verse_count, surah_count, lemma_count
           from content.roots where id = :id""",
        {"id": root_id},
    )


def root_lemmas(conn: Connection, root_id: int) -> list[dict[str, Any]]:
    lem = rows(
        conn,
        """select id, key, ar, ar_bare, pos, verb_form, derivation, occurrences, verse_count, gloss_en, pattern
           from content.lemmas where root_id = :r order by occurrences desc, id""",
        {"r": root_id},
    )
    for x in lem:
        x["ar"] = lemma_display(x["ar"])
    return lem


def _stable_pick(seed: str, n: int) -> int:
    return int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16) % n if n else 0


def word(conn: Connection, location: str) -> dict[str, Any] | None:
    w = one(
        conn,
        """select w.id, w.location, w.surah, w.ayah, w.position, w.verse_id, w.token_from, w.token_to,
                  w.text_uthmani, w.text_imlaei, w.pos, w.definite, w.features, w.segments, w.translit, w.gloss_en,
                  w.root_id, w.lemma_id
           from content.words w where w.location = :loc""",
        {"loc": location},
    )
    if w is None:
        return None
    v = one(
        conn,
        "select id, key, surah, ayah, text_qpc, number_text, page, juz from content.verses where id = :id",
        {"id": w["verse_id"]},
    )
    assert v is not None
    v["tokens"] = rows(
        conn,
        "select position, text, word_from, word_to from content.tokens where verse_id = :id order by position",
        {"id": w["verse_id"]},
    )
    v["surah_name_ar"] = scalar(
        conn, "select name_ar from content.surahs where number = :n", {"n": v["surah"]}
    )
    w["verse"] = v

    w["lemma"] = None
    if w["lemma_id"]:
        lem = one(
            conn,
            """select id, key, ar, ar_bare, pos, verb_form, derivation, occurrences, verse_count, gloss_en, pattern
               from content.lemmas where id = :id""",
            {"id": w["lemma_id"]},
        )
        if lem:
            lem["ar"] = lemma_display(lem["ar"])
            lem["forms"] = rows(
                conn,
                """select text_imlaei as form, count(*)::int as occurrences, (array_agg(location order by id))[1] as sample
                   from content.words where lemma_id = :l group by text_imlaei order by count(*) desc limit 30""",
                {"l": w["lemma_id"]},
            )
        w["lemma"] = lem

    w["root"] = None
    if w["root_id"]:
        root = _root_summary(conn, w["root_id"])
        assert root is not None
        root["lemmas"] = root_lemmas(conn, w["root_id"])
        w["root"] = root

    w["variants"] = rows(
        conn,
        """select rv.source, rv.root_key, s.title_ar as source_title_ar, s.title_en as source_title_en, s.url
           from content.root_variants rv join content.sources s on s.id = rv.source
           where rv.word_id = :id order by rv.source""",
        {"id": w["id"]},
    )
    w["occurrences"] = word_occurrence_counts(conn, w)
    w["next_steps"] = next_steps(conn, w)
    for k in ("root_id", "lemma_id", "verse_id"):
        w.pop(k, None)
    return w


def word_occurrence_counts(conn: Connection, w: dict[str, Any]) -> dict[str, Any]:
    """How often this exact form, its lemma and its root occur — descriptive counts only."""
    same_form = scalar(
        conn,
        "select count(*) from content.words where norm = (select norm from content.words where id = :id)",
        {"id": w["id"]},
    )
    return {
        "form": int(same_form or 0),
        "lemma": w["lemma"]["occurrences"] if w["lemma"] else None,
        "root": w["root"]["occurrences"] if w["root"] else None,
    }


def next_steps(conn: Connection, w: dict[str, Any]) -> list[dict[str, Any]]:
    """Up to three deterministic doors: a cousin (same root, other lemma), another verse with the
    same lemma, and a word sharing the shape (same verb form / derivation in another root)."""
    steps: list[dict[str, Any]] = []
    root, lemma = w.get("root"), w.get("lemma")
    if root and lemma:
        cousins = [x for x in root["lemmas"] if x["id"] != lemma["id"]]
        if cousins:
            c = cousins[0]
            sample = scalar(
                conn,
                "select location from content.words where lemma_id = :l order by id limit 1",
                {"l": c["id"]},
            )
            steps.append({"kind": "cousin", "lemma": c, "location": sample})
    if lemma:
        others = rows(
            conn,
            "select location, surah, ayah from content.words where lemma_id = :l and verse_id <> :v order by id",
            {"l": lemma["id"], "v": w["verse"]["id"]},
        )
        if others:
            pick = others[_stable_pick(w["location"], len(others))]
            steps.append(
                {
                    "kind": "verse",
                    "location": pick["location"],
                    "verse_key": f"{pick['surah']}:{pick['ayah']}",
                }
            )
    feats = w["features"]
    vf = (feats.get("verb_form") or {}).get("number")
    der = (feats.get("derivation") or {}).get("tag")
    if lemma and (vf or der):
        cand = rows(
            conn,
            """select l.id, l.ar, l.pos, l.occurrences, r.key as root from content.lemmas l
               join content.roots r on r.id = l.root_id
               where l.id <> :l and l.root_id <> :r
                 and coalesce(l.verb_form, 0) = coalesce(:vf, 0) and coalesce(l.derivation, '') = coalesce(:der, '')
                 and l.pos = :pos
               order by l.occurrences desc limit 12""",
            {"l": lemma["id"], "r": root["id"] if root else -1, "vf": vf, "der": der, "pos": lemma["pos"]},
        )
        if cand:
            c = cand[_stable_pick(w["location"] + "#shape", len(cand))]
            c["ar"] = lemma_display(c["ar"])
            sample = scalar(
                conn,
                "select location from content.words where lemma_id = :l order by id limit 1",
                {"l": c["id"]},
            )
            steps.append(
                {
                    "kind": "shape",
                    "lemma": c,
                    "location": sample,
                    "verb_form": feats.get("verb_form"),
                    "derivation": feats.get("derivation"),
                }
            )
    return steps


# ─── roots ──────────────────────────────────────────────────────────────────


def resolve_root(conn: Connection, raw: str) -> dict[str, Any] | None:
    letters = parse_root_input(raw)
    if not letters:
        return None
    return one(
        conn,
        """select id, key, letters, spaced, translit, occurrences, verse_count, surah_count, lemma_count
           from content.roots where key = :k""",
        {"k": root_key(letters)},
    )


def root_detail(conn: Connection, raw: str) -> dict[str, Any] | None:
    r = resolve_root(conn, raw)
    if r is None:
        return None
    r["lemmas"] = root_lemmas(conn, r["id"])
    forms = rows(
        conn,
        """select lemma_id, text_imlaei as form, count(*)::int as occurrences, (array_agg(location order by id))[1] as sample
           from content.words where root_id = :r group by lemma_id, text_imlaei order by lemma_id, count(*) desc""",
        {"r": r["id"]},
    )
    by_lemma: dict[int, list[dict[str, Any]]] = {}
    for f in forms:
        by_lemma.setdefault(f.pop("lemma_id"), []).append(f)
    for lem in r["lemmas"]:
        lem["forms"] = by_lemma.get(lem["id"], [])
    r["distribution"] = rows(
        conn,
        """select w.surah, s.name_ar, s.name_translit, s.revelation_place, count(*)::int as occurrences
           from content.words w join content.surahs s on s.number = w.surah
           where w.root_id = :r group by w.surah, s.name_ar, s.name_translit, s.revelation_place order by w.surah""",
        {"r": r["id"]},
    )
    r["variants"] = rows(
        conn,
        """select rv.source, w.location, w.text_imlaei as form, rv.root_key as other_root
           from content.root_variants rv join content.words w on w.id = rv.word_id
           where w.root_id = :r order by w.id limit 200""",
        {"r": r["id"]},
    )
    r["also_attributed"] = rows(
        conn,
        """select rv.source, w.location, w.text_imlaei as form, r2.key as corpus_root
           from content.root_variants rv join content.words w on w.id = rv.word_id
           left join content.roots r2 on r2.id = w.root_id
           where rv.root_key = :k order by w.id limit 200""",
        {"k": r["key"]},
    )
    r.pop("id")
    return r


def roots_list(
    conn: Connection, letters: list[str | None], order: str, limit: int, offset: int
) -> tuple[list[dict[str, Any]], int]:
    conds, params = [], {"limit": limit, "offset": offset}
    for i, letter in enumerate(letters):
        if letter:
            conds.append(f"letters[{i + 1}] = :l{i}")
            params[f"l{i}"] = letter
    where = ("where " + " and ".join(conds)) if conds else ""
    order_sql = "occurrences desc, key" if order == "frequency" else "key"
    total = int(scalar(conn, f"select count(*) from content.roots {where}", params) or 0)
    data = rows(
        conn,
        f"""select key, letters, spaced, translit, occurrences, verse_count, surah_count, lemma_count
            from content.roots {where} order by {order_sql} limit :limit offset :offset""",
        params,
    )
    return data, total


def root_occurrences(
    conn: Connection, root_raw: str, lemma_id: int | None, limit: int, after: int
) -> dict[str, Any] | None:
    r = resolve_root(conn, root_raw)
    if r is None:
        return None
    params: dict[str, Any] = {"r": r["id"], "after": after, "limit": limit + 1}
    lemma_cond = ""
    if lemma_id is not None:
        lemma_cond = "and w.lemma_id = :lem"
        params["lem"] = lemma_id
    occ = rows(
        conn,
        f"""select w.id, w.location, w.surah, w.ayah, w.verse_id, w.token_from, w.token_to, w.text_imlaei as form,
                   l.ar as lemma, l.id as lemma_id, w.pos
            from content.words w left join content.lemmas l on l.id = w.lemma_id
            where w.root_id = :r {lemma_cond} and w.id > :after order by w.id limit :limit""",
        params,
    )
    has_more = len(occ) > limit
    occ = occ[:limit]
    toks = rows(
        conn,
        "select verse_id, position, text from content.tokens where verse_id = any(:ids) order by verse_id, position",
        {"ids": list({o["verse_id"] for o in occ})},
    )
    by_v: dict[int, list[str]] = {}
    for t in toks:
        by_v.setdefault(t["verse_id"], []).append(t["text"])
    out = []
    for o in occ:
        vt = by_v[o["verse_id"]]
        a, b = o["token_from"] - 1, o["token_to"]
        out.append(
            {
                "location": o["location"],
                "verse_key": f"{o['surah']}:{o['ayah']}",
                "left": " ".join(vt[:a]),
                "keyword": " ".join(vt[a:b]),
                "right": " ".join(vt[b:]),
                "form": o["form"],
                "lemma": lemma_display(o["lemma"]),
                "lemma_id": o["lemma_id"],
                "pos": o["pos"],
            }
        )
    total = int(
        scalar(
            conn,
            f"select count(*) from content.words w where w.root_id = :r {lemma_cond}",
            {k: v for k, v in params.items() if k in ("r", "lem")},
        )
        or 0
    )
    return {
        "root": {k: r[k] for k in ("key", "spaced", "translit", "occurrences")},
        "total": total,
        "data": out,
        "next_cursor": str(occ[-1]["id"]) if has_more and occ else None,
    }


def lemma_detail(conn: Connection, lemma_id: int) -> dict[str, Any] | None:
    lem = one(
        conn,
        """select l.id, l.key, l.ar, l.ar_bare, l.pos, l.verb_form, l.derivation, l.occurrences, l.verse_count,
                  l.gloss_en, l.pattern, r.key as root, r.spaced as root_spaced
           from content.lemmas l left join content.roots r on r.id = l.root_id where l.id = :id""",
        {"id": lemma_id},
    )
    if lem is None:
        return None
    lem["ar"] = lemma_display(lem["ar"])
    lem["forms"] = rows(
        conn,
        """select text_imlaei as form, count(*)::int as occurrences, (array_agg(location order by id))[1] as sample
           from content.words where lemma_id = :l group by text_imlaei order by count(*) desc""",
        {"l": lemma_id},
    )
    return lem


# ─── tafsir & translations ──────────────────────────────────────────────────

_LEADING_NUMBER = re.compile(r"^\(\d+\)\s*")

_WORK_COLS = """w.id, w.kind, w.lang, w.level, w.title_ar, w.title_en, w.author_ar, w.author_en, w.version,
                w.default_for, w.verse_coverage, w.passage_count, w.strip_leading_number,
                s.id as source_id, s.title_ar as source_title_ar, s.title_en as source_title_en, s.url as source_url,
                s.license as source_license, s.attribution_ar, s.attribution_en"""


def works(conn: Connection, kind: str | None = None, lang: str | None = None) -> list[dict[str, Any]]:
    return rows(
        conn,
        f"""select {_WORK_COLS} from content.works w join content.sources s on s.id = w.source_id
            where (cast(:kind as text) is null or w.kind = :kind) and (cast(:lang as text) is null or w.lang = :lang)
            order by w.sort_order""",
        {"kind": kind, "lang": lang},
    )


def _clean(text: str, strip_number: bool) -> str:
    return _LEADING_NUMBER.sub("", text) if strip_number else text


def verse_commentary(conn: Connection, verse_key: str, work_ids: list[str]) -> list[dict[str, Any]] | None:
    vid = scalar(conn, "select id from content.verses where key = :k", {"k": verse_key})
    if vid is None:
        return None
    meta = {w["id"]: w for w in works(conn)}
    out = []
    for wid in work_ids:
        w = meta.get(wid)
        if w is None:
            continue
        p = one(
            conn,
            """select p.text, p.footnotes, vf.key as verse_from, vt.key as verse_to
               from content.work_passages p
               join content.verses vf on vf.id = p.verse_from join content.verses vt on vt.id = p.verse_to
               where p.work_id = :w and p.verse_from <= :v and p.verse_to >= :v""",
            {"w": wid, "v": vid},
        )
        entry = {"work": {k: v for k, v in w.items() if k != "strip_leading_number"}, "passage": None}
        if p:
            p["text"] = _clean(p["text"], w["strip_leading_number"])
            entry["passage"] = p
        out.append(entry)
    return out


def attach_translation(conn: Connection, verses: list[dict[str, Any]], work_id: str) -> dict[str, Any] | None:
    w = one(
        conn,
        "select id, title_ar, title_en, strip_leading_number from content.works where id = :w and kind = 'translation'",
        {"w": work_id},
    )
    if w is None or not verses:
        return None
    texts = rows(
        conn,
        "select verse_from, text, footnotes from content.work_passages where work_id = :w and verse_from = any(:ids)",
        {"w": work_id, "ids": [v["id"] for v in verses]},
    )
    by_id = {t["verse_from"]: t for t in texts}
    for v in verses:
        t = by_id.get(v["id"])
        v["translation"] = (
            {"text": _clean(t["text"], w["strip_leading_number"]), "footnotes": t["footnotes"]} if t else None
        )
    return {"id": w["id"], "title_ar": w["title_ar"], "title_en": w["title_en"]}


def work_surah(conn: Connection, work_id: str, surah_no: int) -> dict[str, Any] | None:
    w = next((x for x in works(conn) if x["id"] == work_id), None)
    if w is None:
        return None
    passages = rows(
        conn,
        """select vf.ayah as from_ayah, vt.ayah as to_ayah, vf.surah as from_surah, vt.surah as to_surah,
                  p.text, p.footnotes
           from content.work_passages p
           join content.verses vf on vf.id = p.verse_from join content.verses vt on vt.id = p.verse_to
           where p.work_id = :w and p.verse_to >= (select min(id) from content.verses where surah = :s)
             and p.verse_from <= (select max(id) from content.verses where surah = :s)
           order by p.verse_from""",
        {"w": work_id, "s": surah_no},
    )
    strip = w.pop("strip_leading_number")
    for p in passages:
        p["text"] = _clean(p["text"], strip)
    return {"work": w, "passages": passages}
