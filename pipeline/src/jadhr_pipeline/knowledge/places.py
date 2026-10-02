"""Makki/Madani per verse: the verse-level exceptions to a sūra's type, every opinion attributed.

Two sources, kept side by side (never merged into one verdict):

* Tanzil's "Revelation Order" page — a note per sūra («Except 17-33 and 48-50, from Medina»), which
  follows the headings of the Egyptian standard mushaf. Parsed into verse ranges; the note is the quote.
* The Tafsir Center's revelation study for each sūra (``surah_content.surahNujoolInfo``), whose section
  «الآيات المختلف فيها» / «الآيات المدعى مدنيتها/مكيتها» discusses each disputed passage: who claimed the
  exception (reported, with the names as the text gives them) and, where the text states it, the
  study's own conclusion. Both are rows, each with the sentence it comes from.

Rows describe exceptions only; a verse without a row follows its sūra card. Places are named as the
source names them (mecca, medina, juhfa, mina, arafat, between-mecca-and-medina, hijra-journey,
hudaybiyya-return); ``period`` (makki/madani) is set only when the source states it.
"""

from __future__ import annotations

import html
import re
from collections import Counter
from pathlib import Path
from typing import Any

from .apparatus import split_tc
from .quran import QuranIndex, to_ascii_digits
from .surahs import open_tc

TANZIL_ORDER = "tanzil-revelation-order"
TC = "tafsircenter-quran-db"

_SPECIAL = [
    (re.compile(r"from Juhfa", re.I), "juhfa"),
    (re.compile(r"Mina", re.I), "mina"),
    (re.compile(r"Arafat", re.I), "arafat"),
    (re.compile(r"between Mecca and Medina", re.I), "between-mecca-and-medina"),
    (re.compile(r"during the Prophet's Hijrah", re.I), "hijra-journey"),
    (re.compile(r"returning from Hudaybiyya", re.I), "hudaybiyya-return"),
]


def parse_tanzil_page(path: Path) -> list[dict[str, Any]]:
    """The chronological table: order, sūra number, type and note, verbatim."""
    t = path.read_text(encoding="utf-8")
    out = []
    for r in re.findall(r'<tr class="row\d+">\s*(.*?)</tr>', t, re.S):
        cells = [
            html.unescape(re.sub("<[^>]+>", "", c)).strip()
            for c in re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)
        ]
        if len(cells) == 5 and cells[0].isdigit():
            out.append(
                {
                    "order": int(cells[0]),
                    "name": cells[1],
                    "surah": int(cells[2]),
                    "type": cells[3],
                    "note": cells[4],
                }
            )
    if len(out) != 114 or sorted(x["surah"] for x in out) != list(range(1, 115)):
        raise ValueError(f"Tanzil revelation-order page: {len(out)} rows, expected the 114 sūras once each")
    return out


def _ranges(spec: str) -> list[tuple[int, int]]:
    """«17-33 and 48-50» · «10, 11 and 20» · «26, 32, 33, 57, 73-80» → merged (from, to) ranges."""
    nums: list[tuple[int, int]] = []
    for part in re.split(r",|\band\b", spec):
        part = part.strip()
        if m := re.fullmatch(r"(\d+)\s*-\s*(\d+)", part):
            nums.append((int(m.group(1)), int(m.group(2))))
        elif re.fullmatch(r"\d+", part):
            nums.append((int(part), int(part)))
    out: list[tuple[int, int]] = []
    for a, b in sorted(nums):
        if out and out[-1][1] + 1 >= a:
            out[-1] = (out[-1][0], max(out[-1][1], b))
        else:
            out.append((a, b))
    return out


