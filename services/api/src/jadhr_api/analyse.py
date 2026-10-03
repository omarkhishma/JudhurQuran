"""The Analyser (PLAN P4.3, inventory ANA): a phrase, word by word, with how sure each analysis is.

Two sources of truth (ANA-Q01). A verse reference («2:255», «البقرة 255») or a phrase found in exactly one
verse takes that place's analysis from the Quranic Arabic Corpus — gold, hand-verified morphology, shown at
confidence 1.0 with the place named. Any other text is read word by word against the Quran's own words:

  ``form``     the same written form occurs in the Quran: its analyses there, ranked by their share of those
               occurrences (the share is the confidence);
  ``clitic``   the form after a conjunction, preposition, article or attached pronoun is taken off, then as above
               (confidence scaled by 0.7, the clitics named);
  ``pattern``  no form matches: root candidates from the closed list of patterns attested in the Quran,
               kept only where the root exists in the Quran (confidence at most 0.35);
  ``particle`` a function word (the corpus tags it so wherever it occurs): no root, no pattern;
  ``none``     nothing found.

Nothing is invented: every candidate is a lemma, root and pattern the corpus gives some Quranic word, and
every confidence says how it was found. A morphology service for non-Quranic Arabic is later work (P11).
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from typing import Any

from jadhr_arabic import normalize
from sqlalchemy import Connection

from . import search
from .db import one, rows

MAX_TOKENS = 60
MAX_VERSES = 10  # a reference range («2:1-5») is read verse by verse, gold, up to this many verses
TOP = 3
CONTENT_POS = {"N", "V", "PN", "ADJ", "IMPN", "T", "LOC"}
CLITIC_FACTOR = 0.7
PATTERN_CEILING = 0.35
REVIEW_BELOW = 0.8

# proclitics and enclitics, longest first; a stem must keep two letters or more
_PREFIXES = (
    "وبال",
    "فبال",
    "وال",
    "فال",
    "بال",
    "كال",
    "ولل",
    "فلل",
    "لل",
    "ال",
    "وب",
    "فب",
    "ول",
    "فل",
    "وس",
    "فس",
    "و",
    "ف",
    "ب",
    "ك",
    "ل",
    "س",
)
_SUFFIXES = ("كما", "هما", "تما", "كم", "كن", "هم", "هن", "نا", "ها", "تم", "ني", "ه", "ك", "ي")
_PREFIX_LABEL = {"و": "و", "ف": "ف", "ب": "ب", "ك": "ك", "ل": "ل", "س": "س", "ال": "ال"}
_ROOT_SLOTS = ("ف", "ع", "ل")
_TOKEN = re.compile(r"\S+")


def _word(token: str) -> str:
    """A token without the punctuation and signs at its edges («بالتعلم.», «العلمَ،», «(كتاب)» → the word):
    full stops, commas, quotation marks, brackets, and the mushaf's ۞ and ۩ when they stand alone (ANA-F05)."""
    i, j = 0, len(token)
    while i < j and unicodedata.category(token[i])[0] in "PSZ":
        i += 1
    while j > i and unicodedata.category(token[j - 1])[0] in "PSZ":
        j -= 1
    return token[i:j]


def _key(token: str) -> str:
    """The matching key of a typed or pasted word: edge punctuation dropped, marks stripped, letters folded.
    The words table keeps the same key of each word's everyday (imlāʾī) spelling (``norm``) and of its mushaf
    spelling (``norm_uthmani``), so typed and pasted text both match."""
    return normalize(_word(token))


def _has_article(taken: list[str]) -> bool:
    """A proclitic that ends in the article (ال، وال، بال، لل …): what follows is a noun, never a verb."""
    return any(c.endswith("ال") or c.endswith("لل") for c in taken)


def _candidate(r: dict[str, Any], total: int, factor: float = 1.0) -> dict[str, Any]:
    share = r["n"] / total if total else 0.0
    return {
        "lemma": {"slug": r["slug"], "ar": r["lemma_ar"], "pos": r["pos"]} if r["slug"] else None,
        "root": {"key": r["root_key"], "spaced": r["spaced"], "translit": r["translit"]}
        if r["root_key"]
        else None,
        "pattern": {"slug": r["pattern_slug"], "ar": r["pattern_ar"]} if r["pattern_slug"] else None,
        "pos": r["pos"],
        "features": r["features"],
        "segments": r["segments"],
        "gloss_en": r["gloss_en"],
        # the word's transliteration where the corpus reads it (the interlinear's second line, ANA-25)
        "translit": r.get("word_translit"),
        "count": r["n"],
        "share": round(share, 3),
        "confidence": round(share * factor, 2),
        "location": r["location"],
    }


