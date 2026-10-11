"""Questions in natural language (P18, D35): the question bank read and scored — every reading a person would give
it, its accuracy stated and held to a floor — and the answers checked against the tables by SQL of the test's own;
the reading taken back as given; nothing answered that the data does not hold.

The example questions are read by the embedding model, run here in this process (as in test_semantic_api.py).
"""

from __future__ import annotations

import os
from collections import Counter
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from jadhr_api import ask, semantic
from jadhr_api.db import connect, rows
from jadhr_api.main import app
from jadhr_embed.models import chosen, folder

client = TestClient(app)
BANK = yaml.safe_load((Path(__file__).parent / "data/ask_bank.yaml").read_text(encoding="utf-8"))["questions"]
HAVE_MODEL = all((folder(chosen()) / rel).exists() for rel in chosen().files)
needs_model = pytest.mark.skipif(
    not HAVE_MODEL and os.environ.get("JADHR_REQUIRE_DATA") != "1",
    reason="the chosen model's files are not here (uv run python -m jadhr_embed fetch)",
)


@pytest.fixture(scope="module")
def local_embed():
    from jadhr_embed.encoder import Encoder

    enc = Encoder.load()
    return lambda text: (enc.encode([text[:2000]], "query")[0], enc.spec.tag)


@pytest.fixture
def embedded(monkeypatch, local_embed):
    monkeypatch.setattr(semantic, "embed", local_embed)


def q(sql: str, **params: object) -> list[dict]:
    with connect() as conn:
        return rows(conn, sql, params)


def _ident(t: dict | None) -> str | None:
    s = (t or {}).get("subject")
    return None if not s else s.get("slug") or s.get("key")


def _right(u: dict, want: dict) -> bool:
    if u["intent"] != want["intent"]:
        return False
    if want["intent"] == "theme":
        return True
    for k in ("a", "b"):
        if k in want and _ident(u[k]) != want[k]:
            return False
    return all(u[k] == want[k] for k in ("surah", "place", "focus") if k in want)


@needs_model
def test_the_question_bank_is_read_as_a_person_would_read_it(embedded, capsys) -> None:
    """D35's measure: the share of the bank read right — intent, terms, sūra, place — overall and by intent."""
    misses, by = [], Counter()
    with connect() as conn:
        for want in BANK:
            u = ask.understood(ask.read(conn, want["q"]))
            ok = _right(u, want)
            by[(want["intent"], ok)] += 1
            if not ok:
                misses.append(
                    (
                        want["q"],
                        want,
                        u["intent"],
                        _ident(u["a"]),
                        _ident(u["b"]),
                        u["surah"],
                        u["place"],
                        u["focus"],
                    )
                )
    right = len(BANK) - len(misses)
    with capsys.disabled():
        print(f"\n  question bank: {right}/{len(BANK)} read right ({100 * right / len(BANK):.1f}%)")
        for intent in ask.INTENTS:
            n = by[(intent, True)] + by[(intent, False)]
            if n:
                print(f"    {intent}: {by[(intent, True)]}/{n}")
        for m in misses:
            print("    miss:", m)
    assert len(BANK) >= 150
    assert right / len(BANK) >= 0.9, misses
    for intent in ask.INTENTS:
        n = by[(intent, True)] + by[(intent, False)]
        assert by[(intent, True)] / n >= 0.75, intent


HELDOUT = yaml.safe_load((Path(__file__).parent / "data/ask_heldout.yaml").read_text(encoding="utf-8"))[
    "questions"
]


@needs_model
def test_questions_never_tuned_on_are_read_as_well(embedded, capsys) -> None:
    """The held-out questions, written after the tuning and never tuned on: the reading's measure on the unseen."""
    with connect() as conn:
        misses = [
            (w["q"], ask.understood(ask.read(conn, w["q"])))
            for w in HELDOUT
            if not _right(ask.understood(ask.read(conn, w["q"])), w)
        ]
    right = len(HELDOUT) - len(misses)
    with capsys.disabled():
        print(
            f"\n  held-out questions: {right}/{len(HELDOUT)} read right ({100 * right / len(HELDOUT):.1f}%)"
        )
        for qtext, u in misses:
            print(
                "    miss:",
                qtext,
                "→",
                u["intent"],
                _ident(u["a"]),
                _ident(u["b"]),
                u["surah"],
                u["place"],
                u["focus"],
            )
    assert len(HELDOUT) >= 50 and right / len(HELDOUT) >= 0.8


def test_a_count_is_the_tables_count_with_its_scope_and_its_root_beside_it() -> None:
    d = client.get("/api/v1/ask", params={"q": "كم مرة ذكرت كلمة الرحمة في سورة البقرة"}).json()
    u, a = d["understood"], d["answer"]
    assert u["intent"] == "count" and _ident(u["a"]) == "rahma" and u["surah"] == 2 and u["how"] == "rule"
    want = q(
        """select count(*)::int as n, count(distinct w.verse_id)::int as v from content.words w
             join content.lemmas l on l.id = w.lemma_id where l.slug = 'rahma' and w.surah = 2"""
    )[0]
    assert (a["count"], a["verses"]) == (want["n"], want["v"])
    root = q(
        """select count(*)::int as n from content.words w join content.roots r on r.id = w.root_id
            where r.key = 'رحم' and w.surah = 2"""
    )[0]["n"]
    assert a["root"]["count"] == root and a["counted"]


