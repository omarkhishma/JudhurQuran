"""Lexeme-centred API (PLAN P1.3): the word panel's one-request payload, patterns, glossary, texts.

Every Arabic display string comes as the envelope ``{full, bare, translit}`` (design 08 §8.1): the
client picks ``full`` or ``bare`` from its tashkīl preference without a round trip. The mushaf text is
the exception the client enforces (decision D7): Quran text is always shown ``full``.
"""

from __future__ import annotations

import hashlib
from typing import Any

from jadhr_arabic import display_bare, scholarly
from sqlalchemy import Connection

from . import content
from .db import one, rows, scalar


def ar(full: str | None, translit: str | None = None) -> dict[str, str] | None:
    """The Arabic envelope. ``translit`` defaults to our scholarly romanisation of ``full``."""
    if full is None:
        return None
    return {"full": full, "bare": display_bare(full), "translit": translit if translit else scholarly(full)}


def _pick(seed: str, n: int) -> int:
    return int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16) % n if n else 0


_LEMMA_COLS = """l.id, l.slug, l.key, l.ar, l.translit, l.pos, l.pos_ar, l.pos_en, l.verb_form, l.derivation,
                 l.occurrences, l.verse_count, l.gloss_en, l.pattern_method, l.root_id, l.pattern_id"""


def _lemma_out(x: dict[str, Any]) -> dict[str, Any]:
    full = content.lemma_display(x["ar"])
    return {
        "slug": x["slug"],
        "ar": ar(full, x.get("translit")),
        "pos": {"tag": x["pos"], "ar": x.get("pos_ar"), "en": x.get("pos_en")},
        "gloss_en": x.get("gloss_en"),
        "occurrences": x["occurrences"],
        "verse_count": x.get("verse_count"),
    }


def _pattern_out(p: dict[str, Any] | None) -> dict[str, Any] | None:
    if not p:
        return None
    return {
        "slug": p["slug"],
        "ar": ar(p["ar"], p["translit"]),
        "form_number": p["form_number"],
        "pos_hint": p["pos_hint"],
        "function_ar": p["function_ar"],
        "function_en": p["function_en"],
        "plain_ar": p["plain_ar"],
        "plain_en": p["plain_en"],
        "lemma_count": p["lemma_count"],
        "occurrences": p["occurrences"],
    }


def _root_out(r: dict[str, Any]) -> dict[str, Any]:
    return {
        "key": r["key"],
        "letters": r["letters"],
        "ar_spaced": r["spaced"],
        "translit": r["translit"],
        "gloss_en": r.get("gloss_en"),
        "gist_ar": r.get("gist_ar"),
        "gist_source": r.get("gist_source"),
        "occurrences": r["occurrences"],
        "verse_count": r["verse_count"],
        "surah_count": r["surah_count"],
        "lemma_count": r["lemma_count"],
    }


def lemma_by_slug(conn: Connection, slug: str) -> dict[str, Any] | None:
    return one(conn, f"select {_LEMMA_COLS} from content.lemmas l where l.slug = :s", {"s": slug})


def slug_at(conn: Connection, location: str) -> str | None:
    """The lemma slug of the word at a Quran location (2:255:3)."""
    return scalar(
        conn,
        "select l.slug from content.words w join content.lemmas l on l.id = w.lemma_id where w.location = :loc",
        {"loc": location},
    )


