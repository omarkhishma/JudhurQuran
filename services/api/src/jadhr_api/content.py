"""Content queries. Every function takes an open connection and returns plain dicts/lists
shaped for the API schemas in ``schemas.py``."""

from __future__ import annotations

import hashlib
import re
from typing import Any

from jadhr_arabic import key as root_key
from jadhr_arabic import root_input_candidates
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


def catalog(conn: Connection) -> dict[str, Any]:
    """Compact index of addressable content: [surah, ayah, words] per verse and every root key."""
    verses = rows(conn, "select surah, ayah, word_count from content.verses order by id")
    roots = rows(conn, "select key from content.roots order by occurrences desc, id")
    return {
        "loaded_at": dataset(conn)["loaded_at"],
        "verses": [[v["surah"], v["ayah"], v["word_count"]] for v in verses],
        "roots": [r["key"] for r in roots],
    }


def sources(conn: Connection) -> list[dict[str, Any]]:
    return rows(
        conn,
        """select id, kind, role, role_ar, title_ar, title_en, version, url, license, license_ar, license_url,
                  attribution_ar, attribution_en from content.sources order by kind, id""",
    )


def source_layers(conn: Connection) -> dict[str, Any]:
    """Every other source the product shows, layer by layer, with its licence and the credit it asks for —
    so the sources page lists all of them, not only the text and morphology (licence register, P1.8)."""
    credit = "licence, licence_url, redistributable, attribution_ar, attribution_en"
    people = (
        "title_ar, title_en, author_ar, author_en, death_hijri, death_ce, edition_ar, edition_en, source_url"
    )
    return {
        "knowledge": rows(
            conn,
            """select id, kind, use, title_ar, title_en, version, url, license, license_ar, license_url,
                      attribution_ar, attribution_en from content.knowledge_sources order by id""",
        ),
        "relations": rows(
            conn, f"select id, kind, {people}, {credit} from content.relation_sources order by sort_order"
        ),
        "patterns": rows(
            conn, f"select id, role, {people}, {credit} from content.pattern_sources order by sort_order"
        ),
        "particles": rows(
            conn, f"select id, {people}, {credit} from content.particle_sources order by sort_order"
        ),
        "gharib": rows(
            conn,
            f"""select id, title_ar, title_en, publisher_ar, publisher_en, version, source_url, display_only, {credit}
                from content.gharib_works order by sort_order""",
        ),
        "recitations": {"reciters": reciters(conn), "credit": AUDIO_CREDIT},
    }


# ─── surahs & verses ────────────────────────────────────────────────────────


def surahs(conn: Connection) -> list[dict[str, Any]]:
    return rows(conn, "select * from content.surahs order by number")


def surah(conn: Connection, number: int) -> dict[str, Any] | None:
    return one(conn, "select * from content.surahs where number = :n", {"n": number})


