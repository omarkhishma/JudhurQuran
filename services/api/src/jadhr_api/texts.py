"""Texts beyond the Quran as the reader and the shelf read them (PLAN P11.4a): a text with its source and its top-level
chapters, a chapter with its place in the tree and its passages, a passage cut into its words with each word's reading.

The text is served exactly as stored (verbatim from its source). A passage comes as ``segments`` — the text cut into
contiguous pieces, words and what lies between them, whose concatenation is the stored text character for character —
so a client never slices a string by offsets that could differ between Python and JavaScript. Each word names its
written form, and each form comes once with its reading (``text_forms``): its kind and confidence, the clitics taken off, and every attested
reading with the Quran's root and the dictionary's, the Quran's lemma where the form is the Quran's, and the pattern.
A reading is the rules' (``jadhr_arabic.analysis``), never a person's: its kind says how it was found."""

from __future__ import annotations

from typing import Any

from jadhr_arabic.analysis import word_spans
from sqlalchemy import Connection

from .db import one, rows

# how a word was read, for a client to say so (jadhr_arabic.analysis): sure where the Quran spells the form
SURE = ("form", "clitic")

_SOURCE_COLS = """s.id, s.title_ar, s.title_en, s.version, s.url, s.license, s.license_ar, s.license_url,
                  s.attribution_ar, s.attribution_en"""


def _text(conn: Connection, slug: str) -> dict[str, Any] | None:
    return one(conn, "select * from content.texts where slug = :s", {"s": slug})


def _source(conn: Connection, sid: str | None) -> dict[str, Any] | None:
    if not sid:
        return None
    return one(conn, f"select {_SOURCE_COLS} from content.sources s where s.id = :id", {"id": sid})


def _text_head(t: dict[str, Any]) -> dict[str, Any]:
    return {k: t[k] for k in ("slug", "kind", "title_ar", "title_en", "author_ar", "author_en")}


# a chapter with what a contents line needs: its passages, its own and in all its sub-chapters, and its children
_CHAPTER_SQL = """
    with recursive tree as (
      select c.id as top, c.id from content.chapters c where c.text_id = :t {where}
      union all
      select tree.top, k.id from tree join content.chapters k on k.parent_id = tree.id
    ),
    counts as (
      select tree.top, count(p.id)::int as total, min(p.id) as first_id
        from tree join content.passages p on p.text_id = :t and p.chapter_id = tree.id group by tree.top
    ),
    kids as (
      select parent_id, count(*)::int as n from content.chapters
       where text_id = :t and parent_id is not null group by parent_id
    )
    select c.ordinal, c.uri, c.title_ar, c.title_en, c.title_translit, c.passage_count, c.meta,
           coalesce(c.level, 1) as level, par.ordinal as parent, coalesce(k.n, 0) as children,
           coalesce(n.total, 0) as total, f.ref as first_ref
      from content.chapters c
      left join content.chapters par on par.id = c.parent_id
      left join kids k on k.parent_id = c.id
      left join counts n on n.top = c.id
      left join content.passages f on f.id = n.first_id
     where c.text_id = :t {where}
     order by c.ordinal"""


def text_detail(conn: Connection, slug: str) -> dict[str, Any] | None:
    """A text with its source, its credit and its top-level chapters (a sūra, a kitāb); a chapter's sub-chapters come
    with the chapter."""
    t = _text(conn, slug)
    if t is None:
        return None
    t["chapters"] = rows(conn, _CHAPTER_SQL.format(where="and c.parent_id is null"), {"t": t["id"]})
    t["source"] = _source(conn, t["source_id"])
    titles = (t.get("info") or {}).get("titles_source")
    t["titles_source"] = _source(conn, titles) if titles else None
    t.pop("id")
    return t


def _chapter_row(conn: Connection, tid: int, ordinal: int) -> dict[str, Any] | None:
    return one(
        conn,
        """select c.id, c.ordinal, c.title_ar, c.title_en, c.parent_id, coalesce(c.level, 1) as level, c.passage_count
             from content.chapters c where c.text_id = :t and c.ordinal = :o""",
        {"t": tid, "o": ordinal},
    )


def _path(conn: Connection, parent_id: int | None) -> list[dict[str, Any]]:
    """The chapters above one, outermost first."""
    out: list[dict[str, Any]] = []
    while parent_id is not None:
        c = one(
            conn,
            "select id, ordinal, title_ar, title_en, parent_id from content.chapters where id = :id",
            {"id": parent_id},
        )
        if c is None:
            break
        parent_id = c.pop("parent_id")
        c.pop("id")
        out.insert(0, c)
    return out


