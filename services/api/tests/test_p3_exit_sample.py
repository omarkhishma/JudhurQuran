"""The P3.10 exit's sample: 200 words drawn by a seed fixed by the dataset version, 40 from each fifth of the frequency
list; for every one of them every section of the panel is filled or says, by its own field, why it is empty — never a
missing key, a section silently absent or a word that occurs nowhere. The review against the sources is the experts'
(packets: ``python -m jadhr_api.packets``)."""

from __future__ import annotations

from jadhr_api.db import connect
from jadhr_api.packets import opened, sample_slugs, sections


def test_the_sample_is_fixed_and_spread_over_the_frequency_list() -> None:
    with connect() as conn:
        a, b = sample_slugs(conn), sample_slugs(conn)
        assert a == b and len(a) == 200 and len(set(a)) == 200
        ranks = {
            r["slug"]: i
            for i, r in enumerate(
                conn.execute(
                    __import__("sqlalchemy").text(
                        "select slug from content.lemmas order by occurrences desc, slug"
                    )
                ).mappings()
            )
        }
    fifth = len(ranks) // 5
    bands = [min(ranks[s] // fifth, 4) for s in a]
    assert [bands.count(i) for i in range(5)] == [40] * 5


def test_every_section_of_every_sampled_word_is_filled_or_says_why_not() -> None:
    empty_meanings = 0
    with connect() as conn:
        for slug in sample_slugs(conn):
            got = opened(conn, slug)
            assert got is not None, slug
            w, rel = got
            for key in (
                "senses",
                "senses_status",
                "family",
                "shapes",
                "dict_articles",
                "timeline",
                "attestations",
                "next_steps",
            ):
                assert key in w, (slug, key)
            s = sections(w, rel)
            # the word occurs, and the panel says where
            assert s["occurrences"] >= 1, slug
            # Meanings: a sourced line, or the section's "pending" status that the panel says in words
            if not s["meanings"]:
                empty_meanings += 1
                assert w["senses_status"] == "pending", slug
            # a rooted word has its family, itself at least; a word with no root says so (no pseudo-root)
            if w["root"]:
                assert s["family"] >= 1, slug
            else:
                # the word alone in its family: nothing is claimed to share a root with it
                assert [m["slug"] for g in w["family"] for m in g["members"]] == [slug], slug
            # every dictionary shown carries its credit
            for d in w["dict_articles"]:
                assert d["attribution_ar"] and d["attribution_en"] and d["entries"], (slug, d["id"])
            # Where next: a door, or none because there is none to give — no other word of its root, no other place,
            # no pattern — which the panel says in words (rd.noDoors)
            if s["next_steps"] == 0:
                others = [m for g in w["family"] for m in g["members"] if m["slug"] != slug]
                assert not others and s["occurrences"] == 1 and not w["pattern"], slug
    # the honest empties are few: at most one word in ten has no sourced line
    assert empty_meanings <= 20, empty_meanings