def _occurrence(conn: Connection, location: str, lemma_id: int) -> dict[str, Any] | None:
    w = one(
        conn,
        """select w.id, w.location, w.surah, w.ayah, w.position, w.verse_id, w.token_from, w.token_to, w.text_uthmani, w.text_imlaei, w.translit,
                  w.gloss_en, w.features, w.segments, w.definite, w.lemma_id, s.name_ar, s.name_translit
           from content.words w join content.surahs s on s.number = w.surah where w.location = :loc""",
        {"loc": location},
    )
    if w is None or w["lemma_id"] != lemma_id:
        return None
    return {
        "location": w["location"],
        "uri": f"quran:{w['location']}",
        "verse_key": f"{w['surah']}:{w['ayah']}",
        "surah": {"number": w["surah"], "name_ar": w["name_ar"], "name_translit": w["name_translit"]},
        "position": w["position"],
        "token_from": w["token_from"],
        "token_to": w["token_to"],
        # The occurrence as written in the mushaf, and in everyday spelling.
        "surface": ar(w["text_uthmani"], w["translit"]),
        "surface_imlaei": w["text_imlaei"],
        "gloss_en": w["gloss_en"],
        "definite": w["definite"],
        "features": w["features"],
        "segments": w["segments"],
        "glosses": content.word_glosses(conn, w["location"]),
        "audio": content.word_audio(conn, f"{w['surah']}:{w['ayah']}", w["token_from"], w["token_to"]),
        "signs": content.token_signs(conn, w["verse_id"], w["token_to"]),
        "meanings_here": content.word_meanings_here(conn, w["location"]),
        "variants": rows(
            conn,
            """select rv.source, rv.root_key, s.title_ar as source_title_ar, s.title_en as source_title_en
               from content.root_variants rv join content.sources s on s.id = rv.source
               where rv.word_id = :id order by rv.source""",
            {"id": w["id"]},
        ),
    }


def _family(conn: Connection, root_id: int) -> list[dict[str, Any]]:
    """Every lemma on the root, grouped by pattern (most-used pattern first)."""
    lemmas = rows(
        conn,
        f"select {_LEMMA_COLS} from content.lemmas l where l.root_id = :r order by l.occurrences desc, l.id",
        {"r": root_id},
    )
    pats = {
        p["id"]: p
        for p in rows(
            conn,
            "select * from content.patterns where id = any(:ids)",
            {"ids": [x["pattern_id"] for x in lemmas if x["pattern_id"]]},
        )
    }
    # lemmas al-Suyūṭī reports as non-Arabic: the family shows them apart (P3.7a)
    claimed = {
        r["lemma_id"]
        for r in rows(
            conn,
            "select distinct lemma_id from content.loanword_links where lemma_id = any(:ids)",
            {"ids": [x["id"] for x in lemmas]},
        )
    }
    groups: dict[int | None, dict[str, Any]] = {}
    for x in lemmas:
        g = groups.setdefault(
            x["pattern_id"],
            {"pattern": _pattern_out(pats.get(x["pattern_id"])) if x["pattern_id"] else None, "members": []},
        )
        g["members"].append(_lemma_out(x) | {"loanword": x["id"] in claimed})
    out = list(groups.values())
    out.sort(key=lambda g: (g["pattern"] is None, -sum(m["occurrences"] for m in g["members"])))
    return out


def _same_pattern_other_roots(conn: Connection, pattern_id: int, root_id: int | None) -> list[dict[str, Any]]:
    xs = rows(
        conn,
        f"""select {_LEMMA_COLS}, r.key as root_key, r.spaced as root_spaced from content.lemmas l
            join content.roots r on r.id = l.root_id
            where l.pattern_id = :p and l.root_id <> :r order by l.occurrences desc, l.id limit 12""",
        {"p": pattern_id, "r": root_id or -1},
    )
    return [_lemma_out(x) | {"root": {"key": x["root_key"], "ar_spaced": x["root_spaced"]}} for x in xs]