def chapter(conn: Connection, slug: str, ordinal: int, offset: int, limit: int) -> dict[str, Any] | None:
    """A chapter: where it sits, its sub-chapters, and the passages under it and under them in the text's order,
    paged — each passage with the chapter it is filed under, so a kitāb's page can head each bāb."""
    t = _text(conn, slug)
    if t is None:
        return None
    c = _chapter_row(conn, t["id"], ordinal)
    if c is None:
        return None
    ids = [
        r["id"]
        for r in rows(
            conn,
            """with recursive tree as (select cast(:c as integer) as id union all
                 select k.id from tree join content.chapters k on k.parent_id = tree.id) select id from tree""",
            {"c": c["id"]},
        )
    ]
    total = int(
        one(conn, "select count(*) as n from content.passages where chapter_id = any(:ids)", {"ids": ids})[
            "n"
        ]  # type: ignore[index]
    )
    passages = rows(
        conn,
        """select p.ref, p.ordinal, ch.ordinal as chapter, p.ar_full, p.token_count, p.meta
             from content.passages p join content.chapters ch on ch.id = p.chapter_id
            where p.chapter_id = any(:ids) order by p.id offset :o limit :l""",
        {"ids": ids, "o": offset, "l": limit},
    )
    siblings = rows(
        conn,
        """select ordinal, title_ar, title_en from content.chapters
            where text_id = :t and parent_id is not distinct from :p order by ordinal""",
        {"t": t["id"], "p": c["parent_id"]},
    )
    at = next(i for i, s in enumerate(siblings) if s["ordinal"] == ordinal)
    children = rows(conn, _CHAPTER_SQL.format(where="and c.parent_id = :c"), {"t": t["id"], "c": c["id"]})
    path = _path(conn, c["parent_id"])
    c.pop("id")
    c.pop("parent_id")
    return {
        "text": _text_head(t),
        "chapter": {**c, "total": total},
        "path": path,
        "children": children,
        "prev": siblings[at - 1] if at > 0 else None,
        "next": siblings[at + 1] if at + 1 < len(siblings) else None,
        "passages": passages,
        "offset": offset,
        "limit": limit,
        "total": total,
    }


def _forms(conn: Connection, ids: list[int]) -> dict[int, dict[str, Any]]:
    found = rows(
        conn,
        "select id, norm, kind, confidence, clitics, readings from content.text_forms where id = any(:ids)",
        {"ids": sorted({i for i in ids if i})},
    )
    lemma_ids = {r["lemma_id"] for f in found for r in f["readings"] if r.get("lemma_id")}
    lemmas = {
        x["id"]: x
        for x in rows(
            conn,
            "select id, slug, ar, pos, pos_ar, pos_en, gloss_en from content.lemmas where id = any(:ids)",
            {"ids": sorted(lemma_ids)},
        )
    }
    slugs = {r["pattern"] for f in found for r in f["readings"] if r.get("pattern")}
    patterns = {
        x["slug"]: x["ar"]
        for x in rows(
            conn, "select slug, ar from content.patterns where slug = any(:s)", {"s": sorted(slugs)}
        )
    }
    out: dict[int, dict[str, Any]] = {}
    for f in found:
        readings = []
        for r in f["readings"]:
            lem = lemmas.get(r.get("lemma_id"))
            readings.append(
                {
                    "root": r.get("root"),
                    "dict_root": r.get("dict_root"),
                    "pattern": r.get("pattern"),
                    "pattern_ar": patterns.get(r.get("pattern")),
                    "pos": r.get("pos"),
                    "confidence": r.get("confidence"),
                    "lemma": (
                        {k: lem[k] for k in ("slug", "ar", "pos_ar", "pos_en", "gloss_en")} if lem else None
                    ),
                }
            )
        out[f["id"]] = {
            "norm": f["norm"],
            "kind": f["kind"],
            "confidence": f["confidence"],
            "sure": f["kind"] in SURE,
            "clitics": f["clitics"],
            "readings": readings,
        }
    return out


def segments(text: str, form_ids: list[int]) -> tuple[list[dict[str, Any]], list[int]]:
    """The text cut into contiguous pieces: each word with its index, and what lies between words as plain pieces.
    The pieces join back to the text exactly; the words line up with the stored form ids (one tokeniser)."""
    spans = word_spans(text)
    if len(spans) != len(form_ids):
        raise ValueError(f"{len(spans)} words in the text, {len(form_ids)} form ids stored")
    out: list[dict[str, Any]] = []
    at = 0
    for i, (a, b) in enumerate(spans):
        if a > at:
            out.append({"t": text[at:a]})
        out.append({"t": text[a:b], "w": i})
        at = b
    if at < len(text):
        out.append({"t": text[at:]})
    return out, form_ids


