"""A text beyond the Quran as the generic model holds it (P11.4a): a draft from its source — chapters as a tree,
passages as their verbatim text — assembled into rows with ids after the Quran's, every word's form read once.

A passage keeps its text exactly as the source has it (never normalised: the source's characters, as the Quran's
and the lexica's are kept), the id of each word's form in the order ``jadhr_arabic.analysis.word_spans`` cuts them,
and the roots its words reach — ``roots`` where the form is the Quran's (alone or with its clitics), ``roots_low``
where a pattern or a weak-root rule found it — so a root's life across the texts never mixes the sure and the
possible. A hadith counts the roots of what it reports: never its isnād (``meta.split``), nor a narrator's name or
the formula before it where they stand elsewhere in it (``meta.names``, ``meta.chain``), nor a fixed blessing
(``meta.formulaic``: «صلى الله عليه وسلم» is no use of the root صلو)."""

from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import normalize
from jadhr_arabic.analysis import Analysis, Vocabulary, analyse, word_spans

SURE = frozenset({"form", "clitic"})
LOW = frozenset({"pattern", "pattern-dict", "weak", "weak-dict"})


@dataclass
class Chapter:
    title_ar: str
    title_en: str = ""
    level: int = 1
    parent: int | None = None  # the index of its parent in the draft's chapters
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class Passage:
    chapter: int  # the index of its chapter in the draft's chapters
    ref: str  # its reference inside the text, unique there («6502», «3.12»)
    text: str  # verbatim
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class Draft:
    slug: str
    uri: str
    kind: str  # hadith | book
    title_ar: str
    title_en: str
    author_ar: str | None
    author_en: str | None
    meta_ar: str | None
    meta_en: str | None
    era_year: int | None
    source_id: str
    info: dict[str, Any]
    chapters: list[Chapter] = field(default_factory=list)
    passages: list[Passage] = field(default_factory=list)


def _form_row(fid: int, norm: str, a: Analysis) -> dict[str, Any]:
    return {
        "id": fid,
        "norm": norm,
        "kind": a.kind,
        "confidence": a.confidence,
        "clitics": list(a.clitics),
        "readings": [
            {
                "lemma_id": r.lemma_id,
                "root": r.root,
                "dict_root": r.dict_root,
                "pattern": r.pattern,
                "pos": r.pos,
                "confidence": r.confidence,
            }
            for r in a.readings
        ],
    }


def assemble(
    drafts: list[Draft], vocab: Vocabulary, *, text_id: int, chapter_id: int, passage_id: int, sort_order: int
) -> dict[str, list[dict[str, Any]]]:
    """Rows for texts, chapters, passages and text_forms, ids starting where the Quran's end. A form's id is the order
    it is first met in; each spelling is normalised once and each form read once (15M words, 360k forms)."""
    out: dict[str, list[dict[str, Any]]] = {"texts": [], "chapters": [], "passages": [], "text_forms": []}
    form_id: dict[str, int] = {}
    of_word: dict[str, int] = {}  # a word as written → its form's id, 0 where it holds no letters
    # each form's first reading's root, and whether the rules are sure of it (True), found it possible (False) or
    # neither (None)
    rooted: list[tuple[str | None, bool | None]] = [(None, None)]

    def form_of(word: str) -> int:
        fid = of_word.get(word)
        if fid is not None:
            return fid
        k = normalize(word).replace(" ", "")
        fid = form_id.get(k, 0) if k else 0
        if k and not fid:
            fid = form_id[k] = len(form_id) + 1
            an = analyse(vocab, k)
            out["text_forms"].append(_form_row(fid, k, an))
            root = an.readings[0].dict_root if an.readings else None
            rooted.append((root, True if an.kind in SURE else False if an.kind in LOW else None))
        of_word[word] = fid
        return fid

    for d in drafts:
        tid = text_id
        text_id += 1
        cids: list[int] = []
        counts = [0] * len(d.chapters)
        for i, c in enumerate(d.chapters):
            cid = chapter_id
            chapter_id += 1
            cids.append(cid)
            if c.parent is not None and c.parent >= i:
                raise ValueError(f"{d.slug}: chapter {i} names a later parent")
            out["chapters"].append(
                {
                    "id": cid,
                    "text_id": tid,
                    "ordinal": i + 1,
                    "uri": f"{d.uri}:c{i + 1}",
                    "title_ar": c.title_ar,
                    "title_en": c.title_en,
                    "title_translit": None,
                    "passage_count": 0,
                    "meta": c.meta,
                    "parent_id": cids[c.parent] if c.parent is not None else None,
                    "level": c.level,
                }
            )
        refs: set[str] = set()
        tokens = 0
        for p in d.passages:
            if p.ref in refs:
                raise ValueError(f"{d.slug}: passage {p.ref} twice")
            refs.add(p.ref)
            counts[p.chapter] += 1
            ids: list[int] = []
            sure: dict[str, None] = {}
            low: dict[str, None] = {}
            # a hadith counts the roots of what it reports: not its isnād, not a narrator's name or the formula before
            # it wherever they stand — «الزهري» names a narrator, it does not put the root زهر in every chain he is in
            sp = p.meta.get("split") if isinstance(p.meta.get("split"), dict) else None
            reported = sp["matn"][0] if sp and sp.get("matn") else (sp["isnad"][1] if sp else 0)
            skip = sorted((x, y) for k in ("names", "chain", "formulaic") for x, y in (p.meta.get(k) or []))
            starts = [x for x, _ in skip]
            for a, b in word_spans(p.text):
                fid = form_of(p.text[a:b])
                ids.append(fid)
                if not fid:
                    continue
                if a < reported:
                    continue
                if starts:
                    at = bisect_right(starts, a) - 1
                    if at >= 0 and a < skip[at][1]:
                        continue
                root, certain = rooted[fid]
                if root and certain:
                    sure.setdefault(root, None)
                elif root and certain is False:
                    low.setdefault(root, None)
            tokens += len(ids)
            out["passages"].append(
                {
                    "id": passage_id,
                    "text_id": tid,
                    "chapter_id": cids[p.chapter],
                    "ordinal": counts[p.chapter],
                    "ref": p.ref,
                    "uri": f"{d.uri}:{p.ref}",
                    "verse_id": None,
                    "ar_full": p.text,
                    "norm": normalize(p.text),
                    "token_count": len(ids),
                    "form_ids": ids,
                    "roots": list(sure),
                    "roots_low": [r for r in low if r not in sure],
                    "meta": p.meta,
                }
            )
            passage_id += 1
        for row, n in zip(out["chapters"][-len(d.chapters) :] if d.chapters else [], counts, strict=True):
            row["passage_count"] = n
        out["texts"].append(
            {
                "id": tid,
                "slug": d.slug,
                "uri": d.uri,
                "kind": d.kind,
                "title_ar": d.title_ar,
                "title_en": d.title_en,
                "author_ar": d.author_ar,
                "author_en": d.author_en,
                "meta_ar": d.meta_ar,
                "meta_en": d.meta_en,
                "era_year": d.era_year,
                "source_id": d.source_id,
                "sort_order": sort_order,
                "chapter_count": len(d.chapters),
                "passage_count": len(d.passages),
                "token_count": tokens,
                "info": d.info,
            }
        )
        sort_order += 1
    return out
