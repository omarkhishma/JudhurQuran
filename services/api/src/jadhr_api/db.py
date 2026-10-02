"""Database access: one pooled engine, plain parameterised SQL (no string interpolation of input)."""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from functools import lru_cache
from typing import Any

from sqlalchemy import Connection, Engine, create_engine, text

from .settings import get_settings


@lru_cache
def engine() -> Engine:
    return create_engine(
        get_settings().database_url,
        pool_size=10,
        max_overflow=10,
        pool_pre_ping=True,
        connect_args={"options": "-c statement_timeout=5000 -c default_transaction_read_only=on"},
    )


@contextmanager
def connect() -> Iterator[Connection]:
    with engine().connect() as conn:
        yield conn


def rows(conn: Connection, sql: str, params: Mapping[str, Any] | None = None) -> list[dict[str, Any]]:
    return [dict(r._mapping) for r in conn.execute(text(sql), params or {})]


def one(conn: Connection, sql: str, params: Mapping[str, Any] | None = None) -> dict[str, Any] | None:
    r = conn.execute(text(sql), params or {}).first()
    return dict(r._mapping) if r is not None else None


def scalar(conn: Connection, sql: str, params: Mapping[str, Any] | None = None) -> Any:
    return conn.execute(text(sql), params or {}).scalar()
