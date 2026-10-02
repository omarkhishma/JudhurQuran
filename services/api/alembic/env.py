"""Alembic environment: migrations are hand-written SQL (DDL stays reviewable)."""

from __future__ import annotations

from alembic import context
from judhur_api.settings import get_settings
from sqlalchemy import create_engine


def run_migrations_online() -> None:
    engine = create_engine(get_settings().database_url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=None, version_table_schema="public")
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
