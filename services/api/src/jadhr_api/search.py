"""Unified search over verses, roots, lemmas and word forms.

The query is classified first (verse reference, surah name, root letters, Arabic
word/phrase, Latin) and the classification is returned to the client so the UI
can say honestly what it understood. All Arabic matching is diacritic- and
orthography-insensitive on both sides (``jadhr_arabic.normalize``); display
always uses the stored, verified forms.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from jadhr_arabic import has_arabic, is_uthmani, normalize, parse_root_input, root_input_candidates
from jadhr_arabic import key as root_key
from sqlalchemy import Connection

from . import searchindex
from .content import lemma_display
from .db import one, rows, scalar

_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
_REF_RE = re.compile(r"^\s*(\d{1,3})\s*[:：.\-/ ]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*$")
# a word's place, «2:255:3», as the reader's addresses and the citations write it
_LOC_RE = re.compile(r"^\s*(\d{1,3})\s*:\s*(\d{1,3})\s*:\s*(\d{1,3})\s*$")
# a citation's own prefix before a reference: «Q 2:255», «Q. 2:255», «Qurʾān 2:255», «القرآن 2:255»
_CITE_PREFIX = re.compile(
    r"^\s*(?:q\.?|qur['ʾ’]?[aā]n|quran|koran|al-qur['ʾ’]?[aā]n|القرآن(?:\s*الكريم)?)\s*[,:]?\s*(?=\d)", re.I
)
_SURAH_NUM_RE = re.compile(r"^\s*(?:surah|sura|سورة)?\s*(\d{1,3})\s*$", re.I)
_LATIN_SIMPLIFY = re.compile(r"[^a-z0-9]")
# "الجزء 3", "حزب ١٠", "صفحة 50", "juz 3", "hizb 10", "page 50" (RDR-565)
_DIVISION_RE = re.compile(
    r"^\s*(?:ال)?(جزء|حزب|صفحة)\s*(\d{1,3})\s*$|^\s*(juz['ʾ’]?|hizb|ḥizb|page|p\.)\s*(\d{1,3})\s*$", re.I
)
_DIVISION_KIND = {
    "جزء": "juz",
    "حزب": "hizb",
    "صفحة": "page",
    "hizb": "hizb",
    "ḥizb": "hizb",
    "page": "page",
    "p.": "page",
}
_DIVISION_MAX = {"juz": 30, "hizb": 60, "page": 604}

LABELS = {
    "empty": ("فارغ", "empty"),
    "verse_ref": ("رقم آية", "verse reference"),
    "word_loc": ("موضع كلمة", "word location"),
    "surah": ("سورة", "surah"),
    "root": ("جذر", "root"),
    "arabic_word": ("كلمة عربية", "Arabic word"),
    "arabic_phrase": ("عبارة عربية", "Arabic phrase"),
    "latin": ("نص لاتيني", "Latin text"),
    "translit": ("نقل حرفي", "transliteration"),
    "english": ("معنى بالإنجليزية", "English gloss"),
    "pattern": ("وزن", "pattern"),
    "juz": ("جزء", "juzʾ"),
    "hizb": ("حزب", "ḥizb"),
    "page": ("صفحة", "page"),
}


# Latin queries are classified as a transliteration, an English gloss, or left undecided (SRC-41)
LATIN_KINDS = ("latin", "translit", "english")
# the signs of a transliteration typed by hand: a diacritic, a chat digit, an apostrophe for ʿ/ʾ, a doubled vowel
_TRANSLIT_MARK = re.compile(r"[ʿʾ'’`āīūḥṣḍṭẓġšṯḏḫ]|[a-z][235679]|[235679][a-z]|aa|ii|uu|ee|oo", re.I)
_FOLD_LATIN = str.maketrans("āīūḥṣḍṭẓġšṯḏḫ", "aiuhsdtzgstdh")
# the same fold in SQL: translate() drops the trailing ʿ and ʾ, which have no counterpart
FOLD_LATIN_SQL = "translate(lower({}), 'āīūḥṣḍṭẓġšṯḏḫʿʾ', 'aiuhsdtzgstdh')"
# a range lists at most this many verses
MAX_RANGE = 50

_CHAT_DIGITS = str.maketrans({"2": "ʾ", "3": "ʿ", "5": "kh", "6": "ṭ", "7": "ḥ", "9": "ṣ"})


def chat_alphabet(q: str) -> str:
    """Arabic typed in Latin letters and digits, as in chat (RDR-602): 3ilm → ʿilm, ra7ma → raḥma,
    3'afoor → ghafūr, Saabir → sābir (doubled vowels are long). Plain transliteration passes through."""
    s = q.lower().replace("3'", "gh").replace("7'", "kh")
    s = s.translate(_CHAT_DIGITS)
    s = re.sub(r"a{2,}", "ā", s)
    s = re.sub(r"(?:ee|ii)+", "ī", s)
    return re.sub(r"(?:oo|uu)+", "ū", s)