def tanzil_exceptions(row: dict[str, Any], verse_count: int) -> list[dict[str, Any]]:
    """Exception ranges of one Tanzil note, each {ayah_from, ayah_to, place, period}."""
    note = row["note"]
    if not note:
        return []
    out: list[dict[str, Any]] = []

    def add(rngs: list[tuple[int, int]], place: str) -> None:
        period = {"mecca": "makki", "medina": "madani"}.get(place)
        out.extend({"ayah_from": a, "ayah_to": b, "place": place, "period": period} for a, b in rngs)

    if m := re.fullmatch(r"Only (\d+)-(\d+) from Mecca; the rest from Medina", note):
        b = int(m.group(2))
        add([(b + 1, verse_count)], "medina")
        return out
    if m := re.fullmatch(r"Except the last (two|three) verses from (Mecca|Medina)", note):
        n = {"two": 2, "three": 3}[m.group(1)]
        add([(verse_count - n + 1, verse_count)], m.group(2).lower())
        return out
    if m := re.fullmatch(r"Except last (two|three) verses from (Mecca|Medina)", note):
        n = {"two": 2, "three": 3}[m.group(1)]
        add([(verse_count - n + 1, verse_count)], m.group(2).lower())
        return out
    if m := re.fullmatch(r"Except (.+?) from Medina and (\d+) from Juhfa at the time of the Hijra", note):
        add(_ranges(m.group(1)), "medina")
        add(_ranges(m.group(2)), "juhfa")
        return out
    if m := re.fullmatch(r"Except (.+?),? from (Mecca|Medina)", note):
        add(_ranges(m.group(1)), m.group(2).lower())
        return out
    for pat, place in _SPECIAL:
        if pat.search(note):
            m = re.match(r"Except ([\d ,\-and]+?)(?:,| from| revealed)", note)
            add(_ranges(m.group(1)) if m else [(1, verse_count)], place)
            return out
    raise ValueError(f"Tanzil note for sūra {row['surah']} not understood: {note!r}")


# ── Tafsir Center revelation studies ────────────────────────────────────────────────────────────
_SECTION = re.compile(
    r"^\s*(الآيات المختلف فيها|الآية المختلف فيها|الآيات المدعى (مدنيتها|مكيتها|مدينتها)[^\n]*)\s*$", re.M
)
_ITEM = re.compile(r"^\s*\*?\s*(?:المطلب [^:\n]{1,15}:\s*في\s*)?و?قوله تعالى\s*:?\s*\{", re.M)
_PAREN_NUM = re.compile(r"\(\s*([0-9٠-٩]{1,3})\s*\)")
_BRACKET_RANGE = re.compile(r"\[(?:[^\]\d٠-٩:]{1,20}:\s*)?([0-9٠-٩]{1,3})(?:\s*-\s*([0-9٠-٩]{1,3}))?\]")
_QUOTES = re.compile(r"\{([^{}]+)\}")
_CLAIM = re.compile(
    r"(?P<s>(?:و?نسب|نُسب)\s+(?:القول\s+)?(?:ب)?(?P<w>استثناء|مدنية|مكية|مدنيت|مكيت|بمدنية|بمكية)\S*[^.\n]*?\s+إلى\s+(?P<who>[^.\n]+)"
    r"|(?:^|[.\n]\s*)(?:و)?قال\s+(?P<w2>بمدنية|بمكية|باستثناء)\S*(?:\s+(?:هذه|هاتين|هذا)\s+\S+)?\s*[؛،:]?\s*(?P<who2>[^.\n]+)"
    r"|(?P<anon>قيل\s+(?:ب)?(?P<w3>مدنية|مكية|استثناء|بمدنية|بمكية)\S*[^.\n]*))"
)
_AYA = r"(?:آيات|آية|آيتان|آيتين)"
_VERDICT = re.compile(
    r"(?P<s>[^.\n]*?(?:"
    rf"(?:ف|و)?(?:ال)?{_AYA}\s+(?P<a>مكيات|مكية|مدنيات|مدنية)\s+(?:كغيرها|كسائر|تبعا|تبعًا)"
    rf"|فال{_AYA}\s+(?:-[^-\n]{0, 30}-\s+)?(?P<b>مكيات|مكية|مدنيات|مدنية)"
    rf"|(?:الراجح|فالراجح|والراجح)[^.\n]{{0,60}}?(?:القول\s+ب|أن\s+(?:ال)?{_AYA}\s+|أنها\s+)(?P<c>مكيتها|مدنيتها|مكيات|مكية|مدنيات|مدنية)"
    r"|(?:ف|و)?لا\s+يصح\s+استثناؤ(?:ها|هن|هما)(?P<d>)"
    r")[^.\n]*)"
)
_WHO_END = re.compile(r"\s*[،,]?\s*(?:ولم\s|وأضاف|وهو\s|ولعل|ولا\s|إلا\s|كما\s|ثم\s)")
_HONORIFIC = re.compile(
    r"\s*-?\s*(?:رضي الله عن\S*|رحمه\S*\s+الله(?:\s+تعالى)?|رحمهم\s+الله(?:\s+تعالى)?)\s*-?"
)


