"""Sets a reader or a teacher makes (B29): the curated sets' rules evaluated here give back the build's items word for
word; a sūra's set is counted in the sūra; a rule is one kind with values the data holds. Expected values come from the
database and data/collections.yaml, never typed in."""

from __future__ import annotations

from pathlib import Path

import yaml
from fastapi.testclient import TestClient
from jadhr_api import sets
from jadhr_api.db import connect, rows, scalar
from jadhr_api.main import app

client = TestClient(app)
REPO = Path(__file__).resolve().parents[3]


def evaluate(rule: dict) -> dict:
    r = client.post("/api/v1/sets/evaluate", json={"rule": rule})
    assert r.status_code == 200, r.text
    assert r.headers["cache-control"] == "no-store"
    return r.json()


def test_the_curated_sets_rules_give_back_their_built_items() -> None:
    with connect() as conn:
        built = rows(conn, "select id, rule, item_count from content.collections order by ordinal")
        members = {
            s["id"]: [
                r["slug"]
                for r in rows(
                    conn,
                    """select l.slug from content.collection_items ci join content.lemmas l on l.id = ci.lemma_id
                        where ci.collection_id = :c order by ci.ordinal""",
                    {"c": s["id"]},
                )
            ]
            for s in built
        }
    assert len(built) >= 6
    for s in built:
        got = evaluate({**s["rule"], "limit": s["item_count"]})
        assert [x["slug"] for x in got["items"]] == members[s["id"]], s["id"]


def test_a_name_of_god_is_kept_out_of_a_loanwords_set_as_the_curated_one_keeps_it() -> None:
    reg = yaml.safe_load((REPO / "data/collections.yaml").read_text(encoding="utf-8"))
    excluded = sorted(
        {x for c in reg["collections"] if c["rule"].get("loanwords") for x in c.get("exclude", [])}
    )
    assert sorted(sets.NOT_CASUALLY_FOREIGN) == excluded
    every = evaluate({"loanwords": True})
    assert not {x["slug"] for x in every["items"]} & set(excluded)
    with connect() as conn:
        claimed = scalar(
            conn,
            """select count(distinct l.id) from content.loanword_links x join content.lemmas l on l.id = x.lemma_id
                where x.kind = 'lemma' and x.scope = 'lemma' and l.slug <> all(:e)""",
            {"e": excluded},
        )
    assert every["item_count"] == min(claimed, sets.LIMIT_MAX)


def test_a_suras_set_is_counted_in_the_sura() -> None:
    got = evaluate({"frequent": True, "surah": 36, "limit": 10})
    with connect() as conn:
        scope = scalar(conn, "select count(*) from content.words where surah = 36")
        counts = {
            r["slug"]: r["n"]
            for r in rows(
                conn,
                """select l.slug, count(*)::int as n from content.words w join content.lemmas l on l.id = w.lemma_id
                    where w.surah = 36 group by l.slug""",
            )
        }
    assert got["scope_words"] == scope and got["item_count"] == 10
    assert [x["in_surah"] for x in got["items"]] == [counts[x["slug"]] for x in got["items"]]
    assert [x["in_surah"] for x in got["items"]] == sorted(
        (x["in_surah"] for x in got["items"]), reverse=True
    )
    assert got["occurrences"] == sum(x["in_surah"] for x in got["items"])
    assert got["coverage"] == round(got["occurrences"] / scope, 4)
    # each word's first place is in the sūra
    assert all(x["first"]["verse_key"].startswith("36:") for x in got["items"])


def test_a_roots_set_holds_every_word_of_its_roots() -> None:
    got = evaluate({"root": ["علم", "ك ت ب"]})
    with connect() as conn:
        expected = scalar(
            conn,
            "select count(*) from content.lemmas l join content.roots r on r.id = l.root_id where r.key in ('علم', 'كتب')",
        )
    assert got["item_count"] == expected and got["root_count"] == 2
    assert got["rule"] == {"root": ["علم", "كتب"]}


def test_a_rule_is_one_kind_with_values_the_data_holds() -> None:
    for rule, code in (
        ({"root": ["علم"], "frequent": True}, "rule_kind"),
        ({}, "rule_kind"),
        ({"root": ["ققق"]}, "unknown_root"),
        ({"patterns": ["no-such"]}, "unknown_pattern"),
        ({"patterns": ["faa3il"], "pos": ["P"]}, "rule_pos"),
        ({"frequent": True, "surah": 115}, "rule_surah"),
        ({"frequent": True, "limit": 101}, "rule_limit"),
        ({"root": ["علم"] * 31}, "rule_roots"),
    ):
        r = client.post("/api/v1/sets/evaluate", json={"rule": rule})
        assert r.status_code == 422 and r.json()["error"]["code"] == code, (rule, r.text)