def fold_latin(s: str) -> str:
    """A Latin query or transliteration reduced for comparison: chat digits read, diacritics, ʿ, ʾ,
    apostrophes, hyphens and spaces dropped (kitāb, kitab and ki-tab meet)."""
    s = unicodedata.normalize("NFC", chat_alphabet(s.strip())).translate(_FOLD_LATIN)
    return re.sub(r"[ʿʾ'’`\-\s_]", "", s)


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


def _pattern_match(conn: Connection, raw: str) -> dict[str, Any] | None:
    """A query that names a pattern (SRC-09): its vowelled Arabic (مَفْعُول), its slug (maf3uul) or its
    transliteration typed with a sign of transliteration (mafʿūl, maf'uul). An unvowelled form (مفعول) is
    a word first; the patterns group still offers the pattern."""
    pats = rows(conn, "select slug, ar, translit from content.patterns")
    q = raw.strip()
    if has_arabic(q):
        if " " in q or not _HARAKAT.search(q):
            return None
        v = _vowelled(q)
        return next((p for p in pats if _vowelled(p["ar"]) == v), None)
    if " " in q:
        return None
    low = q.lower()
    hit = next((p for p in pats if p["slug"] == low), None)
    if hit or not _TRANSLIT_MARK.search(q):
        return hit
    f = fold_latin(q)
    return next((p for p in pats if fold_latin(p["translit"]) == f), None)


def _latin_kind(conn: Connection, q: str) -> str:
    """Transliteration when the query carries its signs or spells a Quranic word's transliteration; an
    English gloss when a gloss uses it as a word; otherwise undecided ("latin")."""
    if _TRANSLIT_MARK.search(q):
        return "translit"
    f = fold_latin(q)
    if f and one(
        conn,
        f"select 1 from content.lemmas where {FOLD_LATIN_SQL.format('translit')} = :f limit 1",
        {"f": f},
    ):
        return "translit"
    words = re.escape(q.strip().lower())
    if words and one(
        # the glosses are the corpus's word-by-word ones, on each occurrence
        conn,
        r"select 1 from content.words where lower(gloss_en) ~ :p limit 1",
        {"p": rf"\m{words}\M"},
    ):
        return "english"
    return "latin"


def detect(conn: Connection, q: str) -> tuple[str, dict[str, Any]]:
    raw = q.strip()
    if not raw:
        return "empty", {}
    ascii_q = _CITE_PREFIX.sub("", raw.translate(_DIGITS), count=1)
    m = _LOC_RE.match(ascii_q)
    if m:
        return "word_loc", {"surah": int(m.group(1)), "ayah": int(m.group(2)), "word": int(m.group(3))}
    m = _REF_RE.match(ascii_q)
    if m:
        return "verse_ref", {
            "surah": int(m.group(1)),
            "ayah": int(m.group(2)),
            "to": int(m.group(3) or 0) or None,
        }
    m = _DIVISION_RE.match(ascii_q)
    if m:
        word = (m.group(1) or m.group(3)).lower()
        kind = "juz" if word.startswith("juz") else _DIVISION_KIND[word]
        n = int(m.group(2) or m.group(4))
        if 1 <= n <= _DIVISION_MAX[kind]:
            return kind, {"number": n}
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
    p = _pattern_match(conn, raw)
    if p:
        return "pattern", {"pattern": p["slug"]}
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
    return _latin_kind(conn, raw), {}


