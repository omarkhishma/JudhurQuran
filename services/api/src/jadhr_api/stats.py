"""The Quran in numbers (PLAN P16, PV-12…PV-16; law L4): descriptive statistics only — counts, shares, distributions,
co-occurrence and similarity — each answer saying what was counted and how. Nothing here claims more than its count:
no numerical patterns are read into the text, and a measure of association (PMI, log-likelihood) is named as what it
is, a statistic of the words' co-occurrence in verses.

The unit is the corpus's word (the Quranic Arabic Corpus's segmentation of the KFGQPC text, 77,429 words); a root or a
lemma is counted at each of its words. The corpus is read once per release into memory (about 77 thousand small
records) and every answer is computed from that snapshot, so a new release is read afresh.
"""

from __future__ import annotations

import math
import threading
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import Connection

from .concordance import _FUNCTION_TAGS
from .db import one, rows

UNIT = "corpus-word"
MIN_PAIR = 3  # verses two roots must share before an association between them is reported


@dataclass
class Corpus:
    release: str
    words: list[
        tuple[int, int, int, int | None, int | None, str]
    ]  # verse id, sūra, āya, root id, lemma id, pos
    surahs: dict[int, dict[str, Any]]
    verses: dict[int, dict[str, Any]]  # id → sūra, āya, page, juz
    roots: dict[int, dict[str, Any]]
    lemmas: dict[int, dict[str, Any]]
    patterns: dict[int, dict[str, Any]]
    pos_labels: dict[str, dict[str, str]] = field(default_factory=dict)
    root_verses: dict[int, set[int]] = field(default_factory=dict)
    cache: dict[str, Any] = field(default_factory=dict)


_LOCK = threading.Lock()
_CORPUS: Corpus | None = None


def _release(conn: Connection) -> str:
    d = one(conn, "select version, loaded_at from content.dataset limit 1")
    return f"{d['version']}@{d['loaded_at'].isoformat()}" if d else ""


def corpus(conn: Connection) -> Corpus:
    """The snapshot for the release in the database, read once."""
    global _CORPUS
    rel = _release(conn)
    with _LOCK:
        if _CORPUS and _CORPUS.release == rel:
            return _CORPUS
        words = [
            (r["verse_id"], r["surah"], r["ayah"], r["root_id"], r["lemma_id"], r["pos"] or "")
            for r in rows(
                conn, "select verse_id, surah, ayah, root_id, lemma_id, pos from content.words order by id"
            )
        ]
        c = Corpus(
            release=rel,
            words=words,
            surahs={
                r["number"]: r
                for r in rows(
                    conn,
                    """select number, name_ar, name_translit, name_en, revelation_place, revelation_order, verse_count,
                              word_count, page_start, page_end from content.surahs""",
                )
            },
            verses={r["id"]: r for r in rows(conn, "select id, surah, ayah, page, juz from content.verses")},
            roots={
                r["id"]: r
                for r in rows(
                    conn, "select id, key, spaced, translit, occurrences, verse_count from content.roots"
                )
            },
            lemmas={
                r["id"]: r
                for r in rows(
                    conn,
                    "select id, slug, ar, pos, occurrences, root_id, pattern_id, gloss_en from content.lemmas",
                )
            },
            patterns={r["id"]: r for r in rows(conn, "select id, slug, ar, translit from content.patterns")},
        )
        c.pos_labels = {
            r["tag"]: {"ar": r["ar"], "en": r["en"]}
            for r in rows(
                conn,
                """select distinct features -> 'pos' ->> 'tag' as tag, features -> 'pos' ->> 'ar' as ar,
                          features -> 'pos' ->> 'en' as en from content.words where features ? 'pos'""",
            )
            if r["tag"]
        }
        rv: dict[int, set[int]] = defaultdict(set)
        for vid, _, _, root, _, _ in words:
            if root:
                rv[root].add(vid)
        c.root_verses = dict(rv)
        _CORPUS = c
        return c


