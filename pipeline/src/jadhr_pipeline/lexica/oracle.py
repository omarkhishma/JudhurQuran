"""OpenITI copies of the same editions as TEST ORACLES for the article splitters (never display text).

OpenITI texts are CC BY-NC-SA and carry no vowels (docs/research/06 Part 6), so nothing here reaches a
build output. Each file is read into one stream of words with the positions where its annotators put
a heading, using the markup of that version:

* ``bar``     — "# |غ ل ط" heading lines (Tāj, JK007140, an independently tagged copy);
* ``alone``   — a heading alone on its line, "# علق" (al-ʿAyn, JK000930); "& باب … &" group titles;
* ``colon``   — a paragraph that opens with "# عهك :" (Tahdhīb, JK007040, which has no heading tags);
* ``bullet``  — "# • الأباءة…" (al-Qāmūs, Shamela0007283).

A line that only looks like a heading — "# قال :", "# وقال أبو عبيد :", "# الفغواء : اسم رجل" — is
text, not a heading: its words stay in the stream.

``boundary_precision`` checks, for a seeded sample of our entries, all three ways a split can be
wrong: the entry must start right after an oracle heading with the same key (its opening words
follow that heading); its closing words must end right before an oracle heading or section break
(ends too early or too late fail); and no oracle heading of another key may fall inside it (two
articles run together fail). A false heading in the oracle can only make an entry fail, never pass,
so the number is a lower bound and each miss is read by hand.
"""

from __future__ import annotations

import bisect
import random
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

from jadhr_arabic import strip_marks

from .quranidx import qtokens

_FOLD = str.maketrans(
    {"أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ٱ": "ء", "ى": "ي", "ة": "ه", "ا": "ء"}
)
_SECTION = re.compile(r"^#+\s*\|")
_MILESTONES = re.compile(r"\s*(?:ms\d+|PageV\d+P\d+|@Q[BE]@)\s*")
# "# علق", "# حقي ، حاق", "# شيع وشوع", "# عسبر عبسر" (combined headings: the first word is the key)
_ALONE = re.compile(r"^#\s+([ء-ي]{2,6}(?:(?:\s*[،,]\s*|\s+)[ء-ي]{2,7}){0,2})\s*$")
# "# عهك : …", "# ( كبعث ) : …", "# لذج ذلج : …", "# حقي ، حاق : …", "# خوس _ خيس : …" (the first word is the key)
_COLON = re.compile(
    r"^#\s+\(?\s*([ء-ي]{2,6})(?![ء-ي])\s*\)?(?:(?:\s*[،,_\-]\s*|\s+)\(?\s*[ء-ي]{2,6}(?![ء-ي])\s*\)?){0,3}\s*:\s*(.*)$"
)
_BAR = re.compile(r"^#\s*\|\s*(.+?)\s*$")
_BULLET = re.compile(r"^#\s*•\s*(.*)$")
_INLINE = re.compile(r"^#\s+([ء-ي]{2,5})\s+([ء-ي]+)")
_LETTER_NAME = r"و?ال(?:همزة|ألف|باء|تاء|ثاء|جيم|حاء|خاء|دال|ذال|راء|زاي|زاء|سين|شين|صاد|ضاد|طاء|ظاء|عين|غين|فاء|قاف|كاف|لام|ميم|نون|هاء|واو|ياء)"
_PLAIN_SECTION = re.compile(
    rf"^#\s+(?:(?:باب|أبواب|ابواب|حرف)\s|(?:تم|آخر|انتهى)\s+(?:\S+\s+){{0,3}}?(?:حرف|كتاب|الخماس|الرباعي)|"
    rf"{_LETTER_NAME}\s+{_LETTER_NAME}\s*$|.*(?:مستعمل|مهمل)|(?:[ء-ي]{{1,2}}\s+){{2,}}[ء-ي]{{1,2}}\s*$)"
)
# (A colophon closing a letter, "# آخر كتاب الجيم", "# تم الخماس وبه تم حرف السين", is a section break.)
# Words that open a line of speech or a gloss, never an article: "# قال :", "# وأنشد :", "# أي :".
_SPEECH_WORDS = (
    "قال وقال فقال يقال ويقال قالوا وقالوا قالت وقالت قلت وقلت قيل وقيل يقول ويقول تقول وتقول "
    "أي وأنشد أنشد وقوله قوله وقول أبو ابو ابن وابن وفي في ومنه ومنها ومن من عمرو سلمة شمر ثعلب "
    "روى وروى ويروى ورواه يعني يريد أراد وقد قد وكذلك كذلك ثم وهو هو وهي هي وإذا إذا فإذا فإن ولا "
    "ومثله مثله ومعنى معناه غيره وغيره وسمعت سمعت وأما وأم ورجل ونحو كما وجمعه وجمعها وجمع وجاء "
    "وبعضهم ومنهم وكان والعرب استعمل أهمل أهملت أحدهما فمن فقلت حدثنا ألا أما لا لم أم قاله كأنه رواه "
    "ولو ومثل وعن عن فقد"
)
_SPEECH = {word.translate(_FOLD) for word in _SPEECH_WORDS.split()}
# What follows a Tahdhīb heading: a narrator ("فوغ : أبو عبيد عن الأصمعي", "عهق : قال الليث").
_NARRATOR = re.compile(
    r"^[(\s]*(?:و?قال|و?رو[ىي]|أبو|ابو|أبي|ابن|عمرو|شمر|ثعلب|اللحياني|الليث|الأصمعي|الاصمعي|الفراء|أهمله|اهمله|سلمة|المنذري|أخبرني|اخبرني)"
)