def _attestations(conn: Connection, lemma_id: int, limit: int) -> dict[str, Any]:
    forms = rows(
        conn,
        """select text_uthmani as form, text_imlaei, count(*)::int as occurrences,
                  (array_agg(location order by id))[1] as sample
           from content.words where lemma_id = :l group by text_uthmani, text_imlaei
           order by count(*) desc, min(id) limit 40""",
        {"l": lemma_id},
    )
    dist = rows(
        conn,
        """select w.surah, s.name_ar, s.name_translit, s.revelation_place, count(*)::int as occurrences
           from content.words w join content.surahs s on s.number = w.surah
           where w.lemma_id = :l group by w.surah, s.name_ar, s.name_translit, s.revelation_place
           order by w.surah""",
        {"l": lemma_id},
    )
    first = rows(
        conn,
        """select w.id, w.location, w.surah, w.ayah, w.verse_id, w.token_from, w.token_to, w.text_uthmani,
                  w.features, s.name_ar from content.words w join content.surahs s on s.number = w.surah
           where w.lemma_id = :l order by w.id limit :n""",
        {"l": lemma_id, "n": limit},
    )
    toks = rows(
        conn,
        "select verse_id, position, text from content.tokens where verse_id = any(:ids) order by verse_id, position",
        {"ids": list({o["verse_id"] for o in first})},
    )
    by_v: dict[int, list[str]] = {}
    for t in toks:
        by_v.setdefault(t["verse_id"], []).append(t["text"])
    items = []
    for o in first:
        vt = by_v[o["verse_id"]]
        a, b = o["token_from"] - 1, o["token_to"]
        items.append(
            {
                "location": o["location"],
                "uri": f"quran:{o['location']}",
                "verse_key": f"{o['surah']}:{o['ayah']}",
                "surah_name_ar": o["name_ar"],
                "left": " ".join(vt[:a]),
                "keyword": " ".join(vt[a:b]),
                "right": " ".join(vt[b:]),
                "pos": (o["features"] or {}).get("pos"),
            }
        )
    meccan = sum(d["occurrences"] for d in dist if d["revelation_place"] == "meccan")
    total = sum(d["occurrences"] for d in dist)
    return {
        "text": {"slug": "quran", "title_ar": "القرآن الكريم", "title_en": "The Quran"},
        "total": total,
        "meccan": meccan,
        "medinan": total - meccan,
        "forms": [
            {
                "form": ar(f["form"]),
                "imlaei": f["text_imlaei"],
                "occurrences": f["occurrences"],
                "sample": f["sample"],
            }
            for f in forms
        ],
        "by_chapter": dist,
        "items": items,
        "more": total > len(items),
    }


def _timeline(conn: Connection, lex: dict[str, Any], attested: bool) -> dict[str, Any]:
    """Dictionaries by death year and corpora by date. "has_article" is only that a dictionary has an
    article on this root — which sense it attests is shown only where senses are linked (P3.4a)."""
    works = rows(
        conn,
        """select id, title_ar, title_en, author_ar, author_en, death_hijri, death_ce, lang
           from content.lexicon_works order by coalesce(death_ce, 9999), sort_order""",
    )
    having = {w["id"] for w in lex["works"]}
    corpora = rows(conn, "select id, label_ar, label_en, year from content.corpora order by year, sort_order")
    return {
        "min": 550,
        "max": 1920,
        "dictionaries": [w | {"has_article": w["id"] in having} for w in works if w["death_ce"]],
        "corpora": [c | {"attests": attested} for c in corpora],
        "per_sense": None,  # sense ↔ source links arrive with the editorial workbench (P3.4a)
    }


def _next_steps(
    conn: Connection, lemma: dict[str, Any], family: list[dict[str, Any]], at: str | None
) -> list[dict[str, Any]]:
    """Three deterministic doors (seeded by slug, so everyone gets the same): a cousin, a verse, the shape."""
    seed = lemma["slug"]
    steps: list[dict[str, Any]] = []
    cousins = [(m, g["pattern"]) for g in family for m in g["members"] if m["slug"] != lemma["slug"]]
    if cousins:
        c, pat = cousins[_pick(seed + "#cousin", min(len(cousins), 5))]
        # its pattern, so the door can say "same shape" or name the other one (RDR-329)
        steps.append(
            {
                "kind": "cousin",
                "slug": c["slug"],
                "ar": c["ar"],
                "gloss_en": c["gloss_en"],
                "pattern": {"slug": pat["slug"], "ar": pat["ar"]} if pat else None,
            }
        )
    verses = rows(
        conn,
        "select location, surah, ayah from content.words where lemma_id = :l order by id",
        {"l": lemma["id"]},
    )
    if at:
        verses = [v for v in verses if v["location"] != at]
    if verses:
        v = verses[_pick(seed + "#verse", len(verses))]
        steps.append({"kind": "verse", "location": v["location"], "verse_key": f"{v['surah']}:{v['ayah']}"})
    if lemma["pattern_id"]:
        p = one(conn, "select * from content.patterns where id = :id", {"id": lemma["pattern_id"]})
        if p:
            steps.append({"kind": "pattern", "slug": p["slug"], "ar": ar(p["ar"], p["translit"])})
    return steps


