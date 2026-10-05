"""What we know and what we do not yet (B17): each layer of the data with how much of the text it covers, where its
sources disagree, what waits on review, and what the experts have signed — every number counted from the loaded data
and the board's records when it is asked, none written by hand. A layer the rules derived says so; one the board has
not reviewed says that too."""

from __future__ import annotations

from typing import Any

from sqlalchemy import Connection

from . import topics
from .db import one, rows, scalar


def _n(conn: Connection, sql: str, params: dict[str, Any] | None = None) -> int:
    return int(scalar(conn, sql, params or {}) or 0)


def report(conn: Connection) -> dict[str, Any]:
    words = _n(conn, "select count(*) from content.words")
    verses = _n(conn, "select count(*) from content.verses")
    roots = _n(conn, "select count(*) from content.roots")
    lemmas = _n(conn, "select count(*) from content.lemmas")
    ds = one(conn, "select version, text_sha256 from content.dataset limit 1") or {}
    layers: list[dict[str, Any]] = [
        {
            "id": "text",
            "count": verses,
            "of": verses,
            "how": "source",
            "detail": {"sha256": ds.get("text_sha256")},
        },
        {
            "id": "roots",
            "count": _n(conn, "select count(*) from content.words where root_id is not null"),
            "of": words,
            "how": "source",
            # a word whose root another reading of the corpus gives otherwise: shown with both (L3)
            "disagree": _n(conn, "select count(distinct word_id) from content.root_variants"),
        },
        {
            "id": "patterns",
            "count": _n(conn, "select count(*) from content.lemmas where pattern_id is not null"),
            "of": lemmas,
            "how": "rule",
            "detail": {
                r["method"]: r["n"]
                for r in rows(
                    conn,
                    """select coalesce(pattern_method, 'none') as method, count(*)::int as n from content.lemmas
                        group by 1 order by 2 desc""",
                )
            },
        },
        {
            "id": "gharib",
            "count": _n(
                conn,
                "select count(distinct loc) from content.gharib_meanings, unnest(word_locations) as loc",
            ),
            "of": words,
            "how": "rule",
        },
    ]
    for w in rows(
        conn,
        """select w.id, w.title_ar, w.title_en, count(distinct e.root_key) filter (where r.id is not null)::int as n
             from content.lexicon_works w left join content.lexicon_entries e on e.work_id = w.id
             left join content.roots r on r.key = e.root_key
            group by w.id, w.title_ar, w.title_en, w.sort_order order by w.sort_order""",
    ):
        if w["n"]:
            layers.append(
                {
                    "id": f"lexicon:{w['id']}",
                    "group": "lexica",
                    "title_ar": w["title_ar"],
                    "title_en": w["title_en"],
                    "count": w["n"],
                    "of": roots,
                    "how": "source",
                }
            )
    for w in rows(
        conn,
        "select id, kind, title_ar, title_en, verse_coverage from content.works order by kind, sort_order",
    ):
        layers.append(
            {
                "id": f"work:{w['id']}",
                "group": w["kind"],
                "title_ar": w["title_ar"],
                "title_en": w["title_en"],
                "count": int(w["verse_coverage"] or 0),
                "of": verses,
                "how": "source",
            }
        )
    cov = topics.coverage(conn)
    layers.append(
        {"id": "topics", "count": cov["covered"] + cov["placed"], "of": cov["verses"], "how": "source"}
    )
    hadith = _n(
        conn,
        "select count(*) from content.passages p join content.texts t on t.id = p.text_id where t.kind = 'hadith'",
    )
    layers += [
        {
            "id": "hadith-split",
            "count": _n(
                conn,
                """select count(*) from content.passages p join content.texts t on t.id = p.text_id
                    where t.kind = 'hadith' and p.meta ? 'split'""",
            ),
            "of": hadith,
            "how": "rule",
        },
        {
            "id": "narrators",
            "count": _n(conn, "select count(*) from content.narrator_links where narrator_id is not null"),
            "of": _n(conn, "select count(*) from content.narrator_links"),
            "how": "rule",
        },
        {
            "id": "book-pages",
            "count": _n(
                conn,
                "select count(*) from content.texts where kind = 'book' and info->>'pages_trusted' = 'true'",
            ),
            "of": _n(conn, "select count(*) from content.texts where kind = 'book'"),
            "how": "rule",
        },
    ]
    # what waits on review, what the readers and the board settled, what experts signed
    proposals = {
        r["status"]: r["n"]
        for r in rows(conn, "select status, count(*)::int as n from contributions.proposals group by status")
    }
    board = {
        r["status"]: r["n"]
        for r in rows(conn, "select status, count(*)::int as n from editorial.entries group by status")
    }
    review = {
        "proposals_open": sum(proposals.get(s, 0) for s in ("open", "approved", "changes")),
        "proposals_merged": proposals.get("merged", 0),
        "corrections_in_force": _n(
            conn,
            "select count(*) from contributions.merges where kind = 'correction' and reverted_at is null",
        ),
        "board_in_review": sum(board.get(s, 0) for s in ("draft", "changes", "review")),
        "board_approved": board.get("approved", 0),
        "reports_open": _n(conn, "select count(*) from contributions.reports where resolved_at is null"),
    }
    return {
        "version": ds.get("version"),
        "layers": layers,
        "review": review,
        # an expert's signature on a layer is the board's approval of it (D15): none until the board is named
        "signed": board.get("approved", 0),
    }