_FORM_SQL = """
    with m as (
      select w.lemma_id, w.root_id, w.pos, count(*)::int as n, min(w.id) as first_id
      from content.words w where w.norm = :k or w.norm_uthmani = :k or w.norm_plain = :k
      group by w.lemma_id, w.root_id, w.pos)
    select m.n, m.pos, w.features, w.segments, w.gloss_en, w.location, w.translit as word_translit,
           l.slug, l.ar as lemma_ar, r.key as root_key, r.spaced, r.translit,
           p.slug as pattern_slug, p.ar as pattern_ar
    from m join content.words w on w.id = m.first_id
    left join content.lemmas l on l.id = m.lemma_id
    left join content.roots r on r.id = m.root_id
    left join content.patterns p on p.id = l.pattern_id
    order by m.n desc, m.first_id"""


def _by_form(conn: Connection, key: str) -> list[dict[str, Any]]:
    return rows(conn, _FORM_SQL, {"k": key})


def _strips(key: str) -> list[tuple[str, list[str]]]:
    """Stems left after taking off a proclitic, an enclitic or both, with what was taken."""
    out: list[tuple[str, list[str]]] = []
    for p in ("", *_PREFIXES):
        if not key.startswith(p):
            continue
        rest = key[len(p) :]
        for s in ("", *_SUFFIXES):
            if (p or s) and rest.endswith(s):
                stem = rest[: len(rest) - len(s)] if s else rest
                if len(stem) >= 2:
                    out.append((stem, [x for x in (p, s) if x]))
    return out


def _by_pattern(conn: Connection, key: str, nouns_only: bool = False) -> list[dict[str, Any]]:
    """Root candidates from the Quran's patterns: the word read against each pattern of its length, the
    letters in the ف ع ل slots taken as the root, kept where that root exists in the Quran. After the
    article only noun patterns are read."""
    pats = rows(
        conn,
        """select slug, ar, ar_bare, occurrences from content.patterns
           where length(ar_bare) = :n and (not :nouns or coalesce(pos_hint, '') <> 'V')""",
        {"n": len(key), "nouns": nouns_only},
    )
    found: dict[str, dict[str, Any]] = {}
    total = sum(p["occurrences"] for p in pats) or 1
    for p in pats:
        bare = normalize(p["ar_bare"])
        letters: list[str] = []
        ok = True
        for pc, kc in zip(bare, key, strict=True):
            if pc in _ROOT_SLOTS:
                letters.append(kc)
            elif pc != kc:
                ok = False
                break
        if not ok or len(letters) != 3:
            continue
        rk = "".join(letters)
        root = one(
            conn, "select key, spaced, translit, occurrences from content.roots where key = :k", {"k": rk}
        )
        if root is None:
            continue
        score = min(PATTERN_CEILING, PATTERN_CEILING * (0.5 + p["occurrences"] / total))
        best = found.get(rk)
        if best is None or score > best["confidence"]:
            found[rk] = {
                "lemma": None,
                "root": {"key": root["key"], "spaced": root["spaced"], "translit": root["translit"]},
                "pattern": {"slug": p["slug"], "ar": p["ar"]},
                "pos": None,
                "features": None,
                "segments": None,
                "gloss_en": None,
                "translit": None,
                "count": 0,
                "share": 0.0,
                "confidence": round(score, 2),
                "location": None,
            }
    return sorted(found.values(), key=lambda c: -c["confidence"])[:TOP]


