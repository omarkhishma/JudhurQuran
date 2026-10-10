"""Semantic search (PLAN P17, D34): verses close in meaning to what a reader wrote, found by a pinned open model run on
our own server, and fused with what the sources' own words matched.

A search is embedded by the embedding service (``jadhr_embed``, internal, never logged) and compared with every
verse's vector — exactly, in memory: 6,236 verses in two languages are a few megabytes, an exact answer beats an
approximate one at this size, and it holds while OpenSearch is down. Arabic is compared with each verse's plain text
and al-Muyassar's explanation of it, English with Saheeh International's translation. The model's ranking and the
lexical meaning search (the tafsirs', translations' and gharīb books' own words, B12) are fused by reciprocal rank,
so a verse both find comes first. A hit is a verse with the source text the model read, credited: the ranking is a
computation and says so (L2, L3); nothing here writes a word a reader sees.

Each verse's nearest verses are computed by the build (``verse_neighbours``) and read here.
"""

from __future__ import annotations

import base64
import threading
from dataclasses import dataclass, field
from typing import Any

import httpx
import numpy as np
from sqlalchemy import Connection

from .content import clean_passage
from .db import one, rows
from .settings import get_settings

ELIGIBLE = ("arabic_word", "arabic_phrase", "latin", "english")
DEPTH = 100  # how many verses each ranking gives the fusion
RRF_K = 60  # reciprocal rank fusion's constant (Cormack et al. 2009): rank r counts 1 / (60 + r)
SOURCE = {"ar": "muyassar", "en": "saheeh"}
# The model always has a nearest verse, even for words the Quran never speaks of ("pizza", "zzqqxx"). The group is
# shown when the sources' words found some verses, or when the best verse stands clearly above the median one: on
# research 25's calibration (25 real and 15 unrelated queries a language) every real Arabic query passed and every
# unrelated one in both languages failed; one real English query (no hits in the words, gap 0.067) is lost.
MIN_GAP = 0.075
MIN_WORDS = 5


@dataclass
class Index:
    release: str
    model: str
    ids: np.ndarray  # verse ids, row order
    mats: dict[str, np.ndarray]  # lang → (verses, dim), unit rows
    row: dict[int, int] = field(default_factory=dict)  # verse id → row


_LOCK = threading.Lock()
_INDEX: Index | None = None


def _release(conn: Connection) -> str:
    d = one(conn, "select version, loaded_at from content.dataset limit 1")
    return f"{d['version']}@{d['loaded_at'].isoformat()}" if d else ""


def index(conn: Connection) -> Index | None:
    """The release's verse vectors, read once into memory; None when the release has none."""
    global _INDEX
    rel = _release(conn)
    with _LOCK:
        if _INDEX and _INDEX.release == rel:
            return _INDEX
        data = rows(
            conn, "select verse_id, lang, model, vec from content.verse_vectors order by lang, verse_id"
        )
        if not data:
            _INDEX = None
            return None
        models = {r["model"] for r in data}
        if len(models) != 1:
            raise RuntimeError(f"verse vectors of more than one model: {sorted(models)}")
        mats: dict[str, np.ndarray] = {}
        ids: np.ndarray | None = None
        for lang in ("ar", "en"):
            part = [r for r in data if r["lang"] == lang]
            mats[lang] = np.stack([np.frombuffer(bytes(r["vec"]), dtype="<f4") for r in part])
            these = np.array([r["verse_id"] for r in part])
            if ids is not None and not np.array_equal(ids, these):
                raise RuntimeError("the Arabic and English vectors cover different verses")
            ids = these
        assert ids is not None
        _INDEX = Index(rel, models.pop(), ids, mats, {int(v): i for i, v in enumerate(ids)})
        return _INDEX


def embed(q: str) -> tuple[np.ndarray, str] | None:
    """The search as a vector, from the embedding service; None when it is not set or does not answer in time."""
    s = get_settings()
    if not s.embed_url:
        return None
    try:
        r = httpx.post(
            f"{s.embed_url}/embed", json={"texts": [q[:2000]], "kind": "query"}, timeout=s.embed_timeout
        )
        r.raise_for_status()
        body = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    return np.frombuffer(base64.b64decode(body["vectors"]), dtype="<f4"), body["model"]


def nearest(
    idx: Index, vec: np.ndarray, lang: str, k: int = DEPTH, sims: np.ndarray | None = None
) -> list[tuple[int, float]]:
    sims = idx.mats[lang] @ vec if sims is None else sims
    top = np.argpartition(-sims, min(k, len(sims) - 1))[:k]
    top = top[np.argsort(-sims[top], kind="stable")]
    return [(int(idx.ids[i]), float(sims[i])) for i in top]


def fuse(*rankings: list[str], k: int = RRF_K) -> list[tuple[str, float]]:
    """Reciprocal rank fusion: each list's rank r adds 1 / (k + r); ties keep the first list's order."""
    score: dict[str, float] = {}
    first: dict[str, tuple[int, int]] = {}
    for li, ranking in enumerate(rankings):
        for r, key in enumerate(ranking, start=1):
            score[key] = score.get(key, 0.0) + 1.0 / (k + r)
            first.setdefault(key, (li, r))
    return sorted(score.items(), key=lambda kv: (-kv[1], first[kv[0]]))


