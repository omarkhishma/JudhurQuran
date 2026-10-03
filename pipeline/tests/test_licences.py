"""Licence register: every source the registries name has an entry in data/licences.yaml, and every
entry quotes the terms it rests on (PLAN P1.8). A source added to a registry without its licence entry fails.

Also runnable on its own: `uv run python pipeline/tests/test_licences.py [path/to/licences.yaml]`.
"""

from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path
from typing import Any

import yaml

REPO = Path(__file__).resolve().parents[2]
REGISTER = REPO / "data/licences.yaml"
TOPICS = {"display", "attribution", "modification", "redistribution", "commercial", "retention", "other"}
STATUSES = {"ok", "attention", "conflict"}
# The two upstreams data/recitations.yaml names in audio_url and timings_zip rather than as ids.
UPSTREAMS = {"everyayah", "quran-align"}
SHA256 = re.compile(r"^[0-9a-f]{64}$")


def _yaml(path: Path) -> Any:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def registry_ids() -> set[str]:
    ids = {s["id"] for s in _yaml(REPO / "data/sources.yaml")["sources"]}
    ids |= {w["id"] for w in _yaml(REPO / "data/lexica.yaml")["works"]}
    ids |= {w["id"] for w in _yaml(REPO / "data/gharib.yaml")["works"]}
    ids |= {w["id"] for w in _yaml(REPO / "data/works.yaml")["works"]}
    ids |= {r["id"] for r in _yaml(REPO / "data/recitations.yaml")["reciters"]}
    ids |= {s["id"] for s in _yaml(REPO / "data/patterns.yaml")["sources"]}
    ids |= {s["id"] for s in _yaml(REPO / "data/particles.yaml")["sources"]}
    ids |= {s["id"] for s in _yaml(REPO / "data/relations.yaml")["sources"]}
    ids |= {s["id"] for s in _yaml(REPO / "data/knowledge.yaml")["sources"]}  # evaluation-only ones too
    return ids


def coverage_errors(entries: list[dict[str, Any]]) -> list[str]:
    ids = [str(e.get("id")) for e in entries]
    errors = [f"duplicate entry: {i}" for i in sorted({i for i in ids if ids.count(i) > 1})]
    expected = registry_ids()
    errors += [f"no licence entry for registry id: {i}" for i in sorted(expected - set(ids))]
    errors += [f"entry for an id no registry names: {i}" for i in sorted(set(ids) - expected - UPSTREAMS)]
    errors += [f"no licence entry for upstream: {i}" for i in sorted(UPSTREAMS - set(ids))]
    return errors


def entry_errors(e: dict[str, Any]) -> list[str]:
    who = e.get("id", "?")
    errs: list[str] = []
    urls = e.get("urls_checked") or []
    if not urls or not all(isinstance(u, str) and u.startswith(("http://", "https://")) for u in urls):
        errs.append(f"{who}: urls_checked must be a non-empty list of URLs")
    try:
        date.fromisoformat(str(e.get("fetched")))
    except ValueError:
        errs.append(f"{who}: fetched is not an ISO date: {e.get('fetched')!r}")
    sha = e.get("page_sha256") or {}
    if not sha:
        errs.append(f"{who}: page_sha256 is empty")
    for u, h in sha.items():
        if u not in urls or not SHA256.match(str(h)):
            errs.append(f"{who}: page_sha256 {u!r} must be a checked URL with a 64-hex sha256")
    for f in e.get("fetch_failures") or []:
        if f.get("url") not in urls or not f.get("result"):
            errs.append(f"{who}: fetch_failures entries need a checked url and a result")
    clauses = e.get("clauses") or []
    if not clauses:
        errs.append(f"{who}: no clauses")
    for i, c in enumerate(clauses):
        if c.get("topic") not in TOPICS:
            errs.append(f"{who}: clause {i} topic {c.get('topic')!r} not in {sorted(TOPICS)}")
        if not isinstance(c.get("quote"), str) or not c["quote"].strip():
            errs.append(f"{who}: clause {i} has an empty quote")
        if not isinstance(c.get("url"), str) or c["url"] not in urls:
            errs.append(f"{who}: clause {i} url must be one of urls_checked: {c.get('url')!r}")
    if not isinstance(e.get("our_use"), str) or not e["our_use"].strip():
        errs.append(f"{who}: our_use is empty")
    if e.get("status") not in STATUSES:
        errs.append(f"{who}: status {e.get('status')!r} not in {sorted(STATUSES)}")
    notes = e.get("notes") or []
    if not notes or not all(isinstance(n, str) and n.strip() and "\n" not in n for n in notes):
        errs.append(f"{who}: notes must be non-empty, one line each")
    return errs


def check(path: Path = REGISTER) -> list[str]:
    entries = _yaml(path)["licences"]
    errors = coverage_errors(entries)
    for e in entries:
        errors += entry_errors(e)
    return errors


def test_every_registry_source_has_a_licence_entry() -> None:
    assert coverage_errors(_yaml(REGISTER)["licences"]) == []


def test_every_entry_quotes_its_terms() -> None:
    assert [err for e in _yaml(REGISTER)["licences"] for err in entry_errors(e)] == []


def test_a_missing_entry_and_an_empty_quote_fail(tmp_path: Path) -> None:
    entries = _yaml(REGISTER)["licences"]
    broken = [e for e in entries if e["id"] != "qac"]
    broken[0] = {**broken[0], "clauses": [{**broken[0]["clauses"][0], "quote": "  "}]}
    path = tmp_path / "licences.yaml"
    path.write_text(yaml.safe_dump({"licences": broken}, allow_unicode=True), encoding="utf-8")
    errors = check(path)
    assert "no licence entry for registry id: qac" in errors
    assert any("empty quote" in err for err in errors)


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else REGISTER
    problems = check(target)
    for p in problems:
        print("FAIL", p)
    if problems:
        sys.exit(1)
    entries = _yaml(target)["licences"]
    counts = {s: sum(e["status"] == s for e in entries) for s in sorted(STATUSES)}
    print(
        f"entries={len(entries)} registry_ids={len(registry_ids())} clauses={sum(len(e['clauses']) for e in entries)} {counts}"
    )
    print("LICENCE-REGISTER-OK")
