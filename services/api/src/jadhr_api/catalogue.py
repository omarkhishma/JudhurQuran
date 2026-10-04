"""The catalogue (PLAN P11.3a): the works the D9 gate lets in, as OpenITI's metadata gives them, found by title and
author and browsed by the Hijri century their authors died in; each with where its text is read — our reader for a
book of the shelf, OpenITI's release for every one, shamela.ws and turath where its id is Shamela's (the same number
on both, research 21 §4.1). Century 0 is OpenITI's «0001»: the poets before Islam."""

from __future__ import annotations

from typing import Any

from jadhr_arabic import normalize
from sqlalchemy import Connection

from .db import one, rows

RELEASE = "https://github.com/OpenITI/RELEASE/tree/v2025.1.9/data"
_COLS = """id, version, work, author_uri, death_ah, before_islam, era_year, title_ar, title_lat, author_ar, author_lat,
           words, subjects, categories, library, library_id, shamela_id, shelf"""
# a death year's century: 0 for the poets before Islam
_CENTURY = "case when before_islam then 0 else (death_ah - 1) / 100 + 1 end"


def _links(w: dict[str, Any]) -> dict[str, str]:
    out = {"openiti": f"{RELEASE}/{w['author_uri']}/{w['work']}"}
    if w["shamela_id"]:
        out["shamela"] = f"https://shamela.ws/book/{w['shamela_id']}"
        out["turath"] = f"https://app.turath.io/book/{w['shamela_id']}"
    return out


def catalogue(
    conn: Connection, q: str | None, century: int | None, shelf: bool, offset: int, limit: int
) -> dict[str, Any]:
    """A page of the catalogue in the order the authors died, with the total and how many works each century holds
    under the same words (the century filter's counts)."""
    where, params = ["true"], {}
    if q and normalize(q).strip():
        where.append("norm like :p")
        params["p"] = "%" + normalize(q).replace("%", "").replace("_", "").strip() + "%"
    if shelf:
        where.append("shelf is not null")
    by_words = " and ".join(where)
    if century is not None:
        where.append(f"{_CENTURY} = :c")
        params["c"] = century
    cond = " and ".join(where)
    found = rows(
        conn,
        f"select {_COLS} from content.catalogue_works where {cond} order by death_ah, id limit :l offset :o",
        {**params, "l": limit, "o": offset},
    )
    for w in found:
        w["links"] = _links(w)
    total = int(one(conn, f"select count(*) as n from content.catalogue_works where {cond}", params)["n"])  # type: ignore[index]
    centuries = rows(
        conn,
        f"""select {_CENTURY} as century, count(*)::int as n from content.catalogue_works where {by_words}
             group by 1 order by 1""",
        params,
    )
    source = one(
        conn,
        """select id, title_ar, title_en, version, url, license, license_ar, license_url, attribution_ar,
                  attribution_en from content.sources where id = 'openiti-catalogue'""",
    )
    return {
        "data": found,
        "total": total,
        "offset": offset,
        "limit": limit,
        "centuries": centuries,
        "all": int(one(conn, "select count(*) as n from content.catalogue_works")["n"]),  # type: ignore[index]
        "source": source,
    }
