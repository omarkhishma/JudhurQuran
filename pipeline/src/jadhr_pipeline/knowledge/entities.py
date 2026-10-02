"""People, places, nations and events — the seed of an entity registry, for editors (PLAN P3.9, D25).

Candidates are the corpus's proper-noun lemmas (part of speech ``PN`` in ``words.jsonl``), each with
its Arabic name, the verses it occurs in and its occurrence count. A Wikidata id (CC0) is attached only
when the item is clearly the Quranic entity, by one of two recorded rules:

* ``present-in-quran`` — the item states «present in work» (P1441) = the Quran (Q428) and exactly one
  such item has the candidate's name as an Arabic label or alias;
* ``label+description`` — exactly one Arabic search hit has the name as its Arabic label and an Arabic
  or English description that mentions the Quran, Islam or a prophet.

Otherwise the id stays null and the top search hits are listed for the editors. Every row is
``status: candidate``: a seed for the editorial registry, not a published entity.

Network access happens only in ``fetch_wikidata`` (a separate command). The build reads the pinned
responses from ``data/raw/wikidata-quran-entities/`` and never calls the network.
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from jadhr_arabic import normalize, strip_marks

from ..generic import lemma_display
from .quran import read_jsonl

QAC = "qac-proper-nouns"
WIKIDATA = "wikidata"
USER_AGENT = "jadhr-research/1.0"
# Evidence that a search hit is the Quranic entity: its description names the Quran, a prophet, the
# Muslims, "in Islam" or "before Islam". A bare mention of Islam is not enough (an «Egyptian
# civilisation in the Islamic era» item is not the Miṣr of the Quran).
_KEYWORDS_AR = ("قرآن", "نبي", "أنبياء", "انبياء", "في الإسلام", "قبل الإسلام", "العقيدة الإسلامية", "المسلم")
_KEYWORDS_EN = ("quran", "qur'an", "qurʾan", "koran", "prophet", "pre-islamic", "in islam", "muslim")
_LABEL_SUFFIX = re.compile(r"(?<=\S)\s+\(?(?:في\s+)?(?:الإسلام|الاسلام|القرآن)\)?$")

SPARQL = """
SELECT ?item ?label_ar ?label_en ?desc_ar ?desc_en (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases)
WHERE {
  ?item wdt:P1441 wd:Q428 .
  OPTIONAL { ?item rdfs:label ?label_ar FILTER(LANG(?label_ar) = "ar") }
  OPTIONAL { ?item rdfs:label ?label_en FILTER(LANG(?label_en) = "en") }
  OPTIONAL { ?item schema:description ?desc_ar FILTER(LANG(?desc_ar) = "ar") }
  OPTIONAL { ?item schema:description ?desc_en FILTER(LANG(?desc_en) = "en") }
  OPTIONAL { ?item skos:altLabel ?alias FILTER(LANG(?alias) = "ar") }
}
GROUP BY ?item ?label_ar ?label_en ?desc_ar ?desc_en
ORDER BY ?item
"""


def everyday(ar: str) -> str:
    """The lemma in everyday spelling for a search box: dagger alef written out (هَٰرُون → هارون,
    تَّوْرَىٰة → توراة), alef wasla as alef, marks removed; hamza seats kept."""
    t = unicodedata.normalize("NFC", lemma_display(ar)).replace(" ", "")
    t = t.replace("ِٔ", "ئ")  # ِٔ (kasra + hamza above) → ئ  (صَٰبِ ِٔين → صابئين)
    t = re.sub("ءَ?ا", "آ", t)  # ءا → آ  (قُرْءَان → قرآن)
    t = re.sub("ى(?=ّ)", "ي", t)  # ىّ → يّ  (سَامِرِىّ → سامري)
    t = re.sub("آء$", "اء", t)  # final آء → اء  (سَيْنَآء → سيناء)
    t = re.sub("َإ$", "َأ", t)  # final َإ → َأ  (سَبَإ → سبأ)
    t = t.replace("ٱ", "ا")  # ٱ → ا
    t = t.replace("وٰ", "ا")  # وٰ → ا
    t = re.sub("ىٰ(?=[ء-ي])", "ا", t)  # ىٰ inside a word → ا
    t = t.replace("ىٰ", "ى").replace("ٰ", "ا")  # final ىٰ → ى; other ٰ → ا
    return strip_marks(t).strip()


def name_keys(name: str) -> set[str]:
    k = normalize(name).replace(" ", "")
    keys = {k}
    if k.startswith("ال") and len(k) > 3:
        keys.add(k[2:])
    else:
        keys.add("ال" + k)
    return keys


def pn_candidates(build_dir: Path) -> list[dict[str, Any]]:
    lemmas = {r["id"]: r for r in read_jsonl(build_dir / "lemmas.jsonl")}
    occ: Counter[int] = Counter()
    verses: dict[int, set[int]] = defaultdict(set)
    with (build_dir / "words.jsonl").open(encoding="utf-8") as fh:
        for line in fh:
            w = json.loads(line)
            if w["pos"] == "PN" and w["lemma_id"]:
                occ[w["lemma_id"]] += 1
                verses[w["lemma_id"]].add(w["verse_id"])
    out = []
    for lid, n in sorted(occ.items(), key=lambda x: (-x[1], x[0])):
        lem = lemmas[lid]
        out.append(
            {
                "lemma_id": lid,
                "lemma_key": lem["key"],
                "name_ar": lemma_display(lem["ar"]),
                "name_plain": everyday(lem["ar"]),
                "occurrences": n,
                "verse_count": len(verses[lid]),
                "verses": sorted(verses[lid]),
            }
        )
    return out


# ── network (separate command; never part of a build) ──────────────────────────────────────────
def _get(url: str, tries: int = 7) -> Any:
    """GET JSON politely: on 429/503 wait (Retry-After, else 5 s doubling) and try again."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    wait = 5.0
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == tries - 1:
                raise
            retry = e.headers.get("Retry-After")
            time.sleep(float(retry) if retry and retry.isdigit() else wait)
            wait *= 2
    raise RuntimeError("unreachable")