def _lexical(q: str, latin: bool) -> list[str] | None:
    """The verses the sources' own words match (B12), best first; None without OpenSearch."""
    from . import searchindex
    from .search_os import _meanings_query

    es = searchindex.client()
    if not searchindex.available(es):
        return None
    assert es is not None
    try:
        res = es.search(
            index=searchindex.PREFIX + "meanings",
            body={
                "size": DEPTH,
                "query": _meanings_query(q, latin),
                "_source": ["verse_key"],
                "collapse": {"field": "verse_key"},
            },
        )
    except Exception:
        return None
    return [h["_source"]["verse_key"] for h in res["hits"]["hits"]]


def search(conn: Connection, q: str, kind: str, limit: int, offset: int) -> dict[str, Any]:
    """Verses close in meaning to ``q``: the fused ranking, a page of it, and how it was made."""
    latin = kind not in ("arabic_word", "arabic_phrase")
    lang = "en" if latin else "ar"
    idx = index(conn)
    if idx is None:
        return {"status": "no_vectors", "items": [], "total": 0}
    got = embed(q)
    if got is None:
        return {"status": "unavailable", "items": [], "total": 0, "model": idx.model}
    vec, model = got
    if model != idx.model:
        # a question embedded by another model than the verses' would be compared in another space
        return {"status": "model_mismatch", "items": [], "total": 0, "model": idx.model}
    keys = {
        r["id"]: r
        for r in rows(
            conn,
            """select v.id, v.key, v.surah, v.ayah, v.text_qpc, s.name_ar, s.name_translit
                 from content.verses v join content.surahs s on s.number = v.surah""",
        )
    }
    by_key = {v["key"]: v for v in keys.values()}
    sims = idx.mats[lang] @ vec
    # how far the best verse stands above the median verse: the model's own sign that the Quran speaks of this
    gap = float(sims.max() - np.median(sims))
    lex = _lexical(q, latin)
    if gap < MIN_GAP and len(lex or []) < MIN_WORDS:
        return {
            "status": "weak",
            "items": [],
            "total": 0,
            "model": idx.model,
            "lang": lang,
            "gap": round(gap, 4),
        }
    sem = nearest(idx, vec, lang, sims=sims)
    cos = {keys[i]["key"]: c for i, c in sem}
    sem_keys = [keys[i]["key"] for i, _ in sem]
    fused = fuse(sem_keys, lex) if lex else [(k, 1.0 / (RRF_K + r)) for r, k in enumerate(sem_keys, start=1)]
    lex_rank = {k: r for r, k in enumerate(lex or [], start=1)}
    sem_rank = {k: r for r, k in enumerate(sem_keys, start=1)}
    page = [k for k, _ in fused[offset : offset + limit] if k in by_key]
    texts = {
        r["verse_from"]: r["text"]
        for r in rows(
            conn,
            "select verse_from, text from content.work_passages where work_id = :w and verse_from = any(:ids)",
            {"w": SOURCE[lang], "ids": [by_key[k]["id"] for k in page]},
        )
    }
    work = one(
        conn,
        "select id, title_ar, title_en, strip_leading_number from content.works where id = :w",
        {"w": SOURCE[lang]},
    )
    strip = bool(work and work.pop("strip_leading_number"))
    score = dict(fused)
    items = [
        {
            "verse": {
                c: by_key[k][c] for c in ("key", "surah", "ayah", "text_qpc", "name_ar", "name_translit")
            },
            # what the model read beside the verse, credited: al-Muyassar's explanation, or the translation
            "source": {
                "work": work,
                "text": clean_passage(texts[by_key[k]["id"]], strip) if by_key[k]["id"] in texts else None,
            },
            # how it was found: by the model's reading (its cosine), by the sources' words, or both
            "by_meaning": sem_rank.get(k),
            "by_words": lex_rank.get(k),
            "cosine": round(cos[k], 4) if k in cos else None,
            "score": round(score[k], 5),
        }
        for k in page
    ]
    return {
        "status": "ok",
        "items": items,
        "total": len(fused),
        "model": idx.model,
        "lang": lang,
        "gap": round(gap, 4),
        "fused_with_words": lex is not None,
    }


def neighbours(conn: Connection, key: str, limit: int = 10) -> dict[str, Any] | None:
    """A verse's nearest verses by the model's reading, as the build computed them."""
    v = one(conn, "select id from content.verses where key = :k", {"k": key})
    if not v:
        return None
    items = rows(
        conn,
        """select n.rank, n.score, n.model, w.key, w.surah, w.ayah, w.text_qpc, s.name_ar, s.name_translit
             from content.verse_neighbours n join content.verses w on w.id = n.neighbour_id
             join content.surahs s on s.number = w.surah
            where n.verse_id = :v order by n.rank limit :n""",
        {"v": v["id"], "n": limit},
    )
    return {
        "verse": key,
        "model": items[0]["model"] if items else None,
        "items": [
            {
                "verse": {c: r[c] for c in ("key", "surah", "ayah", "text_qpc", "name_ar", "name_translit")},
                "score": r["score"],
            }
            for r in items
        ],
    }
