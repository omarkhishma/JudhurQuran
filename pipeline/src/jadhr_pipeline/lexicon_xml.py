"""The release's lexicon files (PLAN P10.1a, research 19): TEI Lex-0 (0.9.5) and LMF in its ISO 24613-4 TEI
serialisation, one file per licence scope — the Quranic lexicon (roots, lemmas and their patterns; in LMF also the
word forms the Quran attests), held like the corpus's other files (D19, D2), and Lane's Lexicon (CC BY-SA 3.0 US),
which is not.

Every file is checked before it is written, and any failure stops the release: TEI Lex-0 against the vendored 0.9.5
schema with Jing (a missing Java fails the build, never skips it) and against 0.9.4 with lxml; LMF against the
vendored ISO 24613-4 schema with lxml; then what no schema checks — every pointer resolves, every language tag is
ours, every entry is the release's own (its forms byte for byte the JSON Lines values: the sources' characters, never
normalised; its place; its word forms and their counts), no id twice, the licences and the notices there verbatim,
Perseus's statement intact, and TEI Lex-0's three Schematron rules.

    uv run python -m jadhr_pipeline.lexicon_xml fetch-jing   # once: Jing, pinned by its sha256, into data/tools
"""

from __future__ import annotations

import hashlib
import io
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from lxml import etree

from .labels import POS

REPO = Path(__file__).resolve().parents[3]
SCHEMAS = REPO / "pipeline/schemas"
LEX0 = SCHEMAS / "tei-lex-0-0.9.5.rng"
LEX0_LXML = SCHEMAS / "tei-lex-0-0.9.4.rng"
LMF = SCHEMAS / "lmf-iso-24613-4.rng"
SCHEMA_SHA = {
    LEX0.name: "35e73fef48526634714bdf3d16b924f958fca078a903d0bdc2dd4d7d116d1aaa",
    LEX0_LXML.name: "f5270a718c377d18d3137d4fbbd883e3d39a01dca890fa62f5f580d43d1aa30a",
    LMF.name: "6c1c0b906296efd5829a3c69d37ca4b65f2405041db4ad6cc799eec58b18ea72",
}
JING_URL = "https://github.com/relaxng/jing-trang/releases/download/V20241231/jing-20241231.zip"
JING_ZIP = REPO / "data/tools/jing-20241231.zip"
JING_SHA = "d11a765f9106e398e01d66aaffb629beb1da21f8a716299e2930a751130bfad2"
JING_JAR = REPO / "data/tools/jing-20241231/bin/jing.jar"
LANE_RAW = REPO / "data/raw/lexica/laneslexicon-lexicon_xml/lexicon_xml-f3c19fb.tar.gz"

TEI = "http://www.tei-c.org/ns/1.0"
XMLNS = "http://www.w3.org/XML/1998/namespace"
LANGS = {"ar", "en", "ar-Latn"}
LEX0_PI = 'href="https://lex-0.org/releases/v0.9.5/schema/lex-0.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"'
QURAN, LANE = "lexicon_quran", "lexicon_lane"
FORMATS = ("tei", "lmf")
# a word form's inflection, as the corpus tags its stem (the lemma's own verb form and derivation are on the entry)
INFLECTION = ("aspect", "case", "gender", "mood", "number", "person", "voice")
PATTERN_METHODS = {
    "match": "matched against the vocalised lemma",
    "tag": "from the corpus's derivation tag",
    "verb-form": "from the corpus's verb form",
    "verb-form-I": "from the corpus's verb form I and the lemma's vowels",
}
DERIVED_LICENCE = (
    "https://creativecommons.org/licenses/by-sa/4.0/",
    'Patterns (wazn), marked resp="#jadhr": derived by Jadhr, CC BY-SA 4.0.',
)
GLOBAL_NOTE = "ISO 24613-4 (LMF in TEI): a lexical resource holding one lexicon; each licence scope of the release is a file of its own."


def path_of(table: str, fmt: str) -> str:
    return f"{table}.{fmt}.xml"


def E(
    tag: str, attrs: dict[str, Any] | None = None, text: str | None = None, *children: etree._Element
) -> etree._Element:
    """A TEI element; `id` and `lang` become xml:id and xml:lang, a None value is left out."""
    el = etree.Element(f"{{{TEI}}}{tag}", nsmap={None: TEI})
    for k, v in (attrs or {}).items():
        if v is not None:
            el.set(f"{{{XMLNS}}}{k}" if k in ("id", "lang") else k, str(v))
    if text is not None:
        el.text = text
    for c in children:
        el.append(c)
    return el


