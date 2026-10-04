"""The lexicon as TEI Lex-0 and LMF (research 19): a small slice of the release builds valid files, and every check —
Jing, lxml, and ours — stops a file that breaks what it guards."""

from __future__ import annotations

import json
import unicodedata
from pathlib import Path
from typing import Any

import pytest
from jadhr_pipeline import lexicon_xml as L
from jadhr_pipeline.release import QAC_COPYRIGHT, REPO

BUILD = REPO / "data/build/2026.10.0"


def _rows(name: str) -> list[dict[str, Any]]:
    with (BUILD / name).open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


@pytest.fixture(scope="module")
def data() -> dict[str, Any]:
    """Three roots with all their lemmas, two lemmas without a root, the words that attest them, and three of Lane's
    articles — one linked to a root of the slice, one to none."""
    roots_all, lemmas_all = _rows("roots.jsonl"), _rows("lemmas.jsonl")
    keys = {"رحم", "سمو", "كتب"}
    roots = [r for r in roots_all if r["key"] in keys]
    ids = {r["id"] for r in roots}
    lemmas = [x for x in lemmas_all if x["root_id"] in ids]
    lemmas += [x for x in lemmas_all if x["root_id"] is None][:2]
    # one lemma whose stored form is not NFC: the files must carry it as it is
    assert any(not unicodedata.is_normalized("NFC", x["ar"]) for x in lemmas)
    keys_bw = {x["key"] for x in lemmas}
    words = [w for w in _rows("words.jsonl") if any(g.get("lemma") in keys_bw for g in w["segments"])]
    lane_all = [x for x in _rows("lexicon_entries.jsonl") if x["work_id"] == "lane"]
    lane = L.lane_rows(
        [next(x for x in lane_all if x["root_key"] == "رحم" and x["displayable"]), *lane_all[:2]]
    )
    work = next(w for w in _rows("lexicon_works.jsonl") if w["id"] == "lane")
    return {
        "lemmas": lemmas,
        "roots": roots,
        "words": words,
        "lane": lane,
        "lane_work": work,
        "version": "2026.10.0",
    }


@pytest.fixture(scope="module")
def files(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {L.path_of(f["table"], f["format"]): f for f in L.prepare(**data)}


def test_the_slice_builds_four_valid_files_the_same_each_time(
    data: dict[str, Any], files: dict[str, dict[str, Any]]
) -> None:
    built = L.build(**data)
    assert [f["path"] for f in built] == [
        "lexicon_quran.tei.xml",
        "lexicon_quran.lmf.xml",
        "lexicon_lane.tei.xml",
        "lexicon_lane.lmf.xml",
    ]
    assert all(f["data"] == files[f["path"]]["data"] for f in built)
    q = files["lexicon_quran.tei.xml"]["data"].decode()
    assert q.startswith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<?xml-model href="https://lex-0.org/releases/v0.9.5/'
    )
    assert '<TEI xmlns="http://www.tei-c.org/ns/1.0" type="lex-0"' in q and "ns0:" not in q
    assert '<entry type="wordFamily" xml:id="root.رحم"' in q and '<date when="2026-10">' in q
    # the stored form, never normalised
    odd = next(x["ar"] for x in data["lemmas"] if not unicodedata.is_normalized("NFC", x["ar"]))
    assert f"<orth>{odd}</orth>" in q and f"<orth>{unicodedata.normalize('NFC', odd)}</orth>" not in q
    lane = files["lexicon_lane.tei.xml"]["data"].decode()
    assert (
        'target="lexicon_quran.tei.xml#root.رحم"' in lane
        and "You offer Perseus any modifications you make." in lane
    )
    lmf = files["lexicon_quran.lmf.xml"]["data"].decode()
    assert (
        '<teiCorpus xmlns="http://www.tei-c.org/ns/1.0" type="lexicalResource"' in lmf
        and '<form type="inflected" n="' in lmf
    )
    assert QAC_COPYRIGHT.splitlines()[-1] in q and QAC_COPYRIGHT.splitlines()[-1] in lmf


def _broken(f: dict[str, Any], old: str, new: str, count: int = 1) -> bytes:
    text = f["data"].decode()
    assert text.count(old) >= count, (old, text.count(old))
    return text.replace(old, new, count).encode()


