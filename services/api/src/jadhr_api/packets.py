"""Review packets for the expert reviewers (D15, PLAN P3.10): what this project derived or mapped, laid out for a
linguist and a Quran scholar to check against the sources, one CSV per question, with columns for their verdict.

    uv run python -m jadhr_api.packets data/review/<dataset version>

* ``wazn.csv`` — every lemma's pattern as this project derived it, how, and how often the word occurs;
* ``terms.csv`` — the plain-language cards, our own wording, flagged for review;
* ``pattern-functions.csv`` — each statement of the books of sarf and the patterns it was linked to;
* ``lexicon-mappings.csv`` — the lexica's articles filed under a Quranic root by a loose match, and their confidence;
* ``dictionary-roots.csv`` — the articles left under their heading as written, with the roots they may belong to;
* ``lane-words.csv`` — each Quranic word linked to the paragraph of Lane's article that treats it;
* ``sample-200.csv`` — 200 words drawn by a fixed seed, each section of the panel as it stands, for the P3.10 exit;
* ``README.md`` — what each packet asks and how the answers come back (the board enters them in the workbench).

Quotations of the display-only lexica are short excerpts for review, never published: the folder is outside git.
Nothing here is sent anywhere; handing the packets to the reviewers is the owner's (D15).
"""

from __future__ import annotations

import csv
import random
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import Connection

from . import content, knowledge, lexicon
from .db import connect, rows

VERDICT = ["الحكم (صحيح / خطأ / غير متأكد)", "التصحيح", "ملاحظة"]
METHODS = {
    "match": "طوبق اللفظ المشكول بقوالب الأوزان",
    "tag": "من وسم الاشتقاق في المدونة",
    "verb-form": "من رقم باب الفعل في المدونة",
    "verb-form-I": "من الباب الأول في المدونة وحركات اللفظ",
    "": "بلا وزن (حرف أو ضمير أو علم)",
}
EXCERPT = 400


def _cut(text: str | None, n: int = EXCERPT) -> str:
    t = " ".join((text or "").split())
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + " …"


def wazn(conn: Connection) -> list[dict[str, Any]]:
    found = rows(
        conn,
        """select l.slug, l.ar, l.pos_ar, l.pos, l.occurrences, coalesce(l.pattern_method, '') as method,
                  p.ar as pattern, r.spaced as root,
                  (select w.location from content.words w where w.lemma_id = l.id order by w.id limit 1) as first,
                  (select w.text_uthmani from content.words w where w.lemma_id = l.id order by w.id limit 1) as written
             from content.lemmas l left join content.patterns p on p.id = l.pattern_id
             left join content.roots r on r.id = l.root_id
            order by l.occurrences desc, l.slug""",
    )
    return [
        {
            "الرتبة": i,
            "اللفظ": content.lemma_display(x["ar"]),
            "المعرّف": x["slug"],
            "القسم": x["pos_ar"] or x["pos"],
            "الجذر": x["root"] or "",
            "الوزن المستخرج": x["pattern"] or "",
            "طريقة الاستخراج": METHODS.get(x["method"], x["method"]),
            "مرات الورود": x["occurrences"],
            "أول موضع": x["first"] or "",
            "كما كُتب فيه": x["written"] or "",
        }
        for i, x in enumerate(found, 1)
    ]


def terms(conn: Connection) -> list[dict[str, Any]]:
    return [
        {
            "المفتاح": x["key"],
            "الصنف": x["category_ar"],
            "المصطلح": x["label_ar"],
            "الشرح": x["body_ar"],
            "Term": x["label_en"],
            "Explanation": x["body_en"],
        }
        for x in rows(conn, "select * from content.glossary_terms order by sort_order, key")
    ]