def _xml(root: etree._Element, model: str | None) -> bytes:
    """UTF-8 with its declaration, TEI the default namespace; the schema it targets named in a processing instruction
    (validators ignore it)."""
    etree.cleanup_namespaces(root, top_nsmap={None: TEI})
    head = b'<?xml version="1.0" encoding="UTF-8"?>\n'
    if model:
        head += f"<?xml-model {model}?>\n".encode()
    return head + etree.tostring(root, encoding="UTF-8", xml_declaration=False) + b"\n"


def month_of(version: str) -> str:
    """The release's date, from its version (2026.10.0 → 2026-10): the files carry it, not the build's time, so a
    rebuild is byte for byte the same."""
    year, month, _ = version.split(".")
    return f"{year}-{int(month):02d}"


# ─── headers ──────────────────────────────────────────────────────────────────


def _bibl(
    xid: str,
    author: str | None,
    title: str,
    url: str | None,
    edition: str | None,
    year: str | None,
    release: str | None = None,
) -> etree._Element:
    monogr = E("monogr")
    if author:
        monogr.append(E("author", None, author))
    monogr.append(E("title", None, title))
    if url:
        monogr.append(E("idno", {"type": "URI"}, url))
    if release:
        monogr.append(E("idno", {"type": "release"}, release))
    if edition:
        monogr.append(E("edition", None, edition))
    if year:
        monogr.append(E("imprint", None, None, E("date", {"when": year}, year)))
    return E("biblStruct", {"id": xid}, None, monogr)


def _header(
    *,
    title: str,
    abbr: str | None,
    version: str,
    status: str,
    statements: list[etree._Element],
    licences: list[tuple[str, str]],
    bibls: list[etree._Element],
    bibl_type: str,
    note: str,
    taxonomy: list[str] | None,
    lex0: bool,
    resp: str,
    resp_id: str | None = "jadhr",
) -> etree._Element:
    titles = [E("title", {"type": "full"} if lex0 else None, title)]
    if abbr and lex0:
        titles.append(E("title", {"type": "abbr"}, abbr))
    by = E("respStmt", {"id": resp_id}, None, E("resp", None, resp))
    by.append(E("orgName", None, "Jadhr") if lex0 else E("name", {"type": "org"}, "Jadhr"))
    availability = E("availability", {"status": status}, None, *statements)
    for target, text in licences:
        availability.append(E("licence", {"target": target}, text))
    file_desc = E(
        "fileDesc",
        None,
        None,
        E("titleStmt", None, None, *titles, by),
        E("editionStmt", None, None, E("edition", {"n": version}, f"Dataset release {version}")),
        E(
            "publicationStmt",
            None,
            None,
            E("publisher", None, "Jadhr"),
            E("date", {"when": month_of(version)}, month_of(version)),
            E("idno", {"type": "release"}, f"jadhr-quran {version}"),
            availability,
        ),
        E("sourceDesc", None, None, E("listBibl", {"type": bibl_type}, None, *bibls)),
    )
    encoding = E("encodingDesc", None, None, E("p", None, note))
    if taxonomy:
        tax = E("taxonomy", {"id": "patternMethod"})
        for m in taxonomy:
            tax.append(
                E(
                    "category",
                    {"id": _method_id(m)},
                    None,
                    E("catDesc", None, None, E("term", None, m), E("gloss", None, PATTERN_METHODS[m])),
                )
            )
        encoding.append(E("classDecl", None, None, tax))
    head = E("teiHeader", None, None, file_desc, encoding)
    if lex0:
        head.append(
            E(
                "profileDesc",
                None,
                None,
                E(
                    "langUsage",
                    None,
                    None,
                    E("language", {"ident": "ar", "role": "objectLanguage"}, "Arabic"),
                    E("language", {"ident": "en", "role": "workingLanguage"}, "English"),
                ),
            )
        )
    return head


def _global(version: str, status: str) -> etree._Element:
    """LMF's GlobalInformation: the release; the lexicon's own header carries its sources and terms."""
    return _header(
        title=f"Jadhr — Quranic roots dataset, release {version}: lexical resource",
        abbr=None,
        version=version,
        status=status,
        statements=[
            E(
                "p",
                None,
                "The lexicon in this resource states its sources, its licences and their notices in its own header.",
            )
        ],
        licences=[],
        bibls=[
            _bibl(
                "src.jadhr",
                None,
                "Jadhr — Quranic roots dataset",
                None,
                version,
                month_of(version)[:4],
                f"jadhr-quran {version}",
            )
        ],
        bibl_type="corpora",
        note=GLOBAL_NOTE,
        taxonomy=None,
        lex0=False,
        resp="Released by",
        resp_id=None,
    )


