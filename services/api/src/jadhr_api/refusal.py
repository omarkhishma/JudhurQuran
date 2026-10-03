"""A refusal the reader is told in their own language (audit 12 F19): the API's English message for developers,
and beside it a stable code the web maps to its own copy."""

from __future__ import annotations

from fastapi import HTTPException


class Refusal(HTTPException):
    def __init__(self, status_code: int, code: str, detail: str) -> None:
        super().__init__(status_code=status_code, detail=detail)
        self.code = code
