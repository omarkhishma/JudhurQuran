"""Sets of Quranic words that a reader or a teacher makes (B29): the rules the curated sets are built by (pipeline
``collections.py``) — a root, patterns, the most frequent content words, the function words, the words al-Suyūṭī
claims came from another language — evaluated here over the loaded data, optionally within one sūra, so a set that
someone names can only hold what its rule yields. The curated sets' own rules give back their built items, word for
word (``test_sets_api.py``)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import Connection

from . import collections, lexicon
from .db import rows, scalar
from .refusal import Refusal

# the parts of speech that carry content, as the build counts them (pipeline collections.CONTENT_POS); a lemma with a
# root is content whatever its tag
CONTENT_POS = ["N", "V", "PN", "ADJ", "IMPN", "T", "LOC"]
# a name of God is not listed in a casual set as possibly foreign (L5) — the curated loanwords set's exclusion, held
# equal to data/collections.yaml by a test; al-Suyūṭī's claim stays in the word's entry with its attribution (L3)
NOT_CASUALLY_FOREIGN = ["rahman"]
KINDS = ("root", "patterns", "frequent", "function_words", "loanwords")
LIMIT_MAX = 100
ROOTS_MAX = 30
PATTERNS_MAX = 10


def clean_rule(conn: Connection, raw: Any) -> dict[str, Any]:
    """A rule as the sets take it — one kind, its values checked against the data — with its sūra and its limit."""
    if not isinstance(raw, dict):
        raise Refusal(422, "rule_shape", "A set's rule names its kind.")
    kinds = [k for k in KINDS if raw.get(k)]
    if len(kinds) != 1:
        raise Refusal(
            422,
            "rule_kind",
            "A set has one rule: a root, patterns, the most frequent words, the function words or the loanwords.",
        )
    kind = kinds[0]
    rule: dict[str, Any] = {}
    if kind == "root":
        keys = raw["root"]
        if not isinstance(keys, list) or not 1 <= len(keys) <= ROOTS_MAX:
            raise Refusal(422, "rule_roots", f"A set names one to {ROOTS_MAX} roots.")
        keys = list(dict.fromkeys(str(k).replace(" ", "")[:8] for k in keys if str(k).strip()))
        known = {
            r["key"] for r in rows(conn, "select key from content.roots where key = any(:k)", {"k": keys})
        }
        unknown = [k for k in keys if k not in known]
        if unknown or not keys:
            raise Refusal(
                422, "unknown_root", f"No root {unknown[0] if unknown else ''} in the Quran.".strip()
            )
        rule["root"] = keys
    elif kind == "patterns":
        slugs = raw["patterns"]
        if not isinstance(slugs, list) or not 1 <= len(slugs) <= PATTERNS_MAX:
            raise Refusal(422, "rule_patterns", f"A set names one to {PATTERNS_MAX} patterns.")
        slugs = list(dict.fromkeys(str(s)[:40] for s in slugs))
        known = {
            r["slug"]
            for r in rows(conn, "select slug from content.patterns where slug = any(:s)", {"s": slugs})
        }
        unknown = [s for s in slugs if s not in known]
        if unknown:
            raise Refusal(422, "unknown_pattern", f"No pattern {unknown[0]} in the catalogue.")
        rule["patterns"] = slugs
        if raw.get("pos"):
            tags = [str(p)[:8] for p in raw["pos"]][:8]
            if not set(tags) <= set(CONTENT_POS):
                raise Refusal(
                    422, "rule_pos", "A pattern's words are narrowed to content parts of speech only."
                )
            rule["pos"] = tags
        if raw.get("derivation"):
            der = str(raw["derivation"])[:20]
            if not scalar(conn, "select 1 from content.lemmas where derivation = :d limit 1", {"d": der}):
                raise Refusal(422, "rule_derivation", "No such derivation in the corpus.")
            rule["derivation"] = der
    else:
        rule[kind] = True
    surah = raw.get("surah")
    if surah is not None:
        if not isinstance(surah, int) or not 1 <= surah <= 114:
            raise Refusal(422, "rule_surah", "A sūra is numbered 1 to 114.")
        rule["surah"] = surah
    limit = raw.get("limit")
    if limit is not None:
        if not isinstance(limit, int) or not 1 <= limit <= LIMIT_MAX:
            raise Refusal(422, "rule_limit", f"A set holds at most {LIMIT_MAX} words.")
        rule["limit"] = limit
    return rule


def evaluate(conn: Connection, rule: dict[str, Any]) -> dict[str, Any]:
    """The words a rule yields, most frequent first (in the sūra, where it names one), each with its root, its pattern
    and its first place; how many, the roots they touch, and how much of the text in scope they make up."""
    surah = rule.get("surah")
    where = []
    params: dict[str, Any] = {"content": CONTENT_POS, "limit": rule.get("limit") or LIMIT_MAX}
    content = "(l.root_id is not null or l.pos = any(:content))"
    if "root" in rule:
        where.append("r.key = any(:keys)")
        params["keys"] = rule["root"]
    elif "patterns" in rule:
        where.append("pt.slug = any(:patterns)")
        params["patterns"] = rule["patterns"]
        if rule.get("pos"):
            where.append("l.pos = any(:pos)")
            params["pos"] = rule["pos"]
        if rule.get("derivation"):
            where.append("l.derivation = :derivation")
            params["derivation"] = rule["derivation"]
    elif rule.get("frequent"):
        where.append(content)
    elif rule.get("function_words"):
        where.append(f"not {content}")
    elif rule.get("loanwords"):
        where.append(
            """l.id in (select lemma_id from content.loanword_links
                         where kind = 'lemma' and scope = 'lemma' and lemma_id is not null)
               and l.slug <> all(:not_foreign)"""
        )
        params["not_foreign"] = NOT_CASUALLY_FOREIGN
    if surah:
        params["surah"] = surah
    found = rows(
        conn,
        f"""with places as (
              select lemma_id, count(*)::int as n, min(id) as first_id from content.words
               where lemma_id is not null {"and surah = :surah" if surah else ""} group by lemma_id
            )
            select row_number() over (order by {"p.n" if surah else "l.occurrences"} desc, l.id)::int as ordinal,
                   p.n as counted, w.location as first_location, {lexicon._LEMMA_COLS},
                   r.key as root_key, r.spaced as root_spaced, r.translit as root_translit,
                   pt.slug as pattern_slug, pt.ar as pattern_ar, pt.translit as pattern_translit,
                   w.gloss_en as first_gloss, v.key as first_verse
              from places p join content.lemmas l on l.id = p.lemma_id
              left join content.roots r on r.id = l.root_id
              left join content.patterns pt on pt.id = l.pattern_id
              left join content.words w on w.id = p.first_id
              left join content.verses v on v.id = w.verse_id
             where {" and ".join(where)}
             order by {"p.n" if surah else "l.occurrences"} desc, l.id
             limit :limit""",
        params,
    )
    items = [collections.item_out(x) | ({"in_surah": x["counted"]} if surah else {}) for x in found]
    scope = int(
        scalar(
            conn, f"select count(*) from content.words {'where surah = :s' if surah else ''}", {"s": surah}
        )
        or 1
    )
    occurrences = sum(x["counted"] if surah else x["occurrences"] for x in found)
    roots: dict[str, dict[str, Any]] = {}
    for it in items:
        if it["root"] and it["root"]["key"] not in roots:
            roots[it["root"]["key"]] = it["root"]
    return {
        "rule": rule,
        "items": items,
        "item_count": len(items),
        "root_count": len(roots),
        "roots": list(roots.values()),
        "occurrences": occurrences,
        "scope_words": scope,
        "coverage": round(occurrences / scope, 4),
    }
