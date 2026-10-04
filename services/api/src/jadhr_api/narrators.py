"""The narrators (PLAN P11.2b): Ibn Ḥajar's entry for each, verbatim, with what is read from his words and the definition
his introduction gives of it; the hadith each is linked to, every link automatic until the board reviews it.

A narrator's teachers and students are those the linked chains show next to him — who he narrates from, who narrates
from him in these seven books — counted, not a biography of ours."""

from __future__ import annotations

from typing import Any

from jadhr_arabic import normalize
from sqlalchemy import Connection

from .db import one, rows

# the sigla Ibn Ḥajar's introduction lists, each with the book it names (jadhr_pipeline.ecosystem.taqrib.SIGLA)
SIGLA = {
    "خ": "صحيح البخاري",
    "خت": "صحيح البخاري، تعليقا",
    "بخ": "الأدب المفرد للبخاري",
    "عخ": "خلق أفعال العباد للبخاري",
    "ر": "جزء القراءة للبخاري",
    "ي": "رفع اليدين للبخاري",
    "م": "صحيح مسلم",
    "د": "سنن أبي داود",
    "مد": "المراسيل لأبي داود",
    "صد": "فضائل الأنصار لأبي داود",
    "خد": "الناسخ لأبي داود",
    "قد": "القدر لأبي داود",
    "ف": "التفرد لأبي داود",
    "ل": "المسائل لأبي داود",
    "كد": "مسند مالك لأبي داود",
    "ت": "جامع الترمذي",
    "تم": "الشمائل للترمذي",
    "س": "سنن النسائي",
    "عس": "مسند علي للنسائي",
    "كن": "مسند مالك للنسائي",
    "ق": "سنن ابن ماجه",
    "فق": "التفسير لابن ماجه",
    "ع": "الستة",
    "4": "الأربعة سوى الشيخين",
    "تمييز": "ليست له رواية عندهم؛ ذكر ليتميز عن غيره",
}
_SOURCE = "openiti-taqrib"
_COLS = """n.id, n.number, n.name, n.verdict, n.rank, n.tabaqa, n.tabaqa_rule, n.death_text, n.death_ah,
           n.death_rule, n.sigla"""


def card(r: dict[str, Any]) -> dict[str, Any]:
    """A narrator as a link or a list shows him."""
    return {k: r[k] for k in ("id", "number", "name", "verdict", "rank", "tabaqa", "death_ah")}


def _neighbours(conn: Connection, nid: int, step: int, limit: int) -> list[dict[str, Any]]:
    """Who stands next to him in the linked chains: ``step`` 1 the one after him (whom he narrates from), -1 the one
    before (who narrates from him), with how many records show it."""
    found = rows(
        conn,
        f"""select {_COLS}, count(distinct a.passage_id)::int as records
              from content.narrator_links a
              join content.narrator_links b on b.passage_id = a.passage_id and b.ordinal = a.ordinal + :step
              join content.narrators n on n.id = b.narrator_id
             where a.narrator_id = :id and b.narrator_id <> :id
             group by n.id order by records desc, n.id limit :limit""",
        {"id": nid, "step": step, "limit": limit},
    )
    return [card(r) | {"records": r["records"]} for r in found]


def profile(conn: Connection, nid: int) -> dict[str, Any] | None:
    n = one(conn, f"select {_COLS}, n.text, n.kind from content.narrators n where n.id = :id", {"id": nid})
    if n is None or n["kind"] != "entry":
        return None
    scales = {
        (r["scale"], r["n"]): r["text"]
        for r in rows(conn, "select scale, n, text from content.narrator_scales")
    }
    per_text = rows(
        conn,
        """select t.slug, t.title_ar, t.title_en, count(distinct l.passage_id)::int as records
             from content.narrator_links l join content.passages p on p.id = l.passage_id
             join content.texts t on t.id = p.text_id
            where l.narrator_id = :id group by t.slug, t.title_ar, t.title_en, t.sort_order order by t.sort_order""",
        {"id": nid},
    )
    source = one(
        conn,
        """select id, title_ar, title_en, license, license_url, attribution_ar, attribution_en
             from content.sources where id = :s""",
        {"s": _SOURCE},
    )
    return {
        **{
            k: n[k]
            for k in ("id", "number", "name", "text", "verdict", "rank", "tabaqa", "death_text", "death_ah")
        },
        # what is read from his words, and by which of his rules
        "read": {
            "rank": n["rank"],
            "rank_def": scales.get(("rank", n["rank"])) if n["rank"] else None,
            "tabaqa": n["tabaqa"],
            "tabaqa_rule": n["tabaqa_rule"],
            "tabaqa_def": scales.get(("tabaqa", n["tabaqa"])) if n["tabaqa"] else None,
            "death_ah": n["death_ah"],
            "death_rule": n["death_rule"],
            "death_def": scales.get(("death", 1)) if n["death_rule"] == "century-by-tabaqa" else None,
        },
        "sigla": [{"siglum": s, "book_ar": SIGLA.get(s)} for s in n["sigla"]],
        "records": per_text,
        "narrates_from": _neighbours(conn, nid, 1, 12),
        "narrated_by": _neighbours(conn, nid, -1, 12),
        "source": source,
    }


def hadith(conn: Connection, nid: int, offset: int, limit: int) -> dict[str, Any] | None:
    """The records his name is linked in, in the books' order, with how each link was made."""
    from .texts import hits

    if (
        one(conn, "select 1 as x from content.narrators where id = :id and kind = 'entry'", {"id": nid})
        is None
    ):
        return None
    total = int(
        one(
            conn,
            "select count(distinct passage_id) as n from content.narrator_links where narrator_id = :id",
            {"id": nid},
        )["n"]  # type: ignore[index]
    )
    found = rows(
        conn,
        """select p.uri, min(l.ordinal) as ordinal, max(l.confidence) as confidence, min(l.rule) as rule
             from content.narrator_links l join content.passages p on p.id = l.passage_id
            where l.narrator_id = :id group by p.id, p.uri order by p.id offset :o limit :l""",
        {"id": nid, "o": offset, "l": limit},
    )
    by_uri = hits(conn, [r["uri"] for r in found])
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "data": [
            by_uri[r["uri"]] | {"link": {"rule": r["rule"], "confidence": r["confidence"], "status": "auto"}}
            for r in found
            if r["uri"] in by_uri
        ],
    }


def search(conn: Connection, q: str, limit: int) -> list[dict[str, Any]]:
    """Narrators by name: the names that begin with the words typed first, then those that hold them, the most linked
    first."""
    key = normalize(q).strip()
    if not key:
        return []
    found = rows(
        conn,
        f"""select {_COLS}, (n.name_norm like :prefix) as starts,
                  (select count(*) from content.narrator_links l where l.narrator_id = n.id)::int as links
             from content.narrators n
            where n.kind = 'entry' and n.name_norm like :inside
            order by starts desc, links desc, n.number limit :limit""",
        {"prefix": key + "%", "inside": "%" + key + "%", "limit": limit},
    )
    return [card(r) | {"links": r["links"]} for r in found]