# a root result carries its letters (the root builder narrows by position) and its meaning: Ibn Fāris's
# statement in Arabic, an English gloss where one exists (SRC-18)
ROOT_COLS = "key, letters, spaced, translit, occurrences, lemma_count, verse_count, gist_ar, gloss_en"


def _root_row(conn: Connection, key: str) -> dict[str, Any] | None:
    return one(
        conn,
        f"select {ROOT_COLS} from content.roots where key = :k",
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


_HARAKAT = re.compile("[\u064b-\u0652]")
_NOT_VOWELLED = re.compile("[^\u0621-\u064a\u064b-\u0652]")


def _vowelled(s: str) -> str:
    """Letters and the short vowels, shadda and sukūn only — the Quranic annotation signs, tatweel and the
    wasla seat dropped — so a typed vowelled word compares with a lemma's form."""
    s = unicodedata.normalize("NFC", s).replace("\u0671", "\u0627")
    return _NOT_VOWELLED.sub("", s)


def rank_lemmas(lemmas: list[dict[str, Any]], q: str) -> list[dict[str, Any]]:
    """The words a query names, in the design's order (RDR-169, 602): those whose letters are the query's
    first, then the rest; inside each, nouns and particles before verbs, then the more frequent. So «علم»
    offers عِلْم before عَلِمَ, as a reader looking a word up most often means the noun."""
    qn = normalize(q)
    qv = _vowelled(q) if _HARAKAT.search(q) else None

    def key(i_l: tuple[int, dict[str, Any]]) -> tuple[int, int, int, int]:
        i, lem = i_l
        ar = str(lem.get("ar") or "")
        # a query written with its vowels names that word first (عَلِمَ the verb, عِلْم the noun)
        tier = 0 if qv and _vowelled(ar) == qv else 1 if normalize(ar) == qn else 2
        return (tier, 1 if lem.get("pos") == "V" else 0, -int(lem.get("occurrences") or 0), i)

    return [lem for _, lem in sorted(enumerate(lemmas), key=key)]


# kinds a client can page through with ``only`` and ``offset`` (SRC-21, SRC-23)
PAGED = ("verses", "lemmas", "dictionary", "texts", "books")


def search(
    conn: Connection, q: str, limit: int = 20, offset: int = 0, only: str | None = None
) -> dict[str, Any]:
    """OpenSearch when it is reachable (scored, multi-field, highlighted); Postgres otherwise. The
    response says which engine answered, and ``totals`` counts the matches of each kind, not the results
    returned (SRC-12). ``only`` with ``offset`` pages through one kind. Detection, references and root
    letters are exact lookups in Postgres either way."""
    from . import search_os

    es = searchindex.client()
    out: dict[str, Any] | None = None
    if searchindex.available(es):
        try:
            out = search_os.search(conn, es, q, limit, offset, only)
        except Exception:  # an index problem must never take search down: fall back
            out = None
    if out is None:
        out = search_pg(conn, q, limit, offset, only)
        out["engine"] = "postgres"
    if out["detected"]["kind"] != "pattern" and not offset:
        out["results"]["lemmas"] = rank_lemmas(out["results"].get("lemmas", []), q)
    return out


def _pattern_payload(p: dict[str, Any]) -> dict[str, Any]:
    from .lexicon import ar

    return {
        "slug": p["slug"],
        "ar": ar(p["ar"], p["translit"]),
        "form_number": p["form_number"],
        "occurrences": p["occurrences"],
        "lemma_count": p["lemma_count"],
    }


def _lemma_rows(
    conn: Connection, where: str, params: dict[str, Any], order: str = "l.occurrences desc, l.id"
) -> list[dict[str, Any]]:
    out = rows(
        conn,
        f"""select l.id, l.slug, l.ar, l.translit, l.pos, l.pos_ar, l.pos_en, l.occurrences, l.gloss_en,
                   r.key as root, r.spaced as root_spaced, p.slug as pattern
            from content.lemmas l left join content.roots r on r.id = l.root_id
            left join content.patterns p on p.id = l.pattern_id
            where {where} order by {order} limit :limit offset :offset""",
        params,
    )
    for lem in out:
        lem["ar"] = lemma_display(lem["ar"])
        lem["pos_label"] = {"ar": lem.pop("pos_ar"), "en": lem.pop("pos_en")}
    return out


def search_pg(
    conn: Connection, q: str, limit: int = 20, offset: int = 0, only: str | None = None
) -> dict[str, Any]:
    kind, info = detect(conn, q)
    results: dict[str, list[dict[str, Any]]] = {
        "verses": [],
        "surahs": [],
        "roots": [],
        "lemmas": [],
        "words": [],
        "patterns": [],
        "dictionary": [],
        "dict_roots": [],
        "texts": [],
        "books": [],
    }
    totals: dict[str, int] = {}
    norm_q = normalize(q)
    page = {"limit": limit, "offset": offset}
    # Text pasted from a mushaf is matched on the Uthmani shadow; everyday spelling on the imlāʾī one.
    # Typed text is matched on the imlāʾī shadow and on the everyday spelling read off the mushaf
    # (السماوات finds ٱلسَّمَٰوَٰتِ, which Tanzil's imlāʾī writes السموات); pasted mushaf text on its own shadow.
    cols = ("norm_uthmani",) if is_uthmani(q) else ("norm", "norm_plain")

    def eq(alias: str, param: str) -> str:
        return "(" + " or ".join(f"{alias}.{c} = :{param}" for c in cols) + ")"

    def like(alias: str, param: str) -> str:
        return "(" + " or ".join(f"{alias}.{c} like :{param}" for c in cols) + ")"

    if kind in ("juz", "hizb", "page"):
        # the division's first verse, which the reader opens at
        where = {"juz": "juz = :n", "hizb": "(hizb_quarter - 1) / 4 + 1 = :n", "page": "page = :n"}[kind]
        v = one(
            conn,
            f"""select v.key, v.surah, v.ayah, v.text_qpc, v.text_imlaei, s.name_ar, s.name_translit
                from content.verses v join content.surahs s on s.number = v.surah where {where} order by v.id limit 1""",
            {"n": info["number"]},
        )
        if v:
            results["verses"].append(v)
    elif kind == "word_loc":
        # the verse the word stands in; the word itself is opened at its place (the reader's /word/ address)
        results["verses"] = rows(
            conn,
            """select v.key, v.surah, v.ayah, v.text_qpc, v.text_imlaei, s.name_ar, s.name_translit
               from content.verses v join content.surahs s on s.number = v.surah
               where v.surah = :s and v.ayah = :a
                 and exists (select 1 from content.words w where w.location = :loc)""",
            {"s": info["surah"], "a": info["ayah"], "loc": f"{info['surah']}:{info['ayah']}:{info['word']}"},
        )
    elif kind == "verse_ref":
        # a range lists its verses, up to MAX_RANGE (SRC-Q01)
        last = min(info["to"] or info["ayah"], info["ayah"] + MAX_RANGE - 1)
        results["verses"] = rows(
            conn,
            """select v.key, v.surah, v.ayah, v.text_qpc, v.text_imlaei, s.name_ar, s.name_translit
               from content.verses v join content.surahs s on s.number = v.surah
               where v.surah = :s and v.ayah between :a and :b order by v.ayah""",
            {"s": info["surah"], "a": info["ayah"], "b": max(last, info["ayah"])},
        )
    elif kind == "surah":
        s = one(conn, "select * from content.surahs where number = :n", {"n": info["surah"]})
        if s:
            results["surahs"].append(s)
    elif kind == "root":
        # Every reading of the input that is a real root, most frequent first (r-h-m → رحم; h-m-d → حمد, همد).
        keys = [root_key(c) for c in info.get("candidates") or [info["letters"]]]
        results["roots"] = rows(
            conn,
            f"select {ROOT_COLS} from content.roots where key = any(:ks) order by occurrences desc, id",
            {"ks": keys},
        )
        # the whole family of the roots found (09 §9.6: a root query returns the family)
        fam = "r.key = any(:ks)"
        results["lemmas"] = _lemma_rows(conn, fam, {"ks": keys, **page})
        totals["lemmas"] = int(
            scalar(
                conn,
                f"select count(*) from content.lemmas l join content.roots r on r.id = l.root_id where {fam}",
                {"ks": keys},
            )
            or 0
        )
    elif kind == "pattern":
        p = one(
            conn,
            "select id, slug, ar, translit, form_number, occurrences, lemma_count from content.patterns where slug = :s",
            {"s": info["pattern"]},
        )
        assert p is not None
        results["patterns"] = [_pattern_payload(p)]
        # every word on the pattern (SRC-22), most used first
        results["lemmas"] = _lemma_rows(conn, "l.pattern_id = :pid", {"pid": p["id"], **page})
        totals["lemmas"] = p["lemma_count"]
        info = {**info, "ar": p["ar"], "translit": p["translit"]}
    if kind in ("arabic_word", "arabic_phrase", "pattern") or (
        kind == "surah" and has_arabic(q) and not norm_q.isdigit()
    ):
        # A surah name (النور، الفجر) is also an Arabic word — search it as one too.
        if kind in ("arabic_word", "surah") and " " not in norm_q.strip():
            # exact forms first, then forms that start with the query; grouped by form + lemma
            results["words"] = rows(
                conn,
                f"""select w.norm as form, min(w.text_imlaei) as display, count(*)::int as occurrences,
                          (array_agg(w.location order by w.id))[1] as sample, l.id as lemma_id, l.ar as lemma, r.key as root,
                          bool_or({eq("w", "q")}) as exact,
                          -- typed as everyday spelling, a word the mushaf writes otherwise (plan B28)
                          {"false" if cols == ("norm_uthmani",) else f"bool_or(({eq('w', 'q')}) and w.norm_uthmani <> w.norm)"} as rasm_differs,
                          min(w.text_uthmani) as mushaf
                   from content.words w
                   left join content.lemmas l on l.id = w.lemma_id
                   left join content.roots r on r.id = w.root_id
                   where {eq("w", "q")} or {like("w", "prefix")}
                   group by w.norm, l.id, l.ar, r.key
                   order by bool_or({eq("w", "q")}) desc, count(*) desc
                   limit :limit""",
                {"q": norm_q, "prefix": norm_q.replace("%", "").replace("_", "") + "%", "limit": limit},
            )
            for w in results["words"]:
                w["lemma"] = lemma_display(w["lemma"])
            lemma_where = "l.norm = any(:qs) or l.norm_plain = any(:qs)"
            results["lemmas"] = _lemma_rows(conn, lemma_where, {"qs": _lemma_candidates(norm_q), **page})
            totals["lemmas"] = int(
                scalar(
                    conn,
                    f"select count(*) from content.lemmas l where {lemma_where}",
                    {"qs": _lemma_candidates(norm_q)},
                )
                or 0
            )
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
            # a pattern written without its vowels (فاعل) is offered beside the word
            results["patterns"] = [
                _pattern_payload(p)
                for p in rows(
                    conn,
                    "select slug, ar, translit, form_number, occurrences, lemma_count from content.patterns order by lemma_count desc",
                )
                if normalize(p["ar"]) == norm_q
            ]
        pattern = "%" + norm_q.replace("%", "").replace("_", "") + "%"
        results["verses"] = rows(
            conn,
            f"""select v.key, v.surah, v.ayah, v.text_qpc, v.text_imlaei, s.name_ar, s.name_translit
               from content.verses v join content.surahs s on s.number = v.surah
               where {like("v", "p")} order by v.id limit :limit offset :offset""",
            {"p": pattern, **page},
        )
        totals["verses"] = int(
            scalar(conn, f"select count(*) from content.verses v where {like('v', 'p')}", {"p": pattern}) or 0
        )
        # the texts beyond the Quran (P11.4a): a hadith or a book's passage holding the words, in the text's order
        from .texts import hits as text_hits

        # the hadith (``texts``) and the books (``books``, P11.3) apart, each its own group
        for group, text_kind in (("texts", "hadith"), ("books", "book")):
            if only and only != group:
                continue
            held = (
                "p.verse_id is null and p.norm like :p"
                " and p.text_id in (select id from content.texts where kind = :k)"
            )
            found = rows(
                conn,
                f"select p.uri from content.passages p where {held} order by p.id limit :limit offset :offset",
                {"p": pattern, "k": text_kind, **page},
            )
            by_uri = text_hits(conn, [r["uri"] for r in found])
            results[group] = [by_uri[r["uri"]] | {"excerpt": None} for r in found if r["uri"] in by_uri]
            totals[group] = int(
                scalar(
                    conn,
                    f"select count(*) from content.passages p where {held}",
                    {"p": pattern, "k": text_kind},
                )
                or 0
            )
    if kind in LATIN_KINDS:
        like = "%" + q.strip().lower().replace("%", "").replace("_", "") + "%"
        folded = "%" + fold_latin(q).replace("%", "").replace("_", "") + "%"
        # a gloss, or a transliteration with or without its diacritics (kitab finds kitāb, SRC-40)
        lemma_where = (
            f"lower(l.gloss_en) like :p or {FOLD_LATIN_SQL.format('l.translit')} like :f"
            " or l.id in (select lemma_id from content.words where lower(gloss_en) like :p)"
        )
        results["lemmas"] = _lemma_rows(conn, lemma_where, {"p": like, "f": folded, **page})
        totals["lemmas"] = int(
            scalar(
                conn, f"select count(*) from content.lemmas l where {lemma_where}", {"p": like, "f": folded}
            )
            or 0
        )
        results["words"] = rows(
            conn,
            f"""select w.norm as form, min(w.text_imlaei) as display, count(*)::int as occurrences,
                      (array_agg(w.location order by w.id))[1] as sample, l.id as lemma_id, l.ar as lemma, r.key as root, false as exact
               from content.words w left join content.lemmas l on l.id = w.lemma_id
               left join content.roots r on r.id = w.root_id
               where {FOLD_LATIN_SQL.format("w.translit")} like :f or lower(w.gloss_en) like :p
               group by w.norm, l.id, l.ar, r.key order by count(*) desc limit :limit""",
            {"p": like, "f": folded, "limit": limit},
        )
        for w in results["words"]:
            w["lemma"] = lemma_display(w["lemma"])

    # the dictionary's roots (P11.1): a root typed or a heading as a lexicon prints it, the Quran's or not
    if has_arabic(q) and kind not in ("verse_ref", "word_loc", "juz", "hizb", "page", "surah"):
        from .dictionary import keys_for

        results["dict_roots"] = rows(
            conn,
            """select key, display, letters, quran_root, cardinality(lexica)::int as lexica
               from content.dict_roots where key = any(:k) order by array_position(:k, key)""",
            {"k": keys_for(q)[:6]},
        )
    for k, v in results.items():
        totals.setdefault(k, len(v))
    if only in PAGED:
        results = {k: (v if k == only else []) for k, v in results.items()}
    ar, en = LABELS[kind]
    return {
        "query": q,
        "detected": {"kind": kind, "label_ar": ar, "label_en": en, **info},
        "results": results,
        "totals": totals,
    }