def fetch_wikidata(candidates: list[dict[str, Any]], out_dir: Path, pause: float = 2.0) -> dict[str, Any]:
    """Query Wikidata (generic User-Agent, no identifying data) and write the responses to out_dir.
    Resumable: searches already in ``search-ar.json`` are not repeated."""
    out_dir.mkdir(parents=True, exist_ok=True)
    sp_path = out_dir / "sparql-present-in-quran.json"
    if not sp_path.exists():
        sparql = _get("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(SPARQL))
        sp_path.write_text(json.dumps(sparql, ensure_ascii=False, indent=1), encoding="utf-8")
    sparql = json.loads(sp_path.read_text(encoding="utf-8"))
    s_path = out_dir / "search-ar.json"
    searches: dict[str, Any] = json.loads(s_path.read_text(encoding="utf-8")) if s_path.exists() else {}
    for c in candidates:
        q = c["name_plain"]
        if q in searches:
            continue
        url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(
            {
                "action": "wbsearchentities",
                "search": q,
                "language": "ar",
                "uselang": "ar",
                "type": "item",
                "limit": 7,
                "format": "json",
            }
        )
        searches[q] = _get(url)
        s_path.write_text(
            json.dumps(searches, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8"
        )
        time.sleep(pause)
    s_path.write_text(json.dumps(searches, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    ids = sorted({h["id"] for s in searches.values() for h in s.get("search", [])})
    entities: dict[str, Any] = {}
    for i in range(0, len(ids), 50):
        url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(
            {
                "action": "wbgetentities",
                "ids": "|".join(ids[i : i + 50]),
                "props": "labels|descriptions|aliases",
                "languages": "ar|en",
                "format": "json",
            }
        )
        entities.update(_get(url).get("entities", {}))
        time.sleep(pause)
    (out_dir / "entities.json").write_text(
        json.dumps(entities, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8"
    )
    return {
        "sparql_items": len(sparql["results"]["bindings"]),
        "searches": len(searches),
        "entities": len(entities),
    }


# ── matching (offline, from the pinned responses) ──────────────────────────────────────────────
def _val(b: dict[str, Any], k: str) -> str | None:
    return b[k]["value"] if k in b else None


def _mentions_islam(desc_ar: str | None, desc_en: str | None) -> str | None:
    d = strip_marks(desc_ar or "")  # «القُرآنِ» must match «قرآن»
    for kw in _KEYWORDS_AR:
        if kw in d:
            return kw
    low = (desc_en or "").lower()
    for kw in _KEYWORDS_EN:
        if kw in low:
            return kw
    return None


def _label_key(label: str) -> str:
    """«اليسع في الإسلام» → «اليسع»: the qualifier Wikidata adds to tell the Islamic figure apart."""
    return normalize(_LABEL_SUFFIX.sub("", strip_marks(label))).replace(" ", "")


def match_entities(
    candidates: list[dict[str, Any]], cache: Path | None
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    stats: Counter[str] = Counter()
    present: list[dict[str, Any]] = []
    searches: dict[str, Any] = {}
    entities: dict[str, Any] = {}
    if cache and (cache / "sparql-present-in-quran.json").exists():
        sp = json.loads((cache / "sparql-present-in-quran.json").read_text(encoding="utf-8"))
        for b in sp["results"]["bindings"]:
            names = [n for n in [_val(b, "label_ar"), *(_val(b, "aliases") or "").split("|")] if n]
            present.append(
                {
                    "id": _val(b, "item").rsplit("/", 1)[-1],
                    "label_ar": _val(b, "label_ar"),
                    "label_en": _val(b, "label_en"),
                    "desc_ar": _val(b, "desc_ar"),
                    "desc_en": _val(b, "desc_en"),
                    "keys": set().union(*(name_keys(n) for n in names)) if names else set(),
                }
            )
        searches = json.loads((cache / "search-ar.json").read_text(encoding="utf-8"))
        entities = json.loads((cache / "entities.json").read_text(encoding="utf-8"))
    else:
        stats["wikidata_cache_missing"] += 1
    rows: list[dict[str, Any]] = []
    for c in candidates:
        keys = name_keys(c["name_plain"])
        exact = normalize(c["name_plain"]).replace(" ", "")
        wid = label_ar = label_en = desc = evidence = rule = None
        hits = [p for p in present if exact in p["keys"]] or [p for p in present if keys & p["keys"]]
        if len(hits) == 1:
            h = hits[0]
            wid, label_ar, label_en, desc, rule = (
                h["id"],
                h["label_ar"],
                h["label_en"],
                h["desc_ar"] or h["desc_en"],
                "present-in-quran",
            )
            evidence = f"{wid}: P1441 (present in work) = Q428 (Quran); Arabic label/alias matches «{c['name_plain']}»"
        elif len(hits) > 1:
            stats["present_in_quran_ambiguous"] += 1
        suggestions = []
        if wid is None:
            found = []
            for s in searches.get(c["name_plain"], {}).get("search", [])[:7]:
                e = entities.get(s["id"], {})
                lab_ar = e.get("labels", {}).get("ar", {}).get("value") or s.get("label")
                lab_en = e.get("labels", {}).get("en", {}).get("value")
                d_ar = e.get("descriptions", {}).get("ar", {}).get("value")
                d_en = e.get("descriptions", {}).get("en", {}).get("value")
                suggestions.append(
                    {
                        "id": s["id"],
                        "label_ar": lab_ar,
                        "label_en": lab_en,
                        "description_ar": d_ar,
                        "description_en": d_en,
                    }
                )
                if lab_ar and _label_key(lab_ar) in keys and (kw := _mentions_islam(d_ar, d_en)):
                    found.append((s["id"], lab_ar, lab_en, d_ar or d_en, kw))
            pick = found
            if len(found) > 1:
                # «موسى» and «موسى في الإسلام» both qualify: take the Islamic item, as Wikidata's own
                # Quran-linked items do (Q51664 «عيسى ابن مريم» is Jesus in Islam), and name the other
                pick = [f for f in found if _LABEL_SUFFIX.search(strip_marks(f[1]))]
            if len(pick) == 1:
                wid, label_ar, label_en, desc, kw = pick[0]
                rule = "label+description"
                evidence = f"{wid}: Arabic label «{label_ar}» = «{c['name_plain']}»; description «{desc}» mentions «{kw}»"
                others = [f[0] for f in found if f[0] != wid]
                if others:
                    evidence += (
                        f"; the general item{'s' if len(others) > 1 else ''} {', '.join(others)} also match"
                    )
                    stats["label_description_islamic_item_preferred"] += 1
            elif len(found) > 1:
                stats["label_description_ambiguous"] += 1
        stats[f"wikidata_{rule or 'none'}"] += 1
        rows.append(
            {
                **{
                    k: c[k]
                    for k in (
                        "lemma_id",
                        "lemma_key",
                        "name_ar",
                        "name_plain",
                        "occurrences",
                        "verse_count",
                        "verses",
                    )
                },
                "wikidata_id": wid,
                "wikidata_label_ar": label_ar,
                "wikidata_label_en": label_en,
                "wikidata_description": desc,
                "wikidata_rule": rule,
                "wikidata_evidence": evidence,
                "wikidata_suggestions": suggestions[:3] if wid is None and suggestions else None,
                "status": "candidate",
                "source_ids": [QAC] + ([WIKIDATA] if wid or suggestions else []),
            }
        )
    for i, r in enumerate(rows, 1):
        r["id"] = i
    report = {
        "candidates": len(rows),
        "occurrences": sum(r["occurrences"] for r in rows),
        "with_wikidata_id": sum(1 for r in rows if r["wikidata_id"]),
        "by_rule": dict(Counter(r["wikidata_rule"] or "none" for r in rows)),
        "present_in_quran_items": len(present),
        **dict(stats),
    }
    return rows, report