def _names(who: str | None) -> str | None:
    """The names an attribution sentence gives, without the honorifics or the sentence that follows."""
    if not who:
        return None
    who = _WHO_END.split(who, maxsplit=1)[0]
    who = _HONORIFIC.sub(" ", who)
    who = re.sub(r"\s+", " ", who).strip(" ،,-")
    return who or None


def _period(word: str | None, base: str) -> str | None:
    """'makki' / 'madani' from a word; «استثناء» is the opposite of the sūra's base type."""
    if word is None:
        return None
    if "مك" in word:
        return "makki"
    if "مدن" in word:
        return "madani"
    if "استثناء" in word:
        return "madani" if base == "meccan" else "makki"
    return None


def _item_range(header: str, surah: int, quran: QuranIndex) -> tuple[tuple[int, int] | None, str]:
    """Verse range of a disputed passage: the bracketed range after the quotes when given («[48 - 50]»),
    else the verse numbers inside the quotes together with the quotes that carry none (matched in
    this sūra), else None."""
    tail = header[header.rfind("}") + 1 :] if "}" in header else ""
    if m := _BRACKET_RANGE.search(tail):
        a = int(to_ascii_digits(m.group(1)))
        b = int(to_ascii_digits(m.group(2))) if m.group(2) else a
        return (min(a, b), max(a, b)), "bracket-numbers"
    ayahs: list[int] = []
    how = set()
    for q in _QUOTES.findall(header):
        nums = [int(to_ascii_digits(x)) for x in _PAREN_NUM.findall(q)]
        if nums:
            ayahs += nums
            how.add("verse-numbers")
            continue
        q = q.replace("...", " ").replace("…", " ")
        found = [
            h
            for h in quran.locate(q)
            if quran.by_id[h.verse_from].surah == surah and quran.by_id[h.verse_to].surah == surah
        ]
        if len(found) == 1:
            ayahs += [quran.by_id[found[0].verse_from].ayah, quran.by_id[found[0].verse_to].ayah]
            how.add("quote")
        elif len(found) > 1:
            return None, "quote-ambiguous"
    if ayahs:
        return (min(ayahs), max(ayahs)), "+".join(sorted(how))
    return None, "unkeyed"


def _not_quoted(text: str, pos: int) -> bool:
    """False when pos sits inside quoted speech (another scholar's words, not the study's own)."""
    line_start = text.rfind("\n", 0, pos) + 1
    before = text[line_start:pos]
    return before.count('"') % 2 == 0 and before.count("«") <= before.count("»")


_REPORTED_SPEECH = re.compile(r"(?:قالوا|قال|يقول|يقولون)\s*:|حاول البعض")
_OTHERS_VIEW = re.compile(r"في نظر|عند أصحاب هذا القول|على قول من")
_ARGUMENT_HEADING = re.compile(r"^\s*\*?\s*وجه (?:الاستدلال|الدلالة)\s*:?\s*$")
_PARTIAL = re.compile(r"أما ما (?:قبلها|بعدها)|ما عدا|سوى")