def heading_key(text: str) -> str:
    """Letters of a heading, hamza/alif folded (both sides of the comparison use it)."""
    return "".join(ch for ch in strip_marks(text).translate(_FOLD) if "ء" <= ch <= "ي")


def _rootlike(key: str, after: str | None = None, alone: bool = False) -> bool:
    """A heading key spells a root: not a speech word, not a gloss with the article ("الفغواء",
    "والحنك"). On a Tahdhīb paragraph a long key, or one opening with و/ف ("وناقة", "فوجه"), is a
    gloss unless a narrator follows it ("فرطح : قال الليث"); a heading alone on its line (al-ʿAyn) is
    refused only when it opens with و ("ونزعت"), so "فلسط" and "خندرس" stay headings."""
    if not 2 <= len(key) <= 6 or key in _SPEECH or key[:3] in ("وءل", "فءل", "بءل"):
        return False
    if key.startswith("ءل") and len(key) > 4:
        return False
    if alone:
        return not (key[0] == "و" and len(key) >= 4)
    if len(key) >= 5 or (key[0] in "وف" and len(key) >= 4):
        return after is not None and bool(_NARRATOR.match(strip_marks(after)))
    return True


def _one_root(heading: str) -> bool:
    """The words of a combined heading spell one root, or two a letter apart ("شيع وشوع", "عسبر عبسر",
    "برعل فرعل"); a short text line ("نفهت نفسي أعيت") does not."""
    sets = []
    for k, word in enumerate(re.split(r"[\s،,]+", heading.strip())):
        key = heading_key(word)
        if k and key.startswith("و") and len(key) > 2:
            key = key[1:]
        sets.append({ch for ch in key if ch not in "ءوي"})
    return all(len(s ^ sets[0]) <= 2 for s in sets[1:])


def _in_order(root: str, word: str) -> bool:
    it = iter(word)
    return len(root) >= 2 and all(ch in it for ch in root)