# ─── Perseus's statement ─────────────────────────────────────────────────────


def _raw_statement() -> etree._Element:
    with tarfile.open(LANE_RAW) as tar:
        member = next(m for m in tar.getmembers() if m.name.endswith("/_0.xml"))
        raw = tar.extractfile(member).read()  # type: ignore[union-attr]
    src = etree.parse(io.BytesIO(raw), etree.XMLParser(resolve_entities=False, no_network=True)).getroot()
    return next(e for e in src.iter("availability"))


def perseus_xml() -> str:
    """The statement as Perseus's header writes it, character for character (the manifest carries it)."""
    with tarfile.open(LANE_RAW) as tar:
        member = next(m for m in tar.getmembers() if m.name.endswith("/_0.xml"))
        text = tar.extractfile(member).read().decode("utf-8")  # type: ignore[union-attr]
    start, end = text.index("<availability"), text.index("</availability>") + len("</availability>")
    return text[start:end]


def perseus_statement() -> etree._Element:
    """Perseus's availability statement for our header ("You leave this availability statement intact"): its words,
    their order and their markup (the list, its items, the quote) as Perseus wrote them; the list goes inside the
    paragraph it completes, because TEI P5 allows no list directly in <availability>."""
    avail = _raw_statement()
    p_src, list_src = (c for c in avail if isinstance(c.tag, str))
    assert p_src.tag == "p" and list_src.tag == "list", (
        "Perseus's statement is no longer a paragraph and a list"
    )

    def copy(e: etree._Element) -> etree._Element:
        out = E(e.tag, dict(e.attrib), e.text)
        for c in e:
            if isinstance(c.tag, str):
                cc = copy(c)
                cc.tail = c.tail
                out.append(cc)
        return out

    p = E("p", None, (p_src.text or "") + (p_src.tail or ""))
    p.append(copy(list_src))
    return p


def _words(e: etree._Element) -> str:
    return " ".join("".join(e.itertext()).split())


def _shape(e: etree._Element) -> list[str]:
    return [
        etree.QName(x).localname
        for x in e.iter()
        if isinstance(x.tag, str) and etree.QName(x).localname not in ("availability", "p")
    ]


# ─── the Quranic lexicon ──────────────────────────────────────────────────────


def _method_id(m: str) -> str:
    return "pm." + m.replace("-", "_")


def _methods(lemmas: list[dict[str, Any]]) -> list[str]:
    return sorted(
        {
            x["pattern_method"]
            for x in lemmas
            if x.get("pattern") and x.get("pattern_method") in PATTERN_METHODS
        }
    )


def _gram(x: dict[str, Any], pattern: bool) -> etree._Element:
    grp = E(
        "gramGrp",
        None,
        None,
        E("gram", {"type": "pos", "norm": x["pos"]}, POS.get(x["pos"], (x["pos"], x["pos"]))[1]),
    )
    if x.get("verb_form"):
        grp.append(E("gram", {"type": "verbForm", "norm": x["verb_form"]}, str(x["verb_form"])))
    if x.get("derivation"):
        grp.append(E("gram", {"type": "derivation", "norm": x["derivation"]}, x["derivation"]))
    if pattern and x.get("pattern") and x.get("pattern_method") in PATTERN_METHODS:
        grp.append(
            E(
                "gram",
                {"type": "pattern", "resp": "#jadhr", "ana": f"#{_method_id(x['pattern_method'])}"},
                x["pattern"],
            )
        )
    return grp


def quran_notices(with_forms: bool) -> list[str]:
    from .release import QAC_COPYRIGHT, QAC_NOTICE, TANZIL_CORPUS_TEXT_NOTICE

    out = [QAC_COPYRIGHT, QAC_NOTICE]
    if with_forms:
        out.append(
            TANZIL_CORPUS_TEXT_NOTICE.replace(
                "words.text_uthmani and segments[].text", 'The word forms (form type="inflected")'
            )
        )
    return out


