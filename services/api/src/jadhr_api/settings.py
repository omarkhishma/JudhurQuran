"""Runtime configuration (environment variables, prefix JADHR_)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JADHR_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://jadhr:jadhr@localhost:5442/jadhr"
    cors_origins: list[str] = ["http://localhost:3210"]
    public_base_url: str = "http://localhost:8000"
    rate_limit_per_minute: int = 600
    # Shared with the web server: its server-side renders send it and are not rate-limited per IP,
    # since every render comes from the one web host. Unset → no request is exempt.
    internal_token: str | None = None
    environment: str = "development"
    # After a release loads, the loader asks the web app to expire its cached pages (apps/web
    # src/app/api/revalidate). Unset → the step is skipped and the loader says so.
    web_revalidate_url: str | None = None
    revalidate_secret: str | None = None
    # OpenSearch (derived index; Postgres is the source of truth). Unset → search falls back to Postgres.
    search_url: str | None = "http://localhost:9201"
    search_timeout: float = 3.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