def test_where_lists_the_surahs_by_their_count_and_the_first_verses() -> None:
    a = client.get("/api/v1/ask", params={"q": "أين ذكر موسى"}).json()["answer"]
    by = q(
        """select w.surah, count(*)::int as n from content.words w join content.lemmas l on l.id = w.lemma_id
            where l.slug = 'musa' group by w.surah order by n desc, w.surah"""
    )
    assert [(s["surah"], s["count"]) for s in a["surahs"]] == [(r["surah"], r["n"]) for r in by]
    assert a["count"] == sum(r["n"] for r in by) and a["surah_count"] == len(by)
    assert a["place"]["meccan"] + a["place"]["medinan"] == a["count"]
    assert len(a["first"]) == 10 and a["first"][0]["key"].startswith("2:")


def test_two_words_compared_and_together_count_their_shared_verses() -> None:
    shared = q(
        """select count(*)::int as n from (select verse_id from content.words w join content.lemmas l on l.id = w.lemma_id
             where l.slug = 'shams' intersect select verse_id from content.words w join content.lemmas l
             on l.id = w.lemma_id where l.slug = 'qamar') x"""
    )[0]["n"]
    c = client.get("/api/v1/ask", params={"q": "قارن بين الشمس والقمر"}).json()["answer"]
    assert c["kind"] == "compare" and c["shared_verses"] == shared
    assert (
        c["counts"]["a"]["n"] == q("select occurrences as n from content.lemmas where slug = 'shams'")[0]["n"]
    )
    t = client.get(
        "/api/v1/ask", params={"intent": "together", "a": "الشمس", "b": "القمر", "limit": 50}
    ).json()
    assert t["understood"]["how"] == "given" and t["answer"]["shared_verses"] == shared == len(
        t["answer"]["verses"]
    )


def test_a_meaning_is_the_gharib_books_words_credited_and_a_root_is_said_absent_when_there_is_none() -> None:
    m = client.get("/api/v1/ask", params={"q": "ما معنى الصمد"}).json()["answer"]
    assert m["kind"] == "meaning" and m["gharib"]
    g = m["gharib"][0]
    stored = q("select meaning_ar from content.gharib_meanings where meaning_ar = :m", m=g["meaning_ar"])
    assert stored and g["title_ar"]
    r = client.get("/api/v1/ask", params={"q": "ما جذر كلمة موسى"}).json()["answer"]
    assert r["kind"] == "root" and r["root"] is None  # a name the corpus gives no root: never a pseudo-root
    r2 = client.get("/api/v1/ask", params={"q": "ما جذر كلمة المستقيم"}).json()["answer"]
    assert r2["root"]["key"] == "قوم" and r2["family"]


def test_a_surah_and_superlatives_are_the_tables_figures() -> None:
    s = client.get("/api/v1/ask", params={"q": "كم آية في سورة الكهف"}).json()["answer"]
    assert s["surah"]["verses"] == q("select verse_count as n from content.surahs where number = 18")[0]["n"]
    longest = client.get("/api/v1/ask", params={"q": "ما أطول سورة"}).json()["answer"]
    assert longest["items"][0]["number"] == 2
    verse = client.get("/api/v1/ask", params={"q": "ما أطول آية"}).json()["answer"]
    top = q(
        """select v.key from content.verses v join content.words w on w.verse_id = v.id group by v.id
            order by count(*) desc, v.id limit 1"""
    )[0]["key"]
    assert verse["items"][0]["key"] == top


@needs_model
def test_a_theme_is_searched_by_meaning_and_by_topic_and_an_unknown_word_falls_back_to_it(embedded) -> None:
    t = client.get("/api/v1/ask", params={"q": "ماذا قال القرآن عن اليتيم"}).json()["answer"]
    assert t["kind"] == "theme" and t["semantic"]["status"] == "ok" and t["semantic"]["items"]
    assert any("يتيم" in x["name"] or "يتام" in x["name"] for x in t["topics"])
    d = client.get("/api/v1/ask", params={"q": "كم مرة ذكرت كلمة زقزقة"}).json()
    assert d["answer"] == {"kind": "unresolved", "missing": "a"} and d["fallback"]["kind"] == "theme"


def test_the_endpoint_asks_for_a_question_or_a_reading() -> None:
    assert client.get("/api/v1/ask").status_code == 422
    assert client.get("/api/v1/ask", params={"intent": "nonsense"}).status_code == 422
    assert client.get("/api/v1/ask", params={"intent": "surah", "surah": 200}).status_code == 422
    d = client.get("/api/v1/ask", params={"intent": "surah", "surah": 112}).json()
    assert d["answer"]["surah"]["number"] == 112 and d["understood"]["how"] == "given"


def test_the_resolver_names_a_word_or_a_root_or_nothing() -> None:
    """`/ask/resolve` (the mind maps' start page): the questions' resolver on its own."""
    got = lambda q: client.get("/api/v1/ask/resolve", params={"q": q}).json()["subject"]  # noqa: E731
    assert got("ر ح م")["key"] == "رحم" and got("ر ح م")["kind"] == "root"
    assert got("الصبر")["slug"] == "sabr"
    assert got("عِلْم")["slug"] == "ilm" and got("عَلِمَ")["slug"] == "alima"
    assert got("mercy")["slug"] == "rahma"
    assert got("زقزقة") is None
    assert client.get("/api/v1/ask/resolve").status_code == 422