def _method(what: str) -> dict[str, str]:
    return {"unit": UNIT, "counted": what}


def _content(pos: str) -> bool:
    return pos not in _FUNCTION_TAGS


# ─── overview and frequency ───────────────────────────────────────────────────


def overview(conn: Connection) -> dict[str, Any]:
    c = corpus(conn)
    if "overview" in c.cache:
        return c.cache["overview"]
    lemma_n = Counter(w[4] for w in c.words if w[4])
    place = Counter()
    words_by_place = Counter()
    for s in c.surahs.values():
        place[s["revelation_place"]] += 1
        words_by_place[s["revelation_place"]] += s["word_count"]
    verse_words = Counter(w[0] for w in c.words)
    longest_verse = max(verse_words.items(), key=lambda kv: (kv[1], -kv[0]))
    by_verses = sorted(c.surahs.values(), key=lambda s: (s["verse_count"], -s["number"]))
    content_lemmas = Counter(w[4] for w in c.words if w[4] and _content(w[5]))
    top_lemma = content_lemmas.most_common(1)[0]
    root_n = Counter(w[3] for w in c.words if w[3])
    top_root = root_n.most_common(1)[0]
    out = {
        "surahs": len(c.surahs),
        "verses": len(c.verses),
        "words": len(c.words),
        "words_with_root": sum(1 for w in c.words if w[3]),
        "lemmas": len(lemma_n),
        "content_lemmas": len(content_lemmas),
        "roots": len(root_n),
        "patterns": len({c.lemmas[lm]["pattern_id"] for lm in lemma_n if c.lemmas[lm]["pattern_id"]}),
        "hapax_lemmas": sum(1 for n in lemma_n.values() if n == 1),
        "hapax_roots": sum(1 for n in root_n.values() if n == 1),
        "mean_words_per_verse": round(len(c.words) / len(c.verses), 2),
        "place": {k: {"surahs": place[k], "words": words_by_place[k]} for k in ("meccan", "medinan")},
        "longest_verse": {"key": _vkey(c, longest_verse[0]), "words": longest_verse[1]},
        "longest_surah": _surah_ref(c, by_verses[-1]["number"]),
        "shortest_surah": _surah_ref(c, by_verses[0]["number"]),
        "top_lemma": {**_lemma_ref(c, top_lemma[0]), "count": top_lemma[1]},
        "top_root": {**_root_ref(c, top_root[0]), "count": top_root[1]},
        "method": _method(
            "every word of the corpus; a lemma or root at each of its words; content words leave out "
            "particles, pronouns and other function words by their part-of-speech tag"
        ),
    }
    c.cache["overview"] = out
    return out


def _vkey(c: Corpus, vid: int) -> str:
    v = c.verses[vid]
    return f"{v['surah']}:{v['ayah']}"


def _surah_ref(c: Corpus, n: int) -> dict[str, Any]:
    s = c.surahs[n]
    return {
        "surah": n,
        "name_ar": s["name_ar"],
        "name_translit": s["name_translit"],
        "verses": s["verse_count"],
        "words": s["word_count"],
    }


def _lemma_ref(c: Corpus, lid: int) -> dict[str, Any]:
    lm = c.lemmas[lid]
    return {"slug": lm["slug"], "ar": lm["ar"], "gloss_en": lm["gloss_en"]}


def _root_ref(c: Corpus, rid: int) -> dict[str, Any]:
    r = c.roots[rid]
    return {"key": r["key"], "spaced": r["spaced"], "translit": r["translit"]}


KINDS = ("root", "lemma", "pattern", "pos")