def _dedupe(cands: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One candidate per root (particles per lemma), best first (ANA-40)."""
    seen: set[str] = set()
    out = []
    for c in sorted(cands, key=lambda c: -c["confidence"]):
        k = (c["root"] or {}).get("key") or (c["lemma"] or {}).get("slug") or c["pos"] or ""
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
    return out[:TOP]


def analyse_word(conn: Connection, token: str) -> dict[str, Any]:
    key = _key(token)
    base = {"surface": _word(token) or token, "key": key, "clitics": []}
    if not key:
        return {**base, "kind": "none", "confidence": 0.0, "candidates": []}
    found = _by_form(conn, key)
    if found:
        total = sum(r["n"] for r in found)
        cands = _dedupe([_candidate(r, total) for r in found])
        if cands[0]["pos"] not in CONTENT_POS and (cands[0]["root"] is None):
            return {**base, "kind": "particle", "confidence": 1.0, "candidates": [], "particle": cands[0]}
        return {**base, "kind": "form", "confidence": cands[0]["confidence"], "candidates": cands}
    for stem, taken in _strips(key):
        found = _by_form(conn, stem)
        if _has_article(taken):  # a word with the article cannot be a verb (ANA-F05)
            found = [r for r in found if r["pos"] != "V"]
        if found:
            total = sum(r["n"] for r in found)
            cands = _dedupe([_candidate(r, total, CLITIC_FACTOR) for r in found if r["pos"] in CONTENT_POS])
            if cands:
                return {
                    **base,
                    "kind": "clitic",
                    "clitics": taken,
                    "stem": stem,
                    "confidence": cands[0]["confidence"],
                    "candidates": cands,
                }
    for stem, taken in [(key, []), *_strips(key)]:
        cands = _by_pattern(conn, stem, nouns_only=_has_article(taken))
        if cands:
            return {
                **base,
                "kind": "pattern",
                "clitics": taken,
                "stem": stem,
                "confidence": cands[0]["confidence"],
                "candidates": cands,
            }
    return {**base, "kind": "none", "confidence": 0.0, "candidates": []}


def _gold(conn: Connection, verse_id: int, positions: list[int] | None = None) -> list[dict[str, Any]]:
    """A verse's (or a run of its) display tokens with the corpus analysis of the words they hold."""
    words = rows(
        conn,
        """select w.location, w.token_from, w.token_to, w.pos, w.features, w.segments, w.gloss_en,
                  w.translit as word_translit, l.slug, l.ar as lemma_ar, r.key as root_key, r.spaced, r.translit, p.slug as pattern_slug, p.ar as pattern_ar
           from content.words w left join content.lemmas l on l.id = w.lemma_id
           left join content.roots r on r.id = w.root_id left join content.patterns p on p.id = l.pattern_id
           where w.verse_id = :v order by w.position""",
        {"v": verse_id},
    )
    toks = rows(
        conn,
        "select position, text from content.tokens where verse_id = :v order by position",
        {"v": verse_id},
    )
    out = []
    for t in toks:
        if positions is not None and t["position"] not in positions:
            continue
        held = [w for w in words if w["token_from"] <= t["position"] <= w["token_to"]]
        cands = [{**_candidate({**w, "n": 1}, 1), "confidence": 1.0, "share": 1.0} for w in held]
        content = [c for c in cands if c["pos"] in CONTENT_POS or c["root"]]
        kind = "gold" if content else "particle"
        out.append(
            {
                "surface": t["text"],
                "key": _key(t["text"]),
                "clitics": [],
                "kind": kind,
                "confidence": 1.0,
                "candidates": content if kind == "gold" else [],
                **({"particle": cands[0]} if kind == "particle" and cands else {}),
                "location": held[0]["location"] if held else None,
            }
        )
    return out


def _verse_by_phrase(conn: Connection, keys: list[str]) -> tuple[dict[str, Any], list[int]] | None:
    """The one verse holding this run of words, and the token positions it occupies, if exactly one does."""
    phrase = " ".join(keys)
    hits = rows(
        conn,
        "select id, key from content.verses where norm like :p or norm_uthmani like :p or norm_plain like :p limit 3",
        {"p": f"%{phrase}%"},
    )
    if len(hits) != 1:
        return None
    v = hits[0]
    toks = rows(
        conn,
        """select t.position, t.text, string_agg(w.norm, '' order by w.position) as imlaei,
                  string_agg(w.norm_plain, '' order by w.position) as plain
           from content.tokens t left join content.words w
             on w.verse_id = t.verse_id and t.position between w.token_from and w.token_to
           where t.verse_id = :v group by t.position, t.text order by t.position""",
        {"v": v["id"]},
    )
    forms = [{_key(t["text"]), t["imlaei"] or "", t["plain"] or ""} for t in toks]
    for i in range(len(forms) - len(keys) + 1):
        if all(keys[j] in forms[i + j] for j in range(len(keys))):
            return v, [toks[i + j]["position"] for j in range(len(keys))]
    return None


def analyse(conn: Connection, text: str) -> dict[str, Any]:
    text = text.strip()
    kind, info = search.detect(conn, text) if text else ("empty", {})
    verses: list[dict[str, Any]] = []
    span = 1
    if kind == "verse_ref":
        span = (info["to"] or info["ayah"]) - info["ayah"] + 1
        verses = rows(
            conn,
            "select id, key from content.verses where surah = :s and ayah between :a and :b order by ayah",
            {"s": info["surah"], "a": info["ayah"], "b": info["ayah"] + min(span, MAX_VERSES) - 1},
        )
    if verses:
        # a reference or a range is read verse by verse from the corpus; each token knows its verse
        tokens = [{**t, "verse_key": v["key"]} for v in verses for t in _gold(conn, v["id"])]
        key = (
            verses[0]["key"] if len(verses) == 1 else f"{verses[0]['key']}-{verses[-1]['key'].split(':')[1]}"
        )
        source = {"kind": "quran", "verse_key": key, "whole_verse": True}
        truncated = span > MAX_VERSES
    else:
        # tokens that are only punctuation or a sign (a dash, ۞) are not words
        surface = [t for t in _TOKEN.findall(text) if _key(t)][:MAX_TOKENS]
        placed = _verse_by_phrase(conn, [_key(t) for t in surface]) if len(surface) >= 2 else None
        if placed:
            v, positions = placed
            tokens = [{**t, "verse_key": v["key"]} for t in _gold(conn, v["id"], positions)]
            source = {"kind": "quran", "verse_key": v["key"], "whole_verse": False}
        else:
            tokens = [analyse_word(conn, t) for t in surface]
            source = {"kind": "free", "verse_key": None, "whole_verse": False}
        truncated = len([t for t in _TOKEN.findall(text) if _key(t)]) > MAX_TOKENS
    roots = Counter(c["root"]["key"] for t in tokens for c in t["candidates"][:1] if c["root"])
    review = sum(
        1 for t in tokens if t["kind"] not in ("particle", "gold") and t["confidence"] < REVIEW_BELOW
    )
    return {
        "text": text,
        "source": source,
        "tokens": tokens,
        "counts": {"tokens": len(tokens), "roots": len(roots), "to_review": review},
        "truncated": truncated,
    }


MAX_BATCH_FORMS = 3000
MAX_SLOW_FORMS = 400  # forms that need the clitic or pattern path, read one by one


def analyse_many(conn: Connection, tokens: list[str]) -> dict[str, Any]:
    """The reader's own text (the Library's add-a-text, LIB-29…33): every distinct written form once, compact.
    Forms the Quran spells are resolved in one query; the rest take the clitic and pattern paths one by one,
    up to a cap (the remainder is reported, not guessed). Nothing is stored."""
    keys: list[str] = []
    seen: set[str] = set()
    for t in tokens:
        k = _key(t)
        if k and k not in seen:
            seen.add(k)
            keys.append(k)
    keys = keys[:MAX_BATCH_FORMS]
    found = rows(
        conn,
        """with m as (
             select coalesce(case when w.norm = any(:ks) then w.norm end,
                             case when w.norm_plain = any(:ks) then w.norm_plain end, w.norm_uthmani) as k,
                    w.lemma_id, w.root_id, w.pos, count(*)::int as n
             from content.words w where w.norm = any(:ks) or w.norm_uthmani = any(:ks) or w.norm_plain = any(:ks)
             group by 1, 2, 3, 4)
           select m.k, m.n, m.pos, l.slug, l.ar as lemma_ar, r.key as root_key, r.spaced, l.gloss_en
           from m left join content.lemmas l on l.id = m.lemma_id left join content.roots r on r.id = m.root_id
           order by m.k, m.n desc""",
        {"ks": keys},
    )
    by: dict[str, list[dict[str, Any]]] = {}
    for r in found:
        by.setdefault(r["k"], []).append(r)
    out: dict[str, dict[str, Any]] = {}
    slow = 0
    for k in keys:
        rs = by.get(k)
        if rs:
            total = sum(r["n"] for r in rs)
            top = rs[0]
            if top["pos"] not in CONTENT_POS and not top["root_key"]:
                out[k] = {"kind": "particle", "confidence": 1.0, "lemma": top["slug"], "root": None}
            else:
                out[k] = {
                    "kind": "form",
                    "confidence": round(top["n"] / total, 2),
                    "lemma": top["slug"],
                    "lemma_ar": top["lemma_ar"],
                    "root": top["root_key"],
                    "root_spaced": top["spaced"],
                    "gloss_en": top["gloss_en"],
                }
        elif slow < MAX_SLOW_FORMS:
            slow += 1
            a = analyse_word(conn, k)
            c = a["candidates"][0] if a["candidates"] else None
            out[k] = {
                "kind": a["kind"],
                "confidence": a["confidence"],
                "lemma": (c["lemma"] or {}).get("slug") if c else None,
                "lemma_ar": (c["lemma"] or {}).get("ar") if c else None,
                "root": (c["root"] or {}).get("key") if c else None,
                "root_spaced": (c["root"] or {}).get("spaced") if c else None,
                "gloss_en": c["gloss_en"] if c else None,
            }
    # each input token's key, in order, so the page maps its words to these results without normalising itself
    return {
        "token_keys": [_key(t) for t in tokens],
        "forms": out,
        "distinct": len(keys),
        "unread": len(keys) - len(out),
    }
