"""Occasions of revelation (asbāb al-nuzūl), keyed to verse ranges.

* The Tafsir Center's vetted entries (``ayah_content_nozool``): a row of the database can hold several
  verse groups («قوله تعالى: {…} [البقرة: 89].» then numbered narrations «1 - …»), so each numbered
  narration becomes one row, under the verse group whose heading precedes it. Its editors' footnotes
  are separated: the takhrīj (where the narration is found and how it is graded — kept verbatim) and
  any other note (word glosses), with offsets.
* al-Wāḥidī, Asbāb nuzūl al-Qurʾān, and al-Suyūṭī, Lubāb al-nuqūl (OpenITI 2025.1.9, CC BY-NC-SA):
  one row per section («قوله تعالى: {…}» up to the next one). al-Wāḥidī's editor numbered the verses
  after many quotes («{1، 2}», «[107، 108]»); otherwise the section's Quran quote is matched in its
  sūra. al-Suyūṭī's quotes are tagged @QB@…@QE@ and matched the same way. A sūra heading that is
  missing or misnamed is recovered from the quotes (forward only). Sections that cannot be keyed keep
  a null verse — never a guess.

Every row: work, verse range (ids and ayahs, nullable), heading, text (verbatim, markup removed),
locator, match method and confidence.
"""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path
from typing import Any

from .apparatus import MS_TAG, PAGE_TAG, openiti_plain, split_tc
from .quran import QuranIndex, SurahNames, match_key, to_ascii_digits
from .surahs import open_tc

TC = "tafsircenter-quran-db"
WAHIDI = "wahidi-asbab-openiti"
SUYUTI = "suyuti-lubab-openiti"

_TAKHRIJ = re.compile(
    r"^\s*(?:أخرج|اخرج|رواه|روى|سبق تخريج|تقدم تخريج|عزاه|ذكره|أورده|أورد|انظر|ينظر|صحيح|حسن|ضعيف|إسناد|"
    r"متفق عليه|البخاري|مسلم|الحديث|الأثر|لم أجده|لم أقف)"
)


# ── Tafsir Center ───────────────────────────────────────────────────────────────────────────────
_TC_HEADER = re.compile(r"^\s*\*?\s*(?:و?قوله|قال)\s+تعالى\s*:?\s*\{", re.M)
_TC_NARRATION = re.compile(r"^\s*(\d{1,4})\s*-\s*", re.M)
_REF = re.compile(r"\[([^\[\]:]{1,30}):\s*([0-9٠-٩][0-9٠-٩\s\-–،,]*)\]")
_PAREN_NUM = re.compile(r"\(\s*([0-9٠-٩]{1,3})\s*\)")


def _header_range(
    header: str, default_surah: int, quran: QuranIndex, names: SurahNames
) -> tuple[int | None, tuple[int, int] | None, str]:
    """(sūra, (from, to), method) for a verse-group heading. The verse numbers printed inside the quote
    «… ظَهِيرٌ (4) عَسَى رَبُّهُ … (5)}» are the Quran's own and win over a bracket that disagrees with
    them («[التحر يم: 4 - 15]» for a sūra of twelve verses)."""
    quote = header[header.find("{") + 1 : header.rfind("}")] if "{" in header else ""
    inner = [int(to_ascii_digits(x)) for x in _PAREN_NUM.findall(quote)]
    if m := _REF.search(header[header.rfind("}") :] if "}" in header else header):
        s, _ = names.resolve(m.group(1))
        nums = [int(x) for x in re.findall(r"\d+", to_ascii_digits(m.group(2)))]
        if s and nums and (not inner or (min(nums), max(nums)) == (min(inner), max(inner))):
            return s, (min(nums), max(nums)), "reference"
        if s and inner:
            return s, (min(inner), max(inner)), "verse-numbers"
    if inner:
        return default_surah, (min(inner), max(inner)), "verse-numbers"
    hits = [h for h in quran.locate(quote) if quran.by_id[h.verse_from].surah == default_surah]
    if len(hits) == 1:
        a, b = quran.by_id[hits[0].verse_from].ayah, quran.by_id[hits[0].verse_to].ayah
        return default_surah, (a, b), "quote"
    return default_surah, None, "unkeyed"


