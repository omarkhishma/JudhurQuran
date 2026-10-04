"""The catalogue (PLAN P11.3a, D9, research 21 §4.1): OpenITI's primary versions of Arabic works whose authors died by
1374 AH, uncorrected OCR left out — the works the D9 gate lets in — as rows a reader can search and browse, each
linked to where its text is read: our reader for the shelf's books, OpenITI's release, and shamela.ws and turath where
its id is Shamela's (`Shamela0007798` is book 7798 on both, research 21 §4.1).

Nothing is ours: the title and the author are the metadata's own (its first form where it gives several, with no
«(المتوفى…)» after a name), the subjects are OpenITI's codes and the libraries' own categories, verbatim. A death year
OpenITI writes «0001» is its sign for a poet before Islam (ʿAntara, ʿAmr b. Kulthūm), said so, never a year."""

from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path
from typing import Any

from jadhr_arabic import normalize

GATE_AH = 1374  # D9: authors who died by this year; 1375–1394 wait for the owner, later ones fail
BEFORE_ISLAM = 1  # OpenITI's date for a pre-Islamic author
# «(المتوفى: 310هـ)», «المتوفى سنة 905»: the death note after a name, to its end
_DIED = re.compile(r"\s*[،,]?\s*\(?\s*(?:ال)?المتو?فى.*$")
_LIBRARY = re.compile(r"^([A-Za-z]+?)(\d[\w-]*)?$")
# the libraries whose categories the metadata carries, by tag prefix (their own words, in Arabic)
CATEGORY_PREFIXES = ("Shamela@", "JK@", "Shia@", "ShamAY@", "Zaydiyya@", "ShamIbadiyya@", "Sham@")


def death(row: dict[str, str]) -> int | None:
    try:
        return int(float(row["date"]))
    except ValueError:
        return None


def passes(row: dict[str, str]) -> bool:
    """The D9 gate: an Arabic work of the Arabic subcorpus, not uncorrected OCR, its author dead by 1374 AH."""
    d = death(row)
    return (
        row["language"] == "ara"
        and row["subcorpus"] == "ara"
        and row["uncorrected_OCR"] == "False"
        and d is not None
        and d <= GATE_AH
    )


def era_year(ah: int) -> int:
    """The CE year a Hijri year mostly falls in, by the standard conversion (the shelf's registry uses it)."""
    return round(ah * 0.970229 + 621.5643)


def _first(s: str) -> str:
    return s.split("::")[0].strip()


def work(row: dict[str, str], shelf: dict[str, str]) -> dict[str, Any]:
    """One catalogue row from one metadata row."""
    version = row["version_uri"]
    lib_id = version.rsplit(".", 1)[-1].split("-")[0]  # «Shamela0007798»
    m = _LIBRARY.match(lib_id)
    library = m.group(1) if m else ""
    # «Shamela0007528BK2» is part 2 of Shamela's book 7528
    sid = re.match(r"Shamela(\d+)", lib_id)
    shamela = int(sid.group(1)) if sid else None
    tags = [t.strip() for t in row["tags"].split("::") if t.strip()]
    d = death(row) or 0
    title = _first(row["title_ar"]) or _first(row["title_lat"])
    author = _DIED.sub("", _first(row["author_ar"])).strip(" ،,") or row["author_from_uri"]
    return {
        "version": version,
        "work": row["book"],
        "author_uri": row["book"].split(".")[0],
        "death_ah": d,
        "before_islam": d == BEFORE_ISLAM,
        "era_year": None if d == BEFORE_ISLAM else era_year(d),
        "title_ar": title,
        "title_lat": _first(row["title_lat"]),
        "author_ar": author,
        "author_lat": row["author_lat_shuhra"] or row["author_from_uri"],
        "words": int(row["tok_length"] or 0),
        "subjects": sorted({t for t in tags if t.startswith("_")}),
        "categories": sorted({t.split("@", 1)[1] for t in tags if t.startswith(CATEGORY_PREFIXES)}),
        "library": library,
        "library_id": lib_id,
        "shamela_id": shamela,
        "path": row["local_path"],
        "shelf": shelf.get(version),
        "norm": normalize(f"{title} {author}"),
    }


def build_catalogue(metadata: Path, shelf: dict[str, str]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """The catalogue's rows in the order of the metadata (by the author's death), with how many each rule let in or
    kept out. ``shelf`` maps a shelf book's version to its slug."""
    with metadata.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    arabic = [r for r in rows if r["language"] == "ara" and r["subcorpus"] == "ara"]
    out = [work(r, shelf) for r in arabic if passes(r)]
    out.sort(key=lambda w: (w["death_ah"], w["version"]))
    for i, w in enumerate(out, start=1):
        w["id"] = i
    later = Counter(
        "uncorrected OCR"
        if r["uncorrected_OCR"] != "False"
        else "owner's decision (1375–1394)"
        if (death(r) or 9999) <= 1394
        else "after 1394 or no date"
        for r in arabic
        if not passes(r)
    )
    report = {
        "arabic_works": len(arabic),
        "in": len(out),
        "authors": len({w["author_uri"] for w in out}),
        "words": sum(w["words"] for w in out),
        "before_islam": sum(w["before_islam"] for w in out),
        "on_the_shelf": sum(1 for w in out if w["shelf"]),
        "with_shamela_id": sum(1 for w in out if w["shamela_id"]),
        "kept_out": dict(sorted(later.items())),
    }
    return out, report
