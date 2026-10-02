"""Arabic and English labels for the corpus tagset.

These are standard grammatical terms (Arabic naḥw/ṣarf terminology and the
corpus' own English glosses). They label data; they never assert meaning.
"""

from __future__ import annotations

# Stem part-of-speech tags (corpus tagset).
POS: dict[str, tuple[str, str]] = {
    "N": ("اسم", "noun"),
    "PN": ("اسم علم", "proper noun"),
    "ADJ": ("صفة", "adjective"),
    "IMPN": ("اسم فعل أمر", "imperative verbal noun"),
    "PRON": ("ضمير", "personal pronoun"),
    "DEM": ("اسم إشارة", "demonstrative pronoun"),
    "REL": ("اسم موصول", "relative pronoun"),
    "T": ("ظرف زمان", "time adverb"),
    "LOC": ("ظرف مكان", "location adverb"),
    "V": ("فعل", "verb"),
    "P": ("حرف جر", "preposition"),
    "EMPH": ("لام التوكيد", "emphatic particle"),
    "IMPV": ("لام الأمر", "imperative particle"),
    "PRP": ("لام التعليل", "purpose particle"),
    "CONJ": ("حرف عطف", "coordinating conjunction"),
    "SUB": ("حرف مصدري", "subordinating conjunction"),
    "ACC": ("حرف نصب", "accusative particle"),
    "AMD": ("حرف استدراك", "amendment particle"),
    "ANS": ("حرف جواب", "answer particle"),
    "AVR": ("حرف ردع", "aversion particle"),
    "CAUS": ("حرف سببية", "particle of cause"),
    "CERT": ("حرف تحقيق", "particle of certainty"),
    "CIRC": ("حرف حال", "circumstantial particle"),
    "COM": ("واو المعية", "comitative particle"),
    "COND": ("حرف شرط", "conditional particle"),
    "EQ": ("حرف تسوية", "equalization particle"),
    "EXH": ("حرف تحضيض", "exhortation particle"),
    "EXL": ("حرف تفصيل", "explanation particle"),
    "EXP": ("أداة استثناء", "exceptive particle"),
    "FUT": ("حرف استقبال", "future particle"),
    "INC": ("حرف ابتداء", "inceptive particle"),
    "INT": ("حرف تفسير", "particle of interpretation"),
    "INTG": ("حرف استفهام", "interrogative particle"),
    "NEG": ("حرف نفي", "negative particle"),
    "PREV": ("حرف كافّ", "preventive particle"),
    "PRO": ("حرف نهي", "prohibition particle"),
    "REM": ("حرف استئناف", "resumption particle"),
    "RES": ("أداة حصر", "restriction particle"),
    "RET": ("حرف إضراب", "retraction particle"),
    "RSLT": ("حرف واقع في جواب الشرط", "result particle"),
    "SUP": ("حرف زائد", "supplemental particle"),
    "SUR": ("حرف فجاءة", "surprise particle"),
    "VOC": ("حرف نداء", "vocative particle"),
    "INL": ("حروف مقطعة", "Quranic initials"),
    "DET": ("أل التعريف", "determiner"),
}

# Prefix descriptors as written in the corpus feature column.
PREFIX: dict[str, tuple[str, str]] = {
    "Al+": ("أل التعريف", "definite article"),
    "w:CONJ+": ("واو العطف", "conjunction wa"),
    "w:REM+": ("واو الاستئناف", "resumption wa"),
    "w:CIRC+": ("واو الحال", "circumstantial wa"),
    "w:SUP+": ("واو زائدة", "supplemental wa"),
    "w:P+": ("واو القسم", "oath wa"),
    "w:COM+": ("واو المعية", "comitative wa"),
    "f:CONJ+": ("فاء العطف", "conjunction fa"),
    "f:REM+": ("فاء الاستئناف", "resumption fa"),
    "f:RSLT+": ("فاء جواب الشرط", "result fa"),
    "f:SUP+": ("فاء زائدة", "supplemental fa"),
    "f:CAUS+": ("فاء السببية", "cause fa"),
    "bi+": ("باء الجر", "preposition bi"),
    "ka+": ("كاف التشبيه", "preposition ka"),
    "ta+": ("تاء القسم", "oath ta"),
    "l:P+": ("لام الجر", "preposition li"),
    "l:EMPH+": ("لام التوكيد", "emphatic la"),
    "l:PRP+": ("لام التعليل", "purpose li"),
    "l:IMPV+": ("لام الأمر", "imperative li"),
    "sa+": ("سين الاستقبال", "future sa"),
    "A:INTG+": ("همزة الاستفهام", "interrogative alif"),
    "A:EQ+": ("همزة التسوية", "equalization alif"),
    "ya+": ("ياء النداء", "vocative ya"),
    "ha+": ("ها التنبيه", "attention ha"),
}