def tc_asbab(tc_db: Path, quran: QuranIndex) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    names = SurahNames(quran.surah_name)
    con = open_tc(tc_db)
    rows: list[dict[str, Any]] = []
    stats: Counter[str] = Counter()
    seen: dict[tuple[str, str], tuple[int, int]] = {}
    for r in con.execute(
        "select surahNo, ayahNo, nozoolInfo from ayah_content_nozool order by surahNo, ayahNo"
    ):
        s0, a0, original = r["surahNo"], r["ayahNo"], r["nozoolInfo"]
        stats["database_rows"] += 1
        clean, items, counts = split_tc(original)
        stats.update({f"apparatus_{k}": v for k, v in counts.items()})
        # verse groups and narrations, in order
        marks: list[tuple[int, str, re.Match[str]]] = [
            (m.start(), "h", m) for m in _TC_HEADER.finditer(clean)
        ]
        marks += [(m.start(), "n", m) for m in _TC_NARRATION.finditer(clean)]
        marks.sort(key=lambda x: x[0])
        group: dict[str, Any] = {"surah": s0, "range": (a0, a0), "method": "row-key", "heading": None}
        narrations: list[tuple[int, int, dict[str, Any], str]] = []
        for i, (pos, kind, m) in enumerate(marks):
            end = marks[i + 1][0] if i + 1 < len(marks) else len(clean)
            if kind == "h":
                heading = clean[pos:end].strip().split("\n")[0]
                s, rng, how = _header_range(heading, s0, quran, names)
                group = {"surah": s, "range": rng, "method": how, "heading": heading}
                stats["verse_groups"] += 1
                stats[f"group_keyed_by_{how}"] += 1
            else:
                narrations.append((pos, end, dict(group), m.group(1)))
        if not narrations:  # a row with no numbered narration: the whole text is one entry
            narrations.append((0, len(clean), dict(group), ""))
            stats["rows_without_numbered_narrations"] += 1
        for pos, end, grp, number in narrations:
            text = clean[pos:end].strip()
            # the narration's footnotes, offsets made relative to its own text
            lead = len(clean[pos:end]) - len(clean[pos:end].lstrip())
            own = [it for it in items if pos <= it["at"] <= end]
            takhrij = [
                it["text"] for it in own if it["kind"].startswith("footnote") and _TAKHRIJ.match(it["text"])
            ]
            notes = [
                {"at": max(0, it["at"] - pos - lead), "kind": it["kind"], "text": it["text"]}
                for it in own
                if not (it["kind"].startswith("footnote") and _TAKHRIJ.match(it["text"]))
            ]
            stats["takhrij_notes"] += len(takhrij)
            stats["other_notes"] += len(notes)
            rng = grp["range"]
            vf = quran.verse_id(grp["surah"], rng[0]) if rng and grp["surah"] else None
            vt = quran.verse_id(grp["surah"], rng[1]) if rng and grp["surah"] else None
            if not (vf and vt):
                if rng:
                    stats["group_range_out_of_sura"] += 1
                vf = vt = None
            conf = {"reference": "high", "verse-numbers": "high", "quote": "medium", "row-key": "high"}.get(
                grp["method"]
            )
            # the database slices the compilation with overlaps: a narration printed under the next
            # verse group's row too is kept once, under its own heading when one of the copies has it
            dup_key = (number, match_key(text))
            rank = (
                {"reference": 3, "verse-numbers": 3, "quote": 2, "row-key": 1}.get(grp["method"], 0)
                if vf
                else 0
            )
            if dup_key in seen:
                stats["narrations_repeated_in_database"] += 1
                idx, old_rank = seen[dup_key]
                if rank <= old_rank:
                    continue
                rows[idx] = {}
                stats["narrations_repeated_better_heading"] += 1
            seen[dup_key] = (len(rows), rank)
            rows.append(
                {
                    "work": "tafsircenter",
                    "source_id": TC,
                    "surah": grp["surah"] if vf else None,
                    "ayah_from": rng[0] if vf else None,
                    "ayah_to": rng[1] if vt else None,
                    "verse_from": vf,
                    "verse_to": vt,
                    "number": int(number) if number else None,
                    "heading": grp["heading"],
                    "text": text,
                    "takhrij": "\n".join(takhrij) or None,
                    "notes": notes or None,
                    "locator": f"quran.db · ayah_content_nozool · surahNo={s0} ayahNo={a0}"
                    + (f" · #{number}" if number else ""),
                    "match_method": grp["method"] if vf else None,
                    "confidence": conf if vf else None,
                }
            )
            stats["narrations"] += 1
    con.close()
    rows = [r for r in rows if r]
    stats["narrations_kept"] = len(rows)
    return rows, dict(stats)


# ── OpenITI ─────────────────────────────────────────────────────────────────────────────────────
def _openiti_body(path: Path) -> str:
    t = path.read_text(encoding="utf-8")
    if "#META#Header#End#" not in t:
        raise ValueError(f"{path.name}: not an OpenITI mARkdown file")
    return t.split("#META#Header#End#", 1)[1]