def quran_licences(with_forms: bool) -> list[tuple[str, str]]:
    out = [
        (
            "http://corpus.quran.com",
            "Roots, lemmas and their grammar: the Quranic Arabic Corpus's terms of use, as its copyright block above states them.",
        )
    ]
    if with_forms:
        out.append(
            (
                "https://creativecommons.org/licenses/by-nd/3.0/",
                "The word forms: the Tanzil Quran Text, CC BY-ND 3.0 Unported, as the notice above states.",
            )
        )
    out.append(DERIVED_LICENCE)
    return out


QURAN_RESP = "Converted from Buckwalter to Arabic script, arranged by root, and the patterns derived, by"
QAC_BIBL = (
    "src.qac",
    "Kais Dukes",
    "Quranic Arabic Corpus — morphology",
    "http://corpus.quran.com",
    "0.4",
    "2011",
)


def quran_tei(lemmas: list[dict[str, Any]], roots: list[dict[str, Any]], version: str) -> bytes:
    by_root: dict[int | None, list[dict[str, Any]]] = defaultdict(list)
    for x in sorted(lemmas, key=lambda x: x["id"]):
        by_root[x["root_id"]].append(x)
    header = _header(
        title=f"Jadhr — Quranic roots and lemmas, release {version}",
        abbr="jadhr-quran-lexicon",
        version=version,
        status="restricted",
        statements=[E("p", None, n) for n in quran_notices(False)],
        licences=quran_licences(False),
        bibls=[_bibl(*QAC_BIBL)],
        bibl_type="corpora",
        note='Each root is a word family holding its lemmas; a lemma without a root is an entry of its own, with no root made up for it. Arabic as the corpus carries it, converted from Buckwalter to Arabic script and never normalised. Patterns (wazn) are derived by Jadhr (resp="#jadhr"); ana names how each was found.',
        taxonomy=_methods(lemmas),
        resp=QURAN_RESP,
        lex0=True,
    )

    def lemma(x: dict[str, Any]) -> etree._Element:
        e = E(
            "entry",
            {
                "type": "mainEntry",
                "id": f"lemma.{x['slug']}",
                "lang": "ar",
                "n": x["id"],
                "source": "#src.qac",
            },
        )
        e.append(E("form", {"type": "lemma"}, None, E("orth", None, x["ar"])))
        if x.get("pattern") and x.get("pattern_method") in PATTERN_METHODS:
            e.append(
                E(
                    "form",
                    {"type": "scheme", "resp": "#jadhr", "ana": f"#{_method_id(x['pattern_method'])}"},
                    None,
                    E("orth", None, x["pattern"]),
                )
            )
        e.append(_gram(x, pattern=False))
        return e

    body = E("body")
    for r in sorted(roots, key=lambda r: r["key"]):
        fam = E("entry", {"type": "wordFamily", "id": f"root.{r['key']}", "lang": "ar", "source": "#src.qac"})
        fam.append(E("form", {"type": "root"}, None, E("orth", None, r["key"])))
        for x in by_root.get(r["id"], []):
            fam.append(lemma(x))
        body.append(fam)
    for x in by_root.get(None, []):
        body.append(lemma(x))
    return _xml(E("TEI", {"type": "lex-0", "lang": "en"}, None, header, E("text", None, None, body)), LEX0_PI)


Forms = dict[int, list[tuple[str, tuple[tuple[str, str], ...], int]]]


def word_forms(words: list[dict[str, Any]], lemmas: list[dict[str, Any]]) -> Forms:
    """Each lemma's attested forms: every stem's text with its inflection, and how often the Quran has the pair. A
    word with two stems gives each its own lemma (the stem's, not the word's)."""
    lemma_of = {x["key"]: x["id"] for x in lemmas}
    seen: dict[int, Counter[tuple[str, tuple[tuple[str, str], ...]]]] = defaultdict(Counter)
    for w in words:
        for g in w["segments"]:
            if g["kind"] != "stem" or g.get("lemma") not in lemma_of:
                continue
            f = g.get("features") or {}
            feats = [(k, f[k]["tag"]) for k in INFLECTION if isinstance(f.get(k), dict) and "tag" in f[k]]
            if f.get("indefinite") is True:
                feats.append(("state", "INDEF"))
            seen[lemma_of[g["lemma"]]][(g["text"], tuple(feats))] += 1
    return {
        lid: sorted(((t, f, n) for (t, f), n in c.items()), key=lambda x: (-x[2], x[0], x[1]))
        for lid, c in seen.items()
    }


