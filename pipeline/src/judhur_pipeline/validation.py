"""Cross-source validation report → docs/DATA-VALIDATION.md (every number computed here, none typed).

    uv run python -m judhur_pipeline.validation            # after `judhur-pipeline build`

Inputs: the built dataset (data/build/<version>), the corpus editions in data/raw, the owner's example
file (``Example Data/Quran DB - Clean Roots.csv``, local only, identified by sha256), and — when present —
MASAQ and the corpus word-by-word glosses.
"""

from __future__ import annotations

import collections
import csv
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[3]
HAMZA_ALEF = set("اأإآؤئء")
WEAK_FOLD = str.maketrans({c: "W" for c in "اأإآؤئءوىي"})


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def _csv_root(s: str) -> str:
    """Owner CSV writes a root as spaced letters with ا for a hamza radical; fold to the corpus spelling."""
    return "".join("ء" if c in HAMZA_ALEF else c for c in s.split())


def owner_csv_vs_corpus(build: Path, owner_csv: Path) -> dict[str, Any]:
    words = _jsonl(build / "words.jsonl")
    roots = {r["id"]: "".join(r["letters"]) for r in _jsonl(build / "roots.jsonl")}
    variants: dict[str, dict[str, str | None]] = collections.defaultdict(dict)
    for v in _jsonl(build / "root_variants.jsonl"):
        variants[v["location"]][v["source"]] = _csv_root(" ".join(v["root"])) if v["root"] else None
    by_verse: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for w in words:
        by_verse[f"{w['surah']}:{w['ayah']}"].append(w)
    rows: dict[str, list[dict[str, str]]] = collections.defaultdict(list)
    with owner_csv.open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            rows[r["ID"]].append(r)

    cats: collections.Counter[str] = collections.Counter()
    examples: dict[str, list[str]] = collections.defaultdict(list)
    pseudo_pos: collections.Counter[str] = collections.Counter()
    differ_matches_other_edition = 0
    unaligned = []
    for key, ws in by_verse.items():
        rs = rows.get(key, [])
        if len(rs) != len(ws):
            unaligned.append({"verse": key, "csv_rows": len(rs), "corpus_words": len(ws)})
            continue
        for w, r in zip(ws, rs, strict=True):
            qac = roots[w["root_id"]] if w["root_id"] else None
            own = _csv_root(r["Root_Letters"]) or None
            if qac and own == qac:
                cat = "agree"
            elif not qac and not own:
                cat = "both_no_root"
            elif not qac:
                cat = "pseudo_root"
                pseudo_pos[w["pos"]] += 1
            elif not own:
                cat = "csv_no_root"
            elif own.translate(WEAK_FOLD) == qac.translate(WEAK_FOLD):
                cat = "weak_or_hamza_letter"
            else:
                cat = "different_root"
            if (
                cat in ("weak_or_hamza_letter", "different_root")
                and own in variants.get(w["location"], {}).values()
            ):
                differ_matches_other_edition += 1
            cats[cat] += 1
            if cat != "agree" and len(examples[cat]) < 8:
                examples[cat].append(
                    f"{w['location']} {r['ARABIC']}: corpus {qac or '—'} · file {own or '—'}"
                )
    distinct = {_csv_root(r["Root_Letters"]) for rs in rows.values() for r in rs if r["Root_Letters"].strip()}
    return {
        "file": owner_csv.name,
        "sha256": _sha(owner_csv),
        "rows": sum(len(v) for v in rows.values()),
        "unaligned_verses": unaligned,
        "categories": dict(cats),
        "pseudo_root_pos": dict(pseudo_pos.most_common()),
        "differences_matching_another_corpus_edition": differ_matches_other_edition,
        "distinct_file_roots": len(distinct),
        "distinct_file_roots_in_corpus": len(distinct & set(roots.values())),
        "examples": dict(examples),
    }


def corpus_editions(build: Path) -> dict[str, Any]:
    vs = _jsonl(build / "root_variants.jsonl")
    by = collections.Counter((v["source"], "other root" if v["root"] else "no root") for v in vs)
    return {
        "variants": len(vs),
        "by_source": {f"{s} — {k}": n for (s, k), n in sorted(by.items())},
        "words_with_variant": len({v["location"] for v in vs}),
    }


