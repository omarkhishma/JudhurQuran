"""Runtime configuration (environment variables, prefix JUDHUR_)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JUDHUR_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://judhur:judhur@localhost:5442/judhur"
    cors_origins: list[str] = ["http://localhost:3000"]
    public_base_url: str = "http://localhost:8000"
    rate_limit_per_minute: int = 600
    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