_VERSE_COLS = """v.id, v.surah, v.ayah, v.key, v.page, v.juz, v.line_start, v.line_end, v.hizb_mark,
                 v.hizb_quarter, v.manzil, v.ruku, v.sajda,
                 v.text_qpc, v.number_text, v.text_imlaei, v.word_count, v.token_count,
                 v.lexical_level, v.lexical_profile"""


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
        "w.translit, w.gloss_en, r.key as root, l.ar as lemma, l.id as lemma_id, l.slug as lemma_slug"
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
        """select id, key, slug, ar, ar_bare, pos, verb_form, derivation, occurrences, verse_count, gloss_en, pattern,
                  pattern_method
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
    names = one(
        conn, "select name_ar, name_translit from content.surahs where number = :n", {"n": v["surah"]}
    )
    assert names is not None
    v["surah_name_ar"], v["surah_name_translit"] = names["name_ar"], names["name_translit"]
    w["verse"] = v

    w["lemma"] = None
    if w["lemma_id"]:
        lem = one(
            conn,
            """select id, key, ar, ar_bare, pos, verb_form, derivation, occurrences, verse_count, gloss_en, pattern, pattern_method
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
    w["audio"] = word_audio(conn, v["key"], w["token_from"], w["token_to"])
    w["signs"] = token_signs(conn, w["verse_id"], w["token_to"])

    w["variants"] = rows(
        conn,
        """select rv.source, rv.root_key, s.title_ar as source_title_ar, s.title_en as source_title_en, s.url
           from content.root_variants rv join content.sources s on s.id = rv.source
           where rv.word_id = :id order by rv.source""",
        {"id": w["id"]},
    )
    w["occurrences"] = word_occurrence_counts(conn, w)
    if w["root"]:
        lex = root_lexicon(conn, w["root"]["key"], excerpt=700)
        mufradat = next((x for x in lex["works"] if x["id"] == "mufradat"), None)
        w["root_meaning"] = {
            "core": lex["core_meaning"],
            "mufradat": (
                {
                    k: mufradat[k]
                    for k in (
                        "id",
                        "title_ar",
                        "title_en",
                        "author_ar",
                        "death_hijri",
                        "attribution_ar",
                        "attribution_en",
                    )
                }
                | {"entry": mufradat["entries"][0]}
                if mufradat
                else None
            ),
        }
    else:
        w["root_meaning"] = None
    w["glosses"] = word_glosses(conn, w["location"])
    w["meanings_here"] = word_meanings_here(conn, w["location"])
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
    """The root a typed input names. Plain ASCII may name several (h-m-d: حمد or همد); the most frequent
    existing one wins — search lists all of them."""
    keys = [root_key(c) for c in root_input_candidates(raw)]
    if not keys:
        return None
    return one(
        conn,
        """select id, key, letters, spaced, translit, occurrences, verse_count, surah_count, lemma_count,
                  gist_source->>'usul' as usul
           from content.roots where key = any(:ks) order by occurrences desc, id limit 1""",
        {"ks": keys},
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
    r["lexicon"] = root_lexicon(conn, r["key"])
    r.pop("id")
    return r


def roots_list(
    conn: Connection,
    letters: list[str | None],
    order: str,
    limit: int,
    offset: int,
    keys: list[str] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    conds: list[str] = []
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    for i, letter in enumerate(letters):
        if letter:
            conds.append(f"letters[{i + 1}] = :l{i}")
            params[f"l{i}"] = letter
    if keys:
        conds.append("key = any(:keys)")
        params["keys"] = keys
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
    conn: Connection, root_raw: str, lemma_id: int | None, limit: int, after: int, form: str | None = None
) -> dict[str, Any] | None:
    r = resolve_root(conn, root_raw)
    if r is None:
        return None
    params: dict[str, Any] = {"r": r["id"], "after": after, "limit": limit + 1}
    lemma_cond = ""
    if lemma_id is not None:
        lemma_cond = "and w.lemma_id = :lem"
        params["lem"] = lemma_id
    if form:
        lemma_cond += " and w.text_imlaei = :form"
        params["form"] = form
    occ = rows(
        conn,
        f"""select w.id, w.location, w.surah, w.ayah, w.verse_id, w.token_from, w.token_to, w.text_imlaei as form,
                   l.ar as lemma, l.id as lemma_id, w.pos, s.name_ar as surah_name_ar
            from content.words w left join content.lemmas l on l.id = w.lemma_id
            join content.surahs s on s.number = w.surah
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
                "surah_name_ar": o["surah_name_ar"],
            }
        )
    total = int(
        scalar(
            conn,
            f"select count(*) from content.words w where w.root_id = :r {lemma_cond}",
            {k: v for k, v in params.items() if k in ("r", "lem", "form")},
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
                  l.gloss_en, l.pattern, l.pattern_method, r.key as root, r.spaced as root_spaced
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


def clean_passage(text: str, strip_number: bool) -> str:
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
            p["text"] = clean_passage(p["text"], w["strip_leading_number"])
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
            {"text": clean_passage(t["text"], w["strip_leading_number"]), "footnotes": t["footnotes"]}
            if t
            else None
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
        p["text"] = clean_passage(p["text"], strip)
    return {"work": w, "passages": passages}


# ─── root graph document ────────────────────────────────────────────────────


def root_graph(conn: Connection, raw: str) -> dict[str, Any] | None:
    """Everything the root-family canvas needs in one payload: root → lemmas → surface word forms,
    each form with its occurrence count and its first verse (excerpt tokens + reference)."""
    r = resolve_root(conn, raw)
    if r is None:
        return None
    lemmas = root_lemmas(conn, r["id"])
    forms = rows(
        conn,
        """with f as (
             select w.lemma_id, w.text_imlaei as form, count(*)::int as occurrences, min(w.id) as first_id
             from content.words w where w.root_id = :r group by w.lemma_id, w.text_imlaei)
           select f.lemma_id, f.form, f.occurrences, w.location, w.text_uthmani, w.verse_id, w.token_from, w.token_to,
                  v.key as verse_key, v.surah, v.ayah, s.name_ar as surah_name_ar
           from f join content.words w on w.id = f.first_id
           join content.verses v on v.id = w.verse_id join content.surahs s on s.number = v.surah
           order by f.lemma_id, f.occurrences desc, f.first_id""",
        {"r": r["id"]},
    )
    verse_ids = list({f["verse_id"] for f in forms})
    toks = rows(
        conn,
        "select verse_id, position, text from content.tokens where verse_id = any(:ids) order by verse_id, position",
        {"ids": verse_ids},
    )
    by_v: dict[int, list[str]] = {}
    for t in toks:
        by_v.setdefault(t["verse_id"], []).append(t["text"])
    by_lemma: dict[int, list[dict[str, Any]]] = {}
    for f in forms:
        vt = by_v[f["verse_id"]]
        a, b = f["token_from"] - 1, f["token_to"]
        by_lemma.setdefault(f["lemma_id"], []).append(
            {
                "form": f["form"],
                "occurrences": f["occurrences"],
                "first": {
                    "location": f["location"],
                    "verse_key": f["verse_key"],
                    "surah_name_ar": f["surah_name_ar"],
                    "word": " ".join(vt[a:b]),
                    "left": " ".join(vt[max(0, a - 5) : a]),
                    "right": " ".join(vt[b : b + 5]),
                },
            }
        )
    for lem in lemmas:
        lem["forms"] = by_lemma.get(lem["id"], [])
    r.pop("id")
    return {"root": r, "lemmas": lemmas}


# ─── lexica ─────────────────────────────────────────────────────────────────

_LEX_WORK_COLS = """w.id, w.title_ar, w.title_en, w.author_ar, w.author_en, w.death_hijri, w.death_ce, w.lang,
                    w.edition_note, w.source_url, w.license, w.attribution_ar, w.attribution_en, w.redistributable,
                    w.kind, w.sort_order"""


def root_lexicon(conn: Connection, root_key: str, excerpt: int = 600) -> dict[str, Any]:
    """Displayable articles for a root, grouped by work, with an excerpt; full bodies load on demand."""
    entries = rows(
        conn,
        f"""select e.id as entry_id, e.work_id, e.headword, e.match, e.confidence, e.core_meaning, e.page_ref,
                   left(e.body, :n) as excerpt, length(e.body) as length, {_LEX_WORK_COLS}
            from content.lexicon_entries e join content.lexicon_works w on w.id = e.work_id
            where e.root_key = :k and e.displayable order by w.sort_order, e.id""",
        {"k": root_key, "n": excerpt},
    )
    works_out: dict[str, dict[str, Any]] = {}
    core = None
    for e in entries:
        w = works_out.setdefault(
            e["work_id"],
            {
                k: e[k]
                for k in (
                    "id",
                    "title_ar",
                    "title_en",
                    "author_ar",
                    "author_en",
                    "death_hijri",
                    "death_ce",
                    "lang",
                    "edition_note",
                    "source_url",
                    "license",
                    "attribution_ar",
                    "attribution_en",
                    "redistributable",
                )
            }
            | {"entries": []},
        )
        w["entries"].append(
            {"id": e["entry_id"]}
            | {
                k: e[k]
                for k in ("headword", "match", "confidence", "core_meaning", "page_ref", "excerpt", "length")
            }
        )
        if e["core_meaning"] and core is None and e["confidence"] in ("exact", "manual"):
            core = {
                "text": e["core_meaning"],
                "work_id": e["work_id"],
                "title_ar": e["title_ar"],
                "title_en": e["title_en"],
                "author_ar": e["author_ar"],
                "page_ref": e["page_ref"],
                "entry_id": e["entry_id"],
            }
    return {"core_meaning": core, "works": list(works_out.values())}


def lexicon_entry(conn: Connection, entry_id: int) -> dict[str, Any] | None:
    e = one(
        conn,
        f"""select e.id as entry_id, e.work_id, e.root_key, e.headword, e.match, e.confidence, e.body, e.core_meaning,
                   e.page_ref, e.source_ref, {_LEX_WORK_COLS}
            from content.lexicon_entries e join content.lexicon_works w on w.id = e.work_id
            where e.id = :id and e.displayable""",
        {"id": entry_id},
    )
    return e


def word_glosses(conn: Connection, location: str) -> list[dict[str, Any]]:
    return rows(
        conn,
        """select g.id, g.phrase, g.gloss, g.page_ref, w.title_ar, w.title_en, w.author_ar, w.attribution_ar, w.attribution_en
           from content.gharib_glosses g join content.lexicon_works w on w.id = g.work_id
           where :loc = any(g.word_locations) order by g.id""",
        {"loc": location},
    )


def word_meanings_here(conn: Connection, location: str) -> list[dict[str, Any]]:
    """The contextual meaning of the phrase this word belongs to, from al-Muyassar fī Gharīb (P3.1), with the
    work's credit; display-only, never bulk."""
    return rows(
        conn,
        """select m.id, m.phrase_ar, m.meaning_ar, m.match_confidence, m.mushaf_page, m.locator, m.status,
                  w.title_ar, w.title_en, w.publisher_ar, w.publisher_en, w.attribution_ar, w.attribution_en,
                  w.display_only
           from content.gharib_meanings m join content.gharib_works w on w.id = m.work_id
           where :loc = any(m.word_locations) order by w.sort_order, m.seq""",
        {"loc": location},
    )


def lemma_mufradat(conn: Connection, lemma_key: str) -> dict[str, Any] | None:
    """al-Rāghib's treatment of this lemma (P3.1): the sub-entries of al-Mufradāt mapped to it, each verbatim
    with its page, how it was mapped, and the senses al-Rāghib numbers in it."""
    subs = rows(
        conn,
        """select s.id, s.entry_id, s.headword_ar, s.text_ar, s.page_ref, s.match_method, s.match_confidence,
                  s.status, s.verses
           from content.mufradat_subentries s
           where s.lemma_key = :k or :k = any(s.lemma_keys) order by s.entry_id, s.seq""",
        {"k": lemma_key},
    )
    if not subs:
        return None
    senses = rows(
        conn,
        """select subentry_id, list_no, sense_index, marker_ar, announcement_ar, stated_count, found_count, text_ar,
                  verses, page_ref
           from content.mufradat_senses where subentry_id = any(:ids) order by subentry_id, list_no, sense_index""",
        {"ids": [s["id"] for s in subs]},
    )
    for s in subs:
        s["senses"] = [
            {k: v for k, v in x.items() if k != "subentry_id"} for x in senses if x["subentry_id"] == s["id"]
        ]
    work = one(
        conn,
        """select id, title_ar, title_en, author_ar, author_en, death_hijri, death_ce, attribution_ar, attribution_en,
                  redistributable from content.lexicon_works where id = 'mufradat'""",
    )
    return {"work": work, "subentries": subs}


def particle_links(
    conn: Connection, slug: str, segments: list[dict[str, Any]] | None
) -> list[dict[str, Any]]:
    """The particle entries that treat this word (P3.8): by its lemma, or by an affix of this occurrence
    (its prefix و or ب, its suffix ن …, by the corpus tag). A summary each; the senses load on demand."""
    affixes = [
        s
        for s in segments or []
        if s.get("kind") in ("prefix", "suffix") and (s.get("label") or {}).get("tag")
    ]
    tags = [s["label"]["tag"] for s in affixes]
    found = rows(
        conn,
        """select e.id, e.source_id, e.headword_ar, e.descriptor_ar, e.section_ar, e.sense_count, e.stated_count,
                  e.match_method, e.match_confidence, e.page_vol, e.page, e.affix_tags,
                  (:slug = any(e.lemma_slugs)) as by_lemma,
                  s.title_ar, s.title_en, s.author_ar, s.author_en
           from content.particle_entries e join content.particle_sources s on s.id = e.source_id
           where :slug = any(e.lemma_slugs) or e.affix_tags && cast(:tags as text[])
           order by (:slug = any(e.lemma_slugs)) desc, s.sort_order, e.seq""",
        {"slug": slug, "tags": tags},
    )
    out = []
    for e in found:
        hit = [a for a in affixes if a["label"]["tag"] in e["affix_tags"]]
        e["via"] = (
            {"kind": "lemma"}
            if e.pop("by_lemma")
            else {"kind": "affix", "text": hit[0]["text"], "label": hit[0]["label"]}
        )
        e.pop("affix_tags")
        out.append(e)
    return out


def particle_entry(conn: Connection, entry_id: str) -> dict[str, Any] | None:
    """One particle entry with every intro, numbered sense and note in the author's order, and its source."""
    e = one(
        conn,
        """select id, source_id, headword_ar, descriptor_ar, section_ar, sense_count, stated_count, match_method,
                  match_confidence, locator, page_vol, page, status
           from content.particle_entries where id = :id""",
        {"id": entry_id},
    )
    if e is None:
        return None
    e["senses"] = rows(
        conn,
        """select id, kind, list_no, list_depth, parent_id, sense_index, marker_ar, label_ar, text_ar, verses, page_vol,
                  page, status
           from content.particle_senses where entry_id = :id order by ordinal""",
        {"id": entry_id},
    )
    e["source"] = one(
        conn,
        """select id, title_ar, title_en, author_ar, author_en, death_hijri, death_ce, edition_ar, edition_en,
                  licence, licence_url, attribution_ar, attribution_en
           from content.particle_sources where id = :s""",
        {"s": e["source_id"]},
    )
    return e


def lexicon_works(conn: Connection) -> list[dict[str, Any]]:
    return rows(
        conn,
        f"""select {_LEX_WORK_COLS}, (select count(*) from content.lexicon_entries e where e.work_id = w.id and e.displayable)::int as displayed_entries
            from content.lexicon_works w order by w.sort_order""",
    )


# ─── recitations ────────────────────────────────────────────────────────────

AUDIO_CREDIT = {
    "ar": "التلاوات من EveryAyah.com (CC BY-NC 2.5 CA)، وتوقيت الكلمات من مشروع quran-align لكولن فير (CC BY 4.0)، معدّلًا.",
    "en": "Recitations from EveryAyah.com (CC BY-NC 2.5 CA); word timings from quran-align by Collin Fair (CC BY 4.0), modified.",
    # each layer with its link and licence, as both licences ask (research 07)
    "sources": [
        {
            "id": "everyayah",
            "name": "EveryAyah.com",
            "url": "https://everyayah.com/",
            "license": "CC BY-NC 2.5 CA",
            "license_url": "https://creativecommons.org/licenses/by-nc/2.5/ca/",
        },
        {
            "id": "quran-align",
            "name": "quran-align (Collin Fair)",
            "url": "https://github.com/cpfair/quran-align",
            "license": "CC BY 4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "modified": True,
        },
    ],
}


def reciters(conn: Connection) -> list[dict[str, Any]]:
    return rows(
        conn,
        "select id, name_ar, name_en, style, is_default, word_audio from content.reciters order by sort_order",
    )


def _audio_url(template: str, surah: int, ayah: int) -> str:
    return template.replace("{surah:03d}", f"{surah:03d}").replace("{ayah:03d}", f"{ayah:03d}")


# Word audio (P3.7, D10): a word is heard as its slice of one recitation, al-Ḥuṣarī's teaching one, whose
# boundaries are refined against the audio. What keeps a slice from being clean is said, never hidden.
WORD_AUDIO_SHORT_MS = 200
_SHADDA = "\u0651"
_MARK = re.compile("[\u064b-\u065f\u0670\u06d6-\u06ed\u08f0-\u08ff]")


def _shadda_on_first(text: str) -> bool:
    """The first letter carries a shadda: the word before ran into it (idghām, «مِن رَّبِّهِمۡ»)."""
    for ch in text[1:]:
        if ch == _SHADDA:
            return True
        if not _MARK.match(ch):
            return False
    return False


def word_audio(conn: Connection, verse_key: str, token_from: int, token_to: int) -> dict[str, Any] | None:
    """The slice of the word-audio recitation for these display tokens, or None where they are untimed
    (no button then). Flags: ``wasl`` (opens with hamzat al-waṣl, whose vowel continuous reading drops),
    ``joined`` (runs into the next word or the last one runs into it, no audible dip), ``shared`` (timed by
    a segment that also holds another word), ``uncertain`` (the aligner missed or swapped words in this
    verse), ``short`` (under 200 ms)."""
    v = one(
        conn,
        """select v.id, v.surah, v.ayah, r.id as reciter_id, r.name_ar, r.name_en, r.audio_url, t.segments, t.quality
           from content.verses v join content.reciters r on r.word_audio
           join content.recitation_timings t on t.verse_id = v.id and t.reciter_id = r.id
           where v.key = :k""",
        {"k": verse_key},
    )
    if v is None:
        return None
    segs = [x for x in v["segments"] if token_from <= x[0] <= token_to]
    if not segs:
        return None
    start, end = min(x[1] for x in segs), max(x[2] for x in segs)
    q = v["quality"] or {}
    toks = {
        t["position"]: t["text"]
        for t in rows(
            conn,
            "select position, text from content.tokens where verse_id = :id and position between :a and :b",
            {"id": v["id"], "a": token_from, "b": token_to + 1},
        )
    }
    first, nxt = toks.get(token_from, ""), toks.get(token_to + 1)
    joined_next = set(q.get("joined_next") or [])
    flags: list[str] = []
    if token_from > 1 and first.startswith("\u0671"):
        flags.append("wasl")
    if (
        token_to in joined_next
        or (token_from - 1) in joined_next
        or _shadda_on_first(first)
        or (nxt is not None and _shadda_on_first(nxt))
    ):
        flags.append("joined")
    if any(p in (q.get("shared") or []) for p in range(token_from, token_to + 1)):
        flags.append("shared")
    if q.get("deletions") or q.get("transpositions"):
        flags.append("uncertain")
    if end - start < WORD_AUDIO_SHORT_MS:
        flags.append("short")
    return {
        "reciter_id": v["reciter_id"],
        "name_ar": v["name_ar"],
        "name_en": v["name_en"],
        "url": _audio_url(v["audio_url"], v["surah"], v["ayah"]),
        "start_ms": start,
        "end_ms": end,
        "refined": bool(q.get("refined")),
        "flags": flags,
    }


# The signs written in the mushaf (P3.9): their meaning in the Madinah Mushaf's own note, and which of them a
# word carries — a waqf, sakt or sajda sign ends the word's last token in the KFGQPC text.


def mushaf_signs(conn: Connection) -> dict[str, Any]:
    signs = rows(
        conn,
        """select id, kind, codepoints, chars, label_ar, text_ar, example_key, example_token, page, occurrences
           from content.mushaf_signs order by sort_order""",
    )
    source = one(
        conn,
        """select id, title_ar, title_en, url, license_ar, license_url, attribution_ar, attribution_en
           from content.knowledge_sources where id = 'kfgqpc-mushaf-key'""",
    )
    return {"data": signs, "source": source}


def token_signs(conn: Connection, verse_id: int, token_to: int) -> list[str]:
    """The ids of the signs written on the last token of a word (its end)."""
    text = scalar(
        conn,
        "select text from content.tokens where verse_id = :v and position = :p",
        {"v": verse_id, "p": token_to},
    )
    if not text:
        return []
    return [
        r["id"]
        for r in rows(
            conn, "select id, chars from content.mushaf_signs where kind <> 'hizb' order by sort_order"
        )
        if any(text.endswith(c) for c in r["chars"])
    ]


def recitation_surah(conn: Connection, reciter_id: str, surah_no: int) -> dict[str, Any] | None:
    r = one(
        conn,
        "select id, name_ar, name_en, style, audio_url from content.reciters where id = :id",
        {"id": reciter_id},
    )
    if r is None:
        return None
    vs = rows(
        conn,
        """select v.key, v.ayah, t.segments from content.verses v
           left join content.recitation_timings t on t.verse_id = v.id and t.reciter_id = :r
           where v.surah = :s order by v.id""",
        {"r": reciter_id, "s": surah_no},
    )
    tmpl = r.pop("audio_url")
    for v in vs:
        v["url"] = _audio_url(tmpl, surah_no, v["ayah"])
        v["segments"] = v["segments"] or []
    basmala = _audio_url(tmpl, 1, 1) if surah_no not in (1, 9) else None
    return {"reciter": r, "basmala_url": basmala, "verses": vs, "credit": AUDIO_CREDIT}


def recitation_verse(conn: Connection, reciter_id: str, key: str) -> dict[str, Any] | None:
    r = one(conn, "select id, audio_url from content.reciters where id = :id", {"id": reciter_id})
    v = one(
        conn,
        """select v.key, v.surah, v.ayah, coalesce(t.segments, '[]'::jsonb) as segments from content.verses v
           left join content.recitation_timings t on t.verse_id = v.id and t.reciter_id = :r where v.key = :k""",
        {"r": reciter_id, "k": key},
    )
    if r is None or v is None:
        return None
    v["url"] = _audio_url(r["audio_url"], v["surah"], v["ayah"])
    v["credit"] = AUDIO_CREDIT
    return v


# ─── reader helpers ─────────────────────────────────────────────────────────


def surah_roots(conn: Connection, number: int) -> list[dict[str, Any]]:
    """Every root used in a sūra with how often it occurs there (the rail's "roots of this sūra")."""
    return rows(
        conn,
        """select r.key, r.spaced, r.translit, count(*)::int as here, r.occurrences, r.gist_ar
           from content.words w join content.roots r on r.id = w.root_id
           where w.surah = :s group by r.id order by count(*) desc, r.key""",
        {"s": number},
    )


def related_verses(conn: Connection, key: str, limit: int = 10) -> dict[str, Any] | None:
    """Verses sharing roots with this one, ranked by the rarity of what they share: each shared root
    adds ln(6236 / verses containing it), so a shared rare root weighs more than a shared common one.
    A descriptive similarity over the text, not an interpretation."""
    v = one(conn, "select id, surah, ayah from content.verses where key = :k", {"k": key})
    if v is None:
        return None
    rel = rows(
        conn,
        """with mine as (select distinct root_id from content.words where verse_id = :v and root_id is not null),
                weights as (select r.id, ln(6236.0 / greatest(r.verse_count, 1)) as w
                            from content.roots r join mine on mine.root_id = r.id),
                shared as (select distinct w.verse_id, w.root_id from content.words w
                           join mine on mine.root_id = w.root_id where w.verse_id <> :v)
           select s.verse_id, round(sum(wt.w)::numeric, 3)::float as score, count(*)::int as shared,
                  array_agg(r.key order by wt.w desc) as roots
           from shared s join weights wt on wt.id = s.root_id join content.roots r on r.id = s.root_id
           group by s.verse_id order by sum(wt.w) desc, s.verse_id limit :n""",
        {"v": v["id"], "n": limit},
    )
    verses = {
        x["id"]: x
        for x in rows(
            conn,
            """select v.id, v.key, v.surah, v.ayah, v.text_qpc, v.text_imlaei, s.name_ar, s.name_translit
               from content.verses v join content.surahs s on s.number = v.surah where v.id = any(:ids)""",
            {"ids": [r["verse_id"] for r in rel]},
        )
    }
    return {
        "key": key,
        "method": "shared roots weighted by rarity: sum of ln(6236 / verses containing the root)",
        "data": [r | {"verse": verses[r["verse_id"]]} for r in rel],
    }


def divisions(conn: Connection) -> dict[str, Any]:
    """Where each juzʾ and ḥizb begins (the rail's navigation): first verse, its sūra and mushaf page."""
    juz = rows(
        conn,
        """select distinct on (v.juz) v.juz as number, v.key, v.surah, v.ayah, v.page, s.name_ar, s.name_translit
           from content.verses v join content.surahs s on s.number = v.surah order by v.juz, v.id""",
    )
    hizb = rows(
        conn,
        """select distinct on ((v.hizb_quarter - 1) / 4) (v.hizb_quarter - 1) / 4 + 1 as number, v.juz, v.key,
                  v.surah, v.ayah, v.page, s.name_ar, s.name_translit
           from content.verses v join content.surahs s on s.number = v.surah
           order by (v.hizb_quarter - 1) / 4, v.id""",
    )
    return {"juz": juz, "hizb": hizb, "pages": 604}


def surah_lemma_sets(conn: Connection) -> dict[str, list[str]]:
    """The distinct words (lemma slugs) of each sūra, for vocabulary coverage in study mode (RDR-571)."""
    out: dict[str, list[str]] = {}
    for r in rows(
        conn,
        """select w.surah, array_agg(distinct l.slug order by l.slug) as slugs
           from content.words w join content.lemmas l on l.id = w.lemma_id group by w.surah order by w.surah""",
    ):
        out[str(r["surah"])] = r["slugs"]
    return out


def surah_lines(conn: Connection, number: int, kind: str) -> dict[str, str]:
    """One optional reading line per verse, fetched only when the reader turns it on: the verse in
    standard spelling (imlāʾī, D7) or its word-by-word transliteration (the corpus's, joined)."""
    if kind == "imlaei":
        return {
            str(r["ayah"]): r["text_imlaei"]
            for r in rows(
                conn,
                "select ayah, text_imlaei from content.verses where surah = :s order by ayah",
                {"s": number},
            )
        }
    return {
        str(r["ayah"]): r["line"]
        for r in rows(
            conn,
            """select ayah, string_agg(coalesce(translit, ''), ' ' order by position) as line
               from content.words where surah = :s group by ayah order by ayah""",
            {"s": number},
        )
    }