def frequency(
    conn: Connection, kind: str, surah: int | None, place: str | None, content: bool, limit: int
) -> dict[str, Any]:
    """The most frequent roots, lemmas, patterns or parts of speech, in the whole Quran, one sūra, or the Meccan or
    Medinan sūras; each with its count and its share of the words counted."""
    c = corpus(conn)
    picked = [
        w
        for w in c.words
        if (surah is None or w[1] == surah)
        and (place is None or c.surahs[w[1]]["revelation_place"] == place)
        and (not content or _content(w[5]))
    ]
    total = len(picked)
    if kind == "root":
        n = Counter(w[3] for w in picked if w[3])
        items = [{**_root_ref(c, k), "count": v} for k, v in n.most_common(limit)]
    elif kind == "lemma":
        n = Counter(w[4] for w in picked if w[4])
        items = [{**_lemma_ref(c, k), "count": v} for k, v in n.most_common(limit)]
    elif kind == "pattern":
        n = Counter(c.lemmas[w[4]]["pattern_id"] for w in picked if w[4] and c.lemmas[w[4]]["pattern_id"])
        items = [
            {
                "slug": c.patterns[k]["slug"],
                "ar": c.patterns[k]["ar"],
                "translit": c.patterns[k]["translit"],
                "count": v,
            }
            for k, v in n.most_common(limit)
        ]
    else:
        n = Counter(w[5] for w in picked)
        items = [
            {"tag": k, **c.pos_labels.get(k, {"ar": k, "en": k}), "count": v} for k, v in n.most_common(limit)
        ]
    for it in items:
        it["share"] = round(it["count"] / total, 5) if total else 0
    return {
        "kind": kind,
        "scope": {"surah": surah, "place": place, "content": content},
        "total_words": total,
        "distinct": len(n),
        "items": items,
        "method": _method(f"each {kind} at each of its words" + (", content words only" if content else "")),
    }


# ─── sūras ────────────────────────────────────────────────────────────────────


def surah_profiles(conn: Connection) -> dict[str, Any]:
    """Each sūra's size and vocabulary: verses, words, words per verse, distinct lemmas and roots, the roots found in
    no other sūra, and the Quran's once-only lemmas it holds."""
    c = corpus(conn)
    if "profiles" in c.cache:
        return c.cache["profiles"]
    lemma_n = Counter(w[4] for w in c.words if w[4])
    root_surahs: dict[int, set[int]] = defaultdict(set)
    lem: dict[int, set[int]] = defaultdict(set)
    rts: dict[int, set[int]] = defaultdict(set)
    words = Counter()
    for _, s, _, root, lemma, _ in c.words:
        words[s] += 1
        if lemma:
            lem[s].add(lemma)
        if root:
            rts[s].add(root)
            root_surahs[root].add(s)
    out = []
    for n, s in sorted(c.surahs.items()):
        out.append(
            {
                "surah": n,
                "name_ar": s["name_ar"],
                "name_translit": s["name_translit"],
                "place": s["revelation_place"],
                "revelation_order": s["revelation_order"],
                "verses": s["verse_count"],
                "words": words[n],
                "words_per_verse": round(words[n] / s["verse_count"], 2),
                "lemmas": len(lem[n]),
                "roots": len(rts[n]),
                "unique_roots": sum(1 for r in rts[n] if len(root_surahs[r]) == 1),
                "hapax": sum(1 for lm in lem[n] if lemma_n[lm] == 1),
            }
        )
    res = {
        "data": out,
        "method": _method(
            "words by the corpus; a root is unique to a sūra when no other sūra has a word of it; a hapax is a lemma found once in the whole Quran"
        ),
    }
    c.cache["profiles"] = res
    return res