def pattern_functions(conn: Connection) -> list[dict[str, Any]]:
    found = rows(
        conn,
        """select f.id, s.title_ar, f.section, f.heading_ar, f.kind, f.pattern_ar, f.pattern_slugs, f.form_number,
                  f.match_method, f.match_confidence, f.match_candidates, f.unmapped_reason, f.text_ar, f.examples_ar
             from content.pattern_functions f left join content.pattern_sources s on s.id = f.source_id
            order by f.source_id, f.seq""",
    )
    slugs = {x["slug"]: x["ar"] for x in rows(conn, "select slug, ar from content.patterns")}
    return [
        {
            "المعرّف": x["id"],
            "الكتاب": x["title_ar"] or "",
            "الباب": x["heading_ar"] or x["section"],
            "الوزن في الكتاب": x["pattern_ar"] or "",
            "الأوزان المربوطة": " ، ".join(slugs.get(s, s) for s in x["pattern_slugs"]),
            "باب الفعل": x["form_number"] or "",
            "طريقة الربط": x["match_method"] or "",
            "الثقة": x["match_confidence"] or "",
            "سبب عدم الربط": x["unmapped_reason"] or "",
            "نص الكتاب": _cut(x["text_ar"], 600),
            "أمثلته": " ، ".join(x["examples_ar"] or []),
        }
        for x in found
    ]


def lexicon_mappings(conn: Connection) -> list[dict[str, Any]]:
    found = rows(
        conn,
        """select e.uri, w.title_ar, e.headword, r.spaced as root, e.confidence, e.displayable, e.page_ref, e.body
             from content.lexicon_entries e join content.lexicon_works w on w.id = e.work_id
             left join content.roots r on r.key = e.root_key
            where e.match = 'loose' order by w.sort_order, e.confidence, e.id""",
    )
    shown = {"high": "يُعرض موسومًا بالتقريب", "medium": "لا يُعرض حتى المراجعة", "low": "لا يُعرض حتى المراجعة"}
    return [
        {
            "المعرّف": x["uri"],
            "المعجم": x["title_ar"],
            "المادة": x["headword"],
            "الجذر القرآني المربوط": x["root"] or "",
            "الثقة": x["confidence"],
            "العرض الآن": shown.get(x["confidence"], ""),
            "الصفحة": x["page_ref"] or "",
            "أول المادة": _cut(x["body"]),
        }
        for x in found
    ]


def dictionary_roots(conn: Connection) -> list[dict[str, Any]]:
    found = rows(
        conn,
        """select e.uri, w.title_ar, e.headword, e.dict_rule, e.dict_candidates, e.page_ref, e.body
             from content.lexicon_entries e join content.lexicon_works w on w.id = e.work_id
            where e.dict_rule in ('ambiguous', 'unresolved') order by w.sort_order, e.id""",
    )
    rule = {"ambiguous": "دليلان على جذرين", "unresolved": "لا دليل على جذر"}
    return [
        {
            "المعرّف": x["uri"],
            "المعجم": x["title_ar"],
            "المادة كما كُتبت": x["headword"],
            "الحال": rule[x["dict_rule"]],
            "الجذور المحتملة": " ، ".join(x["dict_candidates"] or []),
            "الصفحة": x["page_ref"] or "",
            "أول المادة": _cut(x["body"]),
        }
        for x in found
    ]


def lane_words(conn: Connection) -> list[dict[str, Any]]:
    found = rows(
        conn,
        """select l.slug, l.ar, r.spaced as root, lw.headword, lw.page_ref, lw.rule, lw.para, e.body
             from content.lane_words lw join content.lemmas l on l.id = lw.lemma_id
             join content.lexicon_entries e on e.id = lw.entry_id left join content.roots r on r.id = l.root_id
            order by l.occurrences desc, lw.para""",
    )
    rule = {"vocalised": "بحركات اللفظ", "verb-form": "برقم باب الفعل"}
    out = []
    for x in found:
        paras = (x["body"] or "").split("\n\n")
        out.append(
            {
                "اللفظ": content.lemma_display(x["ar"]),
                "المعرّف": x["slug"],
                "الجذر": x["root"] or "",
                "مدخل لين": x["headword"],
                "الصفحة": x["page_ref"] or "",
                "طريقة الربط": rule.get(x["rule"], x["rule"]),
                "Lane's paragraph": _cut(paras[x["para"]] if x["para"] < len(paras) else ""),
            }
        )
    return out


