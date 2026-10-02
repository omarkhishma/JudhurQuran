"""Build the canonical Quran dataset (text + alignment + morphology) as JSONL.

Inputs are the pinned raw sources; output is ``data/build/<version>/``:

    surahs.jsonl  verses.jsonl  tokens.jsonl  words.jsonl
    lemmas.jsonl  roots.jsonl   root_variants.jsonl   report.json

Display text is the KFGQPC Hafs text (QPC) — byte-identical per verse. The
morphology unit is the corpus word (location ``s:a:w``). Tokens (what the
reader shows) and words (what morphology describes) are linked through an
exact alignment; the handful of fusions/splits are reported, not hidden.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from judhur_arabic import key as root_key
from judhur_arabic import normalize, plain_spelling, skeleton, spaced, strip_marks, translit

from . import labels
from .align import AlignmentError, align, align_fuzzy
from .morphology import ForkWord, MorphWord, Stem, group_by_verse, parse_fork, parse_v2, parse_v04
from .texts import (
    BASMALA_TOKENS,
    TOTAL_VERSES,
    QuranMeta,
    parse_qpc_json,
    parse_tanzil_meta,
    parse_tanzil_txt,
    tanzil_tokens,
)

EXPECTED_WORDS = 77429


@dataclass(frozen=True)
class RawPaths:
    tanzil_uthmani: Path
    tanzil_simple_clean: Path
    tanzil_meta: Path
    qpc: Path
    qac_v04: Path
    qac_v2: Path
    qac_fork: Path

    @classmethod
    def default(cls, raw: Path) -> RawPaths:
        return cls(
            tanzil_uthmani=raw / "tanzil/quran-uthmani.txt",
            tanzil_simple_clean=raw / "tanzil/quran-simple-clean.txt",
            tanzil_meta=raw / "tanzil/quran-data.xml",
            qpc=raw / "qpc/qpc-hafs-via-qul.json",
            qac_v04=raw / "qac/quranic-corpus-morphology-0.4.txt",
            qac_v2=raw / "qac-v2-kaisdukes/morphology.txt",
            qac_fork=raw / "qac-morphology-mustafa0x/quran-morphology.txt",
        )


def _match_key(text: str) -> str:
    return normalize(text).replace(" ", "").replace("ء", "")


def _word_form(w: MorphWord) -> str:
    return "".join(s.form_ar or "" for s in w.segments)


def _stem_features(st: Stem) -> dict[str, Any]:
    f: dict[str, Any] = {"pos": labels.pos_label(st.pos)}
    if st.aspect:
        f["aspect"] = {"tag": st.aspect, "ar": labels.ASPECT[st.aspect][0], "en": labels.ASPECT[st.aspect][1]}
    if st.verb_form:
        pattern, roman = labels.VERB_FORMS[st.verb_form]
        f["verb_form"] = {"number": st.verb_form, "roman": roman, "pattern": pattern}
    if st.voice:
        f["voice"] = {"tag": st.voice, "ar": labels.VOICE[st.voice][0], "en": labels.VOICE[st.voice][1]}
    if st.mood:
        f["mood"] = {"tag": st.mood, "ar": labels.MOOD[st.mood][0], "en": labels.MOOD[st.mood][1]}
    if st.derivation:
        ar, en = labels.DERIVATION[st.derivation]
        f["derivation"] = {"tag": st.derivation, "ar": ar, "en": en}
    if st.person:
        f["person"] = {"tag": st.person, "ar": labels.PERSON[st.person][0], "en": labels.PERSON[st.person][1]}
    if st.gender:
        f["gender"] = {"tag": st.gender, "ar": labels.GENDER[st.gender][0], "en": labels.GENDER[st.gender][1]}
    if st.number:
        f["number"] = {"tag": st.number, "ar": labels.NUMBER[st.number][0], "en": labels.NUMBER[st.number][1]}
    if st.case:
        f["case"] = {"tag": st.case, "ar": labels.CASE[st.case][0], "en": labels.CASE[st.case][1]}
    if st.indefinite:
        f["indefinite"] = True
    if st.special:
        ar, en = labels.SPECIAL.get(st.special, (st.special, st.special))
        f["special"] = {"tag": st.special, "ar": ar, "en": en}
    if st.flags:
        f["flags"] = st.flags
    return f


def _segments_json(w: MorphWord) -> list[dict[str, Any]]:
    out = []
    for s in w.segments:
        item: dict[str, Any] = {"index": s.index, "kind": s.kind, "text": s.form_ar}
        if s.kind == "stem" and s.stem is not None:
            item["features"] = _stem_features(s.stem)
            if s.stem.lemma_bw:
                item["lemma"] = s.stem.lemma_bw
            if s.stem.root:
                item["root"] = root_key(s.stem.root)
        else:
            item["label"] = (
                labels.pos_label(s.tag) if s.feature is None else labels.affix_label(s.feature, s.kind)
            )
        out.append(item)
    return out


def _fork_canon(root: str | None) -> list[str] | None:
    if root is None:
        return None
    return ["ء" if ch in "أإآءؤئا" else ("ي" if ch == "ى" else ch) for ch in root]


def _verse_positions(meta: QuranMeta) -> dict[tuple[int, int], dict[str, Any]]:
    """Page, juz, hizb quarter, manzil, ruku for every verse from the start tables."""
    order = [(s.number, a) for s in meta.surahs for a in range(1, s.verse_count + 1)]
    index = {k: i for i, k in enumerate(order)}
    out: dict[tuple[int, int], dict[str, Any]] = {k: {} for k in order}
    for name, table in (
        ("juz", meta.juz),
        ("hizb_quarter", meta.hizb_quarters),
        ("manzil", meta.manzils),
        ("ruku", meta.rukus),
        ("page", meta.pages),
    ):
        starts = sorted((index[(s, a)], n) for n, s, a in table)
        cur = None
        si = 0
        for i, k in enumerate(order):
            while si < len(starts) and starts[si][0] <= i:
                cur = starts[si][1]
                si += 1
            out[k][name] = cur
    for s, a, kind in meta.sajdas:
        out[(s, a)]["sajda"] = kind
    return out


def build(raw: RawPaths, out_dir: Path, version: str) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {"version": version, "findings": []}

    tanzil = parse_tanzil_txt(raw.tanzil_uthmani)
    simple = parse_tanzil_txt(raw.tanzil_simple_clean)
    meta = parse_tanzil_meta(raw.tanzil_meta)
    qpc = parse_qpc_json(raw.qpc)
    v04 = parse_v04(raw.qac_v04)
    if len(v04) != EXPECTED_WORDS:
        raise ValueError(f"corpus v0.4 has {len(v04)} words, expected {EXPECTED_WORDS}")
    locations = [(w.surah, w.ayah, w.word) for w in v04]
    v2 = parse_v2(raw.qac_v2, locations)
    fork = parse_fork(raw.qac_fork)
    if [(f.surah, f.ayah, f.word) for f in fork] != locations:
        raise ValueError("fork word locations differ from v0.4")
    by_verse = group_by_verse(v04)
    v2_by_loc = {w.location: w for w in v2}
    fork_by_loc: dict[str, ForkWord] = {f"{f.surah}:{f.ayah}:{f.word}": f for f in fork}

    # ── Cross-verification: QPC vs Tanzil letter streams (marks/encodings differ by convention) ──
    letter_mismatch = []
    for k in tanzil.verses:
        _, t_tokens = tanzil_tokens(tanzil.verses[k], *k)
        if skeleton(" ".join(t_tokens)) != skeleton(" ".join(qpc[k].tokens)):
            letter_mismatch.append(f"{k[0]}:{k[1]}")
    report["qpc_vs_tanzil_skeleton_mismatch"] = letter_mismatch

    positions = _verse_positions(meta)
    surah_meta = {s.number: s for s in meta.surahs}

    verses_out: list[dict[str, Any]] = []
    tokens_out: list[dict[str, Any]] = []
    words_out: list[dict[str, Any]] = []
    align_stats: Counter[str] = Counter()
    nonlinear: list[dict[str, Any]] = []

    lemma_ids: dict[str, int] = {}
    lemma_rows: dict[int, dict[str, Any]] = {}
    root_ids: dict[str, int] = {}
    root_rows: dict[int, dict[str, Any]] = {}
    variants_out: list[dict[str, Any]] = []

    word_id = 0
    token_id = 0
    for verse_id, k in enumerate(sorted(tanzil.verses), start=1):
        s, a = k
        words = by_verse[k]
        q = qpc[k]
        _, t_tok = tanzil_tokens(tanzil.verses[k], s, a)
        _, simple_tok = tanzil_tokens(simple.verses[k], s, a)
        forms = [_word_form(w) for w in words]

        try:
            g_qpc = align(forms, q.tokens, _match_key)
        except AlignmentError:
            g_qpc = align(forms, q.tokens, skeleton)
            align_stats["qpc_skeleton_fallback"] += 1
            report["findings"].append({"kind": "spelling-variant", "verse": f"{s}:{a}", "detail": "corpus text (Tanzil 1.0.2) differs in letters from QPC/Tanzil 1.1; aligned by consonant skeleton"})
        try:
            g_tz = align(t_tok, simple_tok, skeleton)
        except AlignmentError:
            g_tz = align_fuzzy(t_tok, simple_tok, skeleton)
            align_stats["imlaei_fuzzy"] += 1
        try:
            g_qt = align(forms, t_tok, _match_key)
        except AlignmentError:
            g_qt = align(forms, t_tok, skeleton)

        # word index → imlaei spelling (via Tanzil tokens)
        tz_to_simple: dict[int, list[int]] = {}
        for grp in g_tz:
            for i in grp.left:
                tz_to_simple[i] = list(grp.right)
        word_to_tz: dict[int, list[int]] = {}
        for grp in g_qt:
            for i in grp.left:
                word_to_tz[i] = list(grp.right)

        word_tokens: dict[int, tuple[int, int]] = {}
        token_words: dict[int, tuple[int, int]] = {}
        for grp in g_qpc:
            if (len(grp.left), len(grp.right)) != (1, 1):
                nonlinear.append(
                    {
                        "verse": f"{s}:{a}",
                        "corpus_words": [words[i].location for i in grp.left],
                        "qpc_tokens": [q.tokens[j] for j in grp.right],
                    }
                )
            for i in grp.left:
                word_tokens[i] = (grp.right[0] + 1, grp.right[-1] + 1)
            for j in grp.right:
                token_words[j] = (grp.left[0] + 1, grp.left[-1] + 1)

        for j, text in enumerate(q.tokens):
            token_id += 1
            tokens_out.append(
                {
                    "id": token_id,
                    "verse_id": verse_id,
                    "position": j + 1,
                    "text": text,
                    "word_from": token_words[j][0],
                    "word_to": token_words[j][1],
                }
            )

        verse_word_ids = []
        for i, w in enumerate(words):
            word_id += 1
            verse_word_ids.append(word_id)
            st = w.primary
            # de-duplicate when a corpus word maps to two Tanzil tokens that share one imlaei token
            imlaei_tokens: list[str] = []
            for t in word_to_tz.get(i, []):
                for x in tz_to_simple.get(t, []):
                    if not imlaei_tokens or imlaei_tokens[-1] != simple_tok[x]:
                        imlaei_tokens.append(simple_tok[x])
            imlaei = " ".join(imlaei_tokens)

            lemma_id = None
            if st.lemma_bw:
                lemma_id = lemma_ids.get(st.lemma_bw)
                if lemma_id is None:
                    lemma_id = lemma_ids[st.lemma_bw] = len(lemma_ids) + 1
                    lemma_rows[lemma_id] = {
                        "id": lemma_id,
                        "key": st.lemma_bw,
                        "ar": st.lemma_ar,
                        "ar_bare": strip_marks(st.lemma_ar or ""),
                        "norm": normalize(st.lemma_ar or ""),
                        "norm_plain": plain_spelling(st.lemma_ar or ""),
                        "root_keys": Counter(),
                        "pos": Counter(),
                        "verb_forms": Counter(),
                        "derivations": Counter(),
                        "occurrences": 0,
                        "verses": set(),
                    }
                row = lemma_rows[lemma_id]
                row["occurrences"] += 1
                row["verses"].add(verse_id)
                row["pos"][st.pos] += 1
                if st.verb_form:
                    row["verb_forms"][st.verb_form] += 1
                if st.derivation:
                    row["derivations"][st.derivation] += 1
                row["root_keys"][root_key(st.root) if st.root else None] += 1

            root_id = None
            if st.root:
                rk = root_key(st.root)
                root_id = root_ids.get(rk)
                if root_id is None:
                    root_id = root_ids[rk] = len(root_ids) + 1
                    root_rows[root_id] = {
                        "id": root_id,
                        "key": rk,
                        "letters": st.root,
                        "spaced": spaced(st.root),
                        "translit": translit(st.root),
                        "occurrences": 0,
                        "verses": set(),
                        "surahs": set(),
                        "lemmas": set(),
                    }
                rr = root_rows[root_id]
                rr["occurrences"] += 1
                rr["verses"].add(verse_id)
                rr["surahs"].add(s)
                if lemma_id:
                    rr["lemmas"].add(lemma_id)

            # Root attribution variants from the other morphology sources.
            primary_letters = st.root
            v2w = v2_by_loc[w.location]
            v2_letters = v2w.primary.root
            if v2_letters != primary_letters:
                variants_out.append(
                    {"word_id": word_id, "location": w.location, "source": "qac-v2",
                     "root": root_key(v2_letters) if v2_letters else None}
                )
            fork_letters = _fork_canon(fork_by_loc[w.location].root)
            if fork_letters != primary_letters:
                variants_out.append(
                    {"word_id": word_id, "location": w.location, "source": "qac-fork-mustafa0x",
                     "root": root_key(fork_letters) if fork_letters else None}
                )

            tf, tt = word_tokens[i]
            words_out.append(
                {
                    "id": word_id,
                    "verse_id": verse_id,
                    "surah": s,
                    "ayah": a,
                    "position": w.word,
                    "location": w.location,
                    "token_from": tf,
                    "token_to": tt,
                    "text_uthmani": _word_form(w),
                    "text_imlaei": imlaei,
                    "norm": normalize(imlaei) if imlaei else normalize(_word_form(w)),
                    "norm_uthmani": normalize(_word_form(w)),
                    "root_id": root_id,
                    "lemma_id": lemma_id,
                    "pos": st.pos,
                    "definite": w.definite,
                    "features": _stem_features(st),
                    "segments": _segments_json(w),
                }
            )

        pos = positions[k]
        verses_out.append(
            {
                "id": verse_id,
                "surah": s,
                "ayah": a,
                "key": f"{s}:{a}",
                "page": pos["page"],
                "juz": pos["juz"],
                "hizb_quarter": pos["hizb_quarter"],
                "manzil": pos["manzil"],
                "ruku": pos["ruku"],
                "sajda": pos.get("sajda"),
                "text_qpc": q.text,
                "number_text": q.number_text,
                "text_tanzil": tanzil.verses[k],
                "text_imlaei": simple.verses[k],
                "norm": normalize(" ".join(simple_tok)),
                "norm_uthmani": normalize(" ".join(q.tokens)),
                "word_count": len(words),
                "token_count": len(q.tokens),
                "sha256": hashlib.sha256(q.text.encode("utf-8")).hexdigest(),
            }
        )

    if len(verses_out) != TOTAL_VERSES or word_id != EXPECTED_WORDS:
        raise ValueError(f"build produced {len(verses_out)} verses / {word_id} words")

    surahs_out = []
    for n in range(1, 115):
        sm = surah_meta[n]
        vs = [v for v in verses_out if v["surah"] == n]
        surahs_out.append(
            {
                "number": n,
                "name_ar": sm.name_ar,
                "name_translit": sm.name_translit,
                "name_en": sm.name_en,
                "revelation_place": sm.revelation_place,
                "revelation_order": sm.revelation_order,
                "verse_count": sm.verse_count,
                "rukus": sm.rukus,
                "page_start": vs[0]["page"],
                "page_end": vs[-1]["page"],
                "juz_start": vs[0]["juz"],
                "word_count": sum(v["word_count"] for v in vs),
                "has_basmala": n != 9,
            }
        )

    lemmas_out = []
    lemma_root_conflicts = []
    for lid in sorted(lemma_rows):
        row = lemma_rows[lid]
        roots_here = [r for r in row["root_keys"] if r]
        if len(row["root_keys"]) > 1:
            lemma_root_conflicts.append({"lemma": row["key"], "roots": dict(row["root_keys"])})
        rk = roots_here[0] if roots_here else None
        lemmas_out.append(
            {
                "id": lid,
                "key": row["key"],
                "ar": row["ar"],
                "ar_bare": row["ar_bare"],
                "norm": row["norm"],
                "norm_plain": row["norm_plain"],
                "root_id": root_ids.get(rk) if rk else None,
                "pos": row["pos"].most_common(1)[0][0],
                "verb_form": row["verb_forms"].most_common(1)[0][0] if row["verb_forms"] else None,
                "derivation": row["derivations"].most_common(1)[0][0] if row["derivations"] else None,
                "occurrences": row["occurrences"],
                "verse_count": len(row["verses"]),
            }
        )
    roots_out = []
    for rid in sorted(root_rows):
        rr = root_rows[rid]
        roots_out.append(
            {
                "id": rid,
                "key": rr["key"],
                "letters": rr["letters"],
                "spaced": rr["spaced"],
                "translit": rr["translit"],
                "occurrences": rr["occurrences"],
                "verse_count": len(rr["verses"]),
                "surah_count": len(rr["surahs"]),
                "lemma_count": len(rr["lemmas"]),
            }
        )

    for name, rows in (
        ("surahs", surahs_out),
        ("verses", verses_out),
        ("tokens", tokens_out),
        ("words", words_out),
        ("lemmas", lemmas_out),
        ("roots", roots_out),
        ("root_variants", variants_out),
    ):
        with (out_dir / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")

    report.update(
        {
            "counts": {
                "surahs": len(surahs_out),
                "verses": len(verses_out),
                "tokens": len(tokens_out),
                "words": len(words_out),
                "segments": sum(len(w["segments"]) for w in words_out),
                "roots": len(roots_out),
                "lemmas": len(lemmas_out),
                "words_with_root": sum(1 for w in words_out if w["root_id"]),
                "words_without_root": sum(1 for w in words_out if not w["root_id"]),
                "root_variants": len(variants_out),
            },
            "alignment": dict(align_stats),
            "token_word_nonlinear": nonlinear,
            "lemma_root_conflicts": lemma_root_conflicts,
            "variant_sources": dict(Counter(v["source"] for v in variants_out)),
            "text_sha256": hashlib.sha256("\n".join(v["text_qpc"] for v in verses_out).encode()).hexdigest(),
            "basmala_tokens_removed_from_tanzil": sum(
                BASMALA_TOKENS for k in tanzil.verses if k[1] == 1 and k[0] not in (1, 9)
            ),
        }
    )
    (out_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    return report