def glosses(raw: Path, owner_csv_glosses: Path | None) -> dict[str, Any] | None:
    wbw_path = raw / "qac-wbw/wbw.jsonl"
    if not wbw_path.exists():
        return None
    wbw = {r["location"]: r["gloss"] for r in _jsonl(wbw_path)}
    out: dict[str, Any] = {"corpus_words": len(wbw)}

    def norm(s: str) -> str:
        return " ".join(
            "".join(c if c.isalnum() or c in "()" else " " for c in s.lower().replace("-", " ")).split()
        )

    masaq = raw / "masaq-mendeley-v6/MASAQ.tsv"
    if masaq.exists():
        seen: dict[str, str] = {}
        with masaq.open(encoding="utf-8") as fh:
            for r in csv.DictReader(fh, delimiter="\t"):
                seen.setdefault(f"{r['Sura_No']}:{r['Verse_No']}:{r['Word_No']}", r["Gloss"])
        by_verse_m = collections.Counter(k.rsplit(":", 1)[0] for k in seen)
        by_verse_c = collections.Counter(k.rsplit(":", 1)[0] for k in wbw)
        same_verses = {k for k in by_verse_c if by_verse_m.get(k) == by_verse_c[k]}
        pairs = [(wbw[k], seen[k]) for k in wbw if k.rsplit(":", 1)[0] in same_verses and k in seen]
        identical = sum(1 for a, b in pairs if norm(a) == norm(b))
        out["masaq"] = {
            "words": len(seen),
            "verses_with_same_word_count": len(same_verses),
            "compared": len(pairs),
            "identical_after_case_and_hyphen_folding": identical,
            "verbatim_identical": sum(1 for a, b in pairs if a == b),
        }
    if owner_csv_glosses and owner_csv_glosses.exists():
        rows: dict[str, list[str]] = collections.defaultdict(list)
        with owner_csv_glosses.open(encoding="utf-8") as fh:
            reader = csv.reader(fh)
            next(reader)
            for r in reader:
                rows[r[1]].append(r[4])
        by_verse: dict[str, list[str]] = collections.defaultdict(list)
        for k in wbw:
            by_verse[k.rsplit(":", 1)[0]].append(k)
        same = diff = 0
        examples = []
        for v, locs in by_verse.items():
            if len(rows.get(v, [])) != len(locs):
                continue
            for loc, g in zip(locs, rows[v], strict=True):
                if g.strip() == wbw[loc].strip():
                    same += 1
                else:
                    diff += 1
                    if len(examples) < 10:
                        examples.append(f"{loc}: corpus «{wbw[loc]}» · file «{g}»")
        out["owner_csv"] = {"identical": same, "different": diff, "examples": examples}
    return out


def run(version: str = "2026.10.0") -> dict[str, Any]:
    build = REPO / "data/build" / version
    raw = REPO / "data/raw"
    report = json.loads((build / "report.json").read_text(encoding="utf-8"))
    owner = REPO / "Example Data/Quran DB - Clean Roots.csv"
    owner_glosses = REPO / "Example Data/Quran DB - Roots.csv"
    return {
        "version": version,
        "text_sha256": report["text_sha256"],
        "counts": report["counts"],
        "text_checks": {
            "qpc_vs_tanzil_skeleton_mismatch": report["qpc_vs_tanzil_skeleton_mismatch"],
            "findings": report["findings"],
            "alignment": report["alignment"],
            "token_word_nonlinear": len(report["token_word_nonlinear"]),
            "juz_field_differences": report["juz_field_differences_kfgqpc_vs_used"],
            "page_differences_vs_tanzil": len(report["page_differences_vs_tanzil"]),
        },
        "owner_csv": owner_csv_vs_corpus(build, owner) if owner.exists() else None,
        "corpus_editions": corpus_editions(build),
        "wazn": report.get("wazn_methods"),
        "english": report.get("english"),
        "glosses": glosses(raw, owner_glosses),
    }


def _n(x: int) -> str:
    return f"{x:,}"