def _paragraphs(body: str) -> list[tuple[int, str]]:
    """(offset in body, raw paragraph text) — '# ' starts a paragraph, '~~' continues it."""
    out: list[tuple[int, str]] = []
    pos = 0
    for line in body.split("\n"):
        if line.startswith("~~") and out:
            out[-1] = (out[-1][0], out[-1][1] + "\n" + line)
        elif line.strip():
            out.append((pos, line))
        pos += len(line) + 1
    return out


def _locator(uri: str, body: str, offset: int) -> tuple[str, str | None]:
    """'<uri>#msNNN' (the milestone that closes this point of the text) and the page ('V01P021'):
    OpenITI page and milestone tags mark the END of their page or milestone."""
    ms = MS_TAG.search(body, offset)
    page = PAGE_TAG.search(body, offset)
    loc = f"{uri}#ms{ms.group(1)}" if ms else uri
    return loc, (f"V{page.group(1)}P{page.group(2)}" if page else None)


def _editor_numbers(header: str) -> list[int] | None:
    """Verse numbers the editor inserted after the quote: «{1، 2}», «{26}», «[107، 108]», «[1: 5]»."""
    for m in re.finditer(r"[\{\[]\s*([0-9٠-٩][0-9٠-٩،,\s\-:]*)[\}\]]", header):
        raw = to_ascii_digits(m.group(1))
        nums = [int(x) for x in re.findall(r"\d+", raw)]
        if not nums or max(nums) > 286:
            continue
        if ":" in raw or "-" in raw:
            return list(range(min(nums), max(nums) + 1))
        return nums
    return None


class _Keyer:
    """Keys sections to verses within a running sūra context. The context moves forward only: by a
    sūra heading, or — when a heading is missing — by a quote found uniquely in one of the next two
    sūras. Within a sūra the sections follow the verse order, so a quote found several times in its
    sūra is taken at its first place after the previous section's verse ('quote-in-order')."""

    FORWARD_WINDOW = 4

    def __init__(self, quran: QuranIndex) -> None:
        self.q = quran
        self.names = SurahNames(quran.surah_name)
        self.surah: int | None = None
        self.last: int = 0  # verse id of the previous keyed section
        self.stats: Counter[str] = Counter()

    def heading(self, name: str) -> None:
        s, _ = self.names.resolve(name)
        if s is not None and (self.surah is None or s > self.surah):
            self.surah = s
            self.stats["surah_headings_used"] += 1
        else:
            self.stats["surah_headings_ignored"] += 1

    def _in_surah(self, quote: str, s: int, words: int) -> list[tuple[int, int, str]]:
        levels = ("exact",) if words < 2 else ("exact", "loose", "skeleton")
        return [(h.verse_from, h.verse_to, h.level) for h in self.q.locate(quote, levels, surah=s)]

    def key(self, quote: str | None, numbers: list[int] | None) -> dict[str, Any]:
        s = self.surah
        words = len(match_key(quote).split()) if quote else 0
        if numbers and s:
            a, b = min(numbers), max(numbers)
            vf, vt = self.q.verse_id(s, a), self.q.verse_id(s, b)
            if vf and vt:
                check = self.q.contains(vf, vt, quote) if quote and words >= 2 else None
                if check or not quote or words < 2:
                    return self._row(vf, vt, "editor-number", "high" if check else "medium")
                self.stats["editor_numbers_disagree_with_quote"] += 1
        if quote and words >= 1:
            if s:
                hits = self._in_surah(quote, s, words)
                if len(hits) == 1:
                    vf, vt, level = hits[0]
                    if words == 1:
                        return self._row(vf, vt, "quote-single-word", "low")
                    return self._row(vf, vt, "quote", "high" if level == "exact" and words >= 3 else "medium")
                if len(hits) > 1:
                    after = sorted(h for h in hits if h[0] >= self.last)
                    if after:
                        vf, vt, _ = after[0]
                        return self._row(vf, vt, "quote-in-order", "medium" if words >= 2 else "low")
                    self.stats["quote_ambiguous_in_surah"] += 1
                    return self._row(None, None, None, None)
            later = [
                (h.verse_from, h.verse_to)
                for h in self.q.locate(quote)
                if s is None or 0 < self.q.by_id[h.verse_from].surah - s <= self.FORWARD_WINDOW
            ]
            if len(later) == 1 and words >= 2:
                vf, vt = later[0]
                self.surah = self.q.by_id[vf].surah
                self.stats["surah_inferred_from_quote"] += 1
                return self._row(vf, vt, "quote-surah-inferred", "low")
        return self._row(None, None, None, None)

    def _row(self, vf: int | None, vt: int | None, how: str | None, conf: str | None) -> dict[str, Any]:
        self.stats[f"keyed_by_{how}" if how else "unkeyed"] += 1
        if vf:
            self.last = vf
        return {"verse_from": vf, "verse_to": vt, "match_method": how, "confidence": conf}


