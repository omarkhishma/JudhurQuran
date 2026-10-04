"""A verse's commentary in the books (PLAN B55): the tafsir books on the shelf name, in their own headings, the verses
each section comments on, and those headings are read here — one set of rules per book, never a guess — so that a
verse's page can open the sections of al-Ṭabarī, Ibn Kathīr, al-Zamakhsharī, Ibn ʿAṭiyya and Hūd b. Muḥakkam on it.

* Hūd b. Muḥakkam (``hudhawwari-tafsir``): «[2.4-7]» — sūra and verses.
* Ibn ʿAṭiyya (``ibncatiyyaandalusi-muharrarwajiz``): «[سورة البقرة (2) : الآيات 54 الى 55]», «… : آية 61]».
* al-Zamakhsharī (``jarallahzamakhshari-kashshaf``): «البقرة : ( 2 ) ذلك الكتاب …» — the sūra by name, its first verse.
* Ibn Kathīr (``ibnkathir-tafsirquran``): «{الحمد لله رب العالمين (2) }» — the verses' numbers inside the quotation,
  the sūra from the section it stands in («تفسير سورة البقرة»).
* al-Ṭabarī (``tabari-jamicbayan``): «القول في تأويل قوله تعالى: {…} [البقرة: 3]» — the reference the edition gives;
  without one, the quotation found in the sūra's verses, never before the verse last found.

A heading naming one verse covers the verses up to the next heading of the same sūra; one naming a range covers each
verse in it. Every heading is checked against its sūra's verses: a number past the sūra's end, or a heading that goes
back before the last one, is counted and left out. al-Farrāʾ and al-Zajjāj order their notes by sūra only, so their
sections are not tied to verses here.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any

from jadhr_arabic import normalize

BOOKS = (
    "hudhawwari-tafsir",
    "ibncatiyyaandalusi-muharrarwajiz",
    "jarallahzamakhshari-kashshaf",
    "ibnkathir-tafsirquran",
    "tabari-jamicbayan",
)

_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
HUD = re.compile(r"^\[(\d{1,3})\.(\d{1,3})(?:\s*-\s*(\d{1,3}))?\]")
ATIYYA = re.compile(
    r"\[سورة\s+[^\]()]+\((\d{1,3})\)\s*:\s*(?:آية|الآيات|الآية)\s*(\d{1,3})(?:\s*(?:الى|إلى)\s*(\d{1,3}))?\s*\]"
)
ZAMAKHSHARI = re.compile(r"^([^:()]+?)\s*:\s*\(\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*\)")
BRACED = re.compile(r"^\{([^{}]*)\}")
NUMBERS = re.compile(r"\((\d{1,3})\)")
TABARI = re.compile(
    r"القول في تأويل قوله(?: تعالى| جل ثناؤه| عز وجل| جل وعز| تعالى ذكره)?\s*[.:،]?\s*\{([^{}]+)\}"
)
REF = re.compile(r"\[([^\[\]:]{2,30}):\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\]")

# the names the books use beside the mushaf's own heading
ALIASES = {
    "فاتحه الكتاب": 1,
    "ام القران": 1,
    "براءه": 9,
    "التوبه": 9,
    "بني اسرائيل": 17,
    "سبحان": 17,
    "الاسراء": 17,
    "المومن": 40,
    "غافر": 40,
    "حم السجده": 41,
    "السجده حم": 41,
    "فصلت": 41,
    "حم عسق": 42,
    "الشوري": 42,
    "القتال": 47,
    "محمد": 47,
    "الملائكه": 35,
    "فاطر": 35,
    "سال سائل": 70,
    "المعارج": 70,
    "الدهر": 76,
    "هل اتي": 76,
    "الانسان": 76,
    "تبارك": 67,
    "الملك": 67,
    "عم": 78,
    "عم يتساءلون": 78,
    "النبا": 78,
    "المطففين": 83,
    "التطفيف": 83,
    "ارايت": 107,
    "الماعون": 107,
    "اقرا": 96,
    "العلق": 96,
    "تبت": 111,
    "المسد": 111,
    "اللهب": 111,
    "الاخلاص": 112,
    "التوحيد": 112,
    "الصمد": 112,
    "يس": 36,
    "ص": 38,
    "ق": 50,
    "ن": 68,
    "القلم": 68,
    "القيمه": 75,
    "سبح": 87,
    "سبح اسم ربك": 87,
    "والشمس وضحاها": 91,
    "الم نشرح": 94,
    "الانشراح": 94,
    "والتين والزيتون": 95,
    "لم يكن": 98,
    "البينه": 98,
    "اذا زلزلت": 99,
    "ويل لكل همزه لمزه": 104,
    "لايلاف قريش": 106,
    "قريش": 106,
    "قل يا ايها الكافرون": 109,
    "اذا جاء نصر الله والفتح": 110,
    "اذا جاء نصر الله": 110,
    "الم السجده": 32,
    "السجده": 32,
    "تنزيل": 32,
    "الطور": 52,
    "الواقعه": 56,
    "الحشر": 59,
    "الممتحنه": 60,
    "الصف": 61,
    "الجمعه": 62,
    "المنافقون": 63,
    "التغابن": 64,
    "الطلاق": 65,
    "التحريم": 66,
}


def _n(s: str) -> str:
    return normalize(s).translate(_DIGITS)


def surah_names(surahs: list[dict[str, Any]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for s in surahs:
        bare = _n(s["name_ar"])
        out[bare] = s["number"]
        out[bare.removeprefix("ال")] = s["number"]
    for k, v in ALIASES.items():
        out.setdefault(_n(k), v)
        out.setdefault(_n(k).removeprefix("ال"), v)
    return out


def _surah_of(title: str, names: dict[str, int]) -> int | None:
    """The sūra a section heading names: «سورة البقرة», «تفسير سورة البقرة», «ومن سورة آل عمران»."""
    # a verse's heading names its sūra too («البقرة : ( 2 ) …», «[سورة البقرة (2) : …]»): not a sūra's section
    if ":" in title or title.lstrip().startswith(("[", "{")):
        return None
    # honorifics and the editor's brackets and quotation marks are not the name
    title = re.sub(r"\[?(?:عليه|عليها) السلام\]?|صلى الله عليه وسلم|[\"«»]", " ", title)
    t = _n(title)
    t = re.sub(r"^(?:و?من\s+|تفسير\s+)", "", t)
    t = re.sub(r"^السوره التي يذكر فيها\s+", "", t)
    t = re.sub(r"^سور(?:ه|تي)\s+", "", t)
    t = re.sub(r"\s*\(.*$|\s*وهي.*$|\s*مكيه.*$|\s*مدنيه.*$", "", t).strip(" .،:-")
    return names.get(t) or names.get(t.removeprefix("ال"))


def _heading(slug: str, title: str, names: dict[str, int]) -> tuple[int | None, int, int | None, str] | None:
    """(sūra or None for the current one, first verse, last verse or None, rule) from a heading, by the book's rule."""
    t = title.translate(_DIGITS).strip()
    if slug == "hudhawwari-tafsir" and (m := HUD.match(t)):
        return int(m[1]), int(m[2]), int(m[3]) if m[3] else int(m[2]), "range"
    if slug == "ibncatiyyaandalusi-muharrarwajiz" and (m := ATIYYA.search(t)):
        return int(m[1]), int(m[2]), int(m[3]) if m[3] else int(m[2]), "range"
    if slug == "jarallahzamakhshari-kashshaf" and (m := ZAMAKHSHARI.match(t)):
        s = names.get(_n(m[1])) or names.get(_n(m[1]).removeprefix("ال"))
        if s:
            return s, int(m[2]), int(m[3]) if m[3] else None, "named"
    if slug == "ibnkathir-tafsirquran" and (m := BRACED.match(t)):
        nums = [int(x) for x in NUMBERS.findall(m[1])]
        if nums:
            return None, min(nums), max(nums), "range"
    if slug == "tabari-jamicbayan" and (m := TABARI.search(t)):
        if r := REF.search(t[m.end() :]):
            s = names.get(_n(r[1])) or names.get(_n(r[1]).removeprefix("ال"))
            if s:
                return s, int(r[2]), int(r[3]) if r[3] else None, "reference"
        return None, -1, None, "quoted:" + m[1]
    return None