def sample_slugs(conn: Connection, n: int = 200) -> list[str]:
    """200 lemmas drawn with a seed fixed by the dataset's version, by quintile of frequency so the rare words are as
    present as the common ones; the same draw for everyone and on every run of a release."""
    version = content.dataset(conn)["version"]
    all_ = rows(conn, "select slug, occurrences from content.lemmas order by occurrences desc, slug")
    rnd = random.Random(f"p3.10:{version}")
    k = len(all_) // 5
    bands = [all_[i * k : (i + 1) * k if i < 4 else len(all_)] for i in range(5)]
    out: list[str] = []
    for b in bands:
        out += [x["slug"] for x in rnd.sample(b, n // 5)]
    return out


def first_place(conn: Connection, slug: str) -> str | None:
    """Where the reader meets the word when it is opened by its name (/read?w=): its first place in the mushaf."""
    r = rows(
        conn,
        """select w.location from content.words w join content.lemmas l on l.id = w.lemma_id
            where l.slug = :s order by w.id limit 1""",
        {"s": slug},
    )
    return r[0]["location"] if r else None


def opened(conn: Connection, slug: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """The word as the panel opens it — at its first place — and the classical relations the panel asks for beside."""
    at = first_place(conn, slug)
    w = lexicon.word_payload(conn, slug, at, 3)
    if w is None:
        return None
    return w, knowledge.word_relations(conn, slug, at) or {}


def sections(w: dict[str, Any], rel: dict[str, Any] | None = None) -> dict[str, Any]:
    """What each section of the panel holds for a word, and whether it is filled or says why it is empty."""
    family = w.get("family") or []
    arts = w.get("dict_articles") or []
    attest = w.get("attestations") or {}
    lane = [p for d in arts if d["id"] == "lane" for e in d["entries"] for p in e.get("word", [])]
    occ = w.get("occurrence") or {}
    rel = rel or {}
    # every source the Meanings section shows: the board's senses, the gharīb at this place, the corpus's gloss of
    # this place, al-Rāghib, Ibn Fāris's core idea, the particles' books, al-Suyūṭī, the wujūh, furūq, aḍdād and fields
    meanings = bool(
        w.get("senses")
        or w.get("mufradat")
        or w.get("core_meaning")
        or w.get("gloss_en")
        or w.get("particles")
        or w.get("loanwords")
        or occ.get("meanings_here")
        or occ.get("glosses")
        or occ.get("gloss_en")
        or any(rel.get(k) for k in ("wujuh", "furuq", "addad", "fields"))
    )
    return {
        "meanings": meanings,
        "senses_status": w.get("senses_status"),
        "family": len(family),
        "patterns": bool(w.get("pattern")),
        "dictionaries": len(arts),
        "articles": sum(len(d["entries"]) for d in arts),
        "lane_word": bool(lane),
        # the timeline's dictionaries that hold an article on the root, and the texts that hold the word
        "timeline": len((w.get("timeline") or {}).get("dictionaries") or [])
        + len((w.get("timeline") or {}).get("corpora") or []),
        "occurrences": attest.get("total", 0),
        "next_steps": len(w.get("next_steps") or []),
    }


def sample(conn: Connection) -> list[dict[str, Any]]:
    out = []
    for slug in sample_slugs(conn):
        got = opened(conn, slug)
        if got is None:
            continue
        w, rel = got
        s = sections(w, rel)
        out.append(
            {
                "اللفظ": w["ar"]["full"],
                "المعرّف": slug,
                "القسم": w["pos"]["ar"] or w["pos"]["tag"],
                "الجذر": (w.get("root") or {}).get("ar_spaced", ""),
                "الوزن": (w.get("pattern") or {}).get("ar", {}).get("full", "") if w.get("pattern") else "",
                "المعاني": "فيه" if s["meanings"] else "فارغ: لا شرح من مصدر بعد",
                "قائمة المعاني": "مقرّة" if s["senses_status"] == "linked" else "تنتظر الهيئة",
                "الأسرة": s["family"],
                "المعاجم": s["dictionaries"],
                "المواد": s["articles"],
                "فقرة لين": "فيه" if s["lane_word"] else "",
                "المواضع في القرآن": s["occurrences"],
                "إلى أين بعد": s["next_steps"],
                "الرابط": f"/read?w={slug}",
            }
        )
    return out


README = """# حزم المراجعة — {version}

أعدّها جذر للمراجعين الخبيرين (القرار D15) ليقابلوا ما استخرجه المشروع وما ربطه بمصادره. لا يُرسل منها شيء إلا بيد المالك.

في كل ملف عمودا «الحكم» و«التصحيح» و«ملاحظة» في آخره: يُكتب الحكم «صحيح» أو «خطأ» أو «غير متأكد»، والتصحيح حيث يُخطَّأ الصف. تُعاد الملفات كما هي، وتُدخل الهيئة التحريرية قراراتها في منضدة التحرير (/workbench) بقاعدة الشخصين.

| الملف | السؤال | الصفوف |
|---|---|---|
{rows}

نصوص المعاجم في هذه الملفات مقتطفات للمراجعة وحدها، وأكثرها للعرض فقط (D22): لا تُنشر ولا تُنسخ خارج المراجعة.

---

Review packets for the expert reviewers (D15): one CSV per question, the verdict columns last («صحيح / خطأ / غير متأكد», the correction, a note). Answers are entered by the editorial board in the workbench under the two-person rule. Excerpts of the display-only lexica are for review only.
"""

QUESTIONS = {
    "wazn.csv": "هل الوزن المستخرج لكل لفظ صحيح؟",
    "terms.csv": "هل شرح كل مصطلح صحيح وواضح؟ (صياغتنا نحن)",
    "pattern-functions.csv": "هل رُبط كل نص من كتب الصرف بالوزن الذي يتكلم عليه؟",
    "lexicon-mappings.csv": "هل رُبطت كل مادة بالجذر القرآني الصحيح؟ (ربط تقريبي)",
    "dictionary-roots.csv": "ما جذر كل مادة تُركت على عنوانها؟",
    "lane-words.csv": "هل فقرة لين المربوطة باللفظ تتكلم عليه هو؟",
    "sample-200.csv": "عيّنة P3.10: هل يعرض كل قسم في اللوحة ما في المصادر، أو يقول بصدق إنه فارغ؟",
}


def write(out: Path) -> dict[str, int]:
    out.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    with connect() as conn:
        version = content.dataset(conn)["version"]
        for name, make in (
            ("wazn.csv", wazn),
            ("terms.csv", terms),
            ("pattern-functions.csv", pattern_functions),
            ("lexicon-mappings.csv", lexicon_mappings),
            ("dictionary-roots.csv", dictionary_roots),
            ("lane-words.csv", lane_words),
            ("sample-200.csv", sample),
        ):
            data = make(conn)
            # UTF-8 with its mark, so a spreadsheet opens the Arabic as Arabic
            with (out / name).open("w", encoding="utf-8-sig", newline="") as f:
                wr = csv.DictWriter(f, fieldnames=[*data[0].keys(), *VERDICT])
                wr.writeheader()
                wr.writerows(data)
            counts[name] = len(data)
    table = "\n".join(f"| `{n}` | {QUESTIONS[n]} | {c} |" for n, c in counts.items())
    (out / "README.md").write_text(README.format(version=version, rows=table), encoding="utf-8")
    return counts


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m jadhr_api.packets <out dir>")
    print(write(Path(sys.argv[1])))