def quran_lmf(lemmas: list[dict[str, Any]], roots: list[dict[str, Any]], forms: Forms, version: str) -> bytes:
    root_key = {r["id"]: r["key"] for r in roots}
    info = _header(
        title=f"Jadhr — Quranic roots, lemmas and attested word forms, release {version}",
        abbr=None,
        version=version,
        status="restricted",
        statements=[E("p", None, n) for n in quran_notices(True)],
        licences=quran_licences(True),
        bibls=[_bibl(*QAC_BIBL)],
        bibl_type="corpora",
        note='A LexicalEntry per lemma; its root as a form typed root (ISO 24613-2, a Stem typed root); each attested word form with its inflection and its count in the Quran (n). Arabic as the corpus carries it, converted from Buckwalter to Arabic script and never normalised. Patterns (wazn) are derived by Jadhr (resp="#jadhr"); ana names how each was found.',
        taxonomy=_methods(lemmas),
        resp=QURAN_RESP,
        lex0=False,
    )
    body = E("body")
    for x in sorted(lemmas, key=lambda x: x["id"]):
        e = E("entry", {"id": f"lemma.{x['slug']}", "lang": "ar", "n": x["id"], "source": "#src.qac"})
        e.append(E("form", {"type": "lemma"}, None, E("orth", None, x["ar"])))
        if x["root_id"]:
            e.append(E("form", {"type": "root"}, None, E("orth", None, root_key[x["root_id"]])))
        for text, feats, n in forms.get(x["id"], []):
            f = E("form", {"type": "inflected", "n": n}, None, E("orth", None, text))
            if feats:
                f.append(E("gramGrp", None, None, *[E("gram", {"type": k}, v) for k, v in feats]))
            e.append(f)
        e.append(_gram(x, pattern=True))
        body.append(e)
    lexicon = E("TEI", {"type": "lexicon", "lang": "ar"}, None, info, E("text", None, None, body))
    return _xml(
        E(
            "teiCorpus",
            {"type": "lexicalResource", "lang": "en"},
            None,
            _global(version, "restricted"),
            lexicon,
        ),
        None,
    )


# ─── Lane's Lexicon ───────────────────────────────────────────────────────────