def _verdict(seg: str) -> re.Match[str] | None:
    """The study's own conclusion: not inside quoted speech, not in a sentence that reports what others
    said («قالوا: …», «في نظر أصحاب هذا القول»), and not the claimants' argument («وجه الاستدلال»)."""
    for m in _VERDICT.finditer(seg):
        at = min(m.start(g) for g in "abcd" if m.group(g) is not None)
        before = seg[m.start("s") : at]
        if not _not_quoted(seg, at) or _REPORTED_SPEECH.search(before) or _OTHERS_VIEW.search(m.group("s")):
            continue
        line_start = seg.rfind("\n", 0, m.start("s"))
        prev_line = seg[seg.rfind("\n", 0, max(line_start, 0)) + 1 : max(line_start, 0)]
        if _ARGUMENT_HEADING.match(prev_line):
            continue
        return m
    return None


def _row(
    common: dict[str, Any], role: str, period: str | None, who: str | None, quote: str, method: str
) -> dict:
    return {**common, "role": role, "period": period, "attributed_to": who, "quote": quote, "method": method}


def tc_opinions(
    surah: int, base: str, text: str, quran: QuranIndex, study_period: str | None = None
) -> tuple[list[dict[str, Any]], Counter[str]]:
    """Verse-level opinion rows from one sūra's revelation study (footnotes already separated).
    A passage listed with no discussion of its own («* قوله تعالى … [17 - 33].» followed by
    «* وقوله تعالى … [48 - 50].» and then one discussion of «هذه الآيات») shares the discussion that
    follows it."""
    stats: Counter[str] = Counter()
    rows: list[dict[str, Any]] = []
    secs = list(_SECTION.finditer(text))
    if not secs:
        return rows, stats
    title = secs[0].group(1).strip()
    claimed_default = (
        "madani"
        if "مدنيت" in title or "مدينت" in title
        else "makki"
        if "مكيت" in title
        else _period("استثناء", base)
    )
    body = text[secs[0].start() :]
    items = list(_ITEM.finditer(body))
    stats["items"] += len(items)
    waiting: list[dict[str, Any]] = []
    for i, m in enumerate(items):
        seg = body[m.start() : items[i + 1].start() if i + 1 < len(items) else len(body)].strip()
        header, _, discussion = seg.partition("\n")
        rng, how = _item_range(header, surah, quran)
        stats[f"range:{how}"] += 1
        if rng is None or not quran.verse_id(surah, rng[0]) or not quran.verse_id(surah, rng[1]):
            stats["items_unkeyed"] += 1
            continue
        common = {
            "surah": surah,
            "ayah_from": rng[0],
            "ayah_to": rng[1],
            "context": header.strip(),
            "scope": "verses",
        }
        if not discussion.strip() and i + 1 < len(items):
            waiting.append(common)  # shares the next passage's discussion
            stats["items_sharing_next_discussion"] += 1
            continue
        group = [*waiting, common]
        waiting = []
        claim = _CLAIM.search(seg)
        verdict = _verdict(seg)
        for c in group:
            if claim:
                word = claim.group("w") or claim.group("w2") or claim.group("w3")
                rows.append(
                    _row(
                        c,
                        "reported",
                        _period(word, base) or claimed_default,
                        _names(claim.group("who") or claim.group("who2")),
                        claim.group(0).strip(" .\n"),
                        "pattern",
                    )
                )
                stats["reported_with_sentence"] += 1
            else:
                rows.append(_row(c, "reported", claimed_default, None, title, "section-title"))
                stats["reported_from_section_title"] += 1
            if verdict:
                word = next((verdict.group(g) for g in "abc" if verdict.group(g)), None)
                # «تبعًا للسورة» / «لا يصح استثناؤها»: the sūra's type as this study concludes it
                follows = study_period or ("makki" if base == "meccan" else "madani")
                period = _period(word, base) if word else follows
                if _PARTIAL.search(verdict.group("s")):
                    period = None  # a verdict that splits the passage («أما ما قبلها …»): see the quote
                    stats["preferred_partial"] += 1
                rows.append(_row(c, "preferred", period, None, verdict.group("s").strip(" .\n*-"), "pattern"))
                stats["preferred"] += 1
    return rows, stats