def mark(segs: list[dict[str, Any]], split: dict[str, Any] | None, links: list[dict[str, Any]]) -> None:
    """Each piece told which part of a hadith it belongs to (``p``: isnad, matn, comment), a piece between words cut
    where a part begins; each word of a narrator's name told its link (``n``: the link's ordinal)."""
    if not split:
        return
    bounds = sorted({x for part in ("matn", "comment") if split.get(part) for x in split[part][:1]})
    out: list[dict[str, Any]] = []
    at = 0
    for seg in segs:
        start, text = at, seg["t"]
        at += len(text)
        cuts = [b - start for b in bounds if start < b < start + len(text)] if "w" not in seg else []
        pieces = [text[i:j] for i, j in zip([0, *cuts], [*cuts, len(text)], strict=True)]
        for k, piece in enumerate(pieces):
            out.append({**seg, "t": piece} if k == 0 else {"t": piece})
    at = 0
    for seg in out:
        start = at
        at += len(seg["t"])
        seg["p"] = next(
            (
                part
                for part in ("comment", "matn")
                if split.get(part) and split[part][0] <= start < split[part][1]
            ),
            "isnad",
        )
        if "w" in seg:
            n = next((x["ordinal"] for x in links if x["span_start"] <= start < x["span_end"]), None)
            if n is not None:
                seg["n"] = n
    segs[:] = out


def passage(conn: Connection, slug: str, ref: str) -> dict[str, Any] | None:
    """One passage: its text verbatim cut into its words, each with its reading; its place in the text's chapters;
    the passages before and after it; its roots, the sure apart from the possible."""
    t = _text(conn, slug)
    if t is None or t["kind"] == "quran":
        return None
    p = one(
        conn,
        """select p.id, p.ref, p.ordinal, p.chapter_id, p.ar_full, p.token_count, p.form_ids, p.roots, p.roots_low,
                  p.meta
             from content.passages p where p.text_id = :t and p.ref = :r""",
        {"t": t["id"], "r": ref},
    )
    if p is None:
        return None
    segs, ids = segments(p["ar_full"] or "", p["form_ids"] or [])
    # a hadith's isnād, matn and comment, and the narrators its chain names, each linked or left open (P11.2b)
    split = (p["meta"] or {}).get("split")
    links = rows(
        conn,
        """select l.ordinal, l.span_start, l.span_end, l.text, l.rule, l.confidence, l.status,
                  cardinality(l.candidates) as candidates, n.id, n.number, n.name, n.verdict, n.rank, n.tabaqa,
                  n.death_ah
             from content.narrator_links l left join content.narrators n on n.id = l.narrator_id
            where l.passage_id = :p order by l.ordinal""",
        {"p": p["id"]},
    )
    mark(segs, split, links)
    # HadeethEnc's items citing this hadith by its number, as HadeethEnc gives them (P11.2c); a citation whose
    # wording our record does not hold is not shown
    explanations = rows(
        conn,
        """select i.id, i.title, i.text, i.explanation, i.word_meanings, i.benefits, i.grade, i.attribution, i.link,
                  i.version, l.book, l.number, l.agreement, l.status
             from content.hadeethenc_links l join content.hadeethenc_items i on i.id = l.item_id
            where l.passage_id = :p and l.status <> 'disagrees' order by l.agreement desc, i.id""",
        {"p": p["id"]},
    )
    forms = _forms(conn, ids)
    ch = one(
        conn,
        "select id, ordinal, title_ar, title_en, parent_id from content.chapters where id = :id",
        {"id": p["chapter_id"]},
    )
    path = (
        [*_path(conn, ch["parent_id"]), {k: ch[k] for k in ("ordinal", "title_ar", "title_en")}] if ch else []
    )
    near = rows(
        conn,
        """(select ref, 'prev' as side from content.passages where text_id = :t and id < :id order by id desc limit 1)
           union all
           (select ref, 'next' from content.passages where text_id = :t and id > :id order by id limit 1)""",
        {"t": t["id"], "id": p["id"]},
    )
    return {
        "text": _text_head(t),
        "ref": p["ref"],
        "path": path,
        "ar_full": p["ar_full"],
        "token_count": p["token_count"],
        "meta": p["meta"],
        "segments": segs,
        "parts": {k: split[k] for k in ("method", "rule", "status", "isnad", "matn", "comment")}
        if split
        else None,
        "narrators": [
            {
                "ordinal": x["ordinal"],
                "text": x["text"],
                "rule": x["rule"],
                "confidence": x["confidence"],
                "status": x["status"],
                "candidates": x["candidates"],
                "narrator": (
                    {k: x[k] for k in ("id", "number", "name", "verdict", "rank", "tabaqa", "death_ah")}
                    if x["id"]
                    else None
                ),
            }
            for x in links
        ],
        # each word's form id (0 where a piece holds no letters), each form's reading once
        "words": ids,
        "forms": {str(i): f for i, f in forms.items()},
        "roots": p["roots"] or [],
        "roots_low": p["roots_low"] or [],
        "prev": next((n["ref"] for n in near if n["side"] == "prev"), None),
        "next": next((n["ref"] for n in near if n["side"] == "next"), None),
        "source": _source(conn, t["source_id"]),
        "explanations": [
            {
                **{
                    k: x[k]
                    for k in ("id", "title", "text", "explanation", "word_meanings", "benefits", "link")
                },
                # HadeethEnc's own verdict and attribution, credited to it
                "grade": x["grade"],
                "attribution": x["attribution"],
                "version": x["version"],
                "cites": {"book": x["book"], "number": x["number"]},
                "agreement": x["agreement"],
                "status": x["status"],
            }
            for x in explanations
        ],
        "explanations_source": _source(conn, "hadeethenc") if explanations else None,
        # the narrators' entries are Ibn Ḥajar's (Taqrīb al-Tahdhīb): its credit wherever a name is linked
        "narrators_source": _source(conn, "openiti-taqrib") if any(x["id"] for x in links) else None,
    }