def word_payload(
    conn: Connection, slug: str, at: str | None = None, limit: int = 12
) -> dict[str, Any] | None:
    lem = lemma_by_slug(conn, slug)
    if lem is None:
        return None
    root = content._root_summary(conn, lem["root_id"]) if lem["root_id"] else None
    if root:
        extra = one(
            conn,
            "select gloss_en, gist_ar, gist_source from content.roots where id = :id",
            {"id": root["id"]},
        )
        root |= extra or {}
    pattern = (
        one(conn, "select * from content.patterns where id = :id", {"id": lem["pattern_id"]})
        if lem["pattern_id"]
        else None
    )
    family = (
        _family(conn, lem["root_id"])
        if lem["root_id"]
        else [
            {
                "pattern": _pattern_out(pattern),
                "members": [_lemma_out(lem) | {"loanword": content.lemma_has_loanword(conn, lem["id"])}],
            }
        ]
    )
    lex = (
        content.root_lexicon(conn, root["key"], excerpt=900) if root else {"core_meaning": None, "works": []}
    )
    senses = rows(
        conn,
        "select id, ordinal, text_ar, text_en, sources, status from content.senses where lemma_id = :l order by ordinal",
        {"l": lem["id"]},
    )
    occurrence = _occurrence(conn, at, lem["id"]) if at else None
    attest = _attestations(conn, lem["id"], limit)
    shapes = {
        "root_patterns": [g["pattern"] for g in family if g["pattern"]],
        "same_pattern_other_roots": _same_pattern_other_roots(conn, lem["pattern_id"], lem["root_id"])
        if lem["pattern_id"]
        else [],
    }
    return {
        "slug": lem["slug"],
        "lemma_id": lem["id"],
        "mufradat": content.lemma_mufradat(conn, lem["key"]),
        "uri": f"lemma:{lem['slug']}",
        "ar": ar(content.lemma_display(lem["ar"]), lem["translit"]),
        "pos": {"tag": lem["pos"], "ar": lem["pos_ar"], "en": lem["pos_en"]},
        "verb_form": lem["verb_form"],
        "derivation": lem["derivation"],
        "gloss_en": lem["gloss_en"],
        "corpus_freq": lem["occurrences"],
        "verse_count": lem["verse_count"],
        "audio_url": None,  # word audio: the occurrence's recitation slice is served by /recitations (D10)
        "root": _root_out(root) if root else None,
        "pattern": _pattern_out(pattern) | {"method": lem["pattern_method"]} if pattern else None,
        "occurrence": occurrence,
        "particles": content.particle_links(
            conn, lem["slug"], occurrence["segments"] if occurrence else None
        ),
        # what al-Suyūṭī reports about the word's being non-Arabic (P3.7a), verbatim
        "loanwords": content.lemma_loanwords(conn, lem["id"]),
        "senses": senses,
        "senses_status": "linked" if senses else "pending",
        "core_meaning": lex["core_meaning"],
        "family": family,
        "shapes": shapes,
        "dict_articles": lex["works"],
        "timeline": _timeline(conn, lex, attest["total"] > 0),
        "attestations": attest,
        "next_steps": _next_steps(conn, lem, family, at),
    }