def map_commentary(
    texts: list[dict[str, Any]],
    chapters: list[dict[str, Any]],
    verses: list[dict[str, Any]],
    surahs: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Rows (verse id, text id, chapter id, rule) for every verse a book's section comments on, and a report."""
    names = surah_names(surahs)
    count = {s["number"]: s["verse_count"] for s in surahs}
    verse_id = {(v["surah"], v["ayah"]): v["id"] for v in verses}
    bare = {(v["surah"], v["ayah"]): _n(v.get("text_imlaei") or v.get("text_qpc") or "") for v in verses}
    by_text: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for c in chapters:
        by_text[c["text_id"]].append(c)
    rows: list[dict[str, Any]] = []
    report: dict[str, Any] = {}
    for t in texts:
        if t["slug"] not in BOOKS:
            continue
        chs = sorted(by_text[t["id"]], key=lambda c: c["id"])
        parent = {c["id"]: c.get("parent_id") for c in chs}
        title = {c["id"]: c["title_ar"] for c in chs}
        stats: Counter[str] = Counter()
        found: list[tuple[int, int, int, int | None, str]] = []  # chapter, sūra, from, to, rule
        current: int | None = None
        last: tuple[int, int] = (0, 0)
        for c in chs:
            # the sūra a section stands in: its own heading, or its ancestors'
            s_here = _surah_of(c["title_ar"], names)
            if s_here:
                current = s_here
                last = (s_here, 0)
                stats["surah headings"] += 1
                continue
            h = _heading(t["slug"], c["title_ar"], names)
            if h is None:
                continue
            s, a, b, rule = h
            if s is None:
                # Ibn Kathīr's quotation stands under its sūra's section; al-Ṭabarī's under the last named
                anc = parent.get(c["id"])
                while s is None and anc:
                    s = _surah_of(title.get(anc, ""), names)
                    anc = parent.get(anc)
                s = s or current
            if s is None:
                stats["no surah"] += 1
                continue
            if rule.startswith("quoted:"):
                quote = _n(rule[7:])
                start = last[1] if last[0] == s else 0
                hit = next(
                    (n for n in range(max(1, start), count[s] + 1) if quote and quote in bare[(s, n)]), None
                )
                if hit is None:
                    stats["quotation not found"] += 1
                    continue
                a, b, rule = hit, hit, "quoted"
            if not (1 <= a <= count[s]) or (b is not None and not (a <= b <= count[s])):
                stats["outside the surah"] += 1
                continue
            if (s, a) < last and last[0] == s:
                stats["out of order"] += 1
                continue
            current = s
            last = (s, a)
            found.append((c["id"], s, a, b, rule))
            stats[rule] += 1
        # a heading naming one verse covers the verses up to the next heading of its sūra
        covered: set[int] = set()
        for i, (cid, s, a, b, rule) in enumerate(found):
            if b is None:
                nxt = next((x for x in found[i + 1 :] if x[1] == s and x[2] > a), None)
                b = nxt[2] - 1 if nxt else (count[s] if not any(x[1] == s for x in found[i + 1 :]) else a)
            for n in range(a, b + 1):
                vid = verse_id[(s, n)]
                rows.append({"verse_id": vid, "text_id": t["id"], "chapter_id": cid, "rule": rule})
                covered.add(vid)
        stats["headings"] = len(found)
        stats["verses covered"] = len(covered)
        report[t["slug"]] = dict(stats)
    # one row per verse, chapter
    seen: set[tuple[int, int]] = set()
    out = []
    for r in rows:
        k = (r["verse_id"], r["chapter_id"])
        if k not in seen:
            seen.add(k)
            out.append(r)
    for i, r in enumerate(out, start=1):
        r["id"] = i
    report["rows"] = len(out)
    return out, report