def lane_rows(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Lane's articles as the release carries them: each root article whole, our match to a root of the Quran only
    where the site shows it, and the article's place in Perseus's files."""
    rows = []
    for x in sorted(entries, key=lambda x: x["id"]):
        _, _, file, ident = x["source_ref"].split(":")
        rows.append(
            {
                "id": x["id"],
                "headword": x["headword"],
                "body": x["body"],
                "root": x["root_key"] if x.get("root_key") and x.get("displayable") else None,
                "perseus": f"{file}#{ident}",
            }
        )
    return rows


def lane_notices(work: dict[str, Any]) -> list[str]:
    return [work["attribution_en"]]


def lane_licences() -> list[tuple[str, str]]:
    return [
        (
            "https://creativecommons.org/licenses/by-sa/3.0/us/",
            "Lane's Lexicon from the Perseus Digital Library, as modified here: CC BY-SA 3.0 United States.",
        ),
        (
            DERIVED_LICENCE[0],
            'The links to roots of the Quran, marked resp="#jadhr": Jadhr\'s match, CC BY-SA 4.0.',
        ),
    ]


def lane_files(rows: list[dict[str, Any]], work: dict[str, Any], version: str) -> tuple[bytes, bytes]:
    note = "Each article is one root heading of Lane's (Perseus's div2 type=\"root\") as one word family, its text one unsplit sense: the TEI markup removed with the text kept in document order, one paragraph per article Lane wrote under the heading, and the Arabic transliteration converted to Arabic script. bibl/idno names the article in Perseus's files. A link to a root of the Quran is Jadhr's match, given only where the site shows it."

    def head(lex0: bool) -> etree._Element:
        return _header(
            title="Edward William Lane, An Arabic-English Lexicon (Perseus Digital Library, with the laneslexicon corrections)",
            abbr="lane" if lex0 else None,
            version=version,
            status="free",
            statements=[perseus_statement(), *[E("p", None, n) for n in lane_notices(work)]],
            licences=lane_licences(),
            bibls=[
                _bibl(
                    "src.lane",
                    "Edward William Lane",
                    "An Arabic-English Lexicon",
                    work["source_url"],
                    work.get("edition_note"),
                    "1863",
                )
            ],
            bibl_type="dictionaries",
            note=note,
            taxonomy=None,
            lex0=lex0,
            resp="Converted (TEI markup removed, the transliteration put in Arabic script) and linked to the roots of the Quran by",
        )

    def entry(x: dict[str, Any], lex0: bool) -> etree._Element:
        e = E(
            "entry",
            {
                "type": "wordFamily" if lex0 else None,
                "id": f"lane.{x['id']}",
                "lang": "ar",
                "source": "#src.lane",
            },
        )
        e.append(E("form", {"type": "root" if lex0 else "lemma"}, None, E("orth", None, x["headword"])))
        e.append(E("sense", {"id": f"lane.{x['id']}.1"}, None, E("def", {"lang": "en"}, x["body"])))
        if x["root"]:
            e.append(
                E(
                    "xr",
                    {"type": "related", "subtype": "root", "resp": "#jadhr"},
                    None,
                    E(
                        "ref",
                        {"type": "entry", "target": f"{path_of(QURAN, 'tei')}#root.{x['root']}"},
                        x["root"],
                    ),
                )
            )
        if lex0:
            e.append(E("bibl", None, None, E("idno", {"type": "perseus"}, x["perseus"])))
        return e

    tei_body = E("body", None, None, *[entry(x, True) for x in rows])
    tei = _xml(
        E("TEI", {"type": "lex-0", "lang": "en"}, None, head(True), E("text", None, None, tei_body)), LEX0_PI
    )
    lmf_body = E("body", None, None, *[entry(x, False) for x in rows])
    lexicon = E("TEI", {"type": "lexicon", "lang": "ar"}, None, head(False), E("text", None, None, lmf_body))
    lmf = _xml(
        E("teiCorpus", {"type": "lexicalResource", "lang": "en"}, None, _global(version, "free"), lexicon),
        None,
    )
    return tei, lmf


# ─── checks ───────────────────────────────────────────────────────────────────


def _schemas_pinned() -> None:
    for name, sha in SCHEMA_SHA.items():
        got = hashlib.sha256((SCHEMAS / name).read_bytes()).hexdigest()
        if got != sha:
            raise RuntimeError(f"{name} is not the pinned schema ({got})")


_RNG: dict[str, etree.RelaxNG] = {}


def _parse(data: bytes) -> etree._Element:
    return etree.fromstring(data, etree.XMLParser(huge_tree=True, resolve_entities=False, no_network=True))


def lxml_errors(data: bytes, schema: Path) -> list[str]:
    if schema.name not in _RNG:
        _RNG[schema.name] = etree.RelaxNG(etree.parse(str(schema)))
    rng = _RNG[schema.name]
    return (
        []
        if rng.validate(_parse(data))
        else [f"{schema.name} {e.line}: {e.message}" for e in rng.error_log][:20]
    )


def fetch_jing() -> Path:
    """Jing, pinned by its sha256: fetched once into data/tools, never at build time."""
    if not JING_ZIP.exists():
        JING_ZIP.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(JING_URL) as r, open(JING_ZIP, "wb") as out:  # a pinned https URL
            shutil.copyfileobj(r, out)
    return _jing()


def _jing() -> Path:
    if not JING_ZIP.exists():
        raise RuntimeError(
            "Jing is missing: run `uv run python -m jadhr_pipeline.lexicon_xml fetch-jing` once"
        )
    got = hashlib.sha256(JING_ZIP.read_bytes()).hexdigest()
    if got != JING_SHA:
        raise RuntimeError(f"{JING_ZIP.name} is not the pinned Jing ({got})")
    if not JING_JAR.exists():
        with zipfile.ZipFile(JING_ZIP) as z:
            # the jars only (jing.jar names its neighbours in its manifest); not the sources or the docs
            z.extractall(
                JING_ZIP.parent,
                [n for n in z.namelist() if n.startswith("jing-20241231/bin/") and n.endswith(".jar")],
            )
    return JING_JAR


def jing_errors(data: bytes, schema: Path) -> list[str]:
    """TEI Lex-0 0.9.5 with Jing (libxml2 cannot compile it)."""
    java = shutil.which("java")
    if java is None:
        raise RuntimeError("Java is needed to validate TEI Lex-0 0.9.5 with Jing: install a JDK")
    jar = _jing()
    with tempfile.NamedTemporaryFile(suffix=".xml") as f:
        f.write(data)
        f.flush()
        r = subprocess.run(
            [java, "-jar", str(jar), str(schema), f.name], capture_output=True, text=True, check=False
        )
    lines = (r.stdout + r.stderr).strip().splitlines()
    return (
        []
        if r.returncode == 0
        else [f"jing: {x.replace(f.name, '')}" for x in lines][:20] or [f"jing exited {r.returncode}"]
    )


def _q(tag: str) -> str:
    return f"{{{TEI}}}{tag}"


def _id(e: etree._Element) -> str | None:
    return e.get(f"{{{XMLNS}}}id")


def _orth(e: etree._Element, kind: str) -> str | None:
    o = e.find(f"{_q('form')}[@type='{kind}']/{_q('orth')}")
    return None if o is None else o.text


def own_errors(
    data: bytes,
    *,
    entries: dict[str, dict[str, Any]],
    notices: list[str],
    licences: list[tuple[str, str]],
    perseus: bool = False,
    other_ids: dict[str, set[str]] | None = None,
) -> list[str]:
    """What no schema checks (research 19 §4.4). `entries` is every entry the file must have, by xml:id, with what it
    must hold: "lemma"/"root" (the form's text, byte for byte; None for none), "parent" (the entry it sits in, or
    None), "forms" (its word forms with their inflection and count)."""
    doc = _parse(data)
    out: list[str] = []
    all_ids = [i for i in (_id(e) for e in doc.iter()) if i]
    ids = set(all_ids)
    if len(ids) != len(all_ids):
        out.append(f"{len(all_ids) - len(ids)} ids used twice")
    # every pointer resolves, in this file or in the release file it names
    for e in doc.iter():
        for att in ("target", "source", "ana", "resp"):
            for ref in (e.get(att) or "").split():
                if "#" not in ref or ref.startswith(("http:", "https:")):
                    continue
                file, _, frag = ref.partition("#")
                if (not file and frag not in ids) or (
                    file and frag not in (other_ids or {}).get(file, set())
                ):
                    out.append(f"unresolved {ref}")
    # the language tags are ours
    for e in doc.iter():
        lang = e.get(f"{{{XMLNS}}}lang")
        if lang is not None and lang not in LANGS:
            out.append(f"language tag {lang!r}")
    # every entry is the release's: the same set, each form byte for byte, each in its place, its word forms counted
    found = {_id(e): e for e in doc.iter(_q("entry"))}
    if None in found:
        out.append("an entry without an xml:id")
    if set(found) - {None} != set(entries):
        missing = set(entries) - set(found)
        extra = {x for x in found if x is not None} - set(entries)
        out.append(
            f"entries: {len(missing)} missing ({sorted(missing)[:3]}), {len(extra)} not the release's ({sorted(extra)[:3]})"
        )
    for xid, want in entries.items():
        e = found.get(xid)
        if e is None:
            continue
        for kind in ("lemma", "root"):
            if _orth(e, kind) != want.get(kind):
                out.append(f"{xid}: its {kind} form is not the release's")
        parent = e.getparent()
        if (_id(parent) if parent is not None and parent.tag == _q("entry") else None) != want.get("parent"):
            out.append(f"{xid}: not in its place")
        if "forms" in want:
            got = [
                (
                    f.findtext(_q("orth")),
                    tuple((g.get("type"), g.text) for g in f.iter(_q("gram"))),
                    int(f.get("n", "0")),
                )
                for f in e.findall(f"{_q('form')}[@type='inflected']")
            ]
            if got != want["forms"]:
                out.append(f"{xid}: its word forms are not the release's")
    # each lexicon's licences and notices, verbatim
    for tei in doc.iter(_q("TEI")):
        avail = tei.find(f"{_q('teiHeader')}/{_q('fileDesc')}/{_q('publicationStmt')}/{_q('availability')}")
        if avail is None:
            out.append("a lexicon without availability")
            continue
        got_lic = [(x.get("target"), x.text) for x in avail.findall(_q("licence"))]
        if not got_lic or got_lic != licences:
            out.append("the licences are not the release's")
        paras = [p.text for p in avail.findall(_q("p"))]
        for n in notices:
            if n not in paras:
                out.append(f"notice missing or altered: {n[:50]}…")
        if perseus:
            src = _raw_statement()
            mine = next((p for p in avail.findall(_q("p")) if p.find(_q("list")) is not None), None)
            if mine is None or _words(mine) != _words(src) or _shape(mine) != _shape(src):
                out.append("Perseus's availability statement is not intact")
    # TEI Lex-0's three Schematron rules, in Python
    for tei in doc.iter(_q("TEI")):
        if len(tei.findall(_q("text"))) != 1:
            out.append("a TEI without exactly one text")
    for e in doc.iter():
        if len(e.findall(_q("gramGrp"))) > 1:
            out.append(f"two gramGrp in one {etree.QName(e).localname}")
    for e in doc.iter(_q("entry")):
        parent = e.getparent()
        if doc.tag == _q("TEI") and parent is not None and parent.tag == _q("entry") and not e.get("type"):
            out.append("a nested entry without a type")
    return out[:30]


def ids_of(data: bytes) -> set[str]:
    return {i for i in (_id(e) for e in _parse(data).iter()) if i}


def validate(name: str, data: bytes, fmt: str, **own: Any) -> None:
    """Every check for one file; any failure stops the release with what failed."""
    _schemas_pinned()
    errors = (
        (jing_errors(data, LEX0) + lxml_errors(data, LEX0_LXML)) if fmt == "tei" else lxml_errors(data, LMF)
    )
    errors += own_errors(data, **own)
    if errors:
        raise RuntimeError(f"{name} fails its checks:\n  " + "\n  ".join(errors))


# ─── the release's lexicon files ──────────────────────────────────────────────


def prepare(
    *,
    lemmas: list[dict[str, Any]],
    roots: list[dict[str, Any]],
    words: list[dict[str, Any]],
    lane: list[dict[str, Any]],
    lane_work: dict[str, Any],
    version: str,
) -> list[dict[str, Any]]:
    """The four XML files, not yet checked, each with what it must hold — read from the release's data, not from the
    file: [{table, format, path, data, rows, expect}]."""
    root_key = {r["id"]: r["key"] for r in roots}
    forms = word_forms(words, lemmas)
    fams = {f"root.{r['key']}": {"root": r["key"], "parent": None} for r in roots}
    tei_lemmas = {
        f"lemma.{x['slug']}": {
            "lemma": x["ar"],
            "parent": f"root.{root_key[x['root_id']]}" if x["root_id"] else None,
        }
        for x in lemmas
    }
    lmf_lemmas = {
        f"lemma.{x['slug']}": {
            "lemma": x["ar"],
            "root": root_key.get(x["root_id"]),
            "parent": None,
            "forms": forms.get(x["id"], []),
        }
        for x in lemmas
    }
    # a Lane article links to a root family of the Quranic lexicon: one the release has
    lane_common = {
        "notices": lane_notices(lane_work),
        "licences": lane_licences(),
        "perseus": True,
        "other_ids": {path_of(QURAN, "tei"): set(fams)},
    }
    l_tei, l_lmf = lane_files(lane, lane_work, version)
    return [
        {
            "table": QURAN,
            "format": "tei",
            "data": quran_tei(lemmas, roots, version),
            "rows": len(lemmas),
            "expect": {
                "entries": fams | tei_lemmas,
                "notices": quran_notices(False),
                "licences": quran_licences(False),
            },
        },
        {
            "table": QURAN,
            "format": "lmf",
            "data": quran_lmf(lemmas, roots, forms, version),
            "rows": len(lemmas),
            "expect": {
                "entries": lmf_lemmas,
                "notices": quran_notices(True),
                "licences": quran_licences(True),
            },
        },
        {
            "table": LANE,
            "format": "tei",
            "data": l_tei,
            "rows": len(lane),
            "expect": {
                "entries": {f"lane.{x['id']}": {"root": x["headword"], "parent": None} for x in lane},
                **lane_common,
            },
        },
        {
            "table": LANE,
            "format": "lmf",
            "data": l_lmf,
            "rows": len(lane),
            "expect": {
                "entries": {f"lane.{x['id']}": {"lemma": x["headword"], "parent": None} for x in lane},
                **lane_common,
            },
        },
    ]


def build(**data: Any) -> list[dict[str, Any]]:
    """The four XML files, each checked (any failure stops the release): [{table, format, path, data, rows}]."""
    out = []
    for f in prepare(**data):
        path = path_of(f["table"], f["format"])
        validate(path, f["data"], f["format"], **f["expect"])
        out.append(
            {"table": f["table"], "format": f["format"], "path": path, "data": f["data"], "rows": f["rows"]}
        )
    return out


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if args == ["fetch-jing"]:
        print(json.dumps({"jing": str(fetch_jing())}))
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