def test_jing_and_lxml_refuse_what_the_schemas_refuse(files: dict[str, dict[str, Any]]) -> None:
    tei = files["lexicon_quran.tei.xml"]
    untyped = _broken(tei, '<entry type="mainEntry" ', "<entry ")
    assert any("missing required attribute" in e for e in L.jing_errors(untyped, L.LEX0))
    # 0.9.4 left this to its Schematron, which lxml cannot run: our port of the rule catches it
    assert L.lxml_errors(untyped, L.LEX0_LXML) == []
    assert "a nested entry without a type" in L.own_errors(untyped, **tei["expect"])
    no_lang = _broken(tei, ' xml:lang="ar" n="', ' n="')
    assert L.jing_errors(no_lang, L.LEX0) and L.lxml_errors(no_lang, L.LEX0_LXML)
    closed = _broken(files["lexicon_lane.tei.xml"], '<xr type="related"', '<xr type="sameRoot"')
    assert L.jing_errors(closed, L.LEX0) and L.lxml_errors(closed, L.LEX0_LXML)
    assert L.jing_errors(tei["data"], L.LEX0) == [] and L.lxml_errors(tei["data"], L.LEX0_LXML) == []
    lmf = files["lexicon_quran.lmf.xml"]
    assert L.lxml_errors(_broken(lmf, '<TEI type="lexicon"', '<TEI type="lex-0"'), L.LMF)
    assert L.lxml_errors(lmf["data"], L.LMF) == []


CASES = [
    # (file, old, new, the error our check gives)
    ("lexicon_quran.tei.xml", 'source="#src.qac"', 'source="#src.qacx"', "unresolved #src.qacx"),
    ("lexicon_quran.tei.xml", 'xml:lang="ar"', 'xml:lang="qqq"', "language tag 'qqq'"),
    (
        "lexicon_quran.tei.xml",
        "<orth>رحم</orth>",
        "<orth>رحمه</orth>",
        "root.رحم: its root form is not the release's",
    ),
    ("lexicon_quran.tei.xml", 'xml:id="lemma.', 'xml:id="lemmax.', "entries:"),
    (
        "lexicon_quran.tei.xml",
        "</gramGrp>",
        '</gramGrp><gramGrp><gram type="pos">noun</gram></gramGrp>',
        "two gramGrp",
    ),
    (
        "lexicon_quran.tei.xml",
        "CHANGING IT IS NOT ALLOWED",
        "CHANGING IT IS ALLOWED",
        "notice missing or altered",
    ),
    (
        "lexicon_quran.tei.xml",
        '<licence target="https://creativecommons.org/licenses/by-sa/4.0/">',
        '<licence target="https://creativecommons.org/licenses/by/4.0/">',
        "the licences are not the release's",
    ),
    (
        "lexicon_quran.lmf.xml",
        '<form type="inflected" n="',
        '<form type="inflected" n="9',
        "its word forms are not the release's",
    ),
    (
        "lexicon_quran.lmf.xml",
        '<gram type="case">NOM</gram>',
        '<gram type="case">ACC</gram>',
        "its word forms are not the release's",
    ),
    (
        "lexicon_lane.tei.xml",
        "You leave this availability statement intact.",
        "You leave this statement intact.",
        "Perseus's availability statement is not intact",
    ),
    (
        "lexicon_lane.tei.xml",
        "lexicon_quran.tei.xml#root.رحم",
        "lexicon_quran.tei.xml#root.رحمم",
        "unresolved lexicon_quran.tei.xml#root.رحمم",
    ),
    ("lexicon_lane.lmf.xml", '<entry xml:id="lane.', '<entry xml:id="lanes.', "entries:"),
]


@pytest.mark.parametrize(("name", "old", "new", "error"), CASES, ids=[f"{c[0]}:{c[3][:30]}" for c in CASES])
def test_our_checks_refuse_what_no_schema_sees(
    files: dict[str, dict[str, Any]], name: str, old: str, new: str, error: str
) -> None:
    f = files[name]
    assert L.own_errors(f["data"], **f["expect"]) == []
    errors = L.own_errors(_broken(f, old, new), **f["expect"])
    assert any(error in e for e in errors), errors