# a search hit's opening words: the passage's start, cut at a word's end
START = 220


def _start(text: str) -> str:
    if len(text) <= START:
        return text
    cut = text.rfind(" ", 0, START)
    return text[: cut if cut > 0 else START]


def hits(conn: Connection, uris: list[str]) -> dict[str, dict[str, Any]]:
    """Passages beyond the Quran as a search lists them, by uri: the text, the top-level chapter and the chapter it is
    filed under, and its opening words (verbatim)."""
    found = rows(
        conn,
        """with recursive up as (
             select c.id as start, c.id, c.parent_id from content.chapters c
              where c.id in (select chapter_id from content.passages where uri = any(:u))
             union all
             select up.start, k.id, k.parent_id from up join content.chapters k on k.id = up.parent_id
           )
           select p.uri, p.ref, p.ar_full, t.slug, t.kind, t.title_ar as text_ar, t.title_en as text_en,
                  c.ordinal as c_ord, c.title_ar as c_ar, c.title_en as c_en,
                  k.ordinal as k_ord, k.title_ar as k_ar, k.title_en as k_en
             from content.passages p
             join content.texts t on t.id = p.text_id
             join content.chapters c on c.id = p.chapter_id
             join up on up.start = c.id and up.parent_id is null
             join content.chapters k on k.id = up.id
            where p.uri = any(:u)""",
        {"u": uris},
    )
    out: dict[str, dict[str, Any]] = {}
    for r in found:
        out[r["uri"]] = {
            "uri": r["uri"],
            "ref": r["ref"],
            "text": {
                "slug": r["slug"],
                "kind": r["kind"],
                "title_ar": r["text_ar"],
                "title_en": r["text_en"],
            },
            "top": {"ordinal": r["k_ord"], "title_ar": r["k_ar"], "title_en": r["k_en"]},
            "chapter": {"ordinal": r["c_ord"], "title_ar": r["c_ar"], "title_en": r["c_en"]},
            "start": _start(r["ar_full"] or ""),
        }
    return out


def hadeethenc_item(conn: Connection, item_id: int) -> dict[str, Any] | None:
    """One HadeethEnc item, verbatim, with the hadith it cites in our texts and how far each agrees."""
    it = one(conn, "select * from content.hadeethenc_items where id = :i", {"i": item_id})
    if it is None:
        return None
    it["cites"] = rows(
        conn,
        """select t.slug, t.title_ar, t.title_en, p.ref, l.book, l.number, l.agreement, l.status
             from content.hadeethenc_links l join content.passages p on p.id = l.passage_id
             join content.texts t on t.id = p.text_id
            where l.item_id = :i order by t.sort_order, p.id""",
        {"i": item_id},
    )
    it["source"] = _source(conn, "hadeethenc")
    return it