_W_SURAH = re.compile(r"^### \|\s*(?:سورة\s+)?(.+?)\s*$")
_W_HEADER = re.compile(r"^#\s+(?:\[[\d٠-٩،,\s]+\]\s*|\(\d+\)\s*-\s*)?و?قوله\b")
_W_HEADER_LOOSE = re.compile(
    r"\[\s*قوله\s+(?:تعالى|عز وجل)\s*:"
)  # the editor's bracketed heading «[قوله تعالى: …»


def _quote_of(header: str) -> str | None:
    """The Quran quote a section heading names: the first non-numeric {…}, else the words after
    «قوله تعالى:» up to «الآية», «...», «[» or the end."""
    for m in re.finditer(r"\{([^{}]+)\}", header):
        if not re.fullmatch(r"[0-9٠-٩،,\s\-:]+", m.group(1)):
            return m.group(1)
    m = re.search(r"قوله\s+(?:تعالى|عز وجل|-\s*عز وجل\s*-)\s*:\s*(.+)", header)
    if m:
        q = re.split(r"\.\.\.|…|الآية|\[|\(", m.group(1))[0]
        return q.strip() or None
    return None


def openiti_sections(
    path: Path, uri: str, work: str, source_id: str, quran: QuranIndex, style: str
) -> tuple[list[dict], dict]:
    """Sections of al-Wāḥidī (style 'wahidi') or al-Suyūṭī (style 'suyuti')."""
    body = _openiti_body(path)
    keyer = _Keyer(quran)
    paras = _paragraphs(body)
    # split al-Suyūṭī's inline sūra headings («… $ سورة البقرة») into their own paragraphs
    if style == "suyuti":
        split: list[tuple[int, str]] = []
        for off, p in paras:
            parts = re.split(r"(?=\$ )", p)
            o = off
            for part in parts:
                if part.strip():
                    split.append((o, part))
                o += len(part)
        paras = split
    sections: list[dict[str, Any]] = []
    cur: dict[str, Any] | None = None

    def close() -> None:
        if cur is not None:
            sections.append(cur)

    for off, p in paras:
        first_line = p.split("\n", 1)[0]
        if style == "wahidi" and (m := _W_SURAH.match(first_line)):
            close()
            cur = None
            title = m.group(1).strip()
            if not re.fullmatch(r"\.+", title):
                heading = first_line.removeprefix("### |").strip()
                if keyer.names.resolve(title)[0] is None:  # a chapter of the book, not a sūra
                    cur = {
                        "offset": off,
                        "raw": [],
                        "surah": None,
                        "heading": heading,
                        "key": None,
                        "kind": "chapter",
                    }
                else:
                    keyer.heading(title)
                    cur = {
                        "offset": off,
                        "raw": [],
                        "surah": keyer.surah,
                        "heading": heading,
                        "key": None,
                        "kind": "surah-intro",
                    }
            continue
        if style == "suyuti" and p.startswith("$ "):
            line = re.sub(r"PageV\d+P\d+|ms\d+", " ", p[2:].split("\n")[0])
            name = re.sub(r"\(.*?\)", " ", line)
            name = re.sub(r"^سورة\s+", "", name.strip())
            name = re.split(r"\s+(?:أو|أخرج|قوله)\b", name)[0].strip()
            close()
            if name.startswith(("مقدمة", "تنبيهات")):
                cur = {
                    "offset": off,
                    "raw": [],
                    "surah": None,
                    "heading": name,
                    "key": None,
                    "kind": "chapter",
                }
            else:
                if name:
                    keyer.heading(name)
                heading = re.split(r"\s+(?:أخرج|قوله|\(\s*ك\s*\))", re.sub(r"\s+", " ", line).strip())[0]
                cur = {
                    "offset": off,
                    "raw": [],
                    "surah": keyer.surah,
                    "heading": heading,
                    "key": None,
                    "kind": "surah-intro",
                }
            rest = re.split(r"(?=قوله\s+تعالى)", p, maxsplit=1)
            if len(rest) == 2 and "@QB@" in rest[1][:60]:
                p, off = rest[1], off + len(rest[0])  # the heading line also opens a section
            else:
                cur["raw"].append(p)
                continue
        is_header = (
            style == "wahidi" and (_W_HEADER.match(first_line) or _W_HEADER_LOOSE.search(first_line[:70]))
        ) or (
            style == "suyuti" and re.match(r"^(?:#\s+)?(?:\(\s*\S\s*\)\s*)?قوله\s+تعالى\s*@QB@", p.lstrip())
        )
        if is_header:
            close()
            header = re.sub(r"\s+", " ", p.replace("\n~~", " "))
            if style == "suyuti":
                qm = re.search(r"@QB@(.+?)@QE@", header)
                quote, numbers = (qm.group(1).strip() if qm else None), None
            else:
                quote, numbers = _quote_of(header), _editor_numbers(header)
            key = keyer.key(quote, numbers)
            cur = {
                "offset": off,
                "raw": [p],
                "surah": keyer.surah,
                "heading": openiti_plain(header.split("\n")[0])[:500],
                "quote": quote,
                "key": key,
                "kind": "section",
            }
            continue
        if cur is None:
            cur = {
                "offset": off,
                "raw": [],
                "surah": keyer.surah,
                "heading": None,
                "key": None,
                "kind": "front-matter",
            }
        cur["raw"].append(p)
    close()
    rows: list[dict[str, Any]] = []
    for sec in sections:
        text = openiti_plain("\n".join(sec["raw"]))
        if not text:
            continue
        key = sec["key"] or {"verse_from": None, "verse_to": None, "match_method": None, "confidence": None}
        vf, vt = key["verse_from"], key["verse_to"]
        loc, page = _locator(uri, body, sec["offset"])
        rows.append(
            {
                "work": work,
                "source_id": source_id,
                "surah": quran.by_id[vf].surah if vf else sec["surah"],
                "ayah_from": quran.by_id[vf].ayah if vf else None,
                "ayah_to": quran.by_id[vt].ayah if vt else None,
                "verse_from": vf,
                "verse_to": vt,
                "number": None,
                "heading": sec["heading"],
                "text": text,
                "takhrij": None,
                "notes": None,
                "locator": loc,
                "page": page,
                "match_method": key["match_method"],
                "confidence": key["confidence"],
                "section_kind": sec["kind"],
            }
        )
    st = dict(keyer.stats)
    st["sections"] = sum(1 for r in rows if r["section_kind"] == "section")
    st["sections_keyed"] = sum(1 for r in rows if r["section_kind"] == "section" and r["verse_from"])
    st["sections_unkeyed"] = st["sections"] - st["sections_keyed"]
    st["surah_intros"] = sum(1 for r in rows if r["section_kind"] == "surah-intro")
    st["front_matter"] = sum(1 for r in rows if r["section_kind"] == "front-matter")
    st["chapters"] = sum(1 for r in rows if r["section_kind"] == "chapter")
    st["keyed_by_method"] = dict(
        Counter(r["match_method"] for r in rows if r["section_kind"] == "section" and r["verse_from"])
    )
    return rows, st