def word_verses(
    conn: Connection, slug: str, after: int, limit: int, form: str | None = None, surah: int | None = None
) -> dict[str, Any] | None:
    """A lemma's verses, paged by verse in mushaf order, each with every place the lemma takes in it — what a word
    card on a map extracts, «10 of 105 verses» at a time (P8.2, QAN-06) — optionally within one sūra or one written
    form, with the sūras and forms it occurs in for the reader to choose from."""
    lem = lemma_by_slug(conn, slug)
    if lem is None:
        return None
    params: dict[str, Any] = {"l": lem["id"], "after": after, "n": limit + 1}
    cond = "w.lemma_id = :l"
    if form:
        cond += " and w.text_uthmani = :form"
        params["form"] = form
    if surah:
        cond += " and w.surah = :s"
        params["s"] = surah
    found = rows(
        conn,
        f"""select w.verse_id, min(w.surah) as surah, min(w.ayah) as ayah,
                   array_agg(w.location order by w.id) as locations
            from content.words w where {cond} and w.verse_id > :after
            group by w.verse_id order by w.verse_id limit :n""",
        params,
    )
    more = len(found) > limit
    found = found[:limit]
    total = scalar(
        conn,
        f"select count(distinct w.verse_id) from content.words w where {cond}",
        {k: v for k, v in params.items() if k not in ("after", "n")},
    )
    surahs = rows(
        conn,
        """select w.surah, s.name_ar, s.name_translit, count(distinct w.verse_id)::int as verses
           from content.words w join content.surahs s on s.number = w.surah
           where w.lemma_id = :l group by w.surah, s.name_ar, s.name_translit order by w.surah""",
        {"l": lem["id"]},
    )
    forms = rows(
        conn,
        """select w.text_uthmani as form, count(distinct w.verse_id)::int as verses
           from content.words w where w.lemma_id = :l group by w.text_uthmani order by verses desc, form""",
        {"l": lem["id"]},
    )
    return {
        "slug": slug,
        "total": int(total or 0),
        # each verse's own cursor, so a reader who takes part of a page goes on from the verse after it
        "data": [{"verse_key": f"{v['surah']}:{v['ayah']}", "locations": list(v["locations"]), "cursor": str(v["verse_id"])} for v in found],
        "next_cursor": str(found[-1]["verse_id"]) if more and found else None,
        "surahs": surahs,
        "forms": forms,
    }


def word_attestations(
    conn: Connection,
    slug: str,
    after: int,
    limit: int,
    form: str | None,
    scope: str = "lemma",
    surah: int | None = None,
) -> dict[str, Any] | None:
    """Every occurrence of a lemma — or of its whole root (``scope="root"``) — in the Quran as KWIC rows,
    optionally within one sūra, paged by word id (the "In the Quran" section, RDR-558)."""
    lem = lemma_by_slug(conn, slug)
    if lem is None:
        return None
    params: dict[str, Any] = {"after": after, "n": limit + 1}
    if scope == "root" and lem["root_id"]:
        cond = "w.root_id = :r"
        params["r"] = lem["root_id"]
    else:
        cond = "w.lemma_id = :l"
        params["l"] = lem["id"]
    if form:
        cond += " and w.text_uthmani = :form"
        params["form"] = form
    if surah:
        cond += " and w.surah = :s"
        params["s"] = surah
    occ = rows(
        conn,
        f"""select w.id, w.location, w.surah, w.ayah, w.verse_id, w.token_from, w.token_to, s.name_ar,
                   s.revelation_place, l.slug as lemma_slug, w.features
            from content.words w join content.surahs s on s.number = w.surah
            left join content.lemmas l on l.id = w.lemma_id
            where {cond} and w.id > :after order by w.id limit :n""",
        params,
    )
    more = len(occ) > limit
    occ = occ[:limit]
    toks = rows(
        conn,
        "select verse_id, position, text from content.tokens where verse_id = any(:ids) order by verse_id, position",
        {"ids": list({o["verse_id"] for o in occ})},
    )
    by_v: dict[int, list[str]] = {}
    for t in toks:
        by_v.setdefault(t["verse_id"], []).append(t["text"])
    data = []
    for o in occ:
        vt = by_v[o["verse_id"]]
        a, b = o["token_from"] - 1, o["token_to"]
        data.append(
            {
                "location": o["location"],
                "verse_key": f"{o['surah']}:{o['ayah']}",
                "surah_name_ar": o["name_ar"],
                "revelation_place": o["revelation_place"],
                "lemma_slug": o["lemma_slug"],
                # this occurrence's inflection, from the corpus (RDR-269)
                "features": o["features"],
                "left": " ".join(vt[:a]),
                "keyword": " ".join(vt[a:b]),
                "right": " ".join(vt[b:]),
            }
        )
    total = scalar(
        conn,
        f"select count(*) from content.words w where {cond}",
        {k: v for k, v in params.items() if k not in ("after", "n")},
    )
    return {
        "slug": slug,
        "scope": "root" if "r" in params else "lemma",
        "total": total,
        "data": data,
        "next_cursor": str(occ[-1]["id"]) if more and occ else None,
    }