_OPINION = re.compile(
    r"^\s*\*?\s*(?P<ord>الأول|الثاني|الثالث|الرابع)\s*:?\s*(?:أنها|إنها|أن السورة)\s+(?P<p>مكية|مدنية)(?P<rest>[^\n]*)",
    re.M,
)
_ORD = {"الأول": 1, "الثاني": 2, "الثالث": 3, "الرابع": 4}
_PREFER_ORD = re.compile(r"(?:رجحان|هو)\s+القول\s+(?P<ord>الأول|الثاني|الثالث|الرابع)")
_PREFER_WORD = re.compile(
    r"(?:يترجح لدي|ترجح لدي|ترجح لديّ|ترجح عندي|يظهر لي|الذي يظهر|أميل إليه|يظهر رجحان)[^.\n]*?"
    r"(?:القول\s+ب(?P<a>مكيتها|مدنيتها)|(?:أن|بأن)\s+(?:سورة\s+\S+\s+)?(?:كلها\s+)?(?P<b>مكية|مدنية))"
    r"|(?:القول\s+ب(?P<c>مكيتها|مدنيتها))[^.\n]*?(?:وهو الذي أميل إليه|أميل إليه)"
)


def _attribution(rest: str) -> str | None:
    """The attribution clause of an opinion line as the study states it («منسوب إلى ابن عباس، وقتادة…»,
    «قول جمهور المفسرين»), honorifics removed, the sentence about evidence that follows cut off."""
    t = _HONORIFIC.sub(" ", rest)
    t = re.split(r"\s*[،,]?\s*(?:ويدل|ولم أجد|وأصحاب|ثم في ذلك|ومنهم من|وذلك)", t)[0]
    t = re.sub(r"^\s*[،,]?\s*(?:وهذا القول|وهو|وهذا|وبه)\s+", "", t)
    t = re.sub(r"\s+([،,])", r"\1", re.sub(r"\s+", " ", t)).strip(" ،,.")
    return t or None


def tc_surah_opinions(surah: int, verse_count: int, text: str) -> tuple[list[dict[str, Any]], Counter[str]]:
    """Sūra-level opinions of a study that opens «سورة … من السور المختلف فيها»: each «الأول: أنها
    مكية، وهو منسوب إلى …» is a reported opinion, and the study's «الراجح» a preferred one when it names
    the opinion it prefers. Rows span the whole sūra (scope 'surah')."""
    stats: Counter[str] = Counter()
    head = text[:600]
    if "من السور المختلف" not in head and "من السورة المختلف" not in head:
        return [], stats
    stats["studies_with_surah_dispute"] += 1
    common = {
        "surah": surah,
        "ayah_from": 1,
        "ayah_to": verse_count,
        "context": head.split("\n")[0].strip()[:300],
        "scope": "surah",
    }
    rows: list[dict[str, Any]] = []
    by_ord: dict[int, str] = {}
    for m in _OPINION.finditer(text):
        period = "makki" if m.group("p") == "مكية" else "madani"
        if _ORD[m.group("ord")] in by_ord:
            continue  # a later list (e.g. sub-opinions) reuses the ordinals
        by_ord[_ORD[m.group("ord")]] = period
        rows.append(
            _row(common, "reported", period, _attribution(m.group("rest")), m.group(0).strip(), "pattern")
        )
        stats["surah_reported"] += 1
    rajih = text.find("الراجح")
    if rajih != -1 and by_ord:
        block = text[rajih : rajih + 700]
        m = _PREFER_ORD.search(block)
        period = by_ord.get(_ORD[m.group("ord")]) if m else None
        sentence = m
        if period is None:
            w = _PREFER_WORD.search(block)
            if w:
                word = w.group("a") or w.group("b") or w.group("c")
                period = _period(word, "")
                sentence = w
        if period and sentence is not None:
            line_start = block.rfind("\n", 0, sentence.start()) + 1
            line_end = block.find("\n", sentence.end())
            quote = block[line_start : line_end if line_end != -1 else len(block)].strip()
            rows.append(_row(common, "preferred", period, None, quote, "pattern"))
            stats["surah_preferred"] += 1
        else:
            stats["surah_no_stated_preference"] += 1
    return rows, stats


