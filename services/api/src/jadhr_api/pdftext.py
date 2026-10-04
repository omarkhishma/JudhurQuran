"""A PDF's text layers read in a process of its own (security review M2): a crafted file can make pypdf decompress
and parse for a long time and in much memory, so the reading runs apart from the API's workers, under a limit of CPU
time and of memory set here before pypdf is imported, and the API kills it at its own deadline.

Run as ``python -m jadhr_api.pdftext <max pages> <cpu seconds> <memory bytes>`` with the file on stdin; writes one
JSON object to stdout: ``{"title", "pages": [raw text per page]}`` or ``{"error": code, "detail"}``."""

from __future__ import annotations

import contextlib
import io
import json
import resource
import sys
from typing import Any


def _limit(cpu: int, memory: int) -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
    # macOS does not enforce an address-space limit; Linux, where the API runs, does
    with contextlib.suppress(ValueError, OSError):
        resource.setrlimit(resource.RLIMIT_AS, (memory, memory))


def read(data: bytes, max_pages: int) -> dict[str, Any]:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            return {"error": "encrypted"}
        count = len(reader.pages)
    except PdfReadError as e:
        return {"error": "not_pdf", "detail": str(e)[:200]}
    if count > max_pages:
        return {"error": "too_many_pages", "detail": str(count)}
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:  # a page pypdf cannot read is a page for OCR, not a failed upload
            pages.append("")
    try:
        title = str((reader.metadata or {}).get("/Title") or "")
    except Exception:
        title = ""
    return {"title": title, "pages": pages}


def main() -> None:
    max_pages, cpu, memory = (int(a) for a in sys.argv[1:4])
    _limit(cpu, memory)
    data = sys.stdin.buffer.read()
    sys.stdout.write(json.dumps(read(data, max_pages), ensure_ascii=False))


if __name__ == "__main__":
    main()