SUFFIX_EXTRA: dict[str, tuple[str, str]] = {
    "+n:EMPH": ("نون التوكيد", "emphatic nun"),
    "+VOC": ("ميم النداء", "vocative suffix"),
    "l:P+": ("لام الجر", "preposition li"),
}

PERSON = {"1": ("متكلم", "first person"), "2": ("مخاطب", "second person"), "3": ("غائب", "third person")}
GENDER = {"M": ("مذكر", "masculine"), "F": ("مؤنث", "feminine")}
NUMBER = {"S": ("مفرد", "singular"), "D": ("مثنى", "dual"), "P": ("جمع", "plural")}
CASE = {"NOM": ("مرفوع", "nominative"), "ACC": ("منصوب", "accusative"), "GEN": ("مجرور", "genitive")}
MOOD = {"IND": ("مرفوع", "indicative"), "SUBJ": ("منصوب", "subjunctive"), "JUS": ("مجزوم", "jussive")}
ASPECT = {"PERF": ("ماضٍ", "perfect"), "IMPF": ("مضارع", "imperfect"), "IMPV": ("أمر", "imperative")}
VOICE = {"PASS": ("مبني للمجهول", "passive")}
DERIVATION = {
    "ACT_PCPL": ("اسم فاعل", "active participle"),
    "PASS_PCPL": ("اسم مفعول", "passive participle"),
    "VN": ("مصدر", "verbal noun"),
}
SPECIAL = {
    "<in~": ("إنّ وأخواتها", "inna and her sisters"),
    "kaAn": ("كان وأخواتها", "kāna and her sisters"),
    "kaAd": ("كاد وأخواتها", "kāda and her sisters"),
}

# Verb forms (abwāb). Form I has several vowel patterns; its canonical citation pattern is فَعَلَ.
VERB_FORMS: dict[int, tuple[str, str]] = {
    1: ("فَعَلَ", "I"),
    2: ("فَعَّلَ", "II"),
    3: ("فَاعَلَ", "III"),
    4: ("أَفْعَلَ", "IV"),
    5: ("تَفَعَّلَ", "V"),
    6: ("تَفَاعَلَ", "VI"),
    7: ("انْفَعَلَ", "VII"),
    8: ("افْتَعَلَ", "VIII"),
    9: ("افْعَلَّ", "IX"),
    10: ("اسْتَفْعَلَ", "X"),
    11: ("افْعَالَّ", "XI"),
    12: ("افْعَوْعَلَ", "XII"),
}


def pos_label(tag: str) -> dict[str, str]:
    ar, en = POS.get(tag, (tag, tag))
    return {"tag": tag, "ar": ar, "en": en}


def affix_label(feature: str, kind: str) -> dict[str, str]:
    if kind == "prefix":
        ar, en = PREFIX.get(feature, (feature, feature))
        return {"tag": feature, "ar": ar, "en": en}
    if feature.startswith("PRON:"):
        pgn = feature[5:]
        parts_ar, parts_en = ["ضمير متصل"], ["attached pronoun"]
        for ch in pgn:
            for table in (PERSON, GENDER, NUMBER):
                if ch in table:
                    parts_ar.append(table[ch][0])
                    parts_en.append(table[ch][1])
        return {"tag": feature, "ar": "، ".join(parts_ar), "en": ", ".join(parts_en)}
    ar, en = SUFFIX_EXTRA.get(feature, (feature, feature))
    return {"tag": feature, "ar": ar, "en": en}


def every_known_tag() -> set[str]:
    return set(POS) | set(PREFIX) | set(SUFFIX_EXTRA)