def pattern_payload(conn: Connection, slug: str, limit: int = 200) -> dict[str, Any] | None:
    p = one(conn, "select * from content.patterns where slug = :s", {"s": slug})
    if p is None:
        return None
    members = rows(
        conn,
        f"""select {_LEMMA_COLS}, r.key as root_key, r.spaced as root_spaced from content.lemmas l
            left join content.roots r on r.id = l.root_id where l.pattern_id = :p
            order by l.occurrences desc, l.id limit :n""",
        {"p": p["id"], "n": limit},
    )
    return _pattern_out(p) | {
        "members": [
            _lemma_out(x)
            | {"root": {"key": x["root_key"], "ar_spaced": x["root_spaced"]} if x["root_key"] else None}
            for x in members
        ],
        "classical": pattern_classical(conn, slug),
    }


_CLASSICAL_COLS = """id, source_id, kind, section, heading_ar, pattern_ar, form_number, match_method,
                     match_confidence, text_ar, examples_ar, cue_ar, locator, page_vol, page, status, seq"""


def pattern_classical(conn: Connection, slug: str) -> dict[str, Any]:
    """What the sarf works say about a pattern, verbatim (P3.3): the rows naming it (``direct``), naming the
    base it inflects (``inflected``, e.g. the ‑ūn plural of a participle), or defining its suffix class
    (``suffix``), each with al-Raḍī's commentary on it and the source's attribution. Rows stay
    ``extracted`` until reviewed, and say how their pattern was matched."""
    found = rows(
        conn,
        f"""select {_CLASSICAL_COLS},
                   case when :s = any(f.pattern_slugs) then 'direct'
                        when :s = any(f.inflected_slugs) then 'inflected' else 'suffix' end as via
            from content.pattern_functions f
            where f.kind <> 'commentary'
              and (:s = any(f.pattern_slugs) or :s = any(f.inflected_slugs) or :s = any(f.suffix_slugs))
            order by case when :s = any(f.pattern_slugs) then 0 when :s = any(f.inflected_slugs) then 1 else 2 end,
                     (select ps.sort_order from content.pattern_sources ps where ps.id = f.source_id), f.seq""",
        {"s": slug},
    )
    comments = (
        rows(
            conn,
            f"""select {_CLASSICAL_COLS}, comments_on from content.pattern_functions
                where kind = 'commentary' and comments_on && cast(:ids as text[]) order by seq""",
            {"ids": [r["id"] for r in found]},
        )
        if found
        else []
    )
    for r in found:
        r["commentary"] = [
            {
                k: c[k]
                for k in ("id", "source_id", "text_ar", "cue_ar", "locator", "page_vol", "page", "status")
            }
            for c in comments
            if r["id"] in c["comments_on"]
        ]
        r.pop("seq")
    used = {r["source_id"] for r in found} | {c["source_id"] for r in found for c in r["commentary"]}
    sources = rows(
        conn,
        """select id, role, comments_on, title_ar, title_en, author_ar, author_en, death_hijri, death_ce,
                  edition_ar, edition_en, page_numbering, licence, licence_url, attribution_ar, attribution_en
           from content.pattern_sources where id = any(:ids) order by sort_order""",
        {"ids": sorted(used)},
    )
    return {"rows": found, "sources": sources}