@dataclass
class Oracle:
    words: list[str] = field(default_factory=list)
    starts: dict[str, list[int]] = field(default_factory=dict)  # heading key → first word of its text
    bounds: list[int] = field(default_factory=list)  # every heading or section break, by word index
    heads: list[int] = field(default_factory=list)  # keyed headings only, by word index
    head_keys: list[str] = field(default_factory=list)  # their keys, parallel to ``heads``

    def mark(self, key: str | None) -> None:
        at = len(self.words)
        self.bounds.append(at)
        if key:
            self.starts.setdefault(key, []).append(at)
            self.heads.append(at)
            self.head_keys.append(key)


def _body_lines(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    if "#META#Header#End#" in text:
        text = text.split("#META#Header#End#", 1)[1]
    out: list[str] = []
    for line in text.splitlines():
        line = _MILESTONES.sub(" ", line).rstrip()  # page and milestone tags, even inside a heading
        if line.startswith("~~") and out:
            out[-1] += " " + line[2:]
        else:
            out.append(line)
    return out


def _bar_heading(content: str) -> str | None:
    """A Tāj heading: one root word, or its letters spaced ("غ ل ط", "ع ور"). JK also uses "|" as a
    column mark inside body lines ("# | الشعر"), which is not a heading."""
    toks = strip_marks(content).split()
    spaced = 1 < len(toks) <= 6 and all(len(x) <= 2 for x in toks)
    if (
        toks
        and all(re.fullmatch("[ء-ي]+", x) for x in toks)
        and (spaced or (len(toks) == 1 and len(toks[0]) <= 7))
    ):
        return content
    return None


def read_oracle(path: Path, style: str) -> Oracle:
    o = Oracle()
    for line in _body_lines(path):
        rest = line
        if style == "bar":
            m = _BAR.match(line)
            if m:
                content = m.group(1).strip(" .:،()")
                head = _bar_heading(content)
                if head is not None:
                    o.mark(heading_key(head))
                    continue
                if re.match(r"^[\d\s]*\(?\s*(?:باب|فصل|المقصد|الجزء|مقدمة|رموز)", strip_marks(content)):
                    o.mark(None)  # a section title
                    continue
                rest = content
        elif style == "alone":
            if "&" in line:  # "… وشجة دامعة تسيل دما & باب العين والتاء والذال معهما & & ذعت … &"
                before, _, after = line.partition("&")
                o.words.extend(qtokens(before))
                o.mark(None)
                o.words.extend(qtokens(after.rsplit("&", 1)[1] if "&" in after else ""))
                continue
            if _SECTION.match(line) or _PLAIN_SECTION.match(
                line
            ):  # "# | باب …", "# الغين والقاف", "# ث غ ي … مستعملات"
                o.mark(None)
                continue
            m = _ALONE.match(line)
            key = heading_key(re.split(r"[\s،,]+", m.group(1))[0]) if m else ""
            if m and _rootlike(key, alone=True) and _one_root(m.group(1)):
                o.mark(key)
                continue
            # JK also types a heading inline: "# عصلب العصلبي الشديد…", "# بظ بظ يبظ…" — a 2–5-letter
            # first word whose letters recur, in order, in the next word.
            m = _INLINE.match(line)
            if (
                m
                and _rootlike(heading_key(m.group(1)), alone=True)
                and _in_order(heading_key(m.group(1)), heading_key(m.group(2)))
            ):
                o.mark(heading_key(m.group(1)))
                rest = line[m.end(1) :]
        elif style == "colon":
            if _SECTION.match(line) or _PLAIN_SECTION.match(
                line
            ):  # also "# ح ن ب", "# حبن ، حنب … : مستعملات"
                o.mark(None)
                continue
            m = _COLON.match(line)
            if m and _rootlike(heading_key(m.group(1)), m.group(2)):
                o.mark(heading_key(m.group(1)))
                rest = m.group(2)
        elif style == "bullet":
            if _SECTION.match(line):
                o.mark(None)
                continue
            m = _BULLET.match(line)
            if m:
                rest = re.sub(r"^\s*[وي]\s*:\s*", "", m.group(1))
                o.mark(heading_key((qtokens(rest) or [""])[0]))
        else:
            raise ValueError(style)
        o.words.extend(qtokens(rest))
    o.bounds.append(len(o.words))
    return o


def _alike(a: list[str], b: list[str]) -> float:
    """Share of ``a``'s words found, in order, in ``b`` (longest common subsequence / len(a))."""
    if not a:
        return 0.0
    blocks = SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks()
    return sum(x.size for x in blocks) / len(a)


def _end_in_oracle(oracle: Oracle, start: int, ours: list[str], n: int, threshold: float) -> int | None:
    """Where our last ``n`` words end in the oracle (searching around start + len(ours))."""
    tail = ours[-n:]
    slack = max(40, len(ours) // 8)  # two typings of a long article drift apart
    expected = start + len(ours)
    lo = max(start + 1, expected - slack)
    hi = min(len(oracle.words), expected + slack)
    best: tuple[float, bool, int, int] | None = None
    for e in range(lo, hi + 1):
        score = _alike(tail, oracle.words[max(start, e - 2 * n - 4) : e])  # room for a few inserted words
        cand = (score, oracle.words[e - 1] == tail[-1], -abs(e - expected), e)
        if best is None or cand > best:
            best = cand
    if best is None or best[0] < threshold:
        return None
    return best[3]


@dataclass
class Verdict:
    index: int
    headword: str
    ok: bool
    start: float
    end: float
    reason: str


def boundary_precision(
    entries: list[tuple[list[str], str]],
    oracle: Oracle,
    *,
    sample: int = 50,
    seed: int = 3002,
    n: int = 8,
    threshold: float = 0.75,
    skip_head: bool = False,
) -> tuple[float, list[Verdict]]:
    """``entries`` are (headings, body) in split order — several headings for a combined article. A
    sampled entry is correct when, after an oracle heading with one of its keys, the oracle text opens
    with our first ``n`` words, our last ``n`` words end within a few words of an oracle heading or
    section break, and no oracle heading with another key lies between. ``skip_head`` drops our body's
    printed header ("هقع: …") before comparing."""
    picks = random.Random(seed).sample(range(len(entries)), min(sample, len(entries)))
    verdicts: list[Verdict] = []
    for i in sorted(picks):
        heads, body = entries[i]
        head = " / ".join(heads)
        keys = {heading_key(h) for h in heads}
        text = body.split(":", 1)[1] if skip_head and ":" in body[:40] else body
        words = qtokens(text)
        starts = [s for k in keys for s in oracle.starts.get(k, [])]
        best = Verdict(
            i, head, False, 0.0, 0.0, "start differs" if starts else "no oracle heading with this key"
        )
        for s in starts:
            st = _alike(words[:n], oracle.words[s : s + n + 4])
            if st < threshold:
                if st > best.start:
                    best = Verdict(i, head, False, round(st, 2), 0.0, "start differs")
                continue
            e = _end_in_oracle(oracle, s, words, min(n, len(words)), threshold) if len(words) >= 2 else s
            if e is None:
                best = Verdict(i, head, False, round(st, 2), 0.0, "end differs")
                continue
            k = bisect.bisect_left(oracle.bounds, e - 2)
            if not (k < len(oracle.bounds) and oracle.bounds[k] <= e + 3):
                best = Verdict(i, head, False, round(st, 2), 0.0, "end differs")
                continue
            lo, hi = bisect.bisect_right(oracle.heads, s + 1), bisect.bisect_right(oracle.heads, e - 3)
            inside = [oracle.head_keys[j] for j in range(lo, hi) if oracle.head_keys[j] not in keys]
            if inside:
                best = Verdict(
                    i, head, False, round(st, 2), 1.0, f"oracle heading inside: {' '.join(inside[:3])}"
                )
                continue
            best = Verdict(i, head, True, round(st, 2), 1.0, "")
            break
        verdicts.append(best)
    return sum(v.ok for v in verdicts) / len(verdicts), verdicts