def surah_detail(conn: Connection, n: int) -> dict[str, Any] | None:
    c = corpus(conn)
    if n not in c.surahs:
        return None
    prof = next(p for p in surah_profiles(conn)["data"] if p["surah"] == n)
    here = [w for w in c.words if w[1] == n]
    root_n = Counter(w[3] for w in here if w[3])
    root_surahs: dict[int, set[int]] = defaultdict(set)
    for _, s, _, root, _, _ in c.words:
        if root:
            root_surahs[root].add(s)
    lemma_all = Counter(w[4] for w in c.words if w[4])
    lem_n = Counter(w[4] for w in here if w[4] and _content(w[5]))
    sim = similarity(conn)
    i = sim["order"].index(n)
    row = sim["matrix"][i]
    neighbours = sorted(
        ((sim["order"][j], v) for j, v in enumerate(row) if sim["order"][j] != n), key=lambda x: -x[1]
    )[:6]
    return {
        **prof,
        "top_roots": [
            {
                **_root_ref(c, r),
                "count": k,
                "per_1000": round(1000 * k / len(here), 2),
                "quran": c.roots[r]["occurrences"],
            }
            for r, k in root_n.most_common(20)
        ],
        "unique_roots": [
            {**_root_ref(c, r), "count": root_n[r]}
            for r in sorted(root_n, key=lambda r: -root_n[r])
            if len(root_surahs[r]) == 1
        ],
        "top_lemmas": [{**_lemma_ref(c, lm), "count": k} for lm, k in lem_n.most_common(20)],
        "hapax_lemmas": [_lemma_ref(c, lm) for lm in sorted(lem_n) if lemma_all[lm] == 1][:60],
        "neighbours": [{**_surah_ref(c, s), "similarity": v} for s, v in neighbours],
        "method": _method(
            "the sūra's words; per 1000 words of the sūra; neighbours by shared vocabulary (see similarity)"
        ),
    }


# ─── a root's or a lemma's distribution ───────────────────────────────────────


def distribution(conn: Connection, root: str | None, lemma: str | None) -> dict[str, Any] | None:
    """Where a root or a lemma occurs: by sūra (count and per 1000 words), in revelation order, by juzʾ and by the
    mushaf's 604 pages."""
    c = corpus(conn)
    if root:
        rid = next((k for k, v in c.roots.items() if v["key"] == root), None)
        if rid is None:
            return None
        hits = [w for w in c.words if w[3] == rid]
        what = {"root": _root_ref(c, rid)}
    elif lemma:
        lid = next((k for k, v in c.lemmas.items() if v["slug"] == lemma), None)
        if lid is None:
            return None
        hits = [w for w in c.words if w[4] == lid]
        what = {"lemma": _lemma_ref(c, lid)}
    else:
        return None
    by_surah = Counter(w[1] for w in hits)
    words = Counter(w[1] for w in c.words)
    pages = Counter(c.verses[w[0]]["page"] for w in hits)
    juz = Counter(c.verses[w[0]]["juz"] for w in hits)
    surahs = [
        {
            "surah": n,
            "name_ar": s["name_ar"],
            "name_translit": s["name_translit"],
            "place": s["revelation_place"],
            "revelation_order": s["revelation_order"],
            "count": by_surah[n],
            "per_1000": round(1000 * by_surah[n] / words[n], 2) if words[n] else 0,
        }
        for n, s in sorted(c.surahs.items())
    ]
    return {
        **what,
        "total": len(hits),
        "verses": len({w[0] for w in hits}),
        "surahs": surahs,
        "pages": [pages.get(p, 0) for p in range(1, 605)],
        "juz": [juz.get(j, 0) for j in range(1, 31)],
        "method": _method(
            "each word of it; per 1000 words of each sūra; pages of the Madinah mushaf (KFGQPC), juzʾ by Tanzil"
        ),
    }


def matrix(conn: Connection, top: int, roots: list[str] | None) -> dict[str, Any]:
    """Roots × sūras: how many words of each root each sūra holds, for the roots asked or the most frequent ones."""
    c = corpus(conn)
    if roots:
        ids = [k for key in roots for k, v in c.roots.items() if v["key"] == key]
    else:
        ids = [r for r, _ in Counter(w[3] for w in c.words if w[3] and _content(w[5])).most_common(top)]
    by = {r: Counter() for r in ids}
    for _, s, _, root, _, _ in c.words:
        if root in by:
            by[root][s] += 1
    return {
        "roots": [{**_root_ref(c, r), "total": sum(by[r].values())} for r in ids],
        "surahs": [
            _surah_ref(c, n)
            | {"place": c.surahs[n]["revelation_place"], "revelation_order": c.surahs[n]["revelation_order"]}
            for n in sorted(c.surahs)
        ],
        "counts": [[by[r].get(n, 0) for n in sorted(c.surahs)] for r in ids],
        "method": _method("words of each root in each sūra"),
    }