def patterns_list(conn: Connection) -> list[dict[str, Any]]:
    return [
        _pattern_out(p) for p in rows(conn, "select * from content.patterns order by occurrences desc, id")
    ]


def glossary(conn: Connection) -> dict[str, Any]:
    terms = rows(conn, "select * from content.glossary_terms order by sort_order")
    return {"terms": terms}


def texts(conn: Connection) -> list[dict[str, Any]]:
    """The shelf. Coverage counts content words by unique lemma (LIB-Q04): particles and pronouns are left
    out by the rule the Analyser applies to the reader's own texts, so both shelves measure the same thing
    (LIB-11); their slugs come along so the reader's "known" leaves them out too."""
    from .analyse import CONTENT_POS

    content = "(l.root_id is not null or l.pos = any(:pos))"
    out = rows(
        conn,
        f"""select t.slug, t.uri, t.kind, t.title_ar, t.title_en, t.author_ar, t.author_en, t.meta_ar, t.meta_en,
                  t.era_year, t.chapter_count, t.passage_count, t.token_count, t.source_id,
                  case when t.kind = 'quran' then (select count(*) from content.lemmas l where {content})::int end
                    as lemma_count
           from content.texts t order by t.sort_order, t.id""",
        {"pos": sorted(CONTENT_POS)},
    )
    function_words = [
        r["slug"]
        for r in rows(
            conn,
            f"select l.slug from content.lemmas l where not {content} order by l.slug",
            {"pos": sorted(CONTENT_POS)},
        )
    ]
    for t in out:
        t["function_lemmas"] = function_words if t["kind"] == "quran" else []
    return out


def text_detail(conn: Connection, slug: str) -> dict[str, Any] | None:
    t = one(conn, "select * from content.texts where slug = :s", {"s": slug})
    if t is None:
        return None
    t["chapters"] = rows(
        conn,
        """select ordinal, uri, title_ar, title_en, title_translit, passage_count, meta
           from content.chapters where text_id = :t order by ordinal""",
        {"t": t["id"]},
    )
    t.pop("id")
    return t


def dictionaries(conn: Connection) -> list[dict[str, Any]]:
    return rows(
        conn,
        """select w.id as key, w.title_ar as name_ar, w.title_en as name_en, w.author_ar, w.author_en,
                  w.death_hijri, w.death_ce, w.lang, w.edition_note, w.source_url, w.license,
                  w.attribution_ar, w.attribution_en, w.redistributable, w.sort_order, w.kind, w.shamela_id,
                  (select count(*) from content.lexicon_entries e where e.work_id = w.id and e.displayable)::int
                    as displayed_entries
           from content.lexicon_works w order by w.sort_order""",
    )


def corpora(conn: Connection) -> list[dict[str, Any]]:
    return rows(conn, "select id, label_ar, label_en, year from content.corpora order by year, sort_order")


def root_family(conn: Connection, raw: str) -> dict[str, Any] | None:
    """A root with its lemmas grouped by pattern (the index and the graph seed use it)."""
    r = content.resolve_root(conn, raw)
    if r is None:
        return None
    extra = one(
        conn, "select gloss_en, gist_ar, gist_source from content.roots where id = :id", {"id": r["id"]}
    )
    return {"root": _root_out(r | (extra or {})), "family": _family(conn, r["id"])}