def build_verse_places(
    tanzil_page: Path, tc_db: Path, quran: QuranIndex, surah_types: dict[int, str]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    table = parse_tanzil_page(tanzil_page)
    rows: list[dict[str, Any]] = []
    tanzil_rows: list[dict[str, Any]] = []
    for r in sorted(table, key=lambda x: x["surah"]):
        if r["type"].lower() != surah_types[r["surah"]]:
            raise ValueError(f"Tanzil page and metadata disagree on the type of sūra {r['surah']}")
        for ex in tanzil_exceptions(r, quran.verse_count[r["surah"]]):
            tanzil_rows.append(
                {
                    "surah": r["surah"],
                    **ex,
                    "role": "source-note",
                    "attributed_to": None,
                    "quote": r["note"],
                    "context": f"Tanzil revelation order #{r['order']} ({r['name']})",
                    "method": "parsed-note",
                    "scope": "surah"
                    if (ex["ayah_from"], ex["ayah_to"]) == (1, quran.verse_count[r["surah"]])
                    else "verses",
                    "source_id": TANZIL_ORDER,
                }
            )
    con = open_tc(tc_db)
    tc_rows: list[dict[str, Any]] = []
    tc_stats: Counter[str] = Counter()
    sections = 0
    for n, txt in con.execute("select surahNo, surahNujoolInfo from surah_content order by surahNo"):
        clean = split_tc(txt)[0]
        whole, st2 = tc_surah_opinions(n, quran.verse_count[n], clean)
        study = next((w["period"] for w in whole if w["role"] == "preferred"), None)
        found, st = tc_opinions(n, surah_types[n], clean, quran, study)
        found = whole + found
        sections += bool(_SECTION.search(clean))
        tc_stats.update(st)
        tc_stats.update(st2)
        for f in found:
            tc_rows.append({**f, "place": None, "source_id": TC})
    con.close()
    # check each Tanzil exception against the Tafsir Center study
    checks: Counter[str] = Counter()
    for t in tanzil_rows:
        over = [
            x
            for x in tc_rows
            if x["scope"] == "verses"
            and x["surah"] == t["surah"]
            and x["ayah_from"] <= t["ayah_to"]
            and x["ayah_to"] >= t["ayah_from"]
        ]
        preferred = [x for x in over if x["role"] == "preferred"]
        if not over:
            t["tc_check"] = "not-discussed"
        elif not preferred:
            t["tc_check"] = "discussed-no-conclusion"
        elif any(x["period"] is None for x in preferred):
            t["tc_check"] = "discussed-partial"
        elif t["period"] and all(x["period"] == t["period"] for x in preferred):
            t["tc_check"] = "agrees"
        elif t["period"] is None:
            t["tc_check"] = "discussed-other-place"
        else:
            t["tc_check"] = "differs"
        checks[t["tc_check"]] += 1
    for x in tc_rows:
        x["tc_check"] = None
    for r in tanzil_rows + tc_rows:
        vf, vt = quran.verse_id(r["surah"], r["ayah_from"]), quran.verse_id(r["surah"], r["ayah_to"])
        if vf is None or vt is None:
            raise ValueError(f"verse place out of range: {r['surah']}:{r['ayah_from']}-{r['ayah_to']}")
        rows.append({"id": len(rows) + 1, "verse_from": vf, "verse_to": vt, **r})
    report = {
        "tanzil_notes": sum(1 for r in table if r["note"]),
        "tanzil_rows": len(tanzil_rows),
        "tanzil_surahs_with_rows": len({r["surah"] for r in tanzil_rows}),
        "tanzil_checked_against_tafsircenter": dict(checks),
        "tafsircenter_studies_with_disputed_section": sections,
        "tafsircenter_rows": len(tc_rows),
        "tafsircenter_rows_by_role": dict(Counter(r["role"] for r in tc_rows)),
        "tafsircenter_extraction": dict(sorted(tc_stats.items())),
        "rows": len(rows),
    }
    return rows, report