def build_asbab(
    tc_db: Path, wahidi: Path, suyuti: Path, quran: QuranIndex
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    tc_rows, tc_stats = tc_asbab(tc_db, quran)
    w_rows, w_stats = openiti_sections(
        wahidi,
        "0468IbnAhmadWahidiNaysaburi.AsbabNuzul.Shamela0011314-ara1",
        "wahidi",
        WAHIDI,
        quran,
        "wahidi",
    )
    s_rows, s_stats = openiti_sections(
        suyuti, "0911Suyuti.LubabNuqul.JK000436-ara1", "suyuti", SUYUTI, quran, "suyuti"
    )
    rows: list[dict[str, Any]] = []
    for seq, r in enumerate(tc_rows + w_rows + s_rows, 1):
        r.setdefault("page", None)
        r.setdefault("section_kind", "narration")
        rows.append({"id": seq, **r})
    report = {
        "tafsircenter": {**tc_stats, "rows": len(tc_rows), "verses_covered": _covered(tc_rows)},
        "wahidi": {**w_stats, "rows": len(w_rows), "verses_covered": _covered(w_rows)},
        "suyuti": {**s_stats, "rows": len(s_rows), "verses_covered": _covered(s_rows)},
        "rows": len(rows),
    }
    return rows, report


def _covered(rows: list[dict[str, Any]]) -> int:
    return len({v for r in rows if r["verse_from"] for v in range(r["verse_from"], r["verse_to"] + 1)})