# ─── co-occurrence and similarity ─────────────────────────────────────────────


def _g2(a: int, b: int, cc: int, d: int) -> float:
    """Dunning's log-likelihood G² of a 2×2 table."""
    n = a + b + cc + d
    total = 0.0
    for obs, row, col in ((a, a + b, a + cc), (b, a + b, b + d), (cc, cc + d, a + cc), (d, cc + d, b + d)):
        exp = row * col / n
        if obs > 0 and exp > 0:
            total += obs * math.log(obs / exp)
    return round(2 * total, 2)


def _assoc(c: Corpus, r1: int, r2: int, both: int) -> dict[str, float]:
    n = len(c.verses)
    v1, v2 = len(c.root_verses[r1]), len(c.root_verses[r2])
    pmi = math.log2(both * n / (v1 * v2)) if both else float("-inf")
    return {"pmi": round(pmi, 3), "g2": _g2(both, v1 - both, v2 - both, n - v1 - v2 + both)}


def collocations(conn: Connection, root: str, limit: int) -> dict[str, Any] | None:
    """The roots that share verses with a root: in how many verses, the pointwise mutual information and Dunning's
    log-likelihood of that sharing, those shared in fewer than MIN_PAIR verses left out."""
    c = corpus(conn)
    rid = next((k for k, v in c.roots.items() if v["key"] == root), None)
    if rid is None:
        return None
    mine = c.root_verses.get(rid, set())
    shared = Counter()
    by_verse: dict[int, set[int]] = defaultdict(set)
    for vid, _, _, r, _, _ in c.words:
        if r and vid in mine:
            by_verse[vid].add(r)
    for roots in by_verse.values():
        for r in roots - {rid}:
            shared[r] += 1
    items = []
    for r, k in shared.items():
        if k < MIN_PAIR:
            continue
        items.append(
            {**_root_ref(c, r), "verses": k, "verses_of_root": len(c.root_verses[r]), **_assoc(c, rid, r, k)}
        )
    items.sort(key=lambda x: -x["g2"])
    return {
        "root": _root_ref(c, rid),
        "verses": len(mine),
        "items": items[:limit],
        "min_shared": MIN_PAIR,
        "method": _method(
            "verses holding a word of both roots; PMI = log2(shared × all verses ÷ (verses of one × verses of the other)); G² is Dunning's log-likelihood of the same 2×2 table; ranked by G²"
        ),
    }


def network(conn: Connection, top: int, per_node: int) -> dict[str, Any]:
    """The most frequent content roots as nodes, each joined to the roots it is most associated with (by G² over
    shared verses), at most ``per_node`` edges from each."""
    c = corpus(conn)
    key = f"network:{top}:{per_node}"
    if key in c.cache:
        return c.cache[key]
    ids = [r for r, _ in Counter(w[3] for w in c.words if w[3] and _content(w[5])).most_common(top)]
    chosen = set(ids)
    pair = Counter()
    by_verse: dict[int, set[int]] = defaultdict(set)
    for vid, _, _, r, _, _ in c.words:
        if r in chosen:
            by_verse[vid].add(r)
    for roots in by_verse.values():
        rs = sorted(roots)
        for i, a in enumerate(rs):
            for b in rs[i + 1 :]:
                pair[(a, b)] += 1
    scored = {p: _assoc(c, p[0], p[1], k) | {"verses": k} for p, k in pair.items() if k >= MIN_PAIR}
    keep: set[tuple[int, int]] = set()
    for r in ids:
        mine = sorted(
            ((p, s) for p, s in scored.items() if r in p and s["pmi"] > 0), key=lambda x: -x[1]["g2"]
        )[:per_node]
        keep |= {p for p, _ in mine}
    out = {
        "nodes": [
            {**_root_ref(c, r), "count": c.roots[r]["occurrences"], "verses": len(c.root_verses[r])}
            for r in ids
        ],
        "edges": [
            {"a": c.roots[a]["key"], "b": c.roots[b]["key"], **scored[(a, b)]} for a, b in sorted(keep)
        ],
        "method": _method(
            f"the {top} most frequent content roots; an edge where two roots share at least {MIN_PAIR} verses with PMI above 0, the {per_node} strongest by G² from each root"
        ),
    }
    c.cache[key] = out
    return out