def test_a_form_normalised_to_nfc_is_refused(data: dict[str, Any], files: dict[str, dict[str, Any]]) -> None:
    f = files["lexicon_quran.tei.xml"]
    x = next(x for x in data["lemmas"] if not unicodedata.is_normalized("NFC", x["ar"]))
    errors = L.own_errors(
        _broken(f, f"<orth>{x['ar']}</orth>", f"<orth>{unicodedata.normalize('NFC', x['ar'])}</orth>"),
        **f["expect"],
    )
    assert f"lemma.{x['slug']}: its lemma form is not the release's" in errors


def test_a_lemma_out_of_its_family_is_refused(data: dict[str, Any], files: dict[str, dict[str, Any]]) -> None:
    from lxml import etree

    f = files["lexicon_quran.tei.xml"]
    doc = etree.fromstring(f["data"])
    nested = next(
        e
        for e in doc.iter(f"{{{L.TEI}}}entry")
        if e.get("type") == "mainEntry" and e.getparent().tag == f"{{{L.TEI}}}entry"
    )
    body = nested.getparent().getparent()
    body.append(nested)
    errors = L.own_errors(etree.tostring(doc, encoding="UTF-8"), **f["expect"])
    assert any(e.endswith("not in its place") for e in errors), errors


def test_validate_stops_the_release_and_its_tools_are_pinned(
    files: dict[str, dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    f = files["lexicon_quran.tei.xml"]
    L.validate("ok.xml", f["data"], "tei", **f["expect"])
    with pytest.raises(RuntimeError, match=r"bad\.xml fails its checks"):
        L.validate("bad.xml", _broken(f, 'xml:lang="ar"', 'xml:lang="qqq"'), "tei", **f["expect"])
    # an id used twice is refused by the parser before any check
    with pytest.raises(Exception, match="already defined"):
        L.validate("dup.xml", _broken(f, 'xml:id="root.رحم"', 'xml:id="root.سمو"'), "tei", **f["expect"])
    monkeypatch.setattr(L, "JING_SHA", "0" * 64)
    with pytest.raises(RuntimeError, match="not the pinned Jing"):
        L.jing_errors(f["data"], L.LEX0)
    monkeypatch.undo()
    monkeypatch.setattr(L.shutil, "which", lambda _: None)
    with pytest.raises(RuntimeError, match="Java is needed"):
        L.jing_errors(f["data"], L.LEX0)
    monkeypatch.undo()
    monkeypatch.setitem(L.SCHEMA_SHA, L.LMF.name, "0" * 64)
    with pytest.raises(RuntimeError, match="not the pinned schema"):
        L.validate(
            "x.xml", files["lexicon_quran.lmf.xml"]["data"], "lmf", **files["lexicon_quran.lmf.xml"]["expect"]
        )


def test_perseus_statement_is_carried_as_perseus_wrote_it() -> None:
    raw = L.perseus_xml()
    assert raw.startswith('<availability status="free">') and raw.endswith("</availability>")
    assert (
        "You leave this availability statement intact." in raw
        and "You offer Perseus any modifications you make." in raw
    )
    p = L.perseus_statement()
    assert L._words(p) == L._words(L._raw_statement()) and L._shape(p) == [
        "list",
        "item",
        "quote",
        "item",
        "item",
    ]


def test_word_forms_count_each_stem_under_its_own_lemma(data: dict[str, Any]) -> None:
    forms = L.word_forms(data["words"], data["lemmas"])
    ism = next(x for x in data["lemmas"] if x["slug"] == "ism")
    assert sum(n for _, _, n in forms[ism["id"]]) == ism["occurrences"]
    assert all(k in (*L.INFLECTION, "state") for fs in forms.values() for _, feats, _ in fs for k, _ in feats)


def test_the_jing_helper_extracts_only_the_jars(tmp_path: Path) -> None:
    jar = L._jing()
    assert jar.is_file() and jar.name == "jing.jar"
    assert not (jar.parents[1] / "doc").exists() and not (jar.parents[1] / "src.zip").exists()