def _pct(a: int, b: int) -> str:
    return f"{a / b:.1%}" if b else "—"


def render_markdown(r: dict[str, Any]) -> str:
    c = r["counts"]
    t = r["text_checks"]
    L: list[str] = [
        "# DATA VALIDATION",
        "",
        f"> Dataset `{r['version']}`. Generated by `uv run python -m judhur_pipeline.validation` from the built"
        " dataset and the raw sources — every count of this dataset below is computed, none is typed; figures"
        " quoted from the research reports are marked with their report. Do not edit by hand; re-run after a build.",
        "",
        "## 1 · Mushaf text",
        "",
        f"- Display text: KFGQPC Hafs data v2.0, sha256-pinned (the build refuses a drifted file). Verses: {_n(c['verses'])}"
        f" in {_n(c['surahs'])} surahs; display tokens: {_n(c['tokens'])}.",
        f"- Integrity hash of the stored verse text: `{r['text_sha256']}`. The loader recomputes it from the"
        " database after every load and aborts the load on any difference.",
        f"- Letter stream against Tanzil Uthmani 1.1 (independent digitisation), conventions folded only inside the"
        f" comparator: **{len(t['qpc_vs_tanzil_skeleton_mismatch'])} verses differ**.",
    ]
    for f in t["findings"]:
        L.append(f"- Finding ({f['kind']}) at {f['verse']}: {f['detail']}.")
    L += [
        f"- Display tokens ↔ corpus words: every word maps to its tokens; {t['token_word_nonlinear']} verses contain a"
        " token that holds two corpus words or a word written as two tokens (بعد ما، إل ياسين…) — shown, not hidden.",
        f"- Imlāʾī search text aligned per word with fuzzy matching in {_n(t['alignment'].get('imlaei_fuzzy', 0))} words;"
        f" consonant-skeleton fallback in {t['alignment'].get('qpc_skeleton_fallback', 0)}.",
        "- Juz: the KFGQPC file's juz field differs from the ۞ signs printed in its own text at "
        + ", ".join(
            f"{d['verse']} (field {d['kfgqpc_field']}, used {d['used']})" for d in t["juz_field_differences"]
        )
        + "; the Tanzil juz table, which agrees with the printed signs, is used.",
        f"- Pages: {t['page_differences_vs_tanzil']} verse page numbers differ from Tanzil's older print; KFGQPC's"
        " numbering matches the edition displayed.",
        "",
    ]
    o = r["owner_csv"]
    if o:
        cat = o["categories"]
        rooted = cat.get("agree", 0) + cat.get("weak_or_hamza_letter", 0) + cat.get("different_root", 0)
        L += [
            "## 2 · Roots: the owner's example file against the Quranic Arabic Corpus",
            "",
            f"File `{o['file']}` (local only), sha256 `{o['sha256']}`, {_n(o['rows'])} rows. Rows were matched to"
            " corpus words verse by verse, in order. "
            + (
                "Verses where the row count differs were left out of the word comparison: "
                + ", ".join(
                    f"{u['verse']} ({u['csv_rows']} rows / {u['corpus_words']} words)"
                    for u in o["unaligned_verses"]
                )
                + "."
                if o["unaligned_verses"]
                else ""
            ),
            "",
            "| Category | Words | Meaning |",
            "|---|---|---|",
            f"| Same root | {_n(cat.get('agree', 0))} | {_pct(cat.get('agree', 0), rooted)} of words that have a root in the corpus |",
            f"| Pseudo-root for a word with no root | {_n(cat.get('pseudo_root', 0))} | particles, pronouns, demonstratives,"
            " foreign names — the file gives them letter strings (من → م ن); the site shows «no root» |",
            f"| Weak letter or hamza spelled differently | {_n(cat.get('weak_or_hamza_letter', 0))} | same consonants; و/ي/ء"
            " written differently — mostly convention (examples below) |",
            f"| Different root | {_n(cat.get('different_root', 0))} | examples below |",
            f"| Both without root | {_n(cat.get('both_no_root', 0))} | |",
            f"| Corpus root, file empty | {_n(cat.get('csv_no_root', 0))} | |",
            "",
            f"Of the {_n(cat.get('weak_or_hamza_letter', 0) + cat.get('different_root', 0))} differences, "
            f"{_n(o['differences_matching_another_corpus_edition'])} equal the root given by another corpus edition"
            " (author's revision or the corrected fork) and are shown on the word as an attributed variant.",
            "",
            f"The file has {_n(o['distinct_file_roots'])} distinct root strings; {_n(o['distinct_file_roots_in_corpus'])}"
            " of them are corpus roots. Pseudo-roots by corpus part of speech: "
            + ", ".join(f"{k} {_n(v)}" for k, v in list(o["pseudo_root_pos"].items())[:10])
            + ".",
            "",
            "Examples:",
            "",
        ]
        for k, ex in o["examples"].items():
            L.append(f"- {k}: " + "; ".join(ex[:5]))
        L.append("")
    e = r["corpus_editions"]
    L += [
        "## 3 · Corpus editions: v0.4 (primary) against the author's revision and the corrected fork",
        "",
        f"{_n(e['variants'])} attributed variants on {_n(e['words_with_variant'])} words, stored beside the primary"
        " analysis and shown on the word, never merged:",
        "",
    ]
    L += [f"- {k}: {_n(v)}" for k, v in e["by_source"].items()]
    L += [
        "",
        "No independent, openly licensed, human-verified token-level root dataset exists: every other root list"
        " tested descends from the corpus (research 01 §6). The independent rule-based analyser AlKhalil agreed with"
        " the corpus's top root on 91.3% of a 3,000-token sample, mostly differing on known scholarly splits"
        " (research 01 §6.2).",
        "",
    ]
    g = r["glosses"]
    L += ["## 4 · English word glosses", ""]
    if g:
        L.append(
            f"Source: the corpus's Word by Word pages, {_n(g['corpus_words'])} words, stored verbatim (punctuation"
            " included) as its terms require."
        )
        if "masaq" in g:
            m = g["masaq"]
            L.append(
                f"- MASAQ (CC BY-NC 3.0) is not an independent gloss source: of {_n(m['compared'])} words compared,"
                f" {_n(m['identical_after_case_and_hyphen_folding'])}"
                f" ({_pct(m['identical_after_case_and_hyphen_folding'], m['compared'])}) are the corpus gloss lowercased"
                f" and hyphenated; {_n(m['verbatim_identical'])} are verbatim. It is not used for glosses."
            )
        if "owner_csv" in g:
            oc = g["owner_csv"]
            L.append(
                f"- The owner's file (Translation column) against the corpus: {_n(oc['identical'])} identical,"
                f" {_n(oc['different'])} different. Examples: " + "; ".join(oc["examples"][:6]) + "."
            )
    else:
        L.append("Word glosses not yet imported in this build.")
    en = r.get("english") or {}
    L += [
        f"- Lemma glosses (corpus author's revision, GPL-3.0): {_n(en.get('lemma_glosses', 0))} lemmas, mostly verbs;"
        f" {len(en.get('lemma_glosses_unused', []))} entries of that list match no lemma of the primary edition.",
        "",
    ]
    w = r.get("wazn") or {}
    rooted_lemmas = sum(v for k, v in w.items() if k != "none")
    L += [
        "## 5 · Morphological patterns (wazn)",
        "",
        "Method in DECISIONS and on the site's method page. Lemmas by how the pattern was found: "
        + ", ".join(f"{k} {_n(v)}" for k, v in w.items())
        + f" (none includes lemmas without a root). With a pattern or a Form I label: {_n(rooted_lemmas)}.",
        "Engine tests pin hand-checked patterns and the abstentions (pipeline/tests/test_wazn.py); the most frequent"
        " matched nouns were reviewed by hand (DECISIONS). An expert review is still owed.",
        "",
    ]
    return "\n".join(L) + "\n"


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    result = run(*args[:1])
    out = REPO / "data/build" / result["version"] / "validation.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    (REPO / "docs/DATA-VALIDATION.md").write_text(render_markdown(result), encoding="utf-8")
    print(json.dumps({"validation": str(out), "doc": "docs/DATA-VALIDATION.md"}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