def _cluster_order(sim: list[list[float]]) -> list[int]:
    """Average-linkage agglomerative clustering's leaf order: alike sūras placed side by side."""
    clusters: dict[int, list[int]] = {i: [i] for i in range(len(sim))}
    while len(clusters) > 1:
        keys = list(clusters)
        best: tuple[float, int, int] | None = None
        for i, a in enumerate(keys):
            for b in keys[i + 1 :]:
                xs, ys = clusters[a], clusters[b]
                s = sum(sim[x][y] for x in xs for y in ys) / (len(xs) * len(ys))
                if best is None or s > best[0]:
                    best = (s, a, b)
        assert best is not None
        _, a, b = best
        clusters[a] = clusters[a] + clusters.pop(b)
    return next(iter(clusters.values()))


def similarity(conn: Connection) -> dict[str, Any]:
    """How alike the sūras' vocabularies are: the cosine of their roots' tf-idf vectors (a root's count in the sūra
    times the log of 114 over the number of sūras it occurs in), with the sūras ordered so that alike ones stand
    together (average-linkage clustering)."""
    c = corpus(conn)
    if "similarity" in c.cache:
        return c.cache["similarity"]
    tf: dict[int, Counter] = defaultdict(Counter)
    for _, s, _, r, _, pos in c.words:
        if r and _content(pos):
            tf[s][r] += 1
    df = Counter(r for s in tf for r in tf[s])
    n = len(c.surahs)
    vec = {s: {r: k * math.log(n / df[r]) for r, k in tf[s].items()} for s in c.surahs}
    norm = {s: math.sqrt(sum(x * x for x in v.values())) or 1.0 for s, v in vec.items()}
    nums = sorted(c.surahs)
    sim = [[0.0] * n for _ in range(n)]
    for i, a in enumerate(nums):
        for j in range(i, n):
            b = nums[j]
            va, vb = vec[a], vec[b]
            small, big = (va, vb) if len(va) < len(vb) else (vb, va)
            dot = sum(x * big.get(r, 0.0) for r, x in small.items())
            sim[i][j] = sim[j][i] = round(dot / (norm[a] * norm[b]), 3)
    order = [nums[i] for i in _cluster_order(sim)]
    idx = {s: i for i, s in enumerate(nums)}
    out = {
        "order": order,
        "surahs": [_surah_ref(c, s) | {"place": c.surahs[s]["revelation_place"]} for s in order],
        "matrix": [[sim[idx[a]][idx[b]] for b in order] for a in order],
        "method": _method(
            "content roots per sūra, weighted by tf-idf (count × ln(114 ÷ sūras holding the root)); cosine similarity; ordered by average-linkage clustering"
        ),
    }
    c.cache["similarity"] = out
    return out


def rank_frequency(conn: Connection) -> dict[str, Any]:
    """Every lemma's count, most frequent first, and how much of the Quran's words the first N lemmas make up."""
    c = corpus(conn)
    counts = sorted(Counter(w[4] for w in c.words if w[4]).values(), reverse=True)
    total = sum(counts)
    run, cumulative = 0, []
    for k in counts:
        run += k
        cumulative.append(round(run / total, 5))
    return {
        "counts": counts,
        "cumulative": cumulative,
        "method": _method("each lemma at each of its words; rank 1 the most frequent"),
    }
